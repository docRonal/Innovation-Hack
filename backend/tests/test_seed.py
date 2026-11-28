from collections.abc import Callable
from datetime import date

import pytest
from app.audit.models import AuditLog
from app.auth.models import Lab, User
from app.core.db_security import ensure_db_roles
from app.core.status import Status
from app.equipment.models import CheckPlan, CheckRecord, Equipment
from app.forms.models import FormTemplate
from app.seed import seed
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

TODAY = date(2026, 11, 27)


@pytest.mark.req("F1", "F2", "F4", "F5", "F7")
def test_seed_is_idempotent(db: Session) -> None:
    seed(db, today=TODAY)
    db.flush()

    audit_count_first = db.scalar(select(func.count(AuditLog.id)))
    seed(db, today=TODAY)
    db.flush()
    audit_count_second = db.scalar(select(func.count(AuditLog.id)))

    assert db.scalar(select(func.count(Lab.id))) == 3
    assert db.scalar(select(func.count(User.id))) == 3
    assert db.scalar(select(func.count(Equipment.id))) == 15
    assert db.scalar(select(func.count(FormTemplate.id))) == 5
    assert db.scalar(select(func.count(CheckPlan.id))) == 6
    assert db.scalar(select(func.count(CheckRecord.id))) == 18
    assert audit_count_first is not None and audit_count_first > 0
    assert audit_count_second == audit_count_first


@pytest.mark.req("F1", "F2", "17025-6.4.8", "17025-6.4.9")
def test_seed_covers_demo_statuses_and_schedule_order(
    client: TestClient,
    db: Session,
    auth: Callable[[User], dict[str, str]],
) -> None:
    seed(db, today=TODAY)
    db.flush()
    admin = db.scalars(select(User).where(User.login == "admin")).one()

    eq_res = client.get("/api/equipment", headers=auth(admin))
    assert eq_res.status_code == 200
    statuses = {item["status"] for item in eq_res.json()}
    assert {
        Status.OK.value,
        Status.DUE_SOON.value,
        Status.OVERDUE.value,
        Status.WITHDRAWN.value,
        Status.NO_DATA.value,
        Status.NOT_REQUIRED.value,
    }.issubset(statuses)

    sched_res = client.get("/api/schedule", headers=auth(admin))
    assert sched_res.status_code == 200
    sched_statuses = [item["status"] for item in sched_res.json()]
    assert Status.OVERDUE.value in sched_statuses
    assert Status.DUE_SOON.value in sched_statuses
    assert sched_statuses.index(Status.OVERDUE.value) < sched_statuses.index(Status.DUE_SOON.value)


@pytest.mark.req("F2")
def test_seed_relative_dates_work_on_future_date(
    client: TestClient,
    db: Session,
    auth: Callable[[User], dict[str, str]],
) -> None:
    future_today = date(2028, 5, 20)
    seed(db, today=future_today)
    db.flush()
    admin = db.scalars(select(User).where(User.login == "admin")).one()

    eq_res = client.get("/api/equipment", headers=auth(admin))
    assert eq_res.status_code == 200
    assert len(eq_res.json()) == 15


@pytest.mark.req("F5", "F6", "F7")
def test_seed_demo_mobile_flows_authorized_and_unauthorized(
    client: TestClient,
    db: Session,
    auth: Callable[[User], dict[str, str]],
) -> None:
    seed(db, today=TODAY)
    db.flush()
    laborant = db.scalars(select(User).where(User.login == "laborant")).one()
    headers = auth(laborant)

    card_ok = client.get("/api/equipment/by-qr/CWA000122A", headers=headers)
    assert card_ok.status_code == 200
    card_data = card_ok.json()
    assert card_data["can_write"] is True
    assert len(card_data["check_plans"]) == 1
    plan_id = card_data["check_plans"][0]["id"]

    rec = client.post(
        f"/api/check-plans/{plan_id}/records",
        headers=headers,
        json={
            "performed_on": "2026-11-27",
            "values": {"temperature_c": "23,5", "humidity_pct": "52"},
        },
    )
    assert rec.status_code == 201
    assert rec.json()["out_of_range"] is True

    card_unauth = client.get("/api/equipment/by-qr/CWA000124A", headers=headers)
    assert card_unauth.status_code == 200
    assert card_unauth.json()["can_write"] is False

    card_other_lab = client.get("/api/equipment/by-qr/CWW000201W", headers=headers)
    assert card_other_lab.status_code == 403
    assert card_other_lab.json()["error"] == "LAB_OUT_OF_SCOPE"


@pytest.mark.req("17025-7.5.2", "17025-7.11.3")
def test_seed_runs_cleanly_under_least_privilege_app_role(db: Session) -> None:
    ensure_db_roles(db.connection(), app_user="_test_lab_app")
    db.execute(text("SET LOCAL ROLE _test_lab_app"))
    seed(db, today=TODAY)
    seed(db, today=TODAY)
    db.execute(text("RESET ROLE"))

    assert db.scalar(select(func.count(Equipment.id))) == 15
