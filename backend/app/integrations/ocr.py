import base64
import json
import logging
import re
import time
from typing import Any

import httpx
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import OcrConfig, get_settings
from app.core.ranges import parse_decimal
from app.errors import AppError
from app.settings.service import get_setting

logger = logging.getLogger(__name__)

_MONTH_RE = re.compile(r"^[0-9]{4}-(0[1-9]|1[0-2])$")
_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)

_OCR_SYSTEM_PROMPT = (
    "Extract calibration certificate fields into strict JSON. Return JSON only, no markdown. "
    "Keys: vendor (string|null), certificate_no (string|null), calibrated_month (YYYY-MM|null), "
    "adjustments (string|null), points (array of objects), confidence (object mapping field "
    "names to 0..1). "
    "For points, return one object per row of the results table with exactly these keys: "
    "point = the text in the 'Wartość odniesienia' column (the reference value, not the "
    "instrument indication); error = 'Błąd pomiaru'; uncertainty = 'Niepewność rozszerzona U'; "
    "unit = 'Jednostka'. Always return point, error, uncertainty and unit as strings, keep the "
    "decimal comma or dot exactly as printed, include every row, and never invent values. "
    "Use null only when a cell is genuinely unreadable."
)


class CalibrationDraftPoint(BaseModel):
    point: str | None = None
    error: str | None = None
    uncertainty: str | None = None
    unit: str | None = None
    warning: str | None = None


class CalibrationDraft(BaseModel):
    vendor: str | None = None
    certificate_no: str | None = None
    calibrated_month: str | None = None
    adjustments: str | None = None
    points: list[CalibrationDraftPoint] = Field(default_factory=list)
    confidence: dict[str, float] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    provider: str
    model: str
    raw_text: str | None = None


def ocr_enabled(db: Session) -> bool:
    return bool(get_setting(db, "ocr_enabled")) and get_settings().ocr_config.is_configured


def _image_data_url(raw: bytes) -> str:
    mime = "image/jpeg" if raw.startswith(b"\xff\xd8\xff") else "image/png"
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _opt_str(val: Any) -> str | None:
    if isinstance(val, str):
        stripped = val.strip()
        return stripped if stripped else None
    return None


def _opt_text(val: Any) -> str | None:
    """Text cell that OCR models sometimes return as a JSON number (for example 0.0)."""
    if isinstance(val, int | float) and not isinstance(val, bool):
        return str(val)
    return _opt_str(val)


def _parse_draft_payload(raw_content: str, *, cfg: OcrConfig) -> CalibrationDraft:
    cleaned = _FENCE_RE.sub("", raw_content.strip()).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise AppError(
            502,
            "OCR_FAILED",
            "Odpowiedź dostawcy OCR nie jest poprawnym obiektem JSON",
        ) from exc
    if not isinstance(parsed, dict):
        raise AppError(502, "OCR_FAILED", "Nieprawidłowa struktura odpowiedzi dostawcy OCR")

    warnings: list[str] = []
    vendor = _opt_str(parsed.get("vendor"))
    certificate_no = _opt_str(parsed.get("certificate_no"))
    adjustments = _opt_str(parsed.get("adjustments"))

    raw_month = _opt_str(parsed.get("calibrated_month"))
    calibrated_month: str | None = None
    if raw_month is not None:
        if _MONTH_RE.match(raw_month):
            calibrated_month = raw_month
        else:
            warnings.append(f"Nieprawidłowy format miesiąca wzorcowania: {raw_month}")

    points: list[CalibrationDraftPoint] = []
    raw_points = parsed.get("points")
    if isinstance(raw_points, list):
        for idx, item in enumerate(raw_points, start=1):
            if not isinstance(item, dict):
                continue
            pt_warnings: list[str] = []
            pt_label = _opt_text(item.get("point"))
            pt_unit = _opt_text(item.get("unit"))

            err_out: str | None = None
            raw_err = item.get("error")
            if raw_err is not None and str(raw_err).strip() != "":
                try:
                    err_out = format(parse_decimal(str(raw_err)), "f")
                except ValueError:
                    msg = f"Punkt {idx}: nie udało się odczytać błędu pomiaru ({raw_err})"
                    warnings.append(msg)
                    pt_warnings.append(msg)

            unc_out: str | None = None
            raw_unc = item.get("uncertainty")
            if raw_unc is not None and str(raw_unc).strip() != "":
                try:
                    unc_out = format(parse_decimal(str(raw_unc)), "f")
                except ValueError:
                    msg = f"Punkt {idx}: nie udało się odczytać niepewności ({raw_unc})"
                    warnings.append(msg)
                    pt_warnings.append(msg)

            points.append(
                CalibrationDraftPoint(
                    point=pt_label,
                    error=err_out,
                    uncertainty=unc_out,
                    unit=pt_unit,
                    warning="; ".join(pt_warnings) if pt_warnings else None,
                )
            )

    confidence: dict[str, float] = {}
    raw_conf = parsed.get("confidence")
    if isinstance(raw_conf, dict):
        for k, v in raw_conf.items():
            if isinstance(v, int | float) and not isinstance(v, bool):
                confidence[str(k)] = max(0.0, min(1.0, float(v)))

    return CalibrationDraft(
        vendor=vendor,
        certificate_no=certificate_no,
        calibrated_month=calibrated_month,
        adjustments=adjustments,
        points=points,
        confidence=confidence,
        warnings=warnings,
        provider=cfg.provider_name,
        model=cfg.model,
        raw_text=raw_content,
    )


def request_calibration_ocr(images: list[bytes], *, cfg: OcrConfig) -> CalibrationDraft:
    if not cfg.api_url or not cfg.api_key:
        raise AppError(409, "OCR_DISABLED", "Rozpoznawanie dokumentów OCR jest wyłączone")

    total_bytes = sum(len(img) for img in images)
    content_blocks: list[dict[str, Any]] = [{"type": "text", "text": _OCR_SYSTEM_PROMPT}]
    for img in images:
        content_blocks.append({"type": "image_url", "image_url": {"url": _image_data_url(img)}})

    url = f"{cfg.api_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": cfg.model,
        "temperature": 0,
        "messages": [{"role": "user", "content": content_blocks}],
    }

    started = time.monotonic()
    try:
        response = httpx.post(url, headers=headers, json=body, timeout=cfg.timeout_s)
    except httpx.TimeoutException as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        logger.warning(
            "OCR timeout: model=%s pages=%d bytes=%d elapsed_ms=%d",
            cfg.model,
            len(images),
            total_bytes,
            elapsed_ms,
        )
        raise AppError(
            504,
            "OCR_TIMEOUT",
            "Przekroczono czas oczekiwania na odpowiedź dostawcy OCR",
        ) from exc
    except httpx.HTTPError as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        logger.warning(
            "OCR HTTP error: model=%s pages=%d bytes=%d elapsed_ms=%d",
            cfg.model,
            len(images),
            total_bytes,
            elapsed_ms,
        )
        raise AppError(
            502,
            "OCR_FAILED",
            "Błąd połączenia z zewnętrznym dostawcą OCR",
        ) from exc

    elapsed_ms = int((time.monotonic() - started) * 1000)
    logger.info(
        "OCR completed: status=%d model=%s pages=%d bytes=%d elapsed_ms=%d",
        response.status_code,
        cfg.model,
        len(images),
        total_bytes,
        elapsed_ms,
    )

    if response.status_code >= 400:
        if response.status_code == 402:
            raise AppError(
                502,
                "OCR_FAILED",
                "Brak środków lub przekroczony limit konta dostawcy OCR",
            )
        if response.status_code in (401, 403) or "Invalid Auth key" in response.text:
            raise AppError(
                502,
                "OCR_FAILED",
                "Klucz API dostawcy OCR jest nieprawidłowy lub nieaktywny",
            )
        raise AppError(502, "OCR_FAILED", "Dostawca OCR zwrócił błąd przetwarzania")

    try:
        envelope = response.json()
        content = envelope["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise AppError(502, "OCR_FAILED", "Nieprawidłowa odpowiedź dostawcy OCR") from exc

    if not isinstance(content, str):
        raise AppError(502, "OCR_FAILED", "Brak treści tekstowej w odpowiedzi OCR")

    return _parse_draft_payload(content, cfg=cfg)
