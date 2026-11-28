import json
from dataclasses import dataclass, field
from typing import Any

import httpx
import pytest
from app.audit.models import AuditLog
from app.config import get_settings
from app.equipment.models import Equipment
from app.files.models import Attachment
from app.files.service import attach, page_images
from app.print.render import render
from app.settings.service import update_settings
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

SAMPLE_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
    b"\x00\x00\x03\x01\x01\x00\xc9\xfe\x92\xef\x00\x00\x00\x00IEND\xaeB`\x82"
)


@dataclass
class OcrStub:
    attachment_id: int
    called: bool = False
    response_status: int = 200
    response_payload: dict[str, Any] = field(default_factory=dict)
    raise_exc: Exception | None = None


@pytest.fixture
def admin_a(make_lab: Any, make_user: Any) -> Any:
    lab_a = make_lab("A")
    return make_user("admin", labs=(lab_a,))


@pytest.fixture
def eq_a(make_lab: Any, make_equipment: Any) -> Equipment:
    return make_equipment(make_lab("A"), number="121", interval=12, lead=1)


@pytest.fixture
def ocr_stub(
    client: TestClient,
    admin_a: Any,
    auth: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> OcrStub:
    settings = get_settings()
    monkeypatch.setattr(settings, "ocr_api_url", "https://ocr.example.test/v1")
    monkeypatch.setattr(settings, "ocr_api_key", "-".join(("sk", "stub", "secret")))
    monkeypatch.setattr(settings, "ocr_model", "qwen-vl-max")
    monkeypatch.setattr(settings, "ocr_timeout_s", 5.0)

    up = client.post(
        "/api/attachments",
        headers=auth(admin_a),
        files={"file": ("scan.png", SAMPLE_PNG, "image/png")},
    )
    assert up.status_code == 201

    default_draft = {
        "vendor": "GUM Warszawa",
        "certificate_no": "GUM/42/2026",
        "calibrated_month": "2026-10",
        "adjustments": "Brak",
        "points": [
            {
                "point": "500 g",
                "error": "-0,001",
                "uncertainty": "0,0005",
                "unit": "g",
            }
        ],
        "confidence": {"vendor": 0.96, "calibrated_month": 0.92, "points": 0.88},
    }
    stub = OcrStub(
        attachment_id=up.json()["id"],
        response_payload={"choices": [{"message": {"content": json.dumps(default_draft)}}]},
    )

    def _fake_post(url: str, **_kwargs: Any) -> httpx.Response:
        stub.called = True
        if stub.raise_exc is not None:
            raise stub.raise_exc
        req = httpx.Request("POST", url)
        return httpx.Response(stub.response_status, json=stub.response_payload, request=req)

    monkeypatch.setattr(httpx, "post", _fake_post)
    return stub


def test_extract_returns_draft_and_saves_nothing(
    client: TestClient,
    db: Session,
    admin_a: Any,
    eq_a: Equipment,
    auth: Any,
    ocr_stub: OcrStub,
) -> None:
    update_settings(db, {"ocr_enabled": True})
    db.flush()

    before = client.get(f"/api/equipment/{eq_a.id}/calibrations", headers=auth(admin_a)).json()
    r = client.post(
        f"/api/equipment/{eq_a.id}/calibrations/extract",
        headers=auth(admin_a),
        json={"attachment_id": ocr_stub.attachment_id},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["points"][0]["error"] == "-0.001"
    assert body["calibrated_month"] == "2026-10"
    assert body["vendor"] == "GUM Warszawa"
    assert body["provider"] == "ocr.example.test"
    assert body["model"] == "qwen-vl-max"
    assert "sk-stub-secret" not in json.dumps(body)

    after = client.get(f"/api/equipment/{eq_a.id}/calibrations", headers=auth(admin_a)).json()
    assert len(after) == len(before)


def test_extract_accepts_numeric_reference_values(
    client: TestClient,
    db: Session,
    admin_a: Any,
    eq_a: Equipment,
    auth: Any,
    ocr_stub: OcrStub,
) -> None:
    update_settings(db, {"ocr_enabled": True})
    db.flush()
    numeric_draft = {
        "vendor": "GUM Warszawa",
        "certificate_no": "GUM/42/2026",
        "calibrated_month": "2026-10",
        "adjustments": "Brak",
        "points": [
            {"point": 0.0, "error": "0,0000", "uncertainty": "0,0003", "unit": "g"},
            {"point": 200, "error": "-0,0002", "uncertainty": "0,0004", "unit": "g"},
        ],
        "confidence": {"points": 0.9},
    }
    ocr_stub.response_payload = {"choices": [{"message": {"content": json.dumps(numeric_draft)}}]}

    r = client.post(
        f"/api/equipment/{eq_a.id}/calibrations/extract",
        headers=auth(admin_a),
        json={"attachment_id": ocr_stub.attachment_id},
    )

    assert r.status_code == 200
    assert [point["point"] for point in r.json()["points"]] == ["0.0", "200"]


def test_extract_disabled_is_409_and_provider_not_called(
    client: TestClient,
    admin_a: Any,
    eq_a: Equipment,
    auth: Any,
    ocr_stub: OcrStub,
) -> None:
    r = client.post(
        f"/api/equipment/{eq_a.id}/calibrations/extract",
        headers=auth(admin_a),
        json={"attachment_id": ocr_stub.attachment_id},
    )
    assert r.status_code == 409
    assert r.json()["error"] == "OCR_DISABLED"
    assert not ocr_stub.called


def test_provider_error_is_502(
    client: TestClient,
    db: Session,
    admin_a: Any,
    eq_a: Equipment,
    auth: Any,
    ocr_stub: OcrStub,
) -> None:
    update_settings(db, {"ocr_enabled": True})
    db.flush()
    ocr_stub.response_status = 500
    ocr_stub.response_payload = {"error": "upstream down"}

    r = client.post(
        f"/api/equipment/{eq_a.id}/calibrations/extract",
        headers=auth(admin_a),
        json={"attachment_id": ocr_stub.attachment_id},
    )
    assert r.status_code == 502
    assert r.json()["error"] == "OCR_FAILED"


def test_timeout_is_504(
    client: TestClient,
    db: Session,
    admin_a: Any,
    eq_a: Equipment,
    auth: Any,
    ocr_stub: OcrStub,
) -> None:
    update_settings(db, {"ocr_enabled": True})
    db.flush()
    ocr_stub.raise_exc = httpx.ReadTimeout("timed out")

    r = client.post(
        f"/api/equipment/{eq_a.id}/calibrations/extract",
        headers=auth(admin_a),
        json={"attachment_id": ocr_stub.attachment_id},
    )
    assert r.status_code == 504
    assert r.json()["error"] == "OCR_TIMEOUT"


def test_garbage_numbers_are_dropped_not_422(
    client: TestClient,
    db: Session,
    admin_a: Any,
    eq_a: Equipment,
    auth: Any,
    ocr_stub: OcrStub,
) -> None:
    update_settings(db, {"ocr_enabled": True})
    db.flush()
    bad_draft = {
        "vendor": "Metrolab",
        "calibrated_month": "nieznany",
        "points": [{"point": "100 g", "error": "n/d", "uncertainty": "0,02", "unit": "g"}],
    }
    ocr_stub.response_payload = {"choices": [{"message": {"content": json.dumps(bad_draft)}}]}

    r = client.post(
        f"/api/equipment/{eq_a.id}/calibrations/extract",
        headers=auth(admin_a),
        json={"attachment_id": ocr_stub.attachment_id},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["calibrated_month"] is None
    assert body["points"][0]["error"] is None
    assert body["points"][0]["uncertainty"] == "0.02"
    assert len(body["warnings"]) >= 2


def test_extract_requires_calibration_write(
    client: TestClient,
    db: Session,
    make_lab: Any,
    make_user: Any,
    eq_a: Equipment,
    auth: Any,
    ocr_stub: OcrStub,
) -> None:
    update_settings(db, {"ocr_enabled": True})
    db.flush()
    worker = make_user("worker", labs=(make_lab("A"),))

    r = client.post(
        f"/api/equipment/{eq_a.id}/calibrations/extract",
        headers=auth(worker),
        json={"attachment_id": ocr_stub.attachment_id},
    )
    assert r.status_code == 403
    assert r.json()["error"] == "FORBIDDEN"


def test_cannot_extract_foreign_attachment(
    client: TestClient,
    db: Session,
    make_lab: Any,
    make_user: Any,
    make_equipment: Any,
    eq_a: Equipment,
    auth: Any,
    ocr_stub: OcrStub,
) -> None:
    update_settings(db, {"ocr_enabled": True})
    lab_w = make_lab("W", name="Wytrzymałościowa")
    admin_all = make_user("admin", all_labs=True)
    eq_w = make_equipment(lab_w, number="1")

    up_w = client.post(
        "/api/attachments",
        headers=auth(admin_all),
        files={"file": ("w.png", SAMPLE_PNG, "image/png")},
    )
    att_w_id = up_w.json()["id"]
    attach(db, admin_all, [att_w_id], owner_type="calibration", owner_id=eq_w.id, lab_id=lab_w.id)
    db.flush()

    r = client.post(
        f"/api/equipment/{eq_a.id}/calibrations/extract",
        headers=auth(admin_all),
        json={"attachment_id": att_w_id},
    )
    assert r.status_code == 403
    assert r.json()["error"] == "FORBIDDEN"
    assert not ocr_stub.called


def test_create_records_ocr_source(
    client: TestClient,
    db: Session,
    admin_a: Any,
    eq_a: Equipment,
    auth: Any,
    ocr_stub: OcrStub,
) -> None:
    update_settings(db, {"ocr_enabled": True})
    db.flush()
    headers = auth(admin_a)

    ext = client.post(
        f"/api/equipment/{eq_a.id}/calibrations/extract",
        headers=headers,
        json={"attachment_id": ocr_stub.attachment_id},
    )
    assert ext.status_code == 200

    created = client.post(
        f"/api/equipment/{eq_a.id}/calibrations",
        headers=headers,
        json={
            "calibrated_month": "2026-10",
            "vendor": "GUM Warszawa",
            "certificate_no": "GUM/42/2026",
            "result": "OK",
            "points": [{"point": "500 g", "error": "-0,001", "uncertainty": "0,0005", "unit": "g"}],
            "attachment_ids": [ocr_stub.attachment_id],
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["source"] == "OCR"
    assert body["ocr_meta"]["provider"] == "ocr.example.test"
    assert body["ocr_meta"]["model"] == "qwen-vl-max"
    assert body["ocr_meta"]["attachment_id"] == ocr_stub.attachment_id

    audit_rows = db.scalars(
        select(AuditLog).where(
            AuditLog.entity == "calibration",
            AuditLog.entity_id == str(body["id"]),
            AuditLog.action == "create",
        )
    ).all()
    assert len(audit_rows) == 1
    assert audit_rows[0].after is not None
    assert audit_rows[0].after["source"] == "OCR"
    assert audit_rows[0].after["ocr_meta"]["provider"] == "ocr.example.test"


def test_page_images_renders_pdf_pages_via_pdftoppm(
    client: TestClient,
    db: Session,
    admin_a: Any,
    auth: Any,
    tmp_path: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.print.render as render_mod

    templates = tmp_path / "templates"
    fonts = tmp_path / "fonts"
    templates.mkdir()
    fonts.mkdir()
    (templates / "cert.typ").write_text(
        "= Swiadectwo 1\n#pagebreak()\n= Strona 2\n", encoding="utf-8"
    )
    monkeypatch.setattr(render_mod, "PRINT_DIR", tmp_path)
    pdf_bytes = render("cert.typ", "{}")

    up = client.post(
        "/api/attachments",
        headers=auth(admin_a),
        files={"file": ("cert.pdf", pdf_bytes, "application/pdf")},
    )
    att = db.get(Attachment, up.json()["id"])
    assert att is not None

    pages = page_images(db, att, limit=5)
    assert len(pages) == 2
    assert all(p.startswith(b"\x89PNG") for p in pages)
