"""Idempotent starter and demo data seeder for Cementownia Warta (T18)."""

from __future__ import annotations

import argparse
import csv
import importlib
import importlib.util
import sys
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.context import audit_context
from app.audit.listener import register_audit_listener
from app.auth.models import Lab, User
from app.auth.security import hash_password, verify_password
from app.auth.service import ensure_default_roles
from app.core.dates import add_months, next_due_month
from app.core.ranges import RangeResult, check_range
from app.db import SessionLocal
from app.equipment.catalog import ensure_default_equipment_catalog
from app.equipment.models import (
    Calibration,
    CalibrationPlan,
    CalibrationPoint,
    CheckPlan,
    CheckRecord,
    Equipment,
    EquipmentAuthorization,
)
from app.forms.models import FormTemplate
from app.forms.validation import FieldSpec, validate_field_specs

if TYPE_CHECKING:
    from collections.abc import Sequence


@dataclass(frozen=True)
class _EquipmentSpec:
    lab_code: str
    number: str
    public_id: str
    name: str
    category: str
    manufacturer: str
    model: str
    location: str
    calibration_mode: str
    calibration_required: bool
    interval_months: int | None
    lead_months: int
    calibrated_offset_months: int | None
    vendor: str
    point: tuple[str, str, str, str] | None
    authorize_worker: bool = False
    withdrawn_reason: str | None = None


_EQUIPMENT_SPECS: tuple[_EquipmentSpec, ...] = (
    _EquipmentSpec(
        lab_code="A",
        number="121",
        public_id="CWA000121A",
        name="Waga analityczna",
        category="Wagi",
        manufacturer="Radwag",
        model="AS 220.R2",
        location="Pracownia A — stół wagowy 1",
        calibration_mode="EXTERNAL",
        calibration_required=True,
        interval_months=12,
        lead_months=1,
        calibrated_offset_months=-6,
        vendor="RADWAG Wagi Elektroniczne",
        point=("200 g", "-0.0002", "0.0004", "g"),
        authorize_worker=True,
    ),
    _EquipmentSpec(
        lab_code="A",
        number="122",
        public_id="CWA000122A",
        name="Termohigrometr",
        category="Warunki środowiskowe",
        manufacturer="Testo",
        model="608-H1",
        location="Pracownia A — ściana północna",
        calibration_mode="EXTERNAL",
        calibration_required=True,
        interval_months=12,
        lead_months=1,
        calibrated_offset_months=-6,
        vendor="Laboratorium Wzorcujące Testo",
        point=("20 °C", "0.1", "0.3", "°C"),
        authorize_worker=True,
    ),
    _EquipmentSpec(
        lab_code="A",
        number="123",
        public_id="CWA000123A",
        name="Termometr szklany laboratoryjny",
        category="Temperatura",
        manufacturer="GUM",
        model="TL-01",
        location="Pracownia A — szafa 2",
        calibration_mode="EXTERNAL",
        calibration_required=True,
        interval_months=24,
        lead_months=2,
        calibrated_offset_months=-23,
        vendor="OUM Łódź",
        point=("20 °C", "-0.05", "0.10", "°C"),
        authorize_worker=True,
    ),
    _EquipmentSpec(
        lab_code="A",
        number="124",
        public_id="CWA000124A",
        name="Wzorzec masy 500 g",
        category="Wzorce masy",
        manufacturer="GUM",
        model="F1-500",
        location="Pracownia A — sejf wzorców",
        calibration_mode="EXTERNAL",
        calibration_required=True,
        interval_months=24,
        lead_months=3,
        calibrated_offset_months=-26,
        vendor="GUM Warszawa",
        point=("500 g", "-0.001", "0.002", "g"),
        authorize_worker=False,
    ),
    _EquipmentSpec(
        lab_code="A",
        number="125",
        public_id="CWA000125A",
        name="Piec muflowy",
        category="Piece",
        manufacturer="Nabertherm",
        model="L 9/11",
        location="Pracownia A — stanowisko prażenia",
        calibration_mode="ON_SITE",
        calibration_required=True,
        interval_months=12,
        lead_months=2,
        calibrated_offset_months=-11,
        vendor="Termo-Cal Serwis",
        point=("950 °C", "1.5", "3.0", "°C"),
        authorize_worker=True,
    ),
    _EquipmentSpec(
        lab_code="A",
        number="126",
        public_id="CWA000126A",
        name="Piknometr helowy",
        category="Gęstość",
        manufacturer="Micromeritics",
        model="AccuPyc II 1345",
        location="Pracownia A — stół 3",
        calibration_mode="ON_SITE",
        calibration_required=True,
        interval_months=12,
        lead_months=2,
        calibrated_offset_months=-4,
        vendor="Micromeritics Service PL",
        point=("10 cm³", "0.002", "0.005", "cm³"),
        authorize_worker=True,
    ),
    _EquipmentSpec(
        lab_code="A",
        number="127",
        public_id="CWA000127A",
        name="Spektrofotometr UV-Vis",
        category="Spektrometria",
        manufacturer="Shimadzu",
        model="UV-1900i",
        location="Pracownia A — stół optyczny",
        calibration_mode="EXTERNAL",
        calibration_required=True,
        interval_months=12,
        lead_months=1,
        calibrated_offset_months=-15,
        vendor="Shimadzu Polska",
        point=("412 nm", "0.2", "0.5", "nm"),
        authorize_worker=True,
    ),
    _EquipmentSpec(
        lab_code="A",
        number="128",
        public_id="CWA000128A",
        name="Fotometr płomieniowy",
        category="Fotometria",
        manufacturer="Sherwood",
        model="M410",
        location="Pracownia A — magazyn serwisu",
        calibration_mode="ON_SITE",
        calibration_required=True,
        interval_months=12,
        lead_months=1,
        calibrated_offset_months=None,
        vendor="LabService",
        point=None,
        authorize_worker=False,
        withdrawn_reason="Uszkodzenie detektora — wycofany do naprawy",
    ),
    _EquipmentSpec(
        lab_code="W",
        number="201",
        public_id="CWW000201W",
        name="Prasa do badań wytrzymałości",
        category="Wytrzymałość",
        manufacturer="Controls",
        model="Automax 5",
        location="Pracownia W — hala pras",
        calibration_mode="ON_SITE",
        calibration_required=True,
        interval_months=12,
        lead_months=2,
        calibrated_offset_months=-5,
        vendor="Controls Polska",
        point=("100 kN", "0.15", "0.40", "kN"),
    ),
    _EquipmentSpec(
        lab_code="W",
        number="202",
        public_id="CWW000202W",
        name="Aparat Vicata",
        category="Czas wiązania",
        manufacturer="Controls",
        model="Vicamatic-2",
        location="Pracownia W — stół zaczynów",
        calibration_mode="EXTERNAL",
        calibration_required=True,
        interval_months=12,
        lead_months=1,
        calibrated_offset_months=-11,
        vendor="Controls Polska",
        point=("10 mm", "0.02", "0.05", "mm"),
    ),
    _EquipmentSpec(
        lab_code="W",
        number="203",
        public_id="CWW000203W",
        name="Pierścienie Le Chateliera",
        category="Stałość objętości",
        manufacturer="Toni Technik",
        model="LC-Set",
        location="Pracownia W — regał 4",
        calibration_mode="EXTERNAL",
        calibration_required=True,
        interval_months=24,
        lead_months=1,
        calibrated_offset_months=-25,
        vendor="OUM Katowice",
        point=("10 mm", "0.05", "0.10", "mm"),
    ),
    _EquipmentSpec(
        lab_code="W",
        number="204",
        public_id="CWW000204W",
        name="Aparat Blaine'a",
        category="Miałkość",
        manufacturer="Toni Technik",
        model="ToniPERM",
        location="Pracownia W — stół 2",
        calibration_mode="EXTERNAL",
        calibration_required=True,
        interval_months=12,
        lead_months=1,
        calibrated_offset_months=-3,
        vendor="ICiMB Kraków",
        point=("3500 cm²/g", "15", "35", "cm²/g"),
    ),
    _EquipmentSpec(
        lab_code="W",
        number="205",
        public_id="CWW000205W",
        name="Komora klimatyczna dojrzewania próbek",
        category="Warunki środowiskowe",
        manufacturer="Memmert",
        model="HPP260",
        location="Pracownia W — strefa dojrzewania",
        calibration_mode="ON_SITE",
        calibration_required=True,
        interval_months=12,
        lead_months=1,
        calibrated_offset_months=None,
        vendor="Memmert Serwis",
        point=None,
    ),
    _EquipmentSpec(
        lab_code="P",
        number="301",
        public_id="CWP000301P",
        name="Kalorymetr semi-adiabatyczny",
        category="Kalorymetria",
        manufacturer="IKA",
        model="C 6000",
        location="Pracownia P — stanowisko 1",
        calibration_mode="ON_SITE",
        calibration_required=True,
        interval_months=12,
        lead_months=2,
        calibrated_offset_months=-8,
        vendor="IKA Poland",
        point=("300 J/g", "1.2", "2.5", "J/g"),
    ),
    _EquipmentSpec(
        lab_code="P",
        number="302",
        public_id="CWP000302P",
        name="Mieszadło magnetyczne pomocnicze",
        category="Pomocnicze",
        manufacturer="IKA",
        model="RCT basic",
        location="Pracownia P — stół 2",
        calibration_mode="EXTERNAL",
        calibration_required=False,
        interval_months=None,
        lead_months=1,
        calibrated_offset_months=None,
        vendor="",
        point=None,
    ),
)


@dataclass(frozen=True)
class _EquipmentDetails:
    """Identity and metrology copied from the paper equipment card."""

    serial_no: str
    software_version: str | None
    acceptance_criteria: str
    notes: str
    vendor: str | None = None
    points: tuple[tuple[str, str, str, str], ...] = ()


# Instruments match the working equipment of the Zakładowe Laboratorium Cementowni
# Warta S.A. in Trębaczew (accreditation AB 1119): the analytical room weighs cement
# and clinker, the strength room presses mortar bars, the fuels room runs calorimetry.
_EQUIPMENT_DETAILS: dict[str, _EquipmentDetails] = {
    "121/A": _EquipmentDetails(
        serial_no="445821",
        software_version="1.4.2",
        acceptance_criteria=(
            "Błąd wskazania ≤ ±0,0005 g w zakresie do 220 g; powtarzalność ≤ 0,0003 g"
        ),
        notes="Naważki do analizy chemicznej cementu i klinkieru (PN-EN 196-2).",
        vendor="RADWAG Laboratorium Wzorcujące",
        points=(
            ("0.0000", "0.0000", "0.0003", "g"),
            ("50.0000", "-0.0001", "0.0003", "g"),
            ("100.0000", "-0.0002", "0.0004", "g"),
            ("200.0000", "-0.0002", "0.0004", "g"),
        ),
    ),
    "122/A": _EquipmentDetails(
        serial_no="40218875",
        software_version=None,
        acceptance_criteria="Temperatura ±0,5 °C; wilgotność względna ±3 % RH",
        notes="Ciągły nadzór warunków środowiskowych w pracowni analitycznej.",
        vendor="Laboratorium Wzorcujące Testo Polska",
        points=(
            ("10", "0.1", "0.2", "°C"),
            ("20", "0.1", "0.2", "°C"),
            ("30", "0.2", "0.2", "°C"),
        ),
    ),
    "123/A": _EquipmentDetails(
        serial_no="TH-123-08",
        software_version=None,
        acceptance_criteria="Błąd wskazania ≤ ±0,2 °C w zakresie 0-100 °C",
        notes="Pomiar temperatury kąpieli wodnej i roztworów w analizie chemicznej.",
        vendor="Okręgowy Urząd Miar w Łodzi",
        points=(
            ("0", "-0.05", "0.10", "°C"),
            ("50", "0.00", "0.10", "°C"),
            ("100", "0.05", "0.10", "°C"),
        ),
    ),
    "124/A": _EquipmentDetails(
        serial_no="GUM-F1-500/22",
        software_version=None,
        acceptance_criteria="Klasa F1; MPE ±2,5 mg wg OIML R 111",
        notes="Odważnik do okresowych sprawdzeń pośrednich wagi analitycznej.",
        vendor="Główny Urząd Miar w Warszawie",
        points=(("500.0000", "-0.0002", "0.0003", "g"),),
    ),
    "125/A": _EquipmentDetails(
        serial_no="261740",
        software_version="B510",
        acceptance_criteria="950 °C ±15 °C; 105 °C ±2 °C w całej komorze",
        notes="Prażenie próbek cementu i klinkieru — straty prażenia (PN-EN 196-2).",
        vendor="Nabertherm Service Polska",
        points=(
            ("105", "0.2", "0.3", "°C"),
            ("500", "0.6", "0.8", "°C"),
            ("950", "1.2", "1.5", "°C"),
        ),
    ),
    "126/A": _EquipmentDetails(
        serial_no="1345-2214",
        software_version="AccuPyc v2.0",
        acceptance_criteria="Objętość kuli wzorcowej w granicach ±0,02 cm³",
        notes="Gęstość właściwa cementu i klinkieru portlandzkiego (PN-EN 196-6).",
        vendor="Micromeritics Service PL",
        points=(
            ("10.0000", "0.0002", "0.0005", "cm³"),
            ("50.0000", "0.0010", "0.0020", "cm³"),
        ),
    ),
    "127/A": _EquipmentDetails(
        serial_no="A114557",
        software_version="LabSolutions UV-Vis",
        acceptance_criteria="Dokładność długości fali ±0,5 nm; fotometryczna ±0,004 Abs",
        notes="Oznaczanie rozpuszczalnego chromu(VI) w cemencie (PN-EN 196-10).",
        vendor="Shimadzu Polska",
        points=(
            ("412.0", "0.2", "0.5", "nm"),
            ("540.0", "0.3", "0.5", "nm"),
        ),
    ),
    "128/A": _EquipmentDetails(
        serial_no="M410-118",
        software_version=None,
        acceptance_criteria="Liniowość dla wzorców Na₂O i K₂O; dryft ≤ 2 %/h",
        notes="Oznaczanie alkaliów Na₂O i K₂O w cemencie i klinkierze (PN-EN 196-2).",
    ),
    "201/W": _EquipmentDetails(
        serial_no="05-11842",
        software_version="DATAMANAGER 5.2",
        acceptance_criteria="Klasa 1 wg PN-EN ISO 7500-1; błąd względny ≤ ±1 %",
        notes="Badania wytrzymałości beleczek zapraw cementowych (PN-EN 196-1).",
        vendor="Controls Polska",
        points=(
            ("100", "0.15", "0.40", "kN"),
            ("200", "0.30", "0.80", "kN"),
        ),
    ),
    "202/W": _EquipmentDetails(
        serial_no="VIC-21-2019",
        software_version=None,
        acceptance_criteria="Masa części ruchomej 300 ±1 g; igła 1,13 ±0,05 mm",
        notes="Konsystencja normowa oraz czas wiązania zaczynów (PN-EN 196-3).",
        vendor="Controls Polska",
        points=(
            ("0", "0.02", "0.05", "mm"),
            ("10", "0.02", "0.05", "mm"),
            ("40", "0.03", "0.05", "mm"),
        ),
    ),
    "203/W": _EquipmentDetails(
        serial_no="LC-07-12",
        software_version=None,
        acceptance_criteria="Szczelina 10 mm; odchyłka wymiarów ≤ 0,05 mm",
        notes="Stałość objętości zaczynów normowych (PN-EN 196-3).",
        vendor="Okręgowy Urząd Miar w Katowicach",
        points=(("0", "0.05", "0.10", "mm"), ("10", "0.05", "0.10", "mm")),
    ),
    "204/W": _EquipmentDetails(
        serial_no="113-2019",
        software_version="TONIPERM 2.0",
        acceptance_criteria="Zgodność z CRM cementu w granicach ±5 % (PN-EN 196-6)",
        notes="Powierzchnia właściwa cementu metodą przepuszczalności powietrza.",
        vendor="Instytut Ceramiki i Materiałów Budowlanych w Krakowie",
        points=(
            ("2000", "-12", "25", "cm²/g"),
            ("3500", "15", "35", "cm²/g"),
            ("5000", "22", "45", "cm²/g"),
        ),
    ),
    "205/W": _EquipmentDetails(
        serial_no="M58012",
        software_version=None,
        acceptance_criteria="20 ±1 °C; wilgotność ≥ 90 % RH",
        notes="Dojrzewanie beleczek zapraw normowych przed badaniami wytrzymałości.",
        vendor="Memmert Serwis Polska",
    ),
    "301/P": _EquipmentDetails(
        serial_no="6000-17-2210",
        software_version="C 6040 Calwin",
        acceptance_criteria="Ciepło hydratacji 200-400 J/g; stabilność < 2 J/g",
        notes="Ciepło hydratacji cementu metodą semi-adiabatyczną (PN-EN 196-9).",
        vendor="IKA Poland",
        points=(("300", "1.2", "2.5", "J/g"), ("400", "1.8", "3.0", "J/g")),
    ),
    "302/P": _EquipmentDetails(
        serial_no="RCT-302-11",
        software_version=None,
        acceptance_criteria="Mieszanie pomocnicze; bez wymagań metrologicznych",
        notes="Mieszadło pomocnicze do przygotowania zawiesin i roztworów.",
    ),
}


def _upsert_lab(db: Session, *, code: str, name: str) -> Lab:
    lab = db.scalars(select(Lab).where(Lab.code == code)).first()
    if lab is None:
        lab = Lab(code=code, name=name, active=True)
        db.add(lab)
        db.flush()
        return lab
    if lab.name != name:
        lab.name = name
        db.flush()
    return lab


def _upsert_user(
    db: Session,
    *,
    login_name: str,
    full_name: str,
    role_id: int,
    all_labs: bool,
    labs: Sequence[Lab],
    env_key: str,
) -> User:
    import os

    # Demo accounts default to 1111 for the whole team; SEED_*_PASSWORD overrides it.
    raw_secret = os.environ.get(env_key, "").strip() or "1111"
    user = db.scalars(select(User).where(User.login == login_name)).first()
    if user is None:
        user = User(
            login=login_name,
            full_name=full_name,
            password_hash=hash_password(raw_secret),
            role_id=role_id,
            all_labs=all_labs,
            active=True,
        )
        user.labs = list(labs)
        db.add(user)
        db.flush()
        return user

    if not verify_password(raw_secret, user.password_hash):
        user.password_hash = hash_password(raw_secret)
    if user.full_name != full_name:
        user.full_name = full_name
    target_lab_ids = {lab.id for lab in labs}
    if {lab.id for lab in user.labs} != target_lab_ids:
        user.labs = list(labs)
    db.flush()
    return user


def _upsert_form_template(
    db: Session,
    *,
    name: str,
    raw_fields: list[dict[str, Any]],
) -> FormTemplate:
    existing = db.scalars(select(FormTemplate).where(FormTemplate.name == name)).first()
    if existing is not None:
        return existing
    specs = [FieldSpec.model_validate(item) for item in raw_fields]
    tpl = FormTemplate(name=name, fields=validate_field_specs(specs))
    db.add(tpl)
    db.flush()
    return tpl


def _upsert_check_plan(
    db: Session,
    *,
    equipment: Equipment,
    name: str,
    interval_months: int,
    lead_months: int,
    form_template: FormTemplate,
) -> CheckPlan:
    plan = db.scalars(
        select(CheckPlan).where(
            CheckPlan.equipment_id == equipment.id,
            CheckPlan.name == name,
        )
    ).first()
    if plan is not None:
        return plan
    # Older seed releases used shorter names. Rename the seeded plan instead of
    # creating a second one for the same device when the demo database is reused.
    legacy = db.scalars(
        select(CheckPlan).where(
            CheckPlan.equipment_id == equipment.id,
            CheckPlan.form_template_id == form_template.id,
            CheckPlan.interval_months == interval_months,
        )
    ).first()
    if legacy is not None:
        legacy.name = name
        legacy.lead_months = lead_months
        legacy.active = True
        db.flush()
        return legacy
    plan = CheckPlan(
        equipment_id=equipment.id,
        name=name,
        interval_months=interval_months,
        lead_months=lead_months,
        form_template_id=form_template.id,
        active=True,
    )
    db.add(plan)
    db.flush()
    return plan


def _day_in_month(today: date, offset_months: int, day: int) -> date:
    month_start = add_months(date(today.year, today.month, 1), offset_months)
    return month_start.replace(day=min(day, 28))


def _certificate_no(month: date, lab_code: str, number: str) -> str:
    return f"SW/{month.year}/{month.month:02d}/{lab_code}{number}"


def _upsert_calibration(
    db: Session,
    *,
    equipment: Equipment,
    calibrated_month: date,
    interval_months: int,
    vendor: str,
    certificate_no: str,
    points: tuple[tuple[str, str, str, str], ...],
    note: str,
    created_by: int,
) -> Calibration:
    existing = db.scalars(
        select(Calibration).where(
            Calibration.equipment_id == equipment.id,
            Calibration.calibrated_month == calibrated_month,
        )
    ).first()
    desired = [
        (point, Decimal(error), Decimal(uncertainty), unit)
        for point, error, uncertainty, unit in points
    ]
    if existing is not None:
        existing.vendor = vendor
        existing.certificate_no = certificate_no
        existing.adjustments = "Bez adiustacji. Wskazania w zakresie tolerancji."
        existing.result = "OK"
        existing.next_due_month = next_due_month(calibrated_month, interval_months)
        existing.note = note
        current = [(row.point, row.error, row.uncertainty, row.unit) for row in existing.points]
        if current != desired:
            existing.points = [
                CalibrationPoint(
                    point=point,
                    error=error,
                    uncertainty=uncertainty,
                    unit=unit,
                )
                for point, error, uncertainty, unit in desired
            ]
        db.flush()
        return existing
    calibration = Calibration(
        equipment_id=equipment.id,
        calibrated_month=calibrated_month,
        vendor=vendor,
        certificate_no=certificate_no,
        adjustments="Bez adiustacji. Wskazania w zakresie tolerancji.",
        result="OK",
        next_due_month=next_due_month(calibrated_month, interval_months),
        note=note,
        source="MANUAL",
        created_by=created_by,
        points=[
            CalibrationPoint(
                point=point,
                error=error,
                uncertainty=uncertainty,
                unit=unit,
            )
            for point, error, uncertainty, unit in desired
        ],
    )
    db.add(calibration)
    db.flush()
    return calibration


def _upsert_check_record(
    db: Session,
    *,
    plan: CheckPlan,
    performed_on: date,
    values: dict[str, Any],
    performed_by: int,
    out_of_range: bool = False,
    note: str = "Wpis z karty ewidencji pracowni",
) -> None:
    existing = db.scalars(
        select(CheckRecord).where(
            CheckRecord.check_plan_id == plan.id,
            CheckRecord.performed_on == performed_on,
        )
    ).first()
    if existing is not None:
        return
    rec = CheckRecord(
        check_plan_id=plan.id,
        performed_on=performed_on,
        values=values,
        out_of_range=out_of_range,
        note=note,
        performed_by=performed_by,
    )
    db.add(rec)
    db.flush()


@dataclass(frozen=True)
class _ReagentSpec:
    lab_code: str
    name: str
    kind: str
    unit: str
    min_stock: Decimal
    interval_days: int
    lead_months: int
    lots: tuple[tuple[str, Decimal, int, int], ...]
    counted_quantity: Decimal
    counted_days_ago: int


_REAGENT_SPECS: tuple[_ReagentSpec, ...] = (
    _ReagentSpec(
        lab_code="A",
        name="Kwas chlorowodorowy 35 %",
        kind="REAGENT",
        unit="ml",
        min_stock=Decimal("1000"),
        interval_days=30,
        lead_months=1,
        lots=(("HCl/26/10", Decimal("2500"), 18, 40),),
        counted_quantity=Decimal("450"),
        counted_days_ago=35,
    ),
    _ReagentSpec(
        lab_code="A",
        name="Kwas azotowy 65 % (HNO₃)",
        kind="REAGENT",
        unit="ml",
        min_stock=Decimal("500"),
        interval_days=30,
        lead_months=1,
        lots=(("HNO3/26/11", Decimal("1000"), 13, 10),),
        counted_quantity=Decimal("1000"),
        counted_days_ago=10,
    ),
    _ReagentSpec(
        lab_code="A",
        name="Chlorek baru 10 % (BaCl₂)",
        kind="REAGENT",
        unit="ml",
        min_stock=Decimal("500"),
        interval_days=30,
        lead_months=1,
        lots=(("BaCl2/26/11", Decimal("2500"), 12, 20),),
        counted_quantity=Decimal("850"),
        counted_days_ago=10,
    ),
    _ReagentSpec(
        lab_code="A",
        name="Azotan srebra 0,1 M (AgNO₃)",
        kind="REAGENT",
        unit="ml",
        min_stock=Decimal("250"),
        interval_days=30,
        lead_months=1,
        lots=(("AgNO3/26/10", Decimal("1000"), 9, 15),),
        counted_quantity=Decimal("950"),
        counted_days_ago=10,
    ),
    _ReagentSpec(
        lab_code="A",
        name="Rodanek amonu 0,1 M (NH₄SCN)",
        kind="REAGENT",
        unit="ml",
        min_stock=Decimal("250"),
        interval_days=30,
        lead_months=1,
        lots=(("NH4SCN/26/09", Decimal("1000"), 14, 30),),
        counted_quantity=Decimal("980"),
        counted_days_ago=12,
    ),
    _ReagentSpec(
        lab_code="A",
        name="CRM cementu — NIST SRM 1889b",
        kind="CRM",
        unit="g",
        min_stock=Decimal("300"),
        interval_days=30,
        lead_months=6,
        lots=(
            ("SRM-1889b/24A", Decimal("400"), -2, 365),
            ("SRM-1889b/26B", Decimal("120"), 2, 60),
            ("SRM-1889b/26C", Decimal("80"), 6, 10),
        ),
        counted_quantity=Decimal("600"),
        counted_days_ago=5,
    ),
    _ReagentSpec(
        lab_code="W",
        name="Piasek normowy CEN EN 196-1",
        kind="REAGENT",
        unit="kg",
        min_stock=Decimal("100"),
        interval_days=90,
        lead_months=1,
        lots=(("CEN-196-1/26", Decimal("250"), 24, 30),),
        counted_quantity=Decimal("250"),
        counted_days_ago=20,
    ),
    _ReagentSpec(
        lab_code="P",
        name="Kwas benzoesowy — wzorzec kalorymetryczny",
        kind="CRM",
        unit="g",
        min_stock=Decimal("50"),
        interval_days=90,
        lead_months=4,
        lots=(("BA/26/09", Decimal("100"), 18, 30),),
        counted_quantity=Decimal("100"),
        counted_days_ago=15,
    ),
)


def _seed_optional_reagents(
    db: Session,
    *,
    labs: dict[str, Lab],
    today: date,
    worker_id: int,
) -> None:
    if (
        importlib.util.find_spec("app.reagents") is None
        or importlib.util.find_spec("app.reagents.models") is None
    ):
        return
    reagents_mod = importlib.import_module("app.reagents.models")
    reagent_cls = getattr(reagents_mod, "Reagent", None)
    lot_cls = getattr(reagents_mod, "ReagentLot", None)
    stock_count_cls = getattr(reagents_mod, "StockCount", None)
    if reagent_cls is None or lot_cls is None or stock_count_cls is None:
        return

    for spec in _REAGENT_SPECS:
        lab = labs[spec.lab_code]
        reagent = db.scalars(
            select(reagent_cls).where(
                reagent_cls.lab_id == lab.id,
                reagent_cls.name == spec.name,
            )
        ).first()
        if reagent is None:
            reagent = reagent_cls(
                lab_id=lab.id,
                name=spec.name,
                kind=spec.kind,
                unit=spec.unit,
                min_stock=spec.min_stock,
                stock_count_interval_days=spec.interval_days,
                expiry_lead_months=spec.lead_months,
                active=True,
            )
            db.add(reagent)
            db.flush()

        for lot_no, quantity, expiry_offset_months, received_days_ago in spec.lots:
            lot = db.scalars(
                select(lot_cls).where(lot_cls.reagent_id == reagent.id, lot_cls.lot_no == lot_no)
            ).first()
            if lot is None:
                db.add(
                    lot_cls(
                        reagent_id=reagent.id,
                        lot_no=lot_no,
                        expiry_date=add_months(today, expiry_offset_months),
                        quantity=quantity,
                        received_on=today - timedelta(days=received_days_ago),
                    )
                )
                db.flush()

        counted_on = today - timedelta(days=spec.counted_days_ago)
        count = db.scalars(
            select(stock_count_cls).where(
                stock_count_cls.reagent_id == reagent.id,
                stock_count_cls.counted_on == counted_on,
            )
        ).first()
        if count is None:
            db.add(
                stock_count_cls(
                    reagent_id=reagent.id,
                    quantity=spec.counted_quantity,
                    counted_on=counted_on,
                    counted_by=worker_id,
                )
            )
            db.flush()


_RESULT_SPECS: tuple[tuple[str, str, str, int, str | None, str | None], ...] = (
    # parameter, sample label, value, days ago, device code, repeated sample
    ("zawartość SO₃", "CEM I 42,5 R-NA · C-26/091", "2.41", 85, "121/A", None),
    ("zawartość SO₃", "CEM II/A-V 42,5 N-NA · C-26/104", "2.88", 71, "121/A", None),
    ("zawartość SO₃", "CEM II/A-LL 52,5 N-NA · C-26/118", "3.02", 57, "121/A", None),
    ("zawartość SO₃", "CEM V/A (S-V) 32,5 R · C-26/135", "3.35", 43, "121/A", None),
    (
        "zawartość SO₃",
        "CEM V/A (S-V) 32,5 R · C-26/135 (powtórzenie)",
        "3.12",
        42,
        "121/A",
        "CEM V/A (S-V) 32,5 R · C-26/135",
    ),
    ("zawartość SO₃", "CEM II/B-M (V-LL) 32,5 R · C-26/152", "2.76", 29, "121/A", None),
    ("zawartość SO₃", "CEM I 42,5 R-NA · C-26/171", "3.01", 15, "121/A", None),
    ("zawartość SO₃", "CEM II/A-V 42,5 N-NA · C-26/188", "2.95", 3, "121/A", None),
    ("zawartość Cl⁻", "CEM I 42,5 R-NA · C-26/091", "0.061", 85, "121/A", None),
    ("zawartość Cl⁻", "CEM II/A-V 42,5 N-NA · C-26/104", "0.058", 71, "121/A", None),
    ("zawartość Cl⁻", "CEM I 42,5 R-NA · C-26/171", "0.060", 15, "121/A", None),
    ("zawartość Cl⁻", "CEM II/A-V 42,5 N-NA · C-26/188", "0.072", 3, "121/A", None),
    ("zawartość CaO", "CEM II/A-V 42,5 N-NA · C-26/104", "64.20", 71, "121/A", None),
    ("zawartość CaO", "CEM V/A (S-V) 32,5 R · C-26/135", "65.10", 43, "121/A", None),
    ("zawartość CaO", "CEM I 42,5 R-NA · C-26/171", "64.80", 15, "121/A", None),
    ("zawartość CaO", "CEM II/A-V 42,5 N-NA · C-26/188", "67.10", 3, "121/A", None),
    ("zawartość MgO", "CEM II/A-V 42,5 N-NA · C-26/104", "1.80", 71, "121/A", None),
    ("zawartość MgO", "CEM V/A (S-V) 32,5 R · C-26/135", "2.10", 43, "121/A", None),
    ("zawartość MgO", "CEM I 42,5 R-NA · C-26/171", "1.90", 15, "121/A", None),
    ("zawartość MgO", "CEM II/A-V 42,5 N-NA · C-26/188", "3.12", 3, "121/A", None),
    ("wytrzymałość zapraw na zginanie (kN)", "Z-26/042", "6.55", 21, "201/W", None),
    ("wytrzymałość zapraw na zginanie (kN)", "Z-26/044", "6.80", 7, "201/W", None),
    ("wytrzymałość zapraw na ściskanie (kN)", "Z-26/042", "128.70", 21, "201/W", None),
    ("wytrzymałość zapraw na ściskanie (kN)", "Z-26/044", "120.40", 7, "201/W", None),
    ("gęstość właściwa", "CEM V/A (S-V) 32,5 R · C-26/135", "3.05", 43, "126/A", None),
    ("gęstość właściwa", "CEM I 42,5 R-NA · C-26/171", "3.02", 15, "126/A", None),
    ("gęstość właściwa", "CEM II/A-V 42,5 N-NA · C-26/188", "3.08", 3, "126/A", None),
    ("powierzchnia właściwa", "CEM V/A (S-V) 32,5 R · C-26/135", "3420", 43, "204/W", None),
    ("powierzchnia właściwa", "CEM I 42,5 R-NA · C-26/171", "3510", 15, "204/W", None),
    ("powierzchnia właściwa", "CEM II/A-V 42,5 N-NA · C-26/188", "3475", 3, "204/W", None),
    ("czas wiązania zaczynów normowych", "CEM I 42,5 R-NA · C-26/171", "185", 15, "202/W", None),
    (
        "czas wiązania zaczynów normowych",
        "CEM II/A-V 42,5 N-NA · C-26/188",
        "172",
        3,
        "202/W",
        None,
    ),
    ("straty prażenia", "CEM V/A (S-V) 32,5 R · C-26/135", "3.40", 43, "125/A", None),
    ("straty prażenia", "CEM I 42,5 R-NA · C-26/171", "8.50", 15, "125/A", None),
    ("straty prażenia", "CEM II/A-V 42,5 N-NA · C-26/188", "3.10", 3, "125/A", None),
)


def _seed_optional_results(
    db: Session,
    *,
    today: date,
    worker_id: int,
    equipment: dict[str, Equipment],
) -> None:
    if (
        importlib.util.find_spec("app.results") is None
        or importlib.util.find_spec("app.results.models") is None
    ):
        return
    results_mod = importlib.import_module("app.results.models")
    param_cls = getattr(results_mod, "TestParameter", None)
    result_cls = getattr(results_mod, "TestResult", None)
    if param_cls is None or result_cls is None:
        return

    csv_path = Path(__file__).resolve().parents[2] / "data" / "seed" / "cement_parameters.csv"
    if csv_path.is_file():
        with csv_path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                action = "BLOCK" if row["name"] == "zawartość Cl⁻" else "FLAG"
                existing = db.scalars(
                    select(param_cls).where(
                        param_cls.material == row["material"],
                        param_cls.name == row["name"],
                        param_cls.unit == row["unit"],
                    )
                ).first()
                if existing is None:
                    db.add(
                        param_cls(
                            material=row["material"],
                            name=row["name"],
                            unit=row["unit"],
                            min_value=Decimal(row["min_value"]) if row["min_value"] else None,
                            max_value=Decimal(row["max_value"]) if row["max_value"] else None,
                            method=row["method"],
                            accredited=row["accredited"] == "true",
                            out_of_range_action=action,
                            active=True,
                        )
                    )
                elif existing.out_of_range_action != action:
                    existing.out_of_range_action = action
            db.flush()

    for (
        parameter_name,
        sample_label,
        raw_value,
        days_ago,
        equipment_code,
        repeat_label,
    ) in _RESULT_SPECS:
        parameter = db.scalars(select(param_cls).where(param_cls.name == parameter_name)).first()
        if parameter is None:
            continue
        existing_result = db.scalars(
            select(result_cls).where(
                result_cls.parameter_id == parameter.id,
                result_cls.sample_label == sample_label,
            )
        ).first()
        if existing_result is not None:
            continue
        sampled_day = today - timedelta(days=days_ago)
        repeat_of_id = None
        if repeat_label is not None:
            original = db.scalars(
                select(result_cls).where(
                    result_cls.parameter_id == parameter.id,
                    result_cls.sample_label == repeat_label,
                )
            ).first()
            repeat_of_id = original.id if original is not None else None
        value = Decimal(raw_value)
        db.add(
            result_cls(
                parameter_id=parameter.id,
                sample_label=sample_label,
                value=value,
                min_snapshot=parameter.min_value,
                max_snapshot=parameter.max_value,
                in_range=check_range(value, parameter.min_value, parameter.max_value)
                is RangeResult.IN_RANGE,
                repeat_of_id=repeat_of_id,
                equipment_id=equipment[equipment_code].id if equipment_code is not None else None,
                created_by=worker_id,
                created_at=datetime(
                    sampled_day.year,
                    sampled_day.month,
                    sampled_day.day,
                    10,
                    0,
                    tzinfo=UTC,
                ),
            )
        )
    db.flush()


def _upsert_calibration_plan(
    db: Session,
    *,
    equipment: Equipment,
    dispatch_on: date,
    return_on: date,
    note: str,
    created_by: int,
) -> None:
    existing = db.scalars(
        select(CalibrationPlan).where(
            CalibrationPlan.equipment_id == equipment.id,
            CalibrationPlan.dispatch_on == dispatch_on,
            CalibrationPlan.return_on == return_on,
        )
    ).first()
    if existing is not None:
        return
    db.add(
        CalibrationPlan(
            equipment_id=equipment.id,
            dispatch_on=dispatch_on,
            return_on=return_on,
            note=note,
            created_by=created_by,
        )
    )
    db.flush()


def seed(db: Session, *, today: date) -> None:
    """Populate starter labs, users, equipment, check plans, and optional domain data."""
    register_audit_listener(Session)
    roles = ensure_default_roles(db)

    lab_a = _upsert_lab(db, code="A", name="Pracownia Analityczna")
    lab_w = _upsert_lab(db, code="W", name="Pracownia Wytrzymałościowa")
    lab_p = _upsert_lab(db, code="P", name="Pracownia Paliw")
    labs_by_code = {"A": lab_a, "W": lab_w, "P": lab_p}

    admin = _upsert_user(
        db,
        login_name="admin",
        full_name="Marcin Lis",
        role_id=roles["admin"].id,
        all_labs=True,
        labs=(),
        env_key="SEED_ADMIN_PASSWORD",
    )
    _upsert_user(
        db,
        login_name="kierownik",
        full_name="dr Anita Smolarek-Nowak",
        role_id=roles["manager"].id,
        all_labs=True,
        labs=(),
        env_key="SEED_MANAGER_PASSWORD",
    )
    laborant = _upsert_user(
        db,
        login_name="laborant",
        full_name="Aneta Dymek",
        role_id=roles["worker"].id,
        all_labs=False,
        labs=(lab_a,),
        env_key="SEED_WORKER_PASSWORD",
    )

    first_of_today = date(today.year, today.month, 1)
    seeded_equipment: dict[str, Equipment] = {}

    with audit_context(user_id=admin.id, reason="Dane startowe i demo"):
        ensure_default_equipment_catalog(db)
        for spec in _EQUIPMENT_SPECS:
            lab = labs_by_code[spec.lab_code]
            details = _EQUIPMENT_DETAILS[f"{spec.number}/{spec.lab_code}"]
            eq = db.scalars(
                select(Equipment).where(
                    Equipment.lab_id == lab.id,
                    Equipment.number == spec.number,
                )
            ).first()
            if eq is None:
                eq = Equipment(
                    public_id=spec.public_id,
                    lab_id=lab.id,
                    number=spec.number,
                    name=spec.name,
                    calibration_required=spec.calibration_required,
                    calibration_mode=spec.calibration_mode,
                    withdrawn_at=None,
                )
                db.add(eq)
            eq.public_id = spec.public_id
            eq.name = spec.name
            eq.category = spec.category
            eq.manufacturer = spec.manufacturer
            eq.model = spec.model
            eq.serial_no = details.serial_no
            eq.software_version = details.software_version
            eq.location = spec.location
            eq.calibration_required = spec.calibration_required
            eq.calibration_interval_months = spec.interval_months
            eq.calibration_mode = spec.calibration_mode
            eq.lead_months = spec.lead_months
            eq.acceptance_criteria = details.acceptance_criteria
            eq.notes = details.notes
            if spec.withdrawn_reason is not None and eq.withdrawn_at is None:
                eq.withdrawn_at = datetime(today.year, today.month, today.day, 8, 0, tzinfo=UTC)
                eq.withdrawn_reason = spec.withdrawn_reason
            db.flush()
            seeded_equipment[f"{spec.number}/{spec.lab_code}"] = eq

            if spec.authorize_worker:
                auth_row = db.scalars(
                    select(EquipmentAuthorization).where(
                        EquipmentAuthorization.equipment_id == eq.id,
                        EquipmentAuthorization.user_id == laborant.id,
                    )
                ).first()
                if auth_row is None:
                    db.add(EquipmentAuthorization(equipment_id=eq.id, user_id=laborant.id))
                    db.flush()

            if spec.calibrated_offset_months is None or spec.interval_months is None:
                continue
            cal_month = add_months(first_of_today, spec.calibrated_offset_months)
            points = details.points or (() if spec.point is None else (spec.point,))
            vendor = details.vendor or spec.vendor
            _upsert_calibration(
                db,
                equipment=eq,
                calibrated_month=cal_month,
                interval_months=spec.interval_months,
                vendor=vendor,
                certificate_no=_certificate_no(cal_month, spec.lab_code, spec.number),
                points=points,
                note="Świadectwo wzorcowania w aktach laboratorium.",
                created_by=admin.id,
            )
            previous_month = add_months(cal_month, -spec.interval_months)
            _upsert_calibration(
                db,
                equipment=eq,
                calibrated_month=previous_month,
                interval_months=spec.interval_months,
                vendor=vendor,
                certificate_no=_certificate_no(previous_month, spec.lab_code, spec.number),
                points=points,
                note="Poprzednie wzorcowanie — archiwum papierowe.",
                created_by=admin.id,
            )

        env_tpl = _upsert_form_template(
            db,
            name="Kontrola warunków środowiskowych",
            raw_fields=[
                {
                    "key": "temperature_c",
                    "label": "Temperatura",
                    "type": "number",
                    "unit": "°C",
                    "min": "18.0",
                    "max": "22.0",
                    "required": True,
                },
                {
                    "key": "humidity_pct",
                    "label": "Wilgotność względna",
                    "type": "number",
                    "unit": "%",
                    "min": "40",
                    "max": "70",
                    "required": True,
                },
            ],
        )
        scale_tpl = _upsert_form_template(
            db,
            name="Sprawdzenie wagi wzorcem 500 g",
            raw_fields=[
                {
                    "key": "reading_g",
                    "label": "Wskazanie wagi dla wzorca 500 g",
                    "type": "number",
                    "unit": "g",
                    "min": "499.998",
                    "max": "500.002",
                    "required": True,
                },
                {
                    "key": "level_ok",
                    "label": "Poziomnica w środku",
                    "type": "bool",
                    "required": True,
                },
            ],
        )
        oven_tpl = _upsert_form_template(
            db,
            name="Sprawdzenie temperatury pieca",
            raw_fields=[
                {
                    "key": "temperature_c",
                    "label": "Temperatura komory",
                    "type": "number",
                    "unit": "°C",
                    "min": "103.0",
                    "max": "107.0",
                    "required": True,
                }
            ],
        )
        press_tpl = _upsert_form_template(
            db,
            name="Sprawdzenie prasy wytrzymałościowej",
            raw_fields=[
                {
                    "key": "force_kn",
                    "label": "Wskazanie siły dla wzorca 100 kN",
                    "type": "number",
                    "unit": "kN",
                    "min": "99.0",
                    "max": "101.0",
                    "required": True,
                },
                {
                    "key": "note",
                    "label": "Uwagi",
                    "type": "text",
                    "required": False,
                },
            ],
        )
        blaine_tpl = _upsert_form_template(
            db,
            name="Sprawdzenie aparatu Blaine'a",
            raw_fields=[
                {
                    "key": "surface_cm2_g",
                    "label": "Powierzchnia właściwa wzorca",
                    "type": "number",
                    "unit": "cm²/g",
                    "min": "2800",
                    "max": "4900",
                    "required": True,
                }
            ],
        )

        temp_plan_a = _upsert_check_plan(
            db,
            equipment=seeded_equipment["122/A"],
            name="Kontrola warunków środowiskowych",
            interval_months=1,
            lead_months=0,
            form_template=env_tpl,
        )
        for offset, temperature, humidity in (
            (-5, "20.9", "48"),
            (-4, "21.2", "51"),
            (-3, "22.4", "49"),
            (-2, "21.4", "50"),
            (-1, "21.6", "47"),
        ):
            _upsert_check_record(
                db,
                plan=temp_plan_a,
                performed_on=_day_in_month(today, offset, 5),
                values={"temperature_c": temperature, "humidity_pct": humidity},
                performed_by=laborant.id,
                out_of_range=temperature == "22.4",
                note=(
                    "Po wymianie filtra — powtórzone po stabilizacji"
                    if temperature == "22.4"
                    else "Wpis z karty ewidencji pracowni"
                ),
            )
        _upsert_check_record(
            db,
            plan=temp_plan_a,
            performed_on=date(today.year, today.month, min(today.day, 5)),
            values={"temperature_c": "21.8", "humidity_pct": "46"},
            performed_by=laborant.id,
        )

        scale_plan_a = _upsert_check_plan(
            db,
            equipment=seeded_equipment["121/A"],
            name="Sprawdzenie wagi wzorcem 500 g",
            interval_months=3,
            lead_months=0,
            form_template=scale_tpl,
        )
        for offset, reading, out_of_range in (
            (-8, "499.999", False),
            (-5, "500.008", True),
            (-2, "500.001", False),
        ):
            _upsert_check_record(
                db,
                plan=scale_plan_a,
                performed_on=_day_in_month(today, offset, 19),
                values={"reading_g": reading, "level_ok": True},
                performed_by=laborant.id,
                out_of_range=out_of_range,
                note=(
                    "Wskazanie poza kryterium; powtórzone po czyszczeniu szalki"
                    if out_of_range
                    else "Wpis z karty ewidencji pracowni"
                ),
            )

        oven_plan = _upsert_check_plan(
            db,
            equipment=seeded_equipment["125/A"],
            name="Sprawdzenie temperatury pieca",
            interval_months=1,
            lead_months=0,
            form_template=oven_tpl,
        )
        for offset, temperature in ((-5, "104.9"), (-4, "108.4"), (-3, "104.6"), (-2, "104.8")):
            _upsert_check_record(
                db,
                plan=oven_plan,
                performed_on=_day_in_month(today, offset, 20),
                values={"temperature_c": temperature},
                performed_by=laborant.id,
                out_of_range=temperature == "108.4",
                note=(
                    "Chwilowy wzrost po załadunku; powtórzone po ustabilizowaniu"
                    if temperature == "108.4"
                    else "Wpis z karty ewidencji pracowni"
                ),
            )

        press_plan = _upsert_check_plan(
            db,
            equipment=seeded_equipment["201/W"],
            name="Sprawdzenie prasy wytrzymałościowej",
            interval_months=3,
            lead_months=0,
            form_template=press_tpl,
        )
        for offset, force in ((-8, "100.2"), (-5, "100.1"), (-2, "100.3")):
            _upsert_check_record(
                db,
                plan=press_plan,
                performed_on=_day_in_month(today, offset, 15),
                values={"force_kn": force, "note": "Wzorzec siły 100 kN"},
                performed_by=laborant.id,
            )

        blaine_plan = _upsert_check_plan(
            db,
            equipment=seeded_equipment["204/W"],
            name="Sprawdzenie aparatu Blaine'a",
            interval_months=6,
            lead_months=0,
            form_template=blaine_tpl,
        )
        for offset, surface in ((-11, "3460"), (-5, "3450")):
            _upsert_check_record(
                db,
                plan=blaine_plan,
                performed_on=_day_in_month(today, offset, 10),
                values={"surface_cm2_g": surface},
                performed_by=laborant.id,
            )

        _upsert_check_plan(
            db,
            equipment=seeded_equipment["205/W"],
            name="Sprawdzenie komory klimatycznej",
            interval_months=1,
            lead_months=0,
            form_template=env_tpl,
        )

        _upsert_calibration_plan(
            db,
            equipment=seeded_equipment["122/A"],
            dispatch_on=_day_in_month(today, 1, 7),
            return_on=_day_in_month(today, 1, 14),
            note="Wzorcowanie zewnętrzne w Laboratorium Wzorcującym Testo Polska.",
            created_by=admin.id,
        )
        _upsert_calibration_plan(
            db,
            equipment=seeded_equipment["204/W"],
            dispatch_on=_day_in_month(today, 2, 10),
            return_on=_day_in_month(today, 2, 17),
            note="Wzorcowanie aparatu Blaine'a w ICiMB Kraków.",
            created_by=admin.id,
        )

        _seed_optional_reagents(db, labs=labs_by_code, today=today, worker_id=laborant.id)
        _seed_optional_results(
            db,
            today=today,
            worker_id=laborant.id,
            equipment=seeded_equipment,
        )


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entrypoint for `python -m app.seed`."""
    parser = argparse.ArgumentParser(description="Seed starter and demo data.")
    parser.add_argument(
        "--today",
        type=date.fromisoformat,
        default=None,
        help="Override reference date (YYYY-MM-DD).",
    )
    args = parser.parse_args(argv)
    target_today = args.today if args.today is not None else datetime.now(UTC).date()

    with SessionLocal() as db:
        seed(db, today=target_today)
        db.commit()

    sys.stdout.write(f"Seeded starter/demo data for {target_today.isoformat()}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
