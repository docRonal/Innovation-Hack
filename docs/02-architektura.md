# 02 — Architektura

Wymagania: [01-zadanie.md](01-zadanie.md). Research i uzasadnienia: [04-research.md](04-research.md).
Plan prac: [03-implemetacja.md](03-implemetacja.md).

Oznaczenia: **[T]** — decyzja zespołu; **propozycja** — decyzja architektury, którą zespół
może zmienić. F1–F9 to funkcje z tabeli w 01 §3.3.

---

## 1. Decyzje w skrócie

| # | Decyzja | Dlaczego | Status |
|---|---|---|---|
| D1 | Własna aplikacja, nie gotowy LIMS ani ERPNext | gotowe systemy są szersze niż potrzeba, ceny tylko na zapytanie, żaden darmowy nie ma wszystkiego (04 §4) | [T] |
| D2 | Backend: Python + FastAPI + PostgreSQL | wybór zespołu; FastAPI generuje opis API (OpenAPI), z którego frontend generuje typy | [T] |
| D3 | Jeden frontend React dla przeglądarki i telefonów; na Androida i iOS zamknięty w Capacitor od początku | wybór zespołu; jeden kod interfejsu, natywny skaner, aparat i push | [T] |
| D4 | Jedna instalacja = jedna firma; różnice między firmami tylko w konfiguracji | serwer może stać w zakładzie (cyberbezpieczeństwo, pyt. 13 w 01); prostszy model danych niż wiele firm w jednej bazie | propozycja |
| D5 | Terminy i statusy liczone z danych, nie wpisywane | status zawsze aktualny; nie ma drugiego miejsca, które może się rozjechać | propozycja |
| D6 | Każda zmiana zapisu i konfiguracji trafia do historii (kto, kiedy, co było, co jest) | 17025 pkt 7.5.2 i 7.11.2 | propozycja |
| D7 | Liczby pomiarowe jako `Decimal` / `NUMERIC`, nigdy `float`; na wejściu przecinek albo kropka | zakresy typu 0,005–0,105 %; polskie przyzwyczajenie do przecinka | propozycja |
| D8 | Logowanie tokenem sesji (nagłówek `Authorization: Bearer`), w bazie tylko skrót tokenu; hasła Argon2 | aplikacja Capacitor ma inny origin niż serwer, więc ciasteczka są zawodne; sesję można od razu unieważnić (zgubiony telefon, odebrane uprawnienia) | propozycja |
| D9 | Powiadomienia o terminach liczy osobny proces (worker), bez duplikatów | powiadomienie ma historię (przeczytane, rozwiązane); ponowne uruchomienie niczego nie dubluje | propozycja |
| D10 | QR i tag NFC zawierają ten sam link `https://<serwer>/e/<public_id>` | QR czyta każdy aparat i drukarka etykiet, a zbliżenie telefonu do tagu (NDEF URI) otwiera tę samą kartę bez skanowania; kod `121/A` się nie nadaje (ma „/”, numery powtarzają się między pracowniami); tag to tylko wskaźnik, dostęp nadal wymaga logowania i uprawnień | propozycja |
| D11 | Adres serwera ustawiany w aplikacji mobilnej przy pierwszym uruchomieniu | jedna aplikacja w sklepie, wiele firm, każda z własnym serwerem (D4) | propozycja |
| D12 | Druki formalne (karta urządzenia z historią, raport walidacji) generuje backend przez binarkę `typst`; etykiety QR zostają w przeglądarce | PDF jest zapisem (17025 7.5.2) — musi powstać po stronie serwera, niezależnie od przeglądarki użytkownika; jedna binarka zamiast przeglądarki w obrazie, szablony `.typ` podglądane tym samym narzędziem co produkcja | propozycja |
| D13 | Wykresy F10 liczone z wyników badań (`TestResult`), bez nowej encji „próbka”; raport F11 to PDF zapisany jako załącznik + powiadomienie dla kierownika | jedno źródło pomiarów dla kontroli zakresu, wykresu i raportu; „wysyłka” bez nowego kanału — dzwonek w aplikacji | propozycja |
| D14 | OCR świadectwa przez zewnętrzne API (model multimodalny/LLM albo OCR, np. Qwen-VL), wyłączony domyślnie | pełny „raport wzorcowania” ma wiele stron i tabel, a przepisywanie firmy, numeru, miesiąca i punktów zajmuje czas; wynik jest tylko szkicem pól — admin zatwierdza i decyduje OK / NIE OK (17025 7.5.2), oryginał skanu zostaje w plikach; klucz zostaje na serwerze, a dokument opuszcza go tylko w tej jednej, świadomej operacji | propozycja |

---

## 2. Widok ogólny

```mermaid
flowchart LR
  subgraph Klienci
    W["Przeglądarka<br/>biuro"]
    M["Aplikacja Android / iOS<br/>Capacitor, pracownia"]
  end
  subgraph Serwer["Serwer firmy (Docker)"]
    P["Caddy<br/>HTTPS"]
    A["API<br/>FastAPI"]
    K["Worker<br/>terminy i powiadomienia"]
    D[("PostgreSQL")]
    F[("Pliki<br/>skany, zdjęcia")]
  end
  FCM["Firebase Cloud Messaging<br/>push, opcjonalnie"]
  W --> P
  M --> P
  P --> A
  A --> D
  A --> F
  K --> D
  K -.-> FCM
  FCM -.-> M
```

| Komponent | Technologia | Odpowiada za |
|---|---|---|
| Frontend | React + TypeScript + Vite, shadcn/ui (Tailwind CSS, Radix UI), TanStack Query | ekrany biura i pracowni — jeden kod |
| Aplikacja mobilna | Capacitor 8 + pluginy: skaner kodów, NFC, aparat, push | ten sam frontend na Androidzie i iOS |
| API | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 | logika, uprawnienia, historia zmian, pliki |
| Worker | ten sam kod Pythona, osobny proces | przeliczanie terminów, powiadomienia, wysyłka push |
| Baza | PostgreSQL 17 | dane i historia zmian |
| Pliki | wolumen dyskowy | skany świadectw, zdjęcia kart |
| Proxy | Caddy | HTTPS, serwowanie frontendu, `/api` → API |

---

## 3. Model danych

### 3.1 Encje i relacje

```mermaid
erDiagram
  LAB ||--o{ EQUIPMENT : "ma"
  LAB ||--o{ REAGENT : "ma"
  ROLE ||--o{ APP_USER : "nadaje uprawnienia"
  APP_USER }o--o{ LAB : "widzi"
  EQUIPMENT ||--o{ EQUIPMENT_AUTHORIZATION : "lista upoważnionych"
  APP_USER ||--o{ EQUIPMENT_AUTHORIZATION : "jest upoważniony"
  EQUIPMENT ||--o{ CALIBRATION : "wzorcowania"
  CALIBRATION ||--o{ CALIBRATION_POINT : "punkty"
  EQUIPMENT ||--o{ CHECK_PLAN : "plany sprawdzeń"
  FORM_TEMPLATE ||--o{ CHECK_PLAN : "formularz"
  CHECK_PLAN ||--o{ CHECK_RECORD : "wpisy"
  REAGENT ||--o{ REAGENT_LOT : "partie"
  REAGENT ||--o{ STOCK_COUNT : "spisy"
  TEST_PARAMETER ||--o{ TEST_RESULT : "wyniki"
  APP_USER ||--o{ NOTIFICATION : "dostaje"
```

### 3.2 Pola

| Encja (tabela) | Najważniejsze pola | Skąd |
|---|---|---|
| `Lab` (`lab`) | `name`, `code` (litera, np. `A`, unikalna), `active` | 01 §2.1 |
| `Role` (`role`) | `name`, `permissions` (lista, §5) | 01 §3.2 |
| `User` (`app_user` — `user` jest zarezerwowane w PostgreSQL) | `login`, `full_name`, `password_hash`, `role_id`, `all_labs`, zakres pracowni (`user_lab`), `active` | 01 §3.2 |
| `UserSession` (`user_session` — nazwa `Session` koliduje z sesją SQLAlchemy) | `user_id`, `token_hash`, `expires_at`, `revoked_at`, `device_info` | D8 |
| `Equipment` (`equipment`) | `public_id` (do QR i NFC), `lab_id`, `number` → kod `121/A`; `name`, `category`, `manufacturer`, `model`, `serial_no`, `software_version`, `location`; `calibration_required`, `calibration_interval_months`, `calibration_mode` (`EXTERNAL` / `ON_SITE`), `lead_months`, `acceptance_criteria`; `withdrawn_at`, `withdrawn_reason`; `notes` | F1, 17025 6.4.13 |
| `EquipmentAuthorization` | `equipment_id`, `user_id` | F7 |
| `Calibration` | `equipment_id`, `calibrated_month` (ze świadectwa), `vendor`, `certificate_no`, `adjustments`, `result` (`OK` / `NOK` — decyzja admina), `next_due_month` (kopia na pamiątkę), `note`, `source` (`MANUAL` / `OCR`), `ocr_meta` (dostawca, model, pewność pól, `attachment_id`), załączniki | F4, 6.4.13 e |
| `CalibrationPoint` | `calibration_id`, `point` (np. „500 g”), `error`, `uncertainty`, `unit` | F4 („punkty wzorcowania” z rozmowy) |
| `FormTemplate` | `name`, `fields`: lista `{key, label, type: number/text/bool/date, unit, min, max, required}` | 01 §3.1 (pola konfigurowalne) |
| `CheckPlan` | `equipment_id`, `name` (np. „Sprawdzenie temperatury”, „Konserwacja”), `interval_months`, `lead_months`, `form_template_id`, `active` | F5, 6.4.10, 6.4.13 g |
| `CheckRecord` | `check_plan_id`, `performed_on`, `values` (JSON), `out_of_range`, `performed_by`, załączniki | F5 |
| `Reagent` | `lab_id`, `name`, `kind` (`REAGENT` / `CRM`), `unit`, `min_stock`, `stock_count_interval_days`, `expiry_lead_months`, `active` | F8 |
| `ReagentLot` | `reagent_id`, `lot_no`, `expiry_date`, `quantity`, `received_on`, `disposed_on` | F8, 6.4.13 f |
| `StockCount` | `reagent_id`, `quantity`, `counted_on`, `counted_by` | F8 |
| `TestParameter` | `material`, `name`, `unit`, `min_value`, `max_value` (puste = bez zakresu), `method`, `accredited`, `out_of_range_action` (`FLAG` / `BLOCK`, puste = ustawienie ogólne), `verify_min`, `verify_max` (próg weryfikacji F10, puste = zakres), `active` | F9, F10, 01 §4 |
| `TestResult` | `parameter_id`, `sample_label`, `value`, `min_snapshot`, `max_snapshot`, `in_range`, `repeat_of_id`, `created_by`, `created_at` — to są „pomiary z próbek” dla wykresów F10 | F9, F10, 7.5.2 |
| `Report` | `period_from`, `period_to`, `parameter_ids`, `attachment_id` (PDF), `created_by`, `created_at` | F11 |
| `Notification` | `user_id`, `kind`, `ref_type`, `ref_id`, `title`, `due`, `dedupe_key`, `read_at`, `resolved_at`; unikalne `(user_id, dedupe_key)` | F3 |
| `NotificationRule` | `kind` → `recipients` (role, czy wg zakresu pracowni), `channels` (`IN_APP`, `PUSH`), `enabled` | F3, 01 §3.1 |
| `DeviceToken` | `user_id`, `platform`, `token` (FCM) | F3 (push) |
| `Attachment` | `owner_type`, `owner_id`, `lab_id` (do kontroli dostępu), `filename`, `content_type`, `size_bytes`, `sha256`, `storage_key`, `uploaded_by` | F4, F5 |
| `Setting` | `key` → `value` (JSON) | 01 §3.1 |
| `AuditLog` | `at`, `user_id`, `action` (`create` / `update` / `delete` / `reject` / `login`), `entity`, `entity_id`, `before`, `after`, `reason` | 7.5.2, 7.11.2 |

Zasady:

- Kod urządzenia: unikalna para `(lab_id, number)`, wyświetlany jako `{number}/{lab.code}`.
- Przy dodawaniu urządzenia można podać ostatnie wzorcowanie z naklejki (MM/RRRR). Powstaje
  wtedy pierwszy wpis wzorcowania z notatką „przeniesione z ewidencji papierowej” — tak
  przenosimy kilkaset pozycji z papieru bez wymyślania danych.
- Zapisów technicznych (wzorcowania, sprawdzenia, spisy, wyniki) nie usuwamy. Poprawka =
  edycja z powodem → historia.
- Miesiące w bazie jako `date` z 1. dniem miesiąca, w API jako `"YYYY-MM"`.
- Kolumny liczbowe jako `NUMERIC` bez skali (zachowuje zapis, np. `0.10`); w JSON liczby
  pomiarowe są tekstem (`"0.10"`), żeby nic nie zaokrągliło ich po drodze.

### 3.3 Pokrycie 17025 pkt 6.4.13

| Punkt | Pola |
|---|---|
| a) identyfikacja, oprogramowanie | `Equipment.name`, `category`, `software_version`, kod |
| b) producent, typ, nr seryjny | `manufacturer`, `model`, `serial_no` |
| c) dowód zgodności | `Calibration.result`, skan świadectwa, `acceptance_criteria` |
| d) lokalizacja | `lab_id`, `location` |
| e) wzorcowania, adiustacje, kryteria, termin lub interwał | `Calibration` + `CalibrationPoint`, `adjustments`, `calibration_interval_months`, liczony termin |
| f) materiały odniesienia | `Reagent` (`kind = CRM`), `ReagentLot.expiry_date`, załączniki |
| g) konserwacja | `CheckPlan` / `CheckRecord` (np. plan „Konserwacja”) |
| h) uszkodzenia, naprawy | tylko `withdrawn_reason` i `notes` — pełny dziennik napraw później |

---

## 4. Terminy i statusy (serce systemu)

### 4.1 Reguły

| Co | Termin | „Ważne do” | „Alert od” |
|---|---|---|---|
| Wzorcowanie | `calibrated_month + calibration_interval_months` | ostatni dzień miesiąca terminu | 1. dzień miesiąca `termin − lead_months` |
| Sprawdzenie | miesiąc ostatniego `performed_on` + `interval_months` | ostatni dzień miesiąca terminu | jak wyżej |
| Partia odczynnika / CRM | `expiry_date` | `expiry_date` | `expiry_date − expiry_lead_months` (dzień przycięty do końca miesiąca) |
| Stan odczynnika | — | — | `stan < min_stock`, gdzie `stan = ostatni spis + partie przyjęte po dniu spisu` |
| Spis stanu | — | — | ostatni spis starszy niż `stock_count_interval_days` |

Wyprzedzenie: urządzenia i partie 1–12 miesięcy (domyślnie 1), plany sprawdzeń 0–12
(domyślnie 0). Dlaczego 0 dla sprawdzeń: przy sprawdzeniu co miesiąc wyprzedzenie 1 mies.
dawałoby alert zaraz po wykonaniu. Granice są w ustawieniach.

Urządzenia wycofane nie generują alertów o terminach.

### 4.2 Statusy

| Status | Kiedy | Etykieta | Kolor |
|---|---|---|---|
| `OK` | dziś < alert od | Ważne | zielony |
| `DUE_SOON` | alert od ≤ dziś ≤ ważne do | Zbliża się termin | żółty |
| `OVERDUE` | dziś > ważne do | Po terminie | czerwony |
| `NO_DATA` | wymaga wzorcowania, brak wpisu | Brak danych | czerwony |
| `WITHDRAWN` | urządzenie wycofane | Wycofane | szary |
| `NOT_REQUIRED` | `calibration_required = false` | Bez wzorcowania | szary |
| `LOW` | stan odczynnika < próg | Mało | czerwony |
| `COUNT_DUE` | spis stanu zaległy | Zrób spis | żółty |

### 4.3 Przykłady (dziś = 27.11.2026)

| Przykład | Termin | Alert od | Ważne do | Status |
|---|---|---|---|---|
| Wzorcowanie 03/2026, co 12 mies., wyprzedzenie 1 | 03/2027 | 01.02.2027 | 31.03.2027 | `OK` |
| Wzorcowanie 12/2025, co 12 mies., wyprzedzenie 1 | 12/2026 | 01.11.2026 | 31.12.2026 | `DUE_SOON` |
| Wzorcowanie 10/2025, co 12 mies., wyprzedzenie 1 | 10/2026 | 01.09.2026 | 31.10.2026 | `OVERDUE` |
| CRM ważny do 31.05.2027, wyprzedzenie 6 | 31.05.2027 | 30.11.2026 | 31.05.2027 | `OK` (alert za 3 dni) |
| Sprawdzenie 05.11.2026, co 1 mies., wyprzedzenie 0 | 12/2026 | 01.12.2026 | 31.12.2026 | `OK` |

### 4.4 Harmonogram jako jedno źródło

Wszystkie terminy sprowadzamy do jednej struktury `DueItem` (`kind`, `ref_type`, `ref_id`,
`lab_id`, `label`, `due`, `alert_from`, `valid_until`, `status`). Korzystają z niej tabela
i grafik terminów (F2), powiadomienia (F3) i „Moje zadania” na telefonie.

Rodzaje (`kind`): `CALIBRATION`, `CHECK`, `LOT_EXPIRY`, `LOW_STOCK`, `STOCK_COUNT`.
`due` to termin (wzorcowanie, sprawdzenie, ważność), dla `LOW_STOCK` — dzień ostatniej zmiany
stanu (spis albo przyjęcie), dla `STOCK_COUNT` — dzień, od którego spis jest zaległy.

---

## 5. Uprawnienia

| Uprawnienie | Kierownik | Admin | Pracownik |
|---|---|---|---|
| `equipment:read`, `schedule:read`, `reagent:read`, `result:read` | ✓ | ✓ | ✓ (swoje pracownie) |
| `report:read` (raporty, wykresy) | ✓ | ✓ | — |
| `report:write` (generowanie i wysyłka raportu) | — | ✓ | — |
| `audit:read` | ✓ | ✓ | — |
| `equipment:write` (rejestr, upoważnienia, wycofanie) | — | ✓ | — |
| `calibration:write` | — | ✓ | — |
| `check:write` | — | ✓ | ✓, tylko gdy jest na liście upoważnionych |
| `reagent:write` (odczynniki, partie) | — | ✓ | — |
| `stock:write` (spis stanu) | — | ✓ | ✓ (swoje pracownie) |
| `result:write` | — | ✓ | ✓ |
| `settings:write`, `users:write` | — | ✓ | — |

Kierownik tylko czyta i dostaje raporty (01 §3.2); domyślnie widzi wszystkie pracownie.

Zasady:

1. Zakres pracowni: `all_labs` albo lista pracowni użytkownika (konfigurowalne).
2. Upoważnić do urządzenia można tylko osobę, która ma tę pracownię w zakresie — pracownik
   jednej pracowni nie korzysta ze sprzętu innej (01 §2.1). Lista upoważnionych dotyczy osób
   bez `equipment:write`; admin może wpisać sprawdzenie zawsze (np. przenosząc zapisy z papieru).
3. Wycofane urządzenie nie przyjmuje wpisów sprawdzeń. Wzorcowanie (admin) można wpisać,
   ale przywrócenie do użytku to osobna akcja z powodem (17025 6.4.9).
4. Uprawnienia sprawdza API (warstwa serwisów), nie interfejs.
5. Nieupoważniony po skanie dostaje komunikat „Brak uprawnień do wpisu dla tego urządzenia”,
   bez formularza (F7).

Role i ich uprawnienia są danymi w bazie — tabela wyżej to ustawienie domyślne.

---

## 6. Konfiguracja (co można ustawić)

| Co | Gdzie | Domyślnie |
|---|---|---|
| Pracownie: nazwa, litera kodu | Ustawienia → Pracownie | z danych startowych |
| Użytkownicy: rola, zakres pracowni | Ustawienia → Użytkownicy | — |
| Częstotliwość wzorcowania, tryb, wyprzedzenie, kryteria akceptacji | karta urządzenia | wyprzedzenie 1 mies. |
| Plany sprawdzeń: cykl, wyprzedzenie, formularz | karta urządzenia | wyprzedzenie 0 |
| Pola formularzy (typ, jednostka, min, max, wymagane) | Ustawienia → Formularze | — |
| Próg minimalny, częstotliwość spisu, wyprzedzenie ważności | karta odczynnika | spis co 30 dni, wyprzedzenie 1 mies. |
| Parametry badań i zakresy | Ustawienia → Parametry (import CSV) | 25 wierszy z 01 §4 (wytrzymałości w kN i MPa osobno) |
| Reakcja na wynik poza zakresem | parametr albo ustawienie ogólne | `FLAG` — zapis z oznaczeniem i wymogiem powtórzenia |
| Próg weryfikacji wykresów (F10) | parametr (`verify_min`, `verify_max`) | zakres parametru |
| Zakres raportu dla kierownika (F11): okres, parametry | formularz raportu | ostatni miesiąc, wszystkie parametry z wynikami |
| Wycofanie po wzorcowaniu „NIE OK” | ustawienie ogólne | włączone (17025 6.4.9; czekamy na pyt. 2 w 01) |
| OCR świadectw: włączony, limit stron | Ustawienia → Integracje (model, URL i klucz tylko w env) | wyłączony; limit 5 stron; `OCR_API_URL`, `OCR_API_KEY`, `OCR_MODEL`, `OCR_TIMEOUT_S` w env |
| Odbiorcy i kanały powiadomień | Ustawienia → Powiadomienia | tabela niżej, kanał: w aplikacji |
| Czas sesji, limit plików, cykl workera, limit prób logowania | ustawienia ogólne | 12 h, 10 MB, 60 min, 5 prób / 15 min |

Każda zmiana ustawień trafia do historii (17025 7.11.2).

Domyślne reguły powiadomień („admini pracowni” = admini, którzy mają tę pracownię w zakresie):

| Rodzaj | Odbiorcy | Kiedy |
|---|---|---|
| `CALIBRATION_DUE` | admini pracowni | `DUE_SOON`, `OVERDUE`, `NO_DATA` |
| `CHECK_DUE` | pracownicy i admini pracowni | `DUE_SOON`, `OVERDUE` |
| `LOT_EXPIRY` | admini pracowni | `DUE_SOON`, `OVERDUE` |
| `LOW_STOCK` | admini pracowni | `LOW` |
| `STOCK_COUNT_DUE` | pracownicy pracowni | `COUNT_DUE` |
| `CHECK_OUT_OF_RANGE` | admini pracowni | od razu przy wpisie |
| `RESULT_OUT_OF_RANGE` | admini | od razu przy wpisie |
| `REPORT_READY` | kierownicy | od razu po wygenerowaniu raportu (F11) |

---

## 7. API

REST pod `/api`, opis OpenAPI generowany przez FastAPI (`/api/openapi.json`).
Błędy zawsze w formacie `{"error": "<KOD>", "message": "<tekst po polsku>"}`.

| Obszar | Endpointy | Kto |
|---|---|---|
| Logowanie | `POST /auth/login`, `POST /auth/logout`, `GET /me` | wszyscy |
| Pracownie, użytkownicy, role | `GET/POST /labs`, `PATCH /labs/{id}`, `GET/POST /users`, `PATCH /users/{id}`, `GET /roles` | admin |
| Ustawienia | `GET/PUT /settings`, `GET/PUT /notification-rules`, `GET/POST /form-templates`, `PATCH /form-templates/{id}` | admin |
| Urządzenia | `GET/POST /equipment`, `GET/PATCH /equipment/{id}`, `GET /equipment/by-qr/{public_id}`, `POST /equipment/{id}/withdraw`, `POST /equipment/{id}/restore` | odczyt: wszyscy w zakresie; zmiany: admin |
| Upoważnienia | `GET/PUT /equipment/{id}/authorized-users` | admin |
| Wzorcowania | `GET/POST /equipment/{id}/calibrations` | zapis: admin |
| OCR wzorcowań | `POST /equipment/{id}/calibrations/extract` (body `{"attachment_id": …}`) | `calibration:write`; nic nie zapisuje |
| Sprawdzenia | `GET/POST /equipment/{id}/check-plans`, `PATCH /check-plans/{id}`, `GET/POST /check-plans/{id}/records` | plany: admin; wpisy: upoważnieni |
| Odczynniki | `GET/POST /reagents`, `PATCH /reagents/{id}`, `POST /reagents/{id}/lots`, `PATCH /lots/{id}`, `POST /reagents/{id}/stock-counts` | spis: pracownicy pracowni; reszta: admin |
| Wyniki | `GET/POST /test-parameters`, `PATCH /test-parameters/{id}`, `POST /test-parameters/import`, `GET/POST /test-results` | parametry: admin; wyniki: `result:write` |
| Harmonogram | `GET /schedule?lab_id=&kind=&horizon_months=&include_ok=` | wszyscy w zakresie |
| Powiadomienia | `GET /notifications?unread=`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `POST /devices` | zalogowani |
| Pliki | `POST /attachments`, `GET /attachments/{id}` | wg właściciela pliku |
| Historia | `GET /audit?entity=&entity_id=&from=&to=` | admin |
| Druki | `GET /equipment/{id}/history.pdf` | odczyt: wszyscy w zakresie |
| Wykresy (F10) | `GET /test-results/series?parameter_id=&from=&to=` | `result:read` |
| Raporty (F11) | `POST /reports`, `GET /reports`, `GET /reports/{id}.pdf` | tworzenie: `report:write`; odczyt: `report:read` |
| Zdrowie | `GET /health` | publiczne |

Kody błędów:

| Kod | HTTP | Kiedy |
|---|---|---|
| `NOT_AUTHENTICATED` | 401 | brak, wygasły albo unieważniony token |
| `INVALID_CREDENTIALS` | 401 | zły login lub hasło, konto nieaktywne |
| `TOO_MANY_ATTEMPTS` | 429 | za dużo nieudanych logowań |
| `FORBIDDEN` | 403 | rola nie ma uprawnienia |
| `LAB_OUT_OF_SCOPE` | 403 | pracownia spoza zakresu użytkownika |
| `NOT_AUTHORIZED_FOR_EQUIPMENT` | 403 | brak na liście upoważnionych |
| `NOT_FOUND` | 404 | — |
| `EQUIPMENT_WITHDRAWN` | 409 | wpis sprawdzenia dla wycofanego urządzenia |
| `DUPLICATE_EQUIPMENT_NUMBER` | 409 | numer już jest w tej pracowni |
| `DUPLICATE_LAB_CODE` | 409 | litera pracowni już zajęta |
| `USER_NOT_IN_LAB` | 422 | upoważnienie dla osoby spoza pracowni |
| `INVALID_NUMBER` | 422 | liczby nie da się odczytać |
| `OUT_OF_RANGE` | 422 | wynik poza zakresem przy reakcji `BLOCK` |
| `VALIDATION_ERROR` | 422 | inne błędy danych (lista pól w `details`) |
| `FILE_TOO_LARGE` | 413 | — |
| `UNSUPPORTED_FILE_TYPE` | 415 | dozwolone: JPEG, PNG, PDF (rozpoznawane po zawartości, nie po nazwie) |
| `OCR_DISABLED` | 409 | OCR wyłączony w ustawieniach albo brak konfiguracji dostawcy |
| `OCR_FAILED` | 502 | dostawca zwrócił błąd albo odpowiedź nie przechodzi walidacji |
| `OCR_TIMEOUT` | 504 | przekroczono `OCR_TIMEOUT_S` |
| `RENDER_FAILED` | 500 | `typst` nie złożył dokumentu; szczegóły (stderr) tylko w logu serwera |

---

## 8. Najważniejsze przepływy

### 8.1 Skan QR albo zbliżenie NFC → wpis sprawdzenia (F5, F6, F7)

```mermaid
sequenceDiagram
  actor L as Laborant
  participant App as Aplikacja (Capacitor)
  participant API
  participant DB as Baza
  L->>App: Skanuj
  App->>App: skaner → https://serwer/e/K7Q2M9XH4D
  App->>API: GET /api/equipment/by-qr/K7Q2M9XH4D
  API->>DB: urządzenie, status, plany sprawdzeń
  API-->>App: karta + can_write
  L->>App: formularz sprawdzenia (+ zdjęcie karty)
  App->>API: POST /api/attachments
  App->>API: POST /api/check-plans/{id}/records
  API->>API: uprawnienia, wycofane?, pola i zakresy min/max
  API->>DB: wpis + historia zmian (+ powiadomienie, jeśli poza zakresem)
  API-->>App: 201, out_of_range true/false
```

Bez zalogowania: aplikacja pamięta adres `/e/...` i po zalogowaniu wraca na kartę urządzenia.

**NFC:** tag NDEF zawiera dokładnie ten sam `qr_url`, więc aplikacja i aparat systemowy
dostają ten sam `public_id` — nie ma osobnego endpointu ani osobnych uprawnień. Tag czytany
w aplikacji przez plugin (Android reader mode, iOS Core NFC); na nowszych iPhone'ach system
czyta NDEF w tle i otwiera kartę w przeglądarce. Tag można sklonować — to tylko wskaźnik,
nie sekret; dostęp nadal daje token sesji.

### 8.2 Wynik wzorcowania → nowy termin (F4)

```mermaid
sequenceDiagram
  actor S as Specjalista
  participant Web as Przeglądarka
  participant API
  S->>Web: miesiąc świadectwa, firma, nr, punkty (błąd, niepewność), skan, OK / NIE OK
  Web->>API: POST /api/attachments (skan)
  Web->>API: POST /api/equipment/{id}/calibrations
  API->>API: next_due_month = miesiąc świadectwa + częstotliwość
  alt NIE OK i włączone wycofanie
    API->>API: urządzenie → Wycofane (17025 6.4.9)
  end
  API-->>Web: nowy termin i status
```

### 8.3 Worker: terminy → powiadomienia (F3)

```mermaid
sequenceDiagram
  participant K as Worker
  participant DB as Baza
  participant FCM
  loop co N minut (ustawienie)
    K->>DB: DueItem dla wszystkich pracowni
    K->>DB: reguły → odbiorcy
    K->>DB: INSERT powiadomień, istniejący dedupe_key pomijany
    K->>DB: powiadomienia bez aktualnej pozycji → rozwiązane
    opt kanał push włączony
      K->>FCM: „Masz nowe powiadomienia w aplikacji” (bez szczegółów)
    end
  end
```

`dedupe_key = "{kind}:{ref_type}:{ref_id}:{due}:{status}"` — jedno powiadomienie na etap
(zbliża się, po terminie) dla każdej pozycji i odbiorcy. Nowe wzorcowanie zmienia `due`, więc
stary alert zostaje rozwiązany, a następny cykl dostaje nowy klucz. Zapis przez
`INSERT … ON CONFLICT DO NOTHING`, więc dwa workery naraz też nie zdublują powiadomień.
Powiadomienia „poza zakresem” tworzy API od razu, bez czekania na worker.

### 8.4 Wynik badania → kontrola zakresu (F9)

```mermaid
sequenceDiagram
  actor L as Laborant
  participant App
  participant API
  L->>App: parametr i wartość (np. SO₃ = 3,35)
  App->>API: POST /api/test-results
  API->>API: "3,35" → Decimal; zakres 0,10–3,20 → ABOVE
  alt reakcja BLOCK
    API->>API: próba zapisana w historii (reject)
    API-->>App: 422 OUT_OF_RANGE
  else reakcja FLAG
    API->>API: zapis z in_range = false i kopią zakresu, powiadomienie
    API-->>App: 201, wynik na czerwono, „powtórz badanie”
  end
```

### 8.5 Świadectwo → OCR → formularz (F4, D14)

```mermaid
sequenceDiagram
  actor S as Specjalista
  participant Web as Przeglądarka
  participant API
  participant OCR as Zewnętrzne API OCR/LLM
  S->>Web: upload skanu (PDF/JPEG/PNG)
  Web->>API: POST /api/attachments
  S->>Web: „Odczytaj ze skanu”
  Web->>API: POST /api/equipment/{id}/calibrations/extract {attachment_id}
  API->>API: uprawnienia, OCR włączony?, typ i rozmiar
  API->>API: PDF → obrazy stron (limit 5)
  API->>OCR: strony + stały prompt (JSON: firma, nr, miesiąc, punkty)
  OCR-->>API: JSON (liczby jako tekst, pewność pól)
  API->>API: walidacja Pydantic + parser liczb; złe pola odrzucone
  API-->>Web: szkic pól (bez zapisu w bazie)
  S->>Web: poprawia, uzupełnia, wybiera OK / NIE OK
  Web->>API: POST /api/equipment/{id}/calibrations (+ attachment_ids)
  API-->>Web: zapis, termin i status; historia: source=OCR, dostawca i model
```

Zasady:

- `extract` nie zapisuje nic; to odczyt, który można powtórzyć.
- Odpowiedź dostawcy jest niezaufana: liczby przechodzą ten sam parser co wpis ręczny
  (przecinek/kropka → `Decimal`), śmieci są odrzucane per pole, a teksty (firma, numer)
  trafiają do formularza jako propozycja — nie do bazy.
- Wysyłamy tylko plik wskazany przez `attachment_id` i tylko przy włączonym OCR; klucz API
  zostaje na serwerze, aplikacja go nie zna. Limit stron (5), `max_upload_mb` (T16) i
  `OCR_TIMEOUT_S` (60 s) ograniczają koszt; bez automatycznych ponowień.
- Oryginał skanu zostaje jako załącznik wpisu (7.5.2), a `source` / `ocr_meta` pozwalają
  odtworzyć, które pola przyszły z modelu.

### 8.6 Wykres i raport dla kierownika (F10, F11)

```mermaid
sequenceDiagram
  actor S as Specjalista
  participant API
  participant T as typst
  actor K as Kierownik
  S->>API: POST /api/reports (okres, parametry)
  API->>API: seria wyników + próg weryfikacji → tabela, liczba poza progiem, wykres SVG
  API->>T: szablon report.typ + JSON (z wykresem)
  T-->>API: PDF
  API->>API: PDF jako załącznik (zapis 7.5.2) + powiadomienie REPORT_READY
  K->>API: GET /api/reports/{id}.pdf
```

Wykres w przeglądarce rysuje frontend z `GET /test-results/series`; do PDF ten sam wykres
składa backend jako SVG (punkty, linie progu), bez pakietów `typst` z internetu.

---

## 9. Frontend i aplikacja mobilna

**Jeden kod, dwa układy**, wybierane po szerokości ekranu, nie po platformie:

- **Biuro** (szeroki ekran): menu boczne — Harmonogram, Urządzenia, Odczynniki, Wyniki,
  Powiadomienia, Ustawienia, Historia zmian.
- **Pracownia** (telefon): dolny pasek — Skanuj, Moje zadania, Spis odczynników, Powiadomienia.

| Potrzeba | Biblioteka |
|---|---|
| Routing | React Router |
| Dane z API, odświeżanie | TanStack Query |
| Komponenty, tabele | shadcn/ui (Radix UI + Tailwind CSS 4) + TanStack Table |
| Typy i klient API | `openapi-typescript` + `openapi-fetch` (generowane z OpenAPI) |
| Formularze | React Hook Form |
| Etykiety z QR | `qrcode` |

**Kolory firmowe** (logo Cementowni Warta): navy `#0C3F76` — primary, przyciski i linki —
oraz lime `#8DC63F` — akcent, wykresy i obramowania; lime na białym tylko jako tło z ciemnym
tekstem (biały tekst ma kontrast 2,0:1). Tokeny w `frontend/src/index.css`.

**Capacitor 8** (build iOS wymaga Xcode 26+ na macOS):

| Potrzeba | Plugin | Uwagi |
|---|---|---|
| Skan QR | `@capacitor/barcode-scanner` (oficjalny) | jedno wywołanie `scanBarcode`; działa też w przeglądarce (html5-qrcode). Alternatywa: `@capacitor-mlkit/barcode-scanning` |
| Odczyt tagów NFC | plugin NFC dla Capacitor 8 (kandydaci: `@capawesome-team/capacitor-nfc`, `@capacitor-community/nfc`; zgodność sprawdzić w T24) | tylko rekord NDEF URI z `public_id`; w przeglądarce brak — zostaje QR; iOS wymaga `NFCReaderUsageDescription` i uprawnienia do typów tagów |
| Zdjęcie dokumentu | `@capacitor/camera` | w przeglądarce zapas: `<input type="file" accept="image/*" capture="environment">` |
| Push | `@capacitor-firebase/messaging` | daje token FCM na obu platformach. Oficjalny `@capacitor/push-notifications` na iOS zwraca token APNs, którego FCM nie przyjmie |
| Token sesji | bezpieczny magazyn (Keychain / Keystore), np. `capacitor-secure-storage-plugin` | sprawdzić zgodność z Capacitor 8; w przeglądarce `sessionStorage` |

Ważne szczegóły:

- **CORS:** API dopuszcza originy `capacitor://localhost` (iOS), `https://localhost` (Android),
  adres webowy i `http://localhost:5173` (dev). Brak `capacitor://localhost` objawia się tym,
  że GET działa, a POST nie (odrzucony preflight).
- **Adres serwera (D11):** ekran przy pierwszym uruchomieniu — wpisanie adresu albo skan
  „QR konfiguracyjnego” z panelu admina.
- **QR i NFC:** trasa `/e/:publicId` działa w przeglądarce i w aplikacji. Otwarcie aplikacji
  natywnej prosto z aparatu systemowego (universal links) na iOS wymaga domeny osiągalnej
  dla Apple — przy serwerze wewnętrznym zostaje skaner w aplikacji. Tag NFC niesie ten sam
  URL (NDEF): system czyta go bez aplikacji na nowszych iPhone'ach, a w aplikacji przez Core
  NFC / reader mode Androida. NFC nie zastępuje QR — drukarka etykiet nie zapisuje tagów.
- **Etykiety (17025 6.4.8):** strona do druku: kod, nazwa, następny termin MM/RRRR, QR.
  Tag NFC (opcjonalnie) zapisujemy tym samym linkiem; nie wchodzi na wydruk.
- **Push:** treść bez danych („Masz nowe powiadomienia w aplikacji”), szczegóły aplikacja
  pobiera z API. Push wymaga projektu Firebase, klucza APNs (konto Apple Developer) i wyjścia
  serwera do internetu. Pliki konfiguracyjne Firebase nie trafiają do publicznego repo.
- **Dystrybucja:** demo — APK na Androida, TestFlight na iOS. Produkcyjnie (sklep, Apple
  Business Manager, MDM) — decyzja firmy, pytanie do mentorów.

---

## 10. Backend

Pakiety według dziedziny (co zmienia się razem, leży razem):

```
backend/app/
  main.py            # create_app(): routery, CORS, obsługa błędów
  config.py          # EnvConfig — zmienne środowiskowe
  db.py              # silnik, sesja, Base
  errors.py          # AppError → {"error", "message"}
  core/              # clock.py (dziś), dates.py (miesiące, terminy), ranges.py (Decimal, zakresy)
  audit/             # historia zmian (listener), /audit
  auth/              # pracownie, użytkownicy, role, sesje, logowanie, uprawnienia
  settings/  files/  forms/
  equipment/         # urządzenia, upoważnienia, wzorcowania, sprawdzenia
  integrations/      # OCR: ocr.py — klient OpenAI-compatible (Qwen-VL, OpenAI, vLLM)
  reagents/          # odczynniki, partie, spisy
  results/           # parametry i wyniki badań
  schedule/          # DueItem, /schedule
  notifications/     # reguły, powiadomienia, kanał push
  print/             # druki PDF: render.py (binarka typst), service.py, router.py,
                     # templates/*.typ, fonts/ (DejaVu), testy w tests/print/
  worker.py          # pętla workera, --once, --today
  seed.py            # dane startowe i demo
```

| Potrzeba | Biblioteka |
|---|---|
| API | FastAPI, Pydantic v2, pydantic-settings, python-multipart |
| Baza | SQLAlchemy 2 (synchronicznie) + psycopg 3, Alembic |
| Hasła | `pwdlib[argon2]` (to obecnie pokazuje dokumentacja FastAPI zamiast passlib) |
| Push | `firebase-admin` (FCM HTTP v1) |
| OCR | `httpx` (klient OpenAI-compatible), `pdftoppm` (poppler) do stron PDF |
| Druki PDF | `typst` 0.15.x — binarka wywoływana przez `subprocess`, nie `typst-py` |
| Testy, lint | pytest + httpx (TestClient), ruff, `pdftotext` (poppler) do sprawdzania PDF |

- **Synchronicznie, nie async:** jedno laboratorium, kilkadziesiąt osób — prostota wygrywa.
- **„Dziś” jako zależność:** `get_today()` w API, parametr `today` w serwisach — testy i demo
  ustawiają datę, zamiast czekać na kalendarz.
- **Historia zmian:** listener SQLAlchemy `after_flush` zapisuje `create` / `update` / `delete`
  ze zmienionymi polami dla wszystkich modeli poza `AuditLog`, `UserSession` i `Notification`.
  Kto i dlaczego — z kontekstu żądania. Odrzucone wpisy (`BLOCK`) zapisuje się osobno jako
  `reject`, nieudane logowania jako `login`. Rola bazy aplikacji ma na `audit_log` tylko
  `INSERT` i `SELECT`.
- **Worker:** `python -m app.worker` — pętla co N minut; `--once` uruchamia raz;
  `--today 2026-12-15` symuluje datę (do demo). Bez Celery i Redisa.
- **Dane startowe:** `python -m app.seed` — pracownie, użytkownicy, urządzenia demo ze
  statusami liczonymi od dzisiaj, parametry cementu z `data/seed/cement_parameters.csv`.

### Druki PDF (D12)

Dokumenty, które są zapisem, a nie widokiem (karta urządzenia z historią, raport dla
kierownika F11, raport walidacji z T29), renderuje backend przez binarkę `typst`;
przeglądarka tylko otwiera gotowy PDF.

- **Wywołanie:** `subprocess.run([...])` bez powłoki — `typst compile <szablon> <out.pdf>
  --root app/print --input data=<json> --ignore-system-fonts --font-path app/print/fonts`,
  `timeout` 10 s, `check=False`; kod wyjścia ≠ 0 → 500 `RENDER_FAILED`, a ostatnia linia
  stderr trafia tylko do logu. Endpoint jest synchroniczny (`def`), więc proces potomny idzie
  do puli wątków FastAPI; przy większym ruchu semafor ogranicza liczbę równoległych renderów.
- **Dane:** Python składa jeden JSON (miesiące `YYYY-MM`, liczby jako tekst, gotowe etykiety
  statusów z §4.2) i przekazuje go przez `sys.inputs.data`; szablon wyłącznie składa dokument —
  bez logiki, bez dostępu do bazy, bez `datetime.today()`. Kształt danych pilnuje model
  Pydantic po stronie Pythona, żeby szablon i dane nie rozjechały się po cichu.
- **Powtarzalność:** wersja `typst` przypięta w obrazie (T27) i sprawdzana przy starcie; fonty
  DejaVu leżą w `app/print/fonts/` (`--ignore-system-fonts`), więc obraz nie zależy od fontów
  systemowych; gdy szablon stempluje datę, `SOURCE_DATE_EPOCH` daje identyczne bajty dla tego
  samego wsadu (sprawdzone: ten sam PDF bajt w bajt).
- **Testy:** złożenie z danych fixture → `%PDF` na początku i `pdftotext` zawierający kod,
  terminy i statusy; bez porównywania bajt po bajcie.
- **Etykiety QR (T21):** zostają w przeglądarce (`window.print()`), bo liczy się precyzja
  arkusza naklejek; PDF tylko tam, gdzie wydruk jest dowodem (17025 7.5.2).

### OCR świadectw (D14)

`POST /api/equipment/{id}/calibrations/extract` nic nie zapisuje — zwraca szkic pól.

- **Dostawca:** jeden klient zgodny z OpenAI (`POST {OCR_API_URL}/chat/completions`), więc
  działa z Qwen-VL (tryb zgodny DashScope), OpenAI i lokalnym vLLM/Ollama. Model i URL z env;
  klucz tylko z env — nigdy w bazie, logu ani odpowiedzi API.
- **Wejście:** załącznik z T16 (PDF/JPEG/PNG), własny i nieprzypięty albo w zakresie pracowni
  urządzenia; PDF renderujemy do PNG przez `pdftoppm -r 200`, bo nie każdy dostawca przyjmuje
  PDF. Limit 5 stron i `max_upload_mb`.
- **Wyjście:** stały prompt prosi o JSON z polami `vendor`, `certificate_no`,
  `calibrated_month`, `adjustments`, `points[{point,error,uncertainty,unit}]`, `confidence`.
  Serwer waliduje Pydantic i parserem liczb; złe pole → `null` + ostrzeżenie, nie 502.
- **Błędy:** brak konfiguracji lub wyłączone ustawienie → 409 `OCR_DISABLED`; błąd dostawcy
  albo zły JSON → 502 `OCR_FAILED`; timeout → 504 `OCR_TIMEOUT`. Bez ponowień (koszt).
- **Bezpieczeństwo:** wysyłka tylko po jawnym kliknięciu — sam upload nic nie wysyła poza
  serwer; nie logujemy treści dokumentu ani odpowiedzi, tylko metadane (model, czas, rozmiar).

---

## 11. Wdrożenie

`docker compose` z usługami: `db` (PostgreSQL), `api`, `worker`, `web` (Caddy: HTTPS,
zbudowany frontend, `/api` → `api`). Ten sam zestaw działa na serwerze w zakładzie i w chmurze.

Zmienne środowiskowe: `DATABASE_URL`, `CORS_ORIGINS`, `PUBLIC_BASE_URL` (do linków w QR i NFC),
`FILES_DIR`, opcjonalnie `FCM_CREDENTIALS_FILE` oraz OCR: `OCR_API_URL`,
`OCR_API_KEY`, `OCR_MODEL`, `OCR_TIMEOUT_S` (brak URL lub klucza = OCR wyłączony, niezależnie
od ustawienia). Plik `.env.example` bez sekretów.

Kopie zapasowe: codzienny `pg_dump` i kopia wolumenu z plikami (17025 7.11.3).

---

## 12. Bezpieczeństwo i zgodność

| Wymaganie | Jak |
|---|---|
| 7.11.3 — nieuprawniony dostęp | logowanie, role, zakres pracowni, upoważnienia do urządzeń, limit prób logowania |
| 7.11.3 — manipulacja | historia tylko do dopisywania, brak usuwania zapisów technicznych |
| 7.11.3 — utrata danych | kopie bazy i plików |
| 7.11.3 — awarie | logi aplikacji; rejestr awarii — później |
| 7.11.2 — walidacja | testy akceptacyjne powiązane z wymaganiami (raport walidacji), historia zmian konfiguracji |
| 7.5.2 — zmiany zapisów | historia zmian |
| 7.5.2 — OCR | szkic z modelu zatwierdza człowiek; oryginał skanu i metadane (dostawca, model, pewność) zostają w zapisie |
| 6.4.8 — oznakowanie | etykieta z terminem, QR i opcjonalnym tagiem NFC (ten sam link) |
| 6.4.9 — wycofanie | status „Wycofane”, blokada wpisów |
| Cyberbezpieczeństwo | HTTPS, Argon2, tokeny odwoływalne i trzymane jako skrót, push bez treści, pliki tylko przez API z kontrolą typu i rozmiaru, klucz OCR wyłącznie w env i wysyłka dopiero po jawnej akcji użytkownika |

---

## 13. Ryzyka

| Ryzyko | Co robimy |
|---|---|
| Build iOS wymaga Maca, Xcode 26+ i konta Apple Developer | w dniu 0 ustalić, kto ma Maca; awaryjnie demo na Androidzie i w przeglądarce |
| Konfiguracja push (Firebase, APNs) zjada czas | push to P2; dzwonek w aplikacji wystarczy do demo |
| Telefon bez dostępu do sieci zakładu (pyt. 13 w 01) | na demo serwer testowy z HTTPS; praca offline — później |
| Dev na Androidzie po HTTP blokowany (cleartext, mixed content) | API przez HTTPS (serwer testowy albo tunel); HTTP tylko w buildzie debug |
| Litery pracowni poza `A` nieznane (pyt. 16 w 01) | w danych demo `W` i `P` jako założenie, do zmiany w ustawieniach |
| Zewnętrzny dostawca OCR niedostępny albo limituje koszt (pyt. 23) | OCR wyłączony domyślnie, bez ponowień, limit stron i timeout; wpis ręczny zawsze działa |
| Skan świadectwa zawiera dane poufne (pyt. 23) | wysyłka tylko po jawnej akcji użytkownika; sam upload nic nie wysyła; dostawcę zatwierdza laboratorium |
| Tag NFC zgubiony, sklonowany albo uszkodzony | tag to wskaźnik, nie sekret — dostęp daje token sesji; QR na etykiecie zostaje |

## 14. Poza tą architekturą (później)

Logowanie firmowe (SSO, OIDC), wiele firm w jednej instalacji, praca offline, import XLSX
z interfejsu, rejestr firm wzorcujących z numerem akredytacji (PCA DA-06), dobieranie
interwałów (ILAC-G24), pełny dziennik napraw (6.4.13 h), klasy dokumentów (pyt. 14 w 01).

## 15. Pokrycie funkcji z 01

| Funkcja | Backend | Ekrany |
|---|---|---|
| F1 Rejestr urządzeń | `equipment` | Urządzenia, karta urządzenia |
| F2 Harmonogram | `schedule` | Harmonogram (tabela + grafik miesięczny), Moje zadania |
| F3 Powiadomienia | `notifications`, worker | dzwonek, lista powiadomień, Ustawienia → Powiadomienia |
| F4 Wzorcowanie | `equipment` (Calibration), `files`, `integrations` (OCR) | formularz wzorcowania na karcie |
| F5 Sprawdzenia | `equipment` (CheckPlan, CheckRecord), `forms` | formularz na telefonie |
| F6 QR i NFC | `equipment` (`public_id`) | Skanuj / zbliż tag, `/e/:publicId`, druk etykiet, zapis tagu |
| F7 Uprawnienia | `auth`, `equipment` | lista upoważnionych na karcie |
| F8 Odczynniki i CRM | `reagents` | Odczynniki, Spis odczynników |
| F9 Kontrola zakresu | `core/ranges`, `results` | Wyniki, Ustawienia → Parametry |
| F10 Wykresy i weryfikacja | `results` (seria + próg) | Wyniki → Wykres |
| F11 Raport dla kierownika | `print`, `reports`, `notifications` | Raporty, dzwonek kierownika |

## Źródła techniczne

- [Capacitor — Push Notifications API](https://capacitorjs.com/docs/apis/push-notifications) i [token APNs vs FCM na iOS](https://github.com/ionic-team/capacitor-plugins/issues/1662)
- [Capacitor — Barcode Scanner API](https://capacitorjs.com/docs/apis/barcode-scanner), [Capawesome — ML Kit Barcode Scanning](https://capawesome.io/plugins/mlkit/barcode-scanning/)
- [Capacitor i CORS — originy aplikacji](https://cors.dev/guides/capacitor-cors), [origin Androida to https://localhost](https://github.com/ionic-team/ionic-docs/issues/4546)
- [Przejście na Capacitor 8 (Xcode 26+)](https://github.com/companionintelligence/CI-Spatial-Atlas/pull/65)
- [FastAPI: pwdlib i Argon2 zamiast passlib](https://tutorialibre.com/courses/programming-frameworks/fastapi/authentication-authorization-security/oauth2-jwt/password-hashing/)
- [Web push na iOS w 2026](https://relaybell.com/blog/ios-web-push-2026)
- [Android — NFC basics](https://developer.android.com/develop/connectivity/nfc/nfc), [Apple — Core NFC](https://developer.apple.com/documentation/corenfc), [NFC Forum — NDEF](https://nfc-forum.org/what-is-nfc/)
- [Qwen2.5-VL](https://github.com/QwenLM/Qwen2.5-VL), [OpenAI — vision](https://platform.openai.com/docs/guides/images), [Anthropic — vision](https://docs.anthropic.com/en/docs/build-with-claude/vision)
