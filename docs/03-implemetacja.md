# 03 — Plan implementacji

> **Dla agentów (np. Claude Code):** wykonuj zadanie po zadaniu; kroki to checkboxy `- [ ]`.

**Cel:** działające demo (przeglądarka + Android + iOS) systemu nadzoru nad wyposażeniem,
wzorcowaniami, sprawdzeniami, odczynnikami i kontrolą zakresu wyników.

**Architektura:** jeden frontend React (przeglądarka i Capacitor) → API FastAPI → PostgreSQL;
osobny worker liczy terminy i tworzy powiadomienia. Szczegóły: [02-architektura.md](02-architektura.md).

**Stack:** Python 3.12+ (uv), FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, pwdlib[argon2],
PostgreSQL 17, React + TypeScript + Vite, shadcn/ui (Tailwind CSS 4), TanStack Query,
openapi-typescript + openapi-fetch, Capacitor 8. Identyfikacja: QR i tag NFC (ten sam link).
OCR świadectw: opcjonalne zewnętrzne API zgodne z OpenAI (`/chat/completions`, model
multimodalny albo OCR, np. Qwen-VL) — tylko szkic pól, zatwierdza admin.

**Spec:** [01-zadanie.md](01-zadanie.md) (wymagania), [02-architektura.md](02-architektura.md)
(projekt), [04-research.md](04-research.md) (uzasadnienie), [05-kryteria.md](05-kryteria.md)
(kryteria jury — co musi być gotowe na ocenę).

---

## Ograniczenia globalne

- Kod, nazwy, commity — po angielsku; interfejs i komunikaty błędów — po polsku.
- Python 3.12 (`uv`), JS/TS przez `bun` canary — bez `npm`, `npx`, `pip` (AGENTS.md); Capacitor 8 (build iOS: Xcode 26+ na macOS).
- Wyprzedzenie `lead_months`: urządzenia i partie 1–12 (domyślnie 1), plany sprawdzeń 0–12 (domyślnie 0); granice w ustawieniach.
- Terminy wzorcowań i sprawdzeń w miesiącach; „ważne do” = ostatni dzień miesiąca terminu; „alert od” = 1. dzień miesiąca (termin − wyprzedzenie).
- Liczby pomiarowe: `Decimal` w Pythonie, `Numeric()` bez skali w bazie, tekst w JSON; na wejściu przecinek albo kropka.
- Miesiące w API jako `"YYYY-MM"`, daty jako `"YYYY-MM-DD"`.
- Błędy API: `{"error": "<KOD>", "message": "<tekst>"}` — kody z 02 §7.
- Każdy zapis przechodzi przez historię zmian; zapisów technicznych nie usuwamy.
- OCR: odpowiedź dostawcy to dane niezaufane — liczby jako tekst, ten sam parser co przy wpisie ręcznym (przecinek/kropka), złe pola odrzucane; `extract` nic nie zapisuje; klucz API tylko w env; testy bez sieci (dostawca zaślepiony).
- NFC: tag NDEF zawiera ten sam URL co QR; brak nowej logiki uprawnień — karta i wpis sprawdzane tak samo jak po skanie.
- CORS: `capacitor://localhost`, `https://localhost`, adres webowy, `http://localhost:5173`.
- Komendy backendu uruchamiamy w `backend/`: `uv run ruff check .`, `uv run ruff format --check .`, `uv run ty check`, `uv run pytest`; frontendu w `frontend/`: `bun fmt --check`, `bun lint --max-warnings 0`, `bun check`, `bun test` (bramki jakości z AGENTS.md).
- „Dziś” w testach: `TODAY = date(2026, 11, 27)` (stała w `tests/conftest.py`).
- Dane testowe i demo są syntetyczne; hasła z zmiennych środowiskowych, nigdy w repo.

## Na co uważać

Sześć sytuacji, których spec nie opisuje wprost, a które najłatwiej zepsują demo:

1. **Liczba z przecinkiem lub śmieci** („3,35”, „0,105”, „1,2,3”, „abc”, puste) → przecinek działa, śmieci dają 422 `INVALID_NUMBER`, nigdy 500. Testy: T03, T11, T14.
2. **Przełom miesięcy i lat** — termin 01/2027 z wyprzedzeniem 1 → alert od 01.12.2026; 31.05.2027 − 6 mies. → 30.11.2026; ostatni dzień miesiąca jeszcze „ważny”. Testy: T02.
3. **Sesja wygasła w trakcie skanu** — po zalogowaniu użytkownik wraca na `/e/<id>`, a parametr `next` nie przekieruje poza aplikację. Testy: T19, T28.
4. **Skan bez uprawnień** — inna pracownia, brak na liście upoważnionych, urządzenie wycofane → 403 / 409 z kodem, bez formularza. Testy: T11, lista kontrolna T24.
5. **Worker uruchomiony dwa razy** (albo dwa naraz) → żadnych zdublowanych powiadomień. Testy: T15.
6. **OCR zwraca śmieci albo dostawca milczy** — zły JSON, liczba „-” albo 502 po timeoucie → formularz zostaje pusty z komunikatem, wpis ręczny działa; nic nie zapisuje się automatycznie. Testy: T37.

---

## Zespół i ścieżki

| Osoba | Ścieżka | Zakres | Zadania |
|---|---|---|---|
| **Timur** | A + B — rdzeń i urządzenia (backend) | szkielet, historia zmian, logowanie, uprawnienia, ustawienia, pliki, rejestr, upoważnienia, wzorcowania, sprawdzenia, harmonogram, OCR świadectwa | T01, T04–T12, T16, T37 |
| **Andrii** | C — odczynniki, cement, wykresy, PDF (backend) | daty i liczby, odczynniki, wyniki z kontrolą zakresu, powiadomienia i worker, kanały, wydruki PDF, wykresy, raport dla kierownika | T02, T03, T13–T15, T17, T31–T33 |
| **Jakub** | D — cały frontend (React UI) | wszystkie ekrany w jednym stylu, formularz OCR, także ekrany telefonu w T24–T25 | T19–T22, T34, T38, ekrany T24–T25 |
| **Ivan** | E + F — Capacitor, QR i NFC, DevOps, dane, testy | projekty natywne, skaner, NFC, aparat, push, Docker, serwer testowy, dane demo, e2e, raport walidacji, skrypt KPI | T18, T23, T26–T29, T35, natywna część T24–T25 |
| **Misza** | Product, QA, pitch | kryteria (05), koszty i KPI z mentorami, testy akceptacyjne z listą kontrolną, scenariusz demo, prezentacja, Q&A | T30, T36 |

Ekrany robi tylko Jakub (jeden styl, bez konfliktów w `frontend/src`); Ivan dostarcza
funkcje natywne (`src/platform/*`, `scanEquipment()`, aparat, push), które ekrany wywołują.

## Harmonogram

| Dzień | Kamień | Gotowe, gdy |
|---|---|---|
| 0 | Start | T01 na `main`, kontrakt schematów, front i Capacitor założone, ustalone: kto ma Maca |
| 1–2 | **M1** — przekrój pionowy w przeglądarce | dodaję urządzenie, wpisuję wzorcowanie, widzę status w harmonogramie |
| 3–4 | **M2** — telefon | Android: skan QR albo zbliżenie NFC → karta → sprawdzenie; dzwonek powiadomień u admina |
| 5 | **M3** — komplet funkcji | odczynniki, wyniki z kontrolą zakresu, wykresy i raport dla kierownika, ustawienia, historia zmian; liczby KPI i kosztów od mentorów (T36) |
| 6 | **M4** — utwardzenie | e2e zielone, build iOS, push, OCR świadectwa i zapis tagów NFC, dane demo, skrypt KPI (T35); wieczorem zamrożenie funkcji i slajdy |
| 7 | Demo | scenariusz T30 przechodzi 2× bez błędu; próba Q&A |

Priorytety: **P0** — potrzebne do demo; **P1** — pełne 11 funkcji i materiały do kryteriów
(05); **P2** — jeśli zostanie czas.

## Zasady pracy

- Gałąź na zadanie: `feat/t08-equipment-registry`; PR do `main`, 1 review, CI zielone.
- Commity: `feat(scope): ...`, `fix: ...`, małe i częste.
- Gotowe = testy zielone, lint czysty, typy frontu wygenerowane ponownie (`bun run gen:api`), jeśli zmieniło się API.

---

## Struktura plików

```
backend/
  pyproject.toml  alembic/  Dockerfile
  app/
    main.py  config.py  db.py  errors.py  worker.py  seed.py  kpi.py
    core/          clock.py  status.py  dates.py  ranges.py
    settings/      models.py  service.py  router.py
    audit/         models.py  context.py  listener.py  service.py  router.py
    auth/          models.py  security.py  service.py  deps.py  permissions.py  router.py
    files/         models.py  service.py  router.py
    forms/         models.py  validation.py  router.py
    equipment/     models.py  schemas.py  service.py  router.py
    integrations/  ocr.py (klient OpenAI-compatible: Qwen-VL, OpenAI, lokalny vLLM)
    reagents/      models.py  schemas.py  service.py  router.py
    results/       models.py  schemas.py  service.py  router.py
    schedule/      service.py  router.py
    notifications/ models.py  service.py  push.py  router.py
    print/         render.py  chart.py  service.py  router.py  templates/  fonts/
    reports/       models.py  schemas.py  service.py  router.py
  scripts/validation_report.py
  tests/           (te same podfoldery co app/) conftest.py
frontend/
  package.json  vite.config.ts  capacitor.config.ts  Dockerfile
  src/
    main.tsx  App.tsx
    api/       client.ts  schema.d.ts (generowany)
    auth/      tokenStore.ts  LoginPage.tsx  AuthGuard.tsx
    platform/  server.ts
    layout/    OfficeLayout.tsx  LabLayout.tsx  ManagerLayout.tsx  NotificationBell.tsx
    lib/       qr.ts  months.ts  status.ts  navigation.ts  (+ *.test.ts)
    features/  schedule/  equipment/  checks/  scan/  reagents/  results/
               notifications/  settings/  audit/  setup/  reports/
  android/  ios/   (generowane przez Capacitor, w repo)
  e2e/
infra/
  docker-compose.yml  Caddyfile  .env.example  backup.sh
data/seed/cement_parameters.csv
.github/workflows/ci.yml
```

---

## Zadania

### T01 · Szkielet backendu, baza testowa, CI — A · P0 · zależy od: —

**Pliki:** utwórz `backend/pyproject.toml`, `backend/app/{main,config,db,errors}.py`,
`backend/app/core/clock.py`, `backend/app/settings/{models,service}.py`, `backend/alembic/`,
`backend/tests/{conftest,test_health}.py`, `infra/docker-compose.yml` (na razie tylko `db`),
`.github/workflows/ci.yml`.

**Daje:**
- `create_app() -> FastAPI` — prefiks `/api`, CORS z `EnvConfig.cors_origins`, `GET /api/health`
- `AppError(status_code: int, error: str, message: str, details: list[dict] | None = None)`; błędy walidacji Pydantic → 422 `VALIDATION_ERROR` z `details`
- `get_db()`, `Base`; `get_today() -> date` (zależność FastAPI)
- `Setting(key: str, value: JSON)`, `DEFAULT_SETTINGS`, `get_setting(db, key: str) -> Any`, `update_settings(db, values: dict[str, Any]) -> dict[str, Any]`
- fixtures: `db` (sesja w transakcji wycofywanej po teście), `client` (TestClient z nadpisanymi `get_db` i `get_today` → `TODAY`)

```python
DEFAULT_SETTINGS = {
    "equipment_lead_months_range": [1, 12], "check_lead_months_range": [0, 12],
    "default_equipment_lead_months": 1, "default_check_lead_months": 0,
    "default_expiry_lead_months": 1, "default_stock_count_interval_days": 30,
    "out_of_range_action": "FLAG", "withdraw_on_calibration_nok": True,
    "session_ttl_hours": 12, "max_upload_mb": 10, "worker_interval_minutes": 60,
    "login_max_attempts": 5, "login_window_minutes": 15,
}
```

- [ ] **Testy (czerwone):** `test_health_returns_ok` — `GET /api/health` → 200, `{"status": "ok"}`; `test_app_error_envelope` — trasa testowa rzuca `AppError(404, "NOT_FOUND", "Nie znaleziono")` → 404, `{"error": "NOT_FOUND", "message": "Nie znaleziono"}`; `test_get_setting_falls_back_to_default` — pusta tabela → `get_setting(db, "default_equipment_lead_months") == 1`.
- [ ] **Uruchom:** `docker compose -f infra/docker-compose.yml up -d db`, potem `uv run pytest -q` → FAIL.
- [ ] **Implementacja:** sesja testowa `Session(bind=connection, join_transaction_mode="create_savepoint")` na połączeniu z otwartą transakcją, wycofywaną po teście; schemat przez `alembic upgrade head` raz na sesję testów.
- [ ] **Kontrakt (dzień 0, razem z B i C):** schematy Pydantic bez logiki — `EquipmentOut`, `CalibrationCreate`, `CheckRecordCreate`, `DueItem`, `NotificationOut`, `TestResultCreate` (pola z 02 §3.2); endpointy GET zwracają `[]`. Frontend generuje z tego typy od pierwszego dnia.
- [ ] **CI:** usługa `postgres`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run ty check`, `uv run pytest`.
- [ ] **Uruchom:** `uv run pytest -q` → PASS.
- [ ] **Commit:** `feat(backend): app skeleton, test db, settings defaults, CI`

### T02 · Miesiące, terminy, statusy — C · P0 · zależy od: T01

**Pliki:** utwórz `backend/app/core/{status,dates}.py`; test `backend/tests/core/test_dates.py`.

**Daje:**
- `Status(StrEnum)`: `OK`, `DUE_SOON`, `OVERDUE`, `NO_DATA`, `WITHDRAWN`, `NOT_REQUIRED`, `LOW`, `COUNT_DUE`
- `add_months(d: date, months: int) -> date` (dzień przycięty do końca miesiąca), `month_start(d: date) -> date`, `month_end(d: date) -> date`
- `next_due_month(done: date, interval_months: int) -> date` (1. dzień miesiąca)
- `month_window(due_month: date, lead_months: int) -> tuple[date, date]` → `(alert_from, valid_until)`
- `date_window(expiry: date, lead_months: int) -> tuple[date, date]` → `(alert_from, valid_until)`
- `due_status(alert_from: date, valid_until: date, today: date) -> Status` (tylko `OK` / `DUE_SOON` / `OVERDUE`)

- [ ] **Test (czerwony):**

```python
from datetime import date
from app.core.dates import add_months, next_due_month, month_window, date_window, due_status
from app.core.status import Status

TODAY = date(2026, 11, 27)

def test_add_months_clamps_to_month_end():
    assert add_months(date(2027, 5, 31), -6) == date(2026, 11, 30)
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)

def test_next_due_month_counts_from_certificate_month():
    assert next_due_month(date(2025, 12, 1), 12) == date(2026, 12, 1)
    assert next_due_month(date(2026, 11, 5), 1) == date(2026, 12, 1)

def test_month_window_rolls_over_year():
    assert month_window(date(2027, 1, 1), 1) == (date(2026, 12, 1), date(2027, 1, 31))
    assert month_window(date(2027, 1, 1), 12) == (date(2026, 1, 1), date(2027, 1, 31))

def test_examples_from_architecture():  # 02 §4.3
    assert due_status(*month_window(date(2027, 3, 1), 1), TODAY) is Status.OK
    assert due_status(*month_window(date(2026, 12, 1), 1), TODAY) is Status.DUE_SOON
    assert due_status(*month_window(date(2026, 10, 1), 1), TODAY) is Status.OVERDUE
    assert due_status(*date_window(date(2027, 5, 31), 6), TODAY) is Status.OK
    assert due_status(*date_window(date(2027, 5, 31), 6), date(2026, 11, 30)) is Status.DUE_SOON
    assert due_status(*month_window(date(2026, 12, 1), 0), TODAY) is Status.OK

def test_last_day_of_due_month_is_still_valid():
    window = month_window(date(2026, 11, 1), 1)
    assert due_status(*window, date(2026, 11, 30)) is Status.DUE_SOON
    assert due_status(*window, date(2026, 12, 1)) is Status.OVERDUE
```

- [ ] **Uruchom:** `uv run pytest tests/core/test_dates.py -q` → FAIL (brak modułu).
- [ ] **Implementacja:** jedyny nieoczywisty fragment to `add_months`:

```python
def add_months(d: date, months: int) -> date:
    years, month0 = divmod(d.month - 1 + months, 12)
    year, month = d.year + years, month0 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))
```

  Reszta wynika z testów: `month_window = (add_months(due, -lead), month_end(due))`, `date_window = (add_months(expiry, -lead), expiry)`, `due_status`: `today > valid_until` → `OVERDUE`, `today >= alert_from` → `DUE_SOON`, inaczej `OK`.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(core): month-based due dates and statuses`

### T03 · Liczby i zakresy — C · P0 · zależy od: T01

**Pliki:** utwórz `backend/app/core/ranges.py`; test `backend/tests/core/test_ranges.py`.

**Daje:** `RangeResult(StrEnum)`: `IN_RANGE`, `BELOW`, `ABOVE`; `parse_decimal(text: str) -> Decimal` (rzuca `ValueError`);
`check_range(value: Decimal, min_value: Decimal | None, max_value: Decimal | None) -> RangeResult` (granice włącznie, `None` = bez granicy).

- [ ] **Test (czerwony):**

```python
from decimal import Decimal
import pytest
from app.core.ranges import parse_decimal, check_range, RangeResult

@pytest.mark.parametrize("text, expected", [
    ("3,35", "3.35"), (" 0,105 ", "0.105"), ("3.20", "3.20"), ("-0,001", "-0.001"), ("2800", "2800")])
def test_parse_decimal_accepts_comma_and_dot(text, expected):
    assert parse_decimal(text) == Decimal(expected)

@pytest.mark.parametrize("text", ["", "  ", "abc", "1,2,3", "1.2.3", "NaN", "Infinity", "1e5", "3,"])
def test_parse_decimal_rejects_garbage(text):
    with pytest.raises(ValueError):
        parse_decimal(text)

def test_so3_range_from_scope_form():  # 01 §4: SO₃ 0,10–3,20 %
    lo, hi = Decimal("0.10"), Decimal("3.20")
    assert check_range(Decimal("3.20"), lo, hi) is RangeResult.IN_RANGE
    assert check_range(Decimal("3.21"), lo, hi) is RangeResult.ABOVE
    assert check_range(Decimal("0.09"), lo, hi) is RangeResult.BELOW

def test_chloride_range_keeps_precision():  # 01 §4: Cl⁻ 0,005–0,105 %
    assert check_range(parse_decimal("0,1050"), Decimal("0.005"), Decimal("0.105")) is RangeResult.IN_RANGE
    assert check_range(parse_decimal("0,1051"), Decimal("0.005"), Decimal("0.105")) is RangeResult.ABOVE

def test_open_bounds():  # konsystencja zaczynów: brak zakresu
    assert check_range(Decimal("999"), None, None) is RangeResult.IN_RANGE
```

- [ ] **Uruchom:** `uv run pytest tests/core/test_ranges.py -q` → FAIL.
- [ ] **Implementacja:** `parse_decimal` — `strip()`, wzorzec `^-?[0-9]+([.,][0-9]+)?$` (nie `\d` — w Pythonie łapie też cyfry innych alfabetów, np. „٣”), zamiana przecinka na kropkę, `Decimal(...)`.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(core): decimal parsing and range check`

### T04 · Historia zmian — A · P0 · zależy od: T01

**Pliki:** utwórz `backend/app/audit/{models,context,listener,service,router}.py`, migracja; test `backend/tests/audit/test_audit.py`.

**Daje:**
- `AuditLog`: `at`, `user_id`, `action`, `entity` (nazwa tabeli), `entity_id` (tekst), `before`, `after`, `reason`
- `audit_context(user_id: int | None, reason: str | None = None)` — context manager na `ContextVar`; `set_audit_user(user_id: int | None) -> None`
- `register_audit_listener(session_factory) -> None` — `after_flush`, pomija `AuditLog`, `UserSession`, `Notification`
- `log_event(db, *, action: str, entity: str, entity_id: str | None, after: dict | None, user_id: int | None, reason: str | None = None) -> None`
- `GET /api/audit?entity=&entity_id=&from=&to=` (uprawnienie dopina T06)

- [ ] **Testy (czerwone):** `test_update_records_before_and_after` — w `audit_context(user_id=7, reason="test")` zmiana `Setting` `default_equipment_lead_months` 1 → 2 → jeden `AuditLog(action="update", entity="setting", before={"value": 1}, after={"value": 2}, user_id=7, reason="test")`; `test_create_and_delete_are_recorded`; `test_audit_rows_are_not_audited` — jedna zmiana = dokładnie jeden wiersz; `test_log_event_writes_reject` — `log_event(action="reject", entity="test_result", entity_id=None, after={"value": "3,35"}, user_id=7)` → wiersz.
- [ ] **Uruchom:** `uv run pytest tests/audit -q` → FAIL.
- [ ] **Implementacja:** w `after_flush` stan sesji i historia atrybutów są jeszcze sprzed flusha, a ID nowych wierszy już są; zapis tylko zmienionych kolumn (`inspect(obj).attrs[...].history`); wartości `Decimal` i `date` jako tekst w JSON.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(audit): append-only change history`

### T05 · Użytkownicy, pracownie, logowanie — A · P0 · zależy od: T04

**Pliki:** utwórz `backend/app/auth/{models,security,service,deps,permissions,router}.py`, migracja; testy `backend/tests/auth/test_login.py`; rozszerz `backend/tests/conftest.py`.

**Daje:**
- modele: `Lab(name, code, active)`, `Role(name, permissions: list[str])`, `User` (tabela `app_user`: `login`, `full_name`, `password_hash`, `role_id`, `all_labs`, `active`, `labs` przez `user_lab`), `UserSession` (tabela `user_session`: `user_id`, `token_hash`, `expires_at`, `revoked_at`, `device_info`)
- `Permission(StrEnum)` z wartościami z 02 §5 (`"equipment:read"`, …) i `DEFAULT_ROLES: dict[str, frozenset[Permission]]` — `"admin"`: wszystkie; `"manager"` (kierownik): `EQUIPMENT_READ`, `SCHEDULE_READ`, `REAGENT_READ`, `RESULT_READ`, `REPORT_READ`, `AUDIT_READ`; `"worker"`: `EQUIPMENT_READ`, `SCHEDULE_READ`, `REAGENT_READ`, `RESULT_READ`, `CHECK_WRITE`, `STOCK_WRITE`, `RESULT_WRITE`
- `hash_password(password: str) -> str`, `verify_password(password: str, password_hash: str) -> bool` (pwdlib, Argon2); `new_token() -> tuple[str, str]` (surowy token 32 bajty url-safe, skrót sha256 hex)
- `login(db, *, login: str, password: str, device_info: str | None, now: datetime) -> tuple[str, User]`, `resolve_token(db, raw_token: str, now: datetime) -> User`, `logout(db, raw_token: str) -> None`
- zależność `current_user` (ustawia też `set_audit_user`); `POST /api/auth/login` (`{login, password, device_info?}` → `{token, user}`), `POST /api/auth/logout`, `GET /api/me`
- fixtures: `make_lab(code="A", name="Analityczna") -> Lab`, `make_user(role="worker", labs=(), all_labs=False, password="test-pass-123") -> User`, `auth(user) -> dict[str, str]` (nagłówek z nowym tokenem)

- [ ] **Testy (czerwone):** `test_login_returns_token_and_user` — 200, `len(token) >= 40`; `test_token_is_stored_only_as_hash` — `token_hash == sha256(token)`, surowego tokenu nie ma w bazie; `test_wrong_password_is_401` — `INVALID_CREDENTIALS` i `AuditLog(action="login", after={"success": False, "login": ...})`; `test_inactive_user_cannot_login` — 401 `INVALID_CREDENTIALS`; `test_logout_revokes_token` — potem `GET /api/me` → 401 `NOT_AUTHENTICATED`; `test_expired_session_is_401`; `test_sixth_failed_login_in_window_is_429` — 5 złych haseł, szóste → 429 `TOO_MANY_ATTEMPTS` (liczone z `AuditLog` w oknie `login_window_minutes`).
- [ ] **Uruchom:** `uv run pytest tests/auth -q` → FAIL.
- [ ] **Implementacja:** czas sesji z `session_ttl_hours`; `resolve_token` odrzuca sesje wygasłe, unieważnione i należące do nieaktywnych użytkowników.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(auth): users, labs, hashed session tokens, login throttling`

### T06 · Uprawnienia — A · P0 · zależy od: T05

**Pliki:** rozszerz `backend/app/auth/permissions.py`; test `backend/tests/auth/test_permissions.py`.

**Daje:**
- `visible_lab_ids(user: User) -> set[int] | None` (`None` = wszystkie pracownie)
- `require(user: User, permission: Permission, *, lab_id: int | None = None, equipment=None) -> None` — rzuca `AppError` 403 `FORBIDDEN` / `LAB_OUT_OF_SCOPE` / `NOT_AUTHORIZED_FOR_EQUIPMENT`. `equipment` to obiekt z `lab_id: int` i `authorized_user_ids: set[int]` (w T09 to właściwość `Equipment`). Lista upoważnionych obowiązuje tylko przy `CHECK_WRITE` i tylko użytkowników bez `EQUIPMENT_WRITE`.
- `GET /api/audit` wymaga `AUDIT_READ`

- [ ] **Testy (czerwone):** `test_worker_lacks_admin_permission` — `require(worker, Permission.SETTINGS_WRITE)` → `FORBIDDEN`; `test_lab_scope` — pracownik A, `lab_id` pracowni W → `LAB_OUT_OF_SCOPE`, admin `all_labs` przechodzi; `test_check_write_requires_list_for_worker` — `SimpleNamespace(lab_id=a.id, authorized_user_ids=set())` → `NOT_AUTHORIZED_FOR_EQUIPMENT`, z ID na liście → przechodzi; `test_admin_writes_checks_without_list`; `test_audit_endpoint_admin_only` — pracownik 403, admin 200.
- [ ] **Uruchom:** `uv run pytest tests/auth/test_permissions.py -q` → FAIL.
- [ ] **Implementacja:** kolejność sprawdzeń: uprawnienie roli → zakres pracowni → lista upoważnionych.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(auth): permissions, lab scope, equipment authorization rule`

### T07 · Ustawienia, pracownie i użytkownicy (API admina) — A · P1 · zależy od: T06

**Pliki:** utwórz `backend/app/settings/router.py`, rozszerz `backend/app/auth/router.py`; test `backend/tests/settings/test_admin_api.py`.

**Daje:** `GET/PUT /api/settings` (znane klucze, typy, zakresy `*_range` jako `[min, max]` z `min <= max`); `GET/POST /api/labs`, `PATCH /api/labs/{id}`; `GET/POST /api/users`, `PATCH /api/users/{id}` (rola, zakres pracowni, `active`, nowe hasło); `GET /api/roles`.

- [ ] **Testy (czerwone):** `test_put_settings_is_audited` — wpis w historii z użytkownikiem admina; `test_unknown_setting_key_is_422` — `VALIDATION_ERROR`; `test_lab_code_must_be_unique` — 409 `DUPLICATE_LAB_CODE`; `test_worker_cannot_change_settings` — 403 `FORBIDDEN`; `test_deactivated_user_token_stops_working` — `PATCH active=false` → token tej osoby → 401.
- [ ] **Uruchom:** `uv run pytest tests/settings -q` → FAIL.
- [ ] **Implementacja:** endpointy cienkie, walidacja w `update_settings`.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(admin): settings, labs and users API`

### T08 · Rejestr urządzeń — B · P0 · zależy od: T02, T06

**Pliki:** utwórz `backend/app/equipment/{models,schemas,service,router}.py`, migracja; test `backend/tests/equipment/test_equipment.py`.

**Daje:**
- modele `Equipment` (pola z 02 §3.2; unikalne `(lab_id, number)` i `public_id`), `Calibration`, `CalibrationPoint` (same dane — reguły w T10)
- `format_code(number: str, lab_code: str) -> str` → `"121/A"`; `new_public_id() -> str` — 10 znaków z alfabetu `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (`secrets`)
- `last_calibration(db, equipment_id: int) -> Calibration | None`; `equipment_status(eq: Equipment, last: Calibration | None, today: date) -> Status`
- `create_equipment(db, user, data: EquipmentCreate) -> Equipment` — opcjonalne `last_calibrated_month` („z naklejki”) tworzy pierwsze `Calibration(result="OK", note="Przeniesione z ewidencji papierowej")`
- `update_equipment`, `withdraw(db, user, equipment_id: int, reason: str) -> Equipment`, `restore(db, user, equipment_id: int, reason: str) -> Equipment`
- `GET/POST /api/equipment`, `GET/PATCH /api/equipment/{id}`, `POST /api/equipment/{id}/withdraw`, `POST /api/equipment/{id}/restore`, `GET /api/equipment/by-qr/{public_id}` → `EquipmentCard` (`EquipmentOut` + `check_plans` (wypełni T11) + `can_write` (T09) + `qr_url = f"{PUBLIC_BASE_URL}/e/{public_id}"`)
- `EquipmentOut`: pola modelu + `code`, `status`, `next_due_month`
- `public_id` jest wspólny dla QR i NFC: tag NDEF niesie ten sam `qr_url`, a `by-qr` obsługuje oba nośniki
- fixture `make_equipment(lab, number="121", interval=12, lead=1, last_calibrated_month: str | None = None, **kw) -> Equipment`

- [ ] **Testy (czerwone):**

```python
def test_same_number_in_two_labs_is_allowed(client, make_lab, make_user, auth):
    lab_a, lab_w = make_lab("A"), make_lab("W", name="Wytrzymałościowa")
    admin = make_user("admin", all_labs=True)
    for lab in (lab_a, lab_w):
        r = client.post("/api/equipment", headers=auth(admin), json={
            "lab_id": lab.id, "number": "121", "name": "Waga analityczna", "calibration_interval_months": 12})
        assert r.status_code == 201
    codes = {e["code"] for e in client.get("/api/equipment", headers=auth(admin)).json()}
    assert codes == {"121/A", "121/W"}

def test_duplicate_number_in_same_lab_is_409(client, make_lab, make_user, auth):
    lab_a, admin = make_lab("A"), make_user("admin", all_labs=True)
    body = {"lab_id": lab_a.id, "number": "121", "name": "Waga", "calibration_interval_months": 12}
    client.post("/api/equipment", headers=auth(admin), json=body)
    r = client.post("/api/equipment", headers=auth(admin), json=body)
    assert r.status_code == 409 and r.json()["error"] == "DUPLICATE_EQUIPMENT_NUMBER"

def test_sticker_month_creates_first_calibration(client, make_lab, make_user, auth):  # dziś 27.11.2026
    lab_a, admin = make_lab("A"), make_user("admin", all_labs=True)
    r = client.post("/api/equipment", headers=auth(admin), json={
        "lab_id": lab_a.id, "number": "7", "name": "Termohigrometr",
        "calibration_interval_months": 12, "lead_months": 1, "last_calibrated_month": "2025-12"})
    body = client.get(f"/api/equipment/{r.json()['id']}", headers=auth(admin)).json()
    assert body["next_due_month"] == "2026-12" and body["status"] == "DUE_SOON"
```

  Dodatkowo: `test_lead_months_outside_1_12_is_422` (parametry 0 i 13 → `VALIDATION_ERROR`); `test_without_calibration_status_is_no_data`; `test_withdraw_and_restore_need_reason` (wycofanie → `WITHDRAWN`, `restore` bez powodu → 422); `test_worker_sees_own_lab_only_and_cannot_create` (lista tylko z A, POST → 403 `FORBIDDEN`); `test_by_qr_returns_card` (`code == "121/A"`, `qr_url` kończy się `/e/<public_id>`).
- [ ] **Uruchom:** `uv run pytest tests/equipment/test_equipment.py -q` → FAIL.
- [ ] **Implementacja:** zakres wyprzedzenia z `get_setting(db, "equipment_lead_months_range")`; status: wycofane → `WITHDRAWN`, bez wymogu → `NOT_REQUIRED`, brak wzorcowania → `NO_DATA`, inaczej `due_status(*month_window(next_due_month(...), lead), today)`.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(equipment): registry, codes, QR ids, computed status`

### T09 · Upoważnienia do urządzeń — B · P0 · zależy od: T08

**Pliki:** rozszerz `backend/app/equipment/{models,service,router}.py`; test `backend/tests/equipment/test_authorizations.py`.

**Daje:** `EquipmentAuthorization`; właściwość `Equipment.authorized_user_ids: set[int]`;
`set_authorized_users(db, user, equipment_id: int, user_ids: list[int]) -> list[User]`;
`GET/PUT /api/equipment/{id}/authorized-users` (`{"user_ids": [...]}`); `can_write` w karcie z T08.

- [ ] **Testy (czerwone):** `test_put_replaces_list` — `[u1, u2]`, potem `[u2]` → tylko u2; `test_user_without_lab_in_scope_is_422` — pracownik W do urządzenia w A → `USER_NOT_IN_LAB`; `test_worker_cannot_edit_list` — 403 `FORBIDDEN`; `test_card_can_write_follows_list` — karta po skanie: `false`, po dopisaniu: `true`.
- [ ] **Uruchom:** `uv run pytest tests/equipment/test_authorizations.py -q` → FAIL.
- [ ] **Implementacja:** `can_write` = `require(user, CHECK_WRITE, equipment=eq)` nie rzuca wyjątku.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(equipment): authorized users per device`

### T10 · Wzorcowania — B · P0 · zależy od: T08, T16

**Pliki:** rozszerz `backend/app/equipment/{schemas,service,router}.py`; test `backend/tests/equipment/test_calibrations.py`.

**Daje:**
- `CalibrationCreate`: `calibrated_month: "YYYY-MM"`, `vendor: str`, `certificate_no: str | None`, `adjustments: str | None`, `result: "OK" | "NOK"`, `points: list[{point, error, uncertainty, unit}]` (min. 1, liczby jako tekst), `note: str | None`, `attachment_ids: list[int] = []`
- `source` (`MANUAL` / `OCR`) i `ocr_meta` ustawia serwer na podstawie użytego szkicu; klient ich nie podaje (T37)
- `record_calibration(db, user, equipment_id: int, data: CalibrationCreate) -> Calibration`
- `GET/POST /api/equipment/{id}/calibrations`
- fixture `make_calibration(eq, month: str, result: str = "OK") -> Calibration`

- [ ] **Testy (czerwone)** (lokalne fixtures `admin_a`, `eq_a` — urządzenie w A, co 12 mies.):

```python
def test_next_due_from_certificate_month(client, admin_a, eq_a, auth):
    r = client.post(f"/api/equipment/{eq_a.id}/calibrations", headers=auth(admin_a), json={
        "calibrated_month": "2026-03", "vendor": "Laboratorium wzorcujące X", "certificate_no": "W/123/2026",
        "result": "OK", "points": [{"point": "500 g", "error": "-0,001", "uncertainty": "0,0005", "unit": "g"}]})
    assert r.status_code == 201
    assert r.json()["next_due_month"] == "2027-03"
    assert r.json()["points"][0]["error"] == "-0.001"
    assert client.get(f"/api/equipment/{eq_a.id}", headers=auth(admin_a)).json()["status"] == "OK"

def test_nok_withdraws_equipment(client, admin_a, eq_a, auth):
    client.post(f"/api/equipment/{eq_a.id}/calibrations", headers=auth(admin_a), json={
        "calibrated_month": "2026-11", "vendor": "Laboratorium wzorcujące X", "certificate_no": "W/124/2026",
        "result": "NOK", "points": [{"point": "500 g", "error": "0,9", "uncertainty": "0,1", "unit": "g"}]})
    body = client.get(f"/api/equipment/{eq_a.id}", headers=auth(admin_a)).json()
    assert body["status"] == "WITHDRAWN" and "W/124/2026" in body["withdrawn_reason"]
```

  Dodatkowo: `test_nok_keeps_dates_status_when_setting_off` (`withdraw_on_calibration_nok = False`); `test_worker_cannot_record_calibration` (403 `FORBIDDEN`); `test_calibration_attaches_scan` (załącznik dostaje `owner_type == "calibration"`); `test_calibration_on_withdrawn_equipment_keeps_it_withdrawn` (przywrócenie to osobna akcja z powodem).
- [ ] **Uruchom:** `uv run pytest tests/equipment/test_calibrations.py -q` → FAIL.
- [ ] **Implementacja:** liczby przez `parse_decimal` (błąd → 422 `INVALID_NUMBER`); `next_due_month` zapisany w rekordzie; wycofanie przy `NOK` wg ustawienia; załączniki przez `attach(...)` z T16.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(equipment): calibration results and next due month`

### T11 · Plany i wpisy sprawdzeń — B · P0 · zależy od: T03, T09, T16

**Pliki:** utwórz `backend/app/forms/{models,validation,router}.py`; rozszerz `backend/app/equipment/*`; testy `backend/tests/forms/test_validation.py`, `backend/tests/equipment/test_checks.py`.

**Daje:**
- `FormTemplate(name, fields)`, `FieldSpec` (`key`, `label`, `type: "number" | "text" | "bool" | "date"`, `unit`, `min`, `max`, `required`)
- `FormValidation` (`values: dict[str, Any]`, `errors: dict[str, str]`, `out_of_range: list[str]`); `validate_form_values(fields: list[FieldSpec], raw: dict[str, Any]) -> FormValidation`
- `CheckPlan`, `CheckRecord`; `CheckRecordCreate` (`performed_on: date`, `values: dict`, `note: str | None`, `attachment_ids: list[int] = []`)
- `record_check(db, user, check_plan_id: int, data: CheckRecordCreate) -> CheckRecord`
- `GET/POST /api/form-templates`, `PATCH /api/form-templates/{id}`, `GET/POST /api/equipment/{id}/check-plans`, `PATCH /api/check-plans/{id}`, `GET/POST /api/check-plans/{id}/records`; karta z T08 dostaje `check_plans` (`id`, `name`, `status`, `next_due_month`)
- fixture `make_check_plan(eq, fields: list[dict], interval=1, lead=0) -> CheckPlan`

- [ ] **Testy (czerwone)** (lokalne fixtures: `worker_a` upoważniony do `eq_a`, `worker_b` z A bez upoważnienia, `worker_w` z pracowni W):

```python
TEMP_FIELDS = [{"key": "temp", "label": "Temperatura", "type": "number", "unit": "°C",
                "min": "18", "max": "22", "required": True}]  # dane syntetyczne

def post_check(client, user, plan, temp, auth):
    return client.post(f"/api/check-plans/{plan.id}/records", headers=auth(user),
                       json={"performed_on": "2026-11-27", "values": {"temp": temp}})

def test_authorized_worker_records_check(client, worker_a, eq_a, make_check_plan, auth):
    r = post_check(client, worker_a, make_check_plan(eq_a, TEMP_FIELDS), "20,5", auth)
    assert r.status_code == 201 and r.json()["out_of_range"] is False

def test_value_outside_template_range_is_flagged(client, worker_a, eq_a, make_check_plan, auth):
    r = post_check(client, worker_a, make_check_plan(eq_a, TEMP_FIELDS), "23,5", auth)
    assert r.status_code == 201 and r.json()["out_of_range"] is True
    assert r.json()["values"]["temp"] == "23.5"

@pytest.mark.parametrize("who, status, error", [
    ("worker_b", 403, "NOT_AUTHORIZED_FOR_EQUIPMENT"),
    ("worker_w", 403, "LAB_OUT_OF_SCOPE")])
def test_scan_without_rights_is_rejected(client, request, eq_a, make_check_plan, auth, who, status, error):
    r = post_check(client, request.getfixturevalue(who), make_check_plan(eq_a, TEMP_FIELDS), "20", auth)
    assert r.status_code == status and r.json()["error"] == error
```

  Dodatkowo: `test_withdrawn_equipment_rejects_check` (409 `EQUIPMENT_WITHDRAWN`); `test_missing_required_field_is_422` (`VALIDATION_ERROR`, pole `temp` w `details`); `test_invalid_number_is_422` (`"abc"` → `INVALID_NUMBER`); `test_check_plan_lead_range_is_0_12` (0 i 12 → 201, 13 → 422).
- [ ] **Uruchom:** `uv run pytest tests/forms tests/equipment/test_checks.py -q` → FAIL.
- [ ] **Implementacja:** kolejność: zakres pracowni → lista upoważnionych → wycofane → walidacja pól (liczby przez `parse_decimal`, zakres przez `check_range`).
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(checks): configurable forms, check plans and records`

### T12 · Harmonogram — B · P0 · zależy od: T10, T11

**Pliki:** utwórz `backend/app/schedule/{service,router}.py`; test `backend/tests/schedule/test_schedule.py`.

**Daje:**
- `DueKind(StrEnum)`: `CALIBRATION`, `CHECK`, `LOT_EXPIRY`, `LOW_STOCK`, `STOCK_COUNT`
- `DueItem` (Pydantic): `kind`, `ref_type`, `ref_id`, `lab_id`, `label`, `due: date | None`, `alert_from: date | None`, `valid_until: date | None`, `status: Status` (`label` = `"{code} {name}"` dla urządzeń)
- `list_due_items(db, *, today: date, lab_ids: set[int] | None = None, kinds: set[DueKind] | None = None, include_ok: bool = False) -> list[DueItem]` — kolejność: `OVERDUE`, `NO_DATA`, `LOW`, `DUE_SOON`, `COUNT_DUE`, `OK`, potem `due`; pomija wycofane urządzenia
- dostawcy pozycji: `calibration_items(...)`, `check_items(...)` (T13 dopisuje `lot_items`, `stock_items`)
- `GET /api/schedule?lab_id=&kind=&horizon_months=&include_ok=`

- [ ] **Test (czerwony):**

```python
def test_overdue_first_and_ok_hidden(client, make_lab, make_user, make_equipment, auth):
    lab_a, admin = make_lab("A"), make_user("admin", all_labs=True)
    for number, month in (("1", "2026-03"), ("2", "2025-12"), ("3", "2025-10")):
        make_equipment(lab_a, number=number, interval=12, lead=1, last_calibrated_month=month)
    items = client.get("/api/schedule", headers=auth(admin)).json()
    assert [(i["label"].split()[0], i["status"]) for i in items] == [("3/A", "OVERDUE"), ("2/A", "DUE_SOON")]
```

  Dodatkowo: `test_include_ok_returns_all_three`; `test_lab_scope_hides_other_labs`; `test_withdrawn_equipment_not_listed`; `test_check_item_counts_from_last_record` — plan co 1 mies., wyprzedzenie 0, wpis 05.10.2026 → `CHECK`, `due == "2026-11-01"`, `valid_until == "2026-11-30"`, `DUE_SOON`.
- [ ] **Uruchom:** `uv run pytest tests/schedule -q` → FAIL.
- [ ] **Implementacja:** zakres pracowni z `visible_lab_ids(user)`; `horizon_months` przycina `due` do `today + N mies.`
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(schedule): unified due items`

### T13 · Odczynniki i CRM — C · P1 · zależy od: T02, T03, T06, T12

**Pliki:** utwórz `backend/app/reagents/{models,schemas,service,router}.py`, migracja; rozszerz `backend/app/schedule/service.py`; test `backend/tests/reagents/test_reagents.py`.

**Daje:**
- modele `Reagent`, `ReagentLot`, `StockCount` (pola z 02 §3.2)
- `current_stock(db, reagent_id: int) -> Decimal` (ostatni spis + partie przyjęte **po** dniu spisu); `last_stock_change(db, reagent_id: int) -> date | None`
- `receive_lot(db, user, reagent_id: int, data: LotCreate) -> ReagentLot`, `dispose_lot(db, user, lot_id: int, disposed_on: date) -> ReagentLot`, `record_stock_count(db, user, reagent_id: int, data: StockCountCreate) -> StockCount`
- `lot_items(...)` (`LOT_EXPIRY`, `date_window`) i `stock_items(...)` (`LOW_STOCK` → `LOW`, `STOCK_COUNT` → `COUNT_DUE`) w `list_due_items`
- `GET/POST /api/reagents`, `PATCH /api/reagents/{id}`, `POST /api/reagents/{id}/lots`, `PATCH /api/lots/{id}`, `POST /api/reagents/{id}/stock-counts`
- fixtures `make_reagent(lab, name="Kwas solny", unit="ml", min_stock="600", kind="REAGENT", interval_days=30, expiry_lead=1)`, `make_lot(reagent, quantity, received_on, expiry, lot_no="L1")`, `make_count(reagent, quantity, counted_on)`

- [ ] **Test (czerwony):**

```python
def test_current_stock_is_last_count_plus_later_receipts(db, make_lab, make_reagent, make_lot, make_count):
    r = make_reagent(make_lab("A"))
    make_lot(r, "1000", received_on=date(2026, 10, 20), expiry=date(2027, 10, 1))  # przed spisem
    make_count(r, "500", counted_on=date(2026, 11, 1))
    make_lot(r, "1000", received_on=date(2026, 11, 1), expiry=date(2027, 11, 1), lot_no="L2")  # w dniu spisu
    make_lot(r, "1000", received_on=date(2026, 11, 10), expiry=date(2027, 11, 1), lot_no="L3")
    assert current_stock(db, r.id) == Decimal("1500")
```

  Dodatkowo: `test_low_stock_in_schedule` (spis 500 < próg 600 → `LOW_STOCK`, `LOW`); `test_lot_expiry_uses_lead_months` (ważność 31.05.2027, wyprzedzenie 6: 27.11.2026 nie ma na liście, 30.11.2026 → `DUE_SOON`); `test_disposed_lot_is_ignored`; `test_stock_count_due_after_interval` (co 7 dni, spis 15.11.2026 → 27.11.2026 `COUNT_DUE`, `due == "2026-11-22"`); `test_worker_counts_only_own_lab` (403 `LAB_OUT_OF_SCOPE`).
- [ ] **Uruchom:** `uv run pytest tests/reagents -q` → FAIL.
- [ ] **Implementacja:** ilości przez `parse_decimal`; stan bez spisu = suma przyjętych partii.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(reagents): lots, stock counts, low stock and expiry`

### T14 · Parametry i wyniki badań — C · P1 · zależy od: T03, T04, T06

**Pliki:** utwórz `backend/app/results/{models,schemas,service,router}.py`, migracja; test `backend/tests/results/test_results.py`.

**Daje:**
- `TestParameter`, `TestResult` (pola z 02 §3.2)
- `record_result(db, user, data: TestResultCreate) -> TestResult` — `TestResultCreate`: `parameter_id`, `sample_label`, `value: str`, `repeat_of_id: int | None`
- `import_parameters_csv(db, text: str) -> int` — kolumny `material,name,unit,min_value,max_value,method,accredited`; puste min/max = bez zakresu
- `GET/POST /api/test-parameters`, `PATCH /api/test-parameters/{id}`, `POST /api/test-parameters/import`, `GET/POST /api/test-results`
- fixture `make_parameter(name="SO₃", unit="%", min_value="0.10", max_value="3.20", action=None)`

- [ ] **Test (czerwony):**

```python
def test_flag_mode_saves_out_of_range_result(client, make_parameter, make_user, auth):
    p, worker = make_parameter(), make_user("worker", all_labs=True)
    r = client.post("/api/test-results", headers=auth(worker),
                    json={"parameter_id": p.id, "sample_label": "Próbka 1", "value": "3,35"})
    assert r.status_code == 201
    assert r.json()["in_range"] is False
    assert (r.json()["min_snapshot"], r.json()["max_snapshot"]) == ("0.10", "3.20")

def test_block_mode_rejects_and_logs(client, db, make_parameter, make_user, auth):
    p, worker = make_parameter(action="BLOCK"), make_user("worker", all_labs=True)
    r = client.post("/api/test-results", headers=auth(worker),
                    json={"parameter_id": p.id, "sample_label": "Próbka 1", "value": "3,35"})
    assert r.status_code == 422 and r.json()["error"] == "OUT_OF_RANGE"
    assert db.query(TestResult).count() == 0
    assert db.query(AuditLog).filter_by(action="reject", entity="test_result").count() == 1
```

  Dodatkowo: `test_parameter_without_range_accepts_any_value` (konsystencja → `in_range` true); `test_snapshot_survives_range_change` (po zmianie max na 3.50 stary wynik ma `max_snapshot == "3.20"`); `test_repeat_links_previous_result`; `test_invalid_number_is_422` (`INVALID_NUMBER`); `test_import_csv_counts_rows` (2 wiersze z pustym i pełnym zakresem → 2, SO₃ ma min `0.10`).
- [ ] **Uruchom:** `uv run pytest tests/results -q` → FAIL.
- [ ] **Implementacja:** reakcja: `parameter.out_of_range_action` albo `get_setting(db, "out_of_range_action")`; przy `BLOCK` najpierw `log_event(action="reject", ...)` i commit, potem `AppError(422, "OUT_OF_RANGE", ...)`.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(results): test parameters, range check, flag or block`

### T15 · Powiadomienia i worker — C · P0 · zależy od: T12 (+ T11, T14 do powiadomień „od razu”)

**Pliki:** utwórz `backend/app/notifications/{models,service,router}.py`, `backend/app/worker.py`, migracja; test `backend/tests/notifications/test_notifications.py`.

**Daje:**
- `Notification`, `NotificationRule` (domyślne reguły z 02 §6), `NotificationKind(StrEnum)`: `CALIBRATION_DUE`, `CHECK_DUE`, `LOT_EXPIRY`, `LOW_STOCK`, `STOCK_COUNT_DUE`, `CHECK_OUT_OF_RANGE`, `RESULT_OUT_OF_RANGE`
- `dedupe_key(item: DueItem) -> str` = `f"{kind}:{ref_type}:{ref_id}:{due}:{status}"`
- `recipients_for(db, kind: NotificationKind, lab_id: int | None) -> list[User]`
- `generate_notifications(db, *, today: date) -> int` (liczba nowych; zapis przez `INSERT … ON CONFLICT DO NOTHING` na `(user_id, dedupe_key)`; nieaktualne → `resolved_at`)
- `notify_now(db, *, kind: NotificationKind, lab_id: int | None, ref_type: str, ref_id: int, title: str) -> int` — wpięte w `record_check` (`out_of_range`) i `record_result` (`FLAG` poza zakresem)
- `GET /api/notifications?unread=`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`, `GET/PUT /api/notification-rules`
- `run_once(today: date | None = None) -> int`; `python -m app.worker [--once] [--today YYYY-MM-DD]`

- [ ] **Test (czerwony)** (lokalne fixtures: `admin_a` z zakresem A, `admin_w` z zakresem W, urządzenie w A po terminie):

```python
def test_generate_is_idempotent_and_respects_scope(db, admin_a, admin_w, overdue_in_a):
    assert generate_notifications(db, today=TODAY) == 1
    assert generate_notifications(db, today=TODAY) == 0
    assert count_for(db, admin_a) == 1 and count_for(db, admin_w) == 0

def test_existing_key_is_skipped_without_error(db, admin_a, overdue_in_a):  # dwa workery naraz
    generate_notifications(db, today=TODAY)
    db.query(Notification).update({"read_at": None})
    assert generate_notifications(db, today=TODAY) == 0
```

  Dodatkowo: `test_stage_change_creates_second_notification` (termin 12/2026: 27.11.2026 → 1, 02.01.2027 → +1 `OVERDUE`); `test_new_calibration_resolves_open_notification`; `test_check_out_of_range_notifies_lab_admins_now`; `test_disabled_rule_creates_nothing`; `test_run_once_accepts_today_override`.
- [ ] **Uruchom:** `uv run pytest tests/notifications -q` → FAIL.
- [ ] **Implementacja:** worker: pętla `run_once()` + `sleep(worker_interval_minutes)`; błąd jednego przebiegu logujemy i idziemy dalej.
- [ ] **Uruchom:** → PASS; ręcznie: `uv run python -m app.worker --once --today 2026-12-15` wypisuje liczbę nowych powiadomień.
- [ ] **Commit:** `feat(notifications): rules, dedupe, worker`

### T16 · Pliki (skany, zdjęcia) — A · P0 · zależy od: T06

**Pliki:** utwórz `backend/app/files/{models,service,router}.py`, migracja; test `backend/tests/files/test_files.py`.

**Daje:**
- `Attachment` (pola z 02 §3.2 + `lab_id`, ustawiane przy przypięciu)
- `sniff_content_type(data: bytes) -> str | None` — `image/jpeg` (`FF D8 FF`), `image/png` (`89 50 4E 47`), `application/pdf` (`%PDF`)
- `save_upload(db, user, *, filename: str, data: bytes) -> Attachment` (limit `max_upload_mb`, plik w `FILES_DIR/<sha256[:2]>/<uuid>`)
- `attach(db, user, attachment_ids: list[int], *, owner_type: str, owner_id: int, lab_id: int) -> None` (tylko własne, jeszcze nieprzypięte)
- `page_images(db, attachment, limit: int = 5) -> list[bytes]` — PDF → PNG przez `pdftoppm -r 200`, JPEG/PNG bez zmian; wejście dla OCR (T37)
- `POST /api/attachments` (multipart), `GET /api/attachments/{id}` (nieprzypięty: tylko autor; przypięty: zakres pracowni)

- [ ] **Testy (czerwone):** `test_upload_jpeg_returns_id_and_sha256`; `test_too_large_is_413` (`FILE_TOO_LARGE`); `test_exe_renamed_to_jpg_is_415` (`UNSUPPORTED_FILE_TYPE`); `test_cannot_attach_someone_elses_upload` (403 `FORBIDDEN`); `test_download_respects_lab_scope` (pracownik W, plik w A → 403 `LAB_OUT_OF_SCOPE`).
- [ ] **Uruchom:** `uv run pytest tests/files -q` → FAIL.
- [ ] **Implementacja:** typ wyłącznie z zawartości; nazwa pliku tylko do nagłówka `Content-Disposition`.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(files): uploads with type sniffing and access control`

### T17 · Kanał push (backend) — C · P2 · zależy od: T15

**Pliki:** utwórz `backend/app/notifications/push.py`; rozszerz `models.py`, `router.py`, `worker.py`; test `backend/tests/notifications/test_channels.py`.

**Daje:** `DeviceToken`; `POST /api/devices` (`{platform: "android" | "ios" | "web", token}`, upsert po tokenie);
`PUSH_BODY = "Masz nowe powiadomienia w aplikacji"`; `send_push(tokens: list[str]) -> None` (firebase-admin, FCM HTTP v1);
worker po `generate_notifications` wysyła jedno push na odbiorcę, gdy reguła ma włączony kanał `PUSH`; token odrzucony przez FCM jako niezarejestrowany usuwa.

- [ ] **Testy (czerwone):** `test_register_device_upserts_token`; `test_push_body_has_no_details` (sender podmieniony, treść == `PUSH_BODY`); `test_channels_follow_rule` (`PUSH` wyłączony → brak wywołania); `test_unregistered_token_is_deleted`.
- [ ] **Uruchom:** `uv run pytest tests/notifications/test_channels.py -q` → FAIL.
- [ ] **Implementacja:** kanał bez konfiguracji (brak `FCM_CREDENTIALS_FILE`) jest pomijany z jednym wpisem w logu.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(notifications): push channel`

### T18 · Dane startowe i demo — F · P0 · zależy od: T10, T11 (T13, T14 dopisują swoje)

**Pliki:** utwórz `data/seed/cement_parameters.csv`, `backend/app/seed.py`; test `backend/tests/test_seed.py`.

**Daje:** `seed(db, *, today: date) -> None` (idempotentne po kluczach naturalnych); `python -m app.seed [--today YYYY-MM-DD]`.

- [ ] **CSV:** z tabeli w 01 §4; wytrzymałości rozbite na 2 wiersze (kN i MPa) → **25 wierszy**; konsystencja z pustym min/max; kropka dziesiętna; `accredited` = `true` dla „A”.
- [ ] **Testy (czerwone):** `test_seed_is_idempotent` (dwa uruchomienia → te same liczności); `test_seed_covers_demo_statuses` (przy `TODAY` są urządzenia `OK`, `DUE_SOON`, `OVERDUE`, `WITHDRAWN`, co najmniej jeden odczynnik `LOW` i partia `DUE_SOON`); `test_cement_csv_has_25_rows_and_so3_range`.
- [ ] **Uruchom:** `uv run pytest tests/test_seed.py -q` → FAIL.
- [ ] **Implementacja:** pracownie `A` Analityczna, `W` Wytrzymałościowa, `P` Paliw (W i P to założenie — pyt. 16 w 01); użytkownicy `admin` (wszystkie pracownie), `kierownik` (rola `manager`, wszystkie pracownie) i `laborant` (A), hasła z `SEED_ADMIN_PASSWORD`, `SEED_MANAGER_PASSWORD`, `SEED_WORKER_PASSWORD`; wyniki SO₃ i Cl⁻ z ostatnich 3 miesięcy (kilka poza zakresem) do wykresów i raportu (T32–T33); ok. 15 urządzeń o nazwach z rozmowy i z formularza zakresu (waga analityczna, termohigrometr, termometr szklany, wzorzec masy 500 g, piec, aparat Vicata, pierścienie Le Chateliera, piknometr helowy, aparat Blaine'a, prasa do badań wytrzymałości, kalorymetr); miesiące wzorcowań liczone od `today`, tak aby wyszły wszystkie statusy; plany: temperatura co 1 mies., sprawdzenie wagi co 3 mies.; odczynniki: kwas solny, chlorek baru, CRM cementu.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(seed): demo data and cement parameters`

### T19 · Szkielet frontu, klient API, logowanie, układy — D · P0 · zależy od: T05

**Pliki:** `frontend/` (Vite, React, TypeScript); `src/{main,App}.tsx`, `src/api/client.ts`, `src/auth/{tokenStore.ts,LoginPage.tsx,AuthGuard.tsx}`, `src/platform/server.ts`, `src/layout/{OfficeLayout,LabLayout}.tsx`, `src/lib/{qr,months,status,navigation}.ts` + testy.

**Daje:**
- `equipmentUrl(baseUrl: string, publicId: string): string`, `parseEquipmentUrl(text: string): string | null` (ścieżka `/e/` + ID pasujące do `^[0-9A-HJKMNP-TV-Z]{10}$`)
- `formatMonth(ym: string): string`, `parseMonthInput(text: string): string | null` (`"12/2026"` lub `"2026-12"` → `"2026-12"`)
- `statusLabel(status: Status): string`, `statusColor(status: Status): "success" | "warning" | "error" | "default"` (etykiety i kolory z 02 §4.2)
- `nextPathFrom(search: string): string` — tylko ścieżki wewnętrzne, domyślnie `/schedule`
- `getToken / setToken / clearToken` (przeglądarka: `sessionStorage`; telefon: T23); `getApiBaseUrl(): Promise<string>` (przeglądarka: ten sam origin)
- `api` (openapi-fetch) z nagłówkiem `Authorization`; 401 → `/login?next=<bieżąca ścieżka>`
- trasy: `/login`, `/schedule`, `/equipment`, `/equipment/:id`, `/e/:publicId`, `/reagents`, `/results`, `/notifications`, `/settings/*`, `/audit`, `/labels`; układ: `OfficeLayout` od breakpointu `md`, niżej `LabLayout`

- [ ] **Projekt:** `bun create vite frontend --template react-ts`; zależności: react-router-dom, @tanstack/react-query, tailwindcss, @tailwindcss/vite, radix-ui, class-variance-authority, cn, lucide-react, tw-animate-css, @fontsource-variable/geist, openapi-fetch, react-hook-form, dayjs, qrcode; dev: openapi-typescript, @testing-library/react, @types/bun; skrypt `gen:api` = `openapi-typescript http://localhost:8000/api/openapi.json -o src/api/schema.d.ts`; komponenty: `bunx shadcn@latest init -b radix -p nova`, potem `bunx shadcn@latest add button input label card alert`. Testy: `bun test` (`bun:test`), pliki `*.test.ts` obok modułów.
- [ ] **Testy (czerwone):**

```ts
import { describe, expect, it } from "bun:test";
import { equipmentUrl, parseEquipmentUrl } from "./qr";
import { formatMonth, parseMonthInput } from "./months";
import { statusColor, statusLabel } from "./status";
import { nextPathFrom } from "./navigation";

describe("lib", () => {
  it("QR: link ↔ public_id", () => {
    expect(equipmentUrl("https://lab.example.com", "K7Q2M9XH4D")).toBe("https://lab.example.com/e/K7Q2M9XH4D");
    expect(parseEquipmentUrl("https://lab.example.com/e/K7Q2M9XH4D")).toBe("K7Q2M9XH4D");
    expect(parseEquipmentUrl("https://lab.example.com/e/")).toBeNull();
    expect(parseEquipmentUrl("121/A")).toBeNull();
  });
  it("miesiące", () => {
    expect(formatMonth("2026-12")).toBe("12/2026");
    expect(parseMonthInput("12/2026")).toBe("2026-12");
    expect(parseMonthInput("13/2026")).toBeNull();
  });
  it("statusy", () => {
    expect(statusLabel("DUE_SOON")).toBe("Zbliża się termin");
    expect(statusColor("OVERDUE")).toBe("error");
  });
  it("powrót po zalogowaniu tylko wewnątrz aplikacji", () => {
    expect(nextPathFrom("?next=/e/K7Q2M9XH4D")).toBe("/e/K7Q2M9XH4D");
    expect(nextPathFrom("?next=https://evil.example")).toBe("/schedule");
    expect(nextPathFrom("?next=//evil.example")).toBe("/schedule");
    expect(nextPathFrom("")).toBe("/schedule");
  });
});
```

- [ ] **Uruchom:** `bun test` → FAIL.
- [ ] **Implementacja:** biblioteki z `src/lib`, `tokenStore`, `api`, logowanie, `AuthGuard`, oba układy; CI dostaje `bun install --frozen-lockfile && bun test && bun run build`.
- [ ] **Sprawdź:** `bun test` → PASS, `bun run build` → OK; ręcznie: wylogowany otwieram `/e/<id>` → logowanie → wracam na `/e/<id>`.
- [ ] **Commit:** `feat(web): app shell, API client, login, layouts`

### T20 · Harmonogram, grafik, dzwonek — D · P0 · zależy od: T12, T15, T19

**Pliki:** `src/features/schedule/{SchedulePage,MonthGrid}.tsx`, `src/layout/NotificationBell.tsx`, `src/features/notifications/NotificationsPage.tsx`.

- [ ] **Tabela (P0):** TanStack Table + komponenty shadcn/ui — Pracownia, Kod, Nazwa, Rodzaj, Termin (`MM/RRRR` dla miesięcy, data dla partii), Status (kolorowy chip); filtry → parametry `/api/schedule`: pracownia, rodzaj, horyzont (1 / 3 / 6 / 12 mies.), „pokaż wszystko”; klik w wiersz → karta.
- [ ] **Grafik miesięczny (P1):** wiersze = pozycje, kolumny = 12 kolejnych miesięcy, kolorowa komórka w miesiącu terminu (kolor wg statusu).
- [ ] **Dzwonek (P0):** licznik nieprzeczytanych (`GET /api/notifications?unread=true`, odświeżanie co 60 s), lista, „oznacz przeczytane”, klik → pozycja.
- [ ] **Sprawdź:** na danych demo pierwsze wiersze to `OVERDUE`; filtr pracowni ukrywa inne; po `python -m app.worker --once` dzwonek pokazuje licznik.
- [ ] **Commit:** `feat(web): schedule table, month grid, notifications bell`

### T21 · Urządzenia, karta, wzorcowanie, etykiety — D · P0 · zależy od: T08–T11, T16, T19

**Pliki:** `src/features/equipment/{EquipmentListPage,EquipmentForm,EquipmentCardPage,CalibrationForm,AuthorizedUsers,LabelsPrintPage}.tsx`.

- [ ] **Lista i formularz:** filtry (pracownia, status, szukaj); dodawanie i edycja z polami z 02 §3.2, w tym „Ostatnie wzorcowanie (z naklejki)” MM/RRRR.
- [ ] **Karta:** dane, status, następny termin, historia wzorcowań i sprawdzeń, plany sprawdzeń, lista upoważnionych (do wyboru tylko osoby z tej pracowni), wycofaj / przywróć z powodem.
- [ ] **Formularz wzorcowania:** miesiąc świadectwa, firma, nr świadectwa, adiustacje, punkty (dodawane wiersze: punkt, błąd, niepewność, jednostka), skan (upload → `attachment_ids`), OK / NIE OK → po zapisie odświeżenie karty. Przycisk „Odczytaj ze skanu” (szkic pól) — T38.
- [ ] **Etykiety:** `/labels?ids=` — kod, nazwa, następny termin MM/RRRR, QR z `equipmentUrl(...)` (biblioteka `qrcode`), druk przez `window.print()`; tag NFC zapisujemy zewnętrzną aplikacją NFC Tools tym samym linkiem albo ekranem w aplikacji mobilnej (P2, T24).
- [ ] **Sprawdź:** dodaję urządzenie z naklejką 12/2025 → status „Zbliża się termin”; wpisuję wzorcowanie 11/2026 OK → „Ważne”, termin 11/2027; wydrukowana etykieta skanuje się telefonem.
- [ ] **Commit:** `feat(web): equipment registry, card, calibration form, labels`

### T22 · Odczynniki, wyniki, ustawienia, historia (web) — D · P1 · zależy od: T07, T13, T14, T04

**Pliki:** `src/features/{reagents,results,settings,audit}/*`.

- [ ] **Odczynniki:** lista (stan, próg, najbliższa ważność, status), przyjęcie partii, utylizacja partii.
- [ ] **Wyniki:** formularz (parametr, próbka, wartość) → przy `in_range = false` czerwony wynik i „Powtórz badanie”, przy 422 `OUT_OF_RANGE` komunikat z zakresem; lista z czerwonymi wierszami.
- [ ] **Ustawienia:** ogólne (klucze z `DEFAULT_SETTINGS`), pracownie, użytkownicy, formularze (edytor listy pól), parametry (edycja min/max/reakcji, import CSV), reguły powiadomień, „QR konfiguracyjny” z adresem serwera (dla T23), integracje: OCR włącz/wyłącz i limit stron (model, URL i klucz tylko z env; ekran pokazuje status konfiguracji).
- [ ] **Historia zmian:** filtry (obiekt, ID, daty), widok przed / po.
- [ ] **Sprawdź:** SO₃ = 3,35 → czerwone; zmiana ustawienia widoczna w historii z moim loginem.
- [ ] **Commit:** `feat(web): reagents, results, settings, audit views`

### T23 · Capacitor: projekty, adres serwera, token — E · P0 · zależy od: T19

**Pliki:** `frontend/capacitor.config.ts`, `frontend/android/`, `frontend/ios/`, `src/features/setup/ServerSetupPage.tsx`, rozszerz `src/auth/tokenStore.ts`, `src/platform/server.ts`.

- [ ] **Projekty:** `bun add @capacitor/core @capacitor/android @capacitor/ios`; `bun add -d @capacitor/cli`; `bunx cap init "Inteligentne Laboratorium" pl.innovationhack.lab --web-dir dist`; `bunx cap add android`; `bunx cap add ios` (na Macu); `.gitignore`: `google-services.json`, `GoogleService-Info.plist`.
- [ ] **Token na telefonie:** `tokenStore` w aplikacji natywnej przez bezpieczny magazyn (np. `capacitor-secure-storage-plugin` — najpierw sprawdzić zgodność z Capacitor 8).
- [ ] **Adres serwera:** `needsServerSetup()` → `ServerSetupPage` przy pierwszym uruchomieniu: wpisanie adresu albo skan QR konfiguracyjnego; zapis dopiero po odpowiedzi `{"status": "ok"}` z `GET <adres>/api/health`.
- [ ] **CORS:** logowanie z telefonu przeciw serwerowi testowemu z T27 (POST działa = `capacitor://localhost` / `https://localhost` dopuszczone). Dev po HTTP: zezwolenie na ruch HTTP tylko w buildzie debug.
- [ ] **Sprawdź:** `bun run cap:sync`; Android: adres serwera → logowanie → harmonogram; iOS: to samo na Macu (Xcode 26+).
- [ ] **Commit:** `feat(mobile): capacitor projects, server setup, secure token`

### T24 · Skan → karta → sprawdzenie — E · P0 · zależy od: T11, T23

**Pliki:** `src/features/scan/{scan.ts,nfc.ts,ScanButton.tsx,QrResolvePage.tsx}`, `src/features/checks/{CheckForm,DynamicField}.tsx`.

**Daje:** `scanEquipment(): Promise<string | null>` — najpierw tag NFC (jeśli jest plugin i uprawnienie), inaczej `scanBarcode` z `@capacitor/barcode-scanner` (podpowiedź: QR) → `parseEquipmentUrl`; oba nośniki dają ten sam `public_id`.

- [ ] **Skan QR:** `bun add @capacitor/barcode-scanner @capacitor/camera`; przycisk „Skanuj” w `LabLayout`; kod spoza systemu → komunikat „To nie jest kod urządzenia”.
- [ ] **NFC:** `bun add <plugin NFC>` po sprawdzeniu zgodności z Capacitor 8 (kandydaci: `@capawesome-team/capacitor-nfc`, `@capacitor-community/nfc`); Android: `android.permission.NFC` i `<uses-feature android:name="android.hardware.nfc" android:required="false"/>`; iOS: `NFCReaderUsageDescription` i `com.apple.developer.nfc.read-types` w entitlements; odczyt rekordu NDEF URI → `parseEquipmentUrl`; tag bez linku → „To nie jest tag urządzenia”; brak NFC → przycisk pokazuje tylko QR.
- [ ] **Karta (`/e/:publicId`):** kod, nazwa, status, następny termin, plany z przyciskiem „Wpisz sprawdzenie”, gdy `can_write`; inaczej baner „Brak uprawnień do wpisu dla tego urządzenia”; wycofane → baner „Urządzenie wycofane — wpisy zablokowane”.
- [ ] **Formularz sprawdzenia:** pola z szablonu (`DynamicField`; liczby z przecinkiem, podpowiedź jednostki i min–max), wymagane pola, opcjonalne zdjęcie (`Camera.getPhoto` → `POST /api/attachments`), zapis → wynik na czerwono przy `out_of_range`.
- [ ] **Sprawdź na telefonie (lista kontrolna):** skan wydrukowanej etykiety → karta; zbliżenie tagu NFC → ta sama karta; tag innego systemu → komunikat; pracownik bez upoważnienia → baner, brak formularza; pracownik z innej pracowni → komunikat z `LAB_OUT_OF_SCOPE`; urządzenie wycofane → baner; temperatura 23,5 → czerwone, a u admina dzwonek „poza zakresem”.
- [ ] **Commit:** `feat(mobile): scan, equipment card, check form`

### T25 · Moje zadania i spis odczynników na telefonie — E · P1 · zależy od: T13, T24

**Pliki:** `src/features/schedule/MyTasksPage.tsx`, `src/features/reagents/StockCountPage.tsx`.

- [ ] **Moje zadania:** `/api/schedule?kind=CHECK&kind=STOCK_COUNT` dla moich pracowni, lista z dużymi przyciskami.
- [ ] **Spis:** odczynniki mojej pracowni → ilość (przecinek) → `POST /api/reagents/{id}/stock-counts` → status od razu po zapisie.
- [ ] **Sprawdź na telefonie:** spis poniżej progu → admin widzi „Mało”.
- [ ] **Commit:** `feat(mobile): my tasks and stock count`

### T26 · Push na telefonie — E · P2 · zależy od: T17, T23

**Pliki:** `src/platform/push.ts`.

- [ ] `bun add @capacitor-firebase/messaging`; pliki Firebase lokalnie (nie w repo); na iOS klucz APNs w projekcie Firebase.
- [ ] Przycisk „Włącz powiadomienia” (prośba o zgodę dopiero po kliknięciu) → token → `POST /api/devices`; push przy otwartej aplikacji → odświeżenie dzwonka.
- [ ] **Sprawdź:** `python -m app.worker --once` z nową pozycją → push na Androidzie; na iOS z kluczem APNs.
- [ ] **Commit:** `feat(mobile): push notifications`

### T27 · Docker i serwer testowy z HTTPS — F · P0 · zależy od: T01

**Pliki:** `backend/Dockerfile`, `frontend/Dockerfile`, `infra/{docker-compose.yml,Caddyfile,.env.example,backup.sh}`.

- [ ] **Compose:** `db`, `api` (migracje przy starcie), `worker`, `web` (Caddy: `{$DOMAIN}`, `/api/*` → `api:8000`, reszta → zbudowany frontend, automatyczne HTTPS).
- [ ] **Env:** `.env.example` uzupełniony o `OCR_API_URL`, `OCR_API_KEY`, `OCR_MODEL`, `OCR_TIMEOUT_S` (puste; brak = OCR wyłączony).
- [ ] **Baza:** osobna rola aplikacji; na `audit_log` tylko `INSERT` i `SELECT` (17025 7.5.2).
- [ ] **Serwer testowy (do dnia 2):** maszyna z domeną, `docker compose up -d --build`, `python -m app.seed`.
- [ ] **Sprawdź:** `curl https://$DOMAIN/api/health` → `{"status":"ok"}`; telefon w sieci hackathonu otwiera stronę.
- [ ] **Kopie (P2):** `backup.sh` — `pg_dump` + archiwum `FILES_DIR`, uruchamiany codziennie.
- [ ] **Commit:** `feat(infra): docker compose, caddy https, backups`

### T28 · Testy end-to-end i lista kontrolna mobile — F · P1 · zależy od: T20–T25

**Pliki:** `frontend/e2e/{schedule,calibration,results,qr-login}.spec.ts`, `frontend/playwright.config.ts`.

- [ ] `schedule.spec.ts` — admin loguje się → pierwszy wiersz ma status „Po terminie”.
- [ ] `calibration.spec.ts` — wzorcowanie OK dla urządzenia po terminie → status „Ważne”.
- [ ] `results.spec.ts` — SO₃ = 3,35 → czerwone „Poza zakresem”.
- [ ] `qr-login.spec.ts` — wylogowany otwiera `/e/<id>` → logowanie → karta urządzenia; `?next=https://evil.example` → `/schedule`.
- [ ] **Uruchom:** `bunx playwright test` na stosie z T27 z danymi z T18 → PASS.
- [ ] Lista kontrolna mobile z T24 przechodzi na 1 Androidzie i 1 iPhonie.
- [ ] **Commit:** `test(e2e): main flows`

### T29 · Raport walidacji 17025 — F · P2 · zależy od: testów T02–T16

**Pliki:** `backend/tests/conftest.py` (marker), `backend/scripts/validation_report.py`.

- [ ] Marker `@pytest.mark.req("F4", "17025-6.4.13e")` na testach; autouse fixture zapisuje marker przez `record_property`, więc trafia do JUnit XML.
- [ ] `validation_report.py report.xml` → Markdown: wymaganie → testy → wynik.
- [ ] **Sprawdź:** `uv run pytest --junitxml=report.xml && uv run python scripts/validation_report.py report.xml > validation-report.md` → każda funkcja F1–F11 ma co najmniej jeden zielony test.
- [ ] **Commit:** `feat(validation): requirement-to-test report`

### T30 · Scenariusz demo i prezentacja — F · P0 · zależy od: wszystkich P0

- [ ] **Scenariusz (5–7 min)** na danych z T18:
  1. Problem: papier, naklejki, segregatory (01 §2).
  2. Specjalistka: harmonogram — po terminie i zbliżające się; dzwonek.
  3. Grafik miesięczny pracowni A.
  4. Telefon: laborant skanuje etykietę (QR) albo zbliża tag NFC → sprawdzenie temperatury 23,5 → czerwone → u specjalistki powiadomienie.
  5. Nieupoważniony laborant skanuje → „Brak uprawnień”.
  6. Specjalistka wpisuje wzorcowanie (jeśli P2 gotowe: OCR szkicuje pola ze skanu, ona poprawia; punkty, niepewność, skan, OK) → zielony status, nowy termin.
  7. Odczynniki: „mało” po spisie z telefonu; CRM z terminem ważności.
  8. Wynik SO₃ = 3,35 → czerwony, poza 0,10–3,20 %.
  9. Wykres SO₃ z progiem → raport PDF → kierownik dostaje go w dzwonku (F10, F11).
  10. Uniwersalność: zmiana ustawienia → wpis w historii zmian (17025 7.11.2).
  11. Koszty i KPI: slajdy z 05 §a4 i §a5 (liczby z T35 i T36).
  12. Co dalej: pilotaż w jednej pracowni, rzeczy z 02 §14.
- [ ] **Prezentacja:** struktura i podział mówców z 05 §e — każdy z pięciu mówi swoją część; czas wg pyt. 22.
- [ ] **Q&A:** ściąga z 05 §e; próba z pytaniami zadawanymi przez Miszę.
- [ ] **Zapas:** nagranie wideo całego scenariusza (dzień 6) i zrzuty ekranu.
- [ ] **Sprawdź:** dzień 7 — 2 pełne przebiegi bez błędu; każda luka z 05 „Luki do zamknięcia” zamknięta albo świadomie pominięta.
- [ ] **Commit:** `docs(demo): demo script`

### T31 · Karta urządzenia jako PDF (Typst) — C · P1 · zależy od: T08–T11, T16, T27

**Pliki:** `backend/app/print/{render,service,router}.py`,
`backend/app/print/templates/equipment-history.typ`, `backend/app/print/fonts/`,
`backend/tests/print/test_history_pdf.py`, `backend/Dockerfile` (pin `typst` + poppler do testów),
`frontend/src/features/equipment/EquipmentCardPage.tsx` (przycisk „Drukuj kartę”).

- [ ] **Render:** `render(template: str, data: str) -> bytes` — `subprocess.run(["typst", "compile", ...])` bez powłoki, `--root` = katalog szablonów, `--input data=<json>`, `--ignore-system-fonts --font-path fonts`, `timeout=10`, `check=False`; kod wyjścia ≠ 0 → `AppError(500, "RENDER_FAILED", "Nie udało się złożyć dokumentu")`, stderr tylko do logu.
- [ ] **Endpoint:** `GET /api/equipment/{id}/history.pdf` — dane z rejestru i historii zmian (miesiące `YYYY-MM`, liczby jako tekst, statusy z 02 §4.2); `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<kod>.pdf"`; zakres pracowni jak przy odczycie karty; urządzenie wycofane drukuje się z adnotacją.
- [ ] **Szablon:** nagłówek (kod, nazwa, producent, model, nr seryjny, pracownia, lokalizacja), tabela wzorcowań i sprawdzeń z nagłówkiem powtarzanym na kolejnych stronach, stopka „wygenerowano” + numer strony; `#set text(lang: "pl", font: ("DejaVu Sans",))`.
- [ ] **Testy (czerwone):** 200 + `%PDF` na początku + `pdftotext` zawiera kod i ostatni termin; 403 dla pracowni spoza zakresu; 404 dla nieistniejącego ID; zepsuty szablon → 500 `RENDER_FAILED` (monkeypatch `render`).
- [ ] **Sprawdź:** `curl -s localhost:8000/api/equipment/1/history.pdf -H "Authorization: Bearer $TOKEN" | pdftotext - - | head`; wydruk historii na 3 strony — nagłówek tabeli powtarza się na każdej stronie.
- [ ] **Commit:** `feat(print): equipment history PDF via typst`

### T32 · Seria wyników i weryfikacja względem progu (F10) — C · P1 · zależy od: T14

**Pliki:** rozszerz `backend/app/results/{models,schemas,service,router}.py`, migracja (`verify_min`, `verify_max`); test `backend/tests/results/test_series.py`.

**Daje:**
- `Series` (Pydantic): `parameter` (`name`, `unit`), `threshold_min: str | None`, `threshold_max: str | None`, `points: list[{at, sample_label, value, status: RangeResult}]`, `count: int`, `out_of_threshold: int`
- `result_series(db, *, parameter_id: int, date_from: date, date_to: date) -> Series` — próg = `verify_min`/`verify_max`, a gdy puste — `min_value`/`max_value`; punkty rosnąco po `created_at`, daty włącznie
- `GET /api/test-results/series?parameter_id=&from=&to=` (`result:read`)

- [ ] **Testy (czerwone):** `test_series_uses_range_when_no_verify_threshold` (SO₃ 0,10–3,20: wyniki 1,5 / 3,35 → `out_of_threshold == 1`); `test_verify_threshold_overrides_range` (`verify_max = "2.50"` → 3 punkty powyżej 2,50 liczone); `test_points_sorted_and_period_inclusive`; `test_from_after_to_is_422` (`VALIDATION_ERROR`); `test_worker_without_result_read_is_403` — rola bez `RESULT_READ` → `FORBIDDEN`.
- [ ] **Uruchom:** `uv run pytest tests/results/test_series.py` → FAIL.
- [ ] **Implementacja:** status punktu przez `check_range` z T03; wartości jako tekst.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(results): measurement series with verification threshold`

### T33 · Raport PDF dla kierownika (F11) — C · P1 · zależy od: T31, T32, T15, T16

**Pliki:** utwórz `backend/app/reports/{models,schemas,service,router}.py`, `backend/app/print/chart.py`, `backend/app/print/templates/report.typ`, migracja; testy `backend/tests/print/test_chart.py`, `backend/tests/reports/test_reports.py`.

**Daje:**
- `chart_svg(series: Series, *, width: int = 640, height: int = 240) -> str` — czysta funkcja: oś czasu, punkty (poza progiem w kolorze błędu), linie progu; pusta seria → SVG z napisem „Brak danych”
- `Report` (02 §3.2); `ReportCreate`: `period_from`, `period_to`, `parameter_ids: list[int]` (puste = wszystkie z wynikami w okresie)
- `create_report(db, user, data: ReportCreate) -> Report` — dla każdego parametru `result_series` + `chart_svg`, jeden JSON do `report.typ`, `render(...)` z T31, PDF jako `Attachment(owner_type="report")`, `notify_now(kind=REPORT_READY, ...)` do kierowników
- `POST /api/reports` (`report:write`), `GET /api/reports`, `GET /api/reports/{id}.pdf` (`report:read`)

- [ ] **Testy (czerwone):** `test_chart_has_point_per_result_and_threshold_lines`; `test_empty_series_chart_says_no_data`; `test_create_report_returns_pdf` (`%PDF`, `pdftotext` zawiera nazwę parametru, okres i „poza progiem: 1”); `test_manager_gets_report_ready_notification`; `test_worker_cannot_create_report` (403 `FORBIDDEN`); `test_manager_downloads_pdf` (200, `application/pdf`); `test_period_from_after_to_is_422`.
- [ ] **Uruchom:** `uv run pytest tests/print/test_chart.py tests/reports` → FAIL.
- [ ] **Implementacja:** szablon tylko składa dokument (02 §10 „Druki PDF”): tytuł, okres, dla każdego parametru tabela punktów, wykres (SVG z JSON osadzony jako obraz), podsumowanie weryfikacji; powiadomienie w aplikacji (`REPORT_READY`) do kierowników.
- [ ] **Uruchom:** → PASS; ręcznie: `curl -s -X POST localhost:8000/api/reports -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"period_from":"2026-09-01","period_to":"2026-11-27","parameter_ids":[]}'`.
- [ ] **Commit:** `feat(reports): manager report PDF with charts`

### T34 · Wykresy, raporty i widok kierownika (web) — D · P1 · zależy od: T19, T32, T33

**Pliki:** `frontend/src/features/results/ChartPage.tsx`, `frontend/src/features/reports/{ReportsPage,ReportForm}.tsx`, `frontend/src/layout/ManagerLayout.tsx`.

- [ ] **Wykres:** wybór parametru i okresu → `GET /api/test-results/series`; komponent `chart` z shadcn/ui (Recharts), linie progu, punkty poza progiem w kolorze błędu, licznik „poza progiem”.
- [ ] **Raporty:** formularz (okres, parametry) → `POST /api/reports`; lista raportów z linkiem do PDF.
- [ ] **Kierownik:** układ tylko do odczytu — raporty, wykresy, harmonogram, historia zmian; dzwonek z `REPORT_READY`.
- [ ] **Sprawdź:** `bun test`, `bun check`; ręcznie na danych z T18: wykres SO₃ pokazuje punkty poza progiem, raport otwiera się u kierownika.
- [ ] **Commit:** `feat(web): charts, reports and manager view`

### T35 · Skrypt KPI na danych (05 §a5) — F · P1 · zależy od: T15, T18

**Pliki:** utwórz `backend/app/kpi.py`; test `backend/tests/test_kpi.py`.

**Daje:** `simulate(db, *, date_from: date, date_to: date) -> KpiReport` — przechodzi dzień po dniu przez `run_once(today=...)` w transakcji wycofywanej na końcu; liczy: pozycje z terminem w okresie, minimalne i medianę dni między pierwszym powiadomieniem a „ważne do”, pozycje po terminie bez wcześniejszego powiadomienia, powiadomienia na osobę na miesiąc, wyniki poza zakresem wykryte przy wpisie; `python -m app.kpi --from 2026-01-01 --to 2026-12-31` drukuje tabelę Markdown.

- [ ] **Testy (czerwone):** `test_alert_advance_is_lead_plus_due_month` (termin 12/2026, wyprzedzenie 1 → alert 01.11.2026, „ważne do” 31.12.2026 → minimum 60 dni); `test_no_overdue_item_without_prior_alert`; `test_simulation_leaves_database_unchanged`.
- [ ] **Uruchom:** `uv run pytest tests/test_kpi.py` → FAIL.
- [ ] **Implementacja:** tylko odczyt wyników `run_once`; żadnych nowych reguł.
- [ ] **Uruchom:** → PASS; wynik na danych z T18 wklejony do 05 §a5 (T36).
- [ ] **Commit:** `feat(kpi): simulate alert lead times and coverage`

### T36 · Koszty, KPI i kryteria z mentorami (05) — Misza · P1 · zależy od: T35

- [ ] Zadać pytania 18–22 z 01 §5; odpowiedzi wpisać w 01 i zastąpić założenia [Z] w 05 §a4 i §a5.
- [ ] Wkleić wynik T35 do 05 §a5; policzyć oszczędność godzin na liczbach od mentorów.
- [ ] Lista kontrolna akceptacji z tabeli 05 §b przejść na serwerze testowym (dzień 6) — każdą funkcję F1–F11 kliknąć w przeglądarce i na telefonie.
- [ ] **Sprawdź:** w 05 nie zostało założenie, na które mentorzy odpowiedzieli; tabela „Luki do zamknięcia” aktualna.
- [ ] **Commit:** `docs(criteria): costs and KPI from mentors`

### T37 · OCR świadectwa — zewnętrzne API (backend) — B · P2 · zależy od: T07, T10, T16

**Pliki:** utwórz `backend/app/integrations/ocr.py`; rozszerz `app/config.py`, `app/files/service.py`, `app/equipment/{models,schemas,service,router}.py`; migracja (`source`, `ocr_meta`); test `backend/tests/equipment/test_ocr.py`.

**Daje:**
- `OcrConfig` z env: `OCR_API_URL`, `OCR_API_KEY`, `OCR_MODEL`, `OCR_TIMEOUT_S`; brak URL lub klucza = OCR wyłączony
- `ocr_enabled(db) -> bool` — ustawienie `ocr_enabled` (domyślnie `false`) i komplet konfiguracji
- `extract_calibration(db, user, equipment_id: int, attachment_id: int) -> CalibrationDraft` — `page_images(...)` z T16, `httpx.post(f"{OCR_API_URL}/chat/completions", timeout=OCR_TIMEOUT_S)`, obraz jako data URL, stały prompt o JSON; bez ponowień
- `CalibrationDraft`: `vendor`, `certificate_no`, `calibrated_month`, `adjustments`, `points[]`, `confidence` (0–1 na pole), `provider`, `model`, `raw_text`; brakujące pole = `null`
- walidacja szkicu: miesiąc `YYYY-MM`, liczby tym samym parserem co ręcznie (`"0,10"`/`"0.10"` → `Decimal`), złe pole → `null` + `warning` (nie 422 całego szkicu); teksty tylko jako propozycja
- `POST /api/equipment/{id}/calibrations/extract` (`{"attachment_id": …}`) → 200 szkic; załącznik musi być własny (nieprzypięty) albo w zakresie pracowni urządzenia; 403 bez `calibration:write`, 409 `OCR_DISABLED`, 415 zły typ, 502 `OCR_FAILED`, 504 `OCR_TIMEOUT`; **nic nie zapisuje**
- przy `POST /calibrations` serwer zapisuje `source` (`MANUAL` / `OCR`) i `ocr_meta` (dostawca, model, pewność, `attachment_id`); klient ich nie podaje

- [ ] **Testy (czerwone)** — dostawca zaślepiony (`ocr_stub` podstawia `httpx.post`; żadnej sieci):

```python
def test_extract_returns_draft_and_saves_nothing(client, admin_a, eq_a, auth, ocr_stub):
    before = client.get(f"/api/equipment/{eq_a.id}/calibrations", headers=auth(admin_a)).json()
    r = client.post(f"/api/equipment/{eq_a.id}/calibrations/extract",
                    headers=auth(admin_a), json={"attachment_id": ocr_stub.attachment_id})
    assert r.status_code == 200
    assert r.json()["points"][0]["error"] == "-0.001" and r.json()["calibrated_month"] == "2026-10"
    after = client.get(f"/api/equipment/{eq_a.id}/calibrations", headers=auth(admin_a)).json()
    assert len(after) == len(before)

def test_extract_disabled_is_409_and_provider_not_called(client, admin_a, eq_a, auth, ocr_stub):
    r = client.post(f"/api/equipment/{eq_a.id}/calibrations/extract",
                    headers=auth(admin_a), json={"attachment_id": ocr_stub.attachment_id})
    assert r.status_code == 409 and r.json()["error"] == "OCR_DISABLED"
    assert not ocr_stub.called
```

  Dodatkowo: `test_provider_error_is_502` i `test_timeout_is_504` (stub rzuca `httpx.ReadTimeout`); `test_garbage_numbers_are_dropped_not_422` (provider zwraca `"n/d"` → pole `null` + `warning`); `test_extract_requires_calibration_write` (pracownik → 403 `FORBIDDEN`); `test_cannot_extract_foreign_attachment` (załącznik z pracowni W, urządzenie w A → 403 `FORBIDDEN`); `test_create_records_ocr_source` (`source == "OCR"`, `ocr_meta["provider"]`, w historii widać dostawcę).
- [ ] **Uruchom:** `uv run pytest tests/equipment/test_ocr.py -q` → FAIL.
- [ ] **Implementacja:** `ocr_enabled` w `DEFAULT_SETTINGS`; log tylko metadanych (rozmiar, model, czas), nigdy treści dokumentu ani odpowiedzi; brak klucza w odpowiedzi API i w `audit`.
- [ ] **Uruchom:** → PASS.
- [ ] **Commit:** `feat(equipment): OCR draft for calibration certificates`

### T38 · OCR w formularzu wzorcowania (web) — D · P2 · zależy od: T21, T37

**Pliki:** `src/features/equipment/{CalibrationForm,CalibrationOcrImport}.tsx`.

- [ ] **Import:** skan/PDF → `POST /api/attachments` → „Odczytaj ze skanu” (`POST .../calibrations/extract`); szkic wypełnia firmę, numer, miesiąc, adiustacje i punkty; pewność < 0,7 podświetlona, brak pola = puste (nie „0”).
- [ ] **Jawna akcja:** przycisk aktywny tylko przy `calibration:write`; komunikat przed wysyłką „Skan zostanie przesłany do zewnętrznego dostawcy OCR”; bez zgody — tylko wpis ręczny.
- [ ] **Błędy:** 409 → „Rozpoznawanie wyłączone — wpisz ręcznie”; 502/504 → „Nie udało się odczytać skanu — wpisz ręcznie”; formularz nigdy nie blokuje się na OCR.
- [ ] **Kontrola człowieka:** OK / NIE OK wybiera admin; „Wyczyść szkic” przywraca puste pola; po zapisie karta pokazuje w historii „wpis wsparty OCR (model)”.
- [ ] **Test (mock API):** szkic wypełnia firmę, miesiąc i punkty; wyczyszczenie przywraca puste pola; 409 nie pokazuje błędu całego formularza.
- [ ] **Sprawdź:** syntetyczny skan wielostronicowy → szkic z 5 stron; uszkodzony plik → komunikat, wpis ręczny działa.
- [ ] **Commit:** `feat(web): OCR-assisted calibration form`
