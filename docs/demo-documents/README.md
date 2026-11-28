# Dokumenty demonstracyjne — świadectwa wzorcowania

Materiał do pokazu: skan/zdjęcie świadectwa wzorcowania → ekstrakcja pól przez model
multimodalny (LLM) → zatwierdzenie w formularzu wzorcowania. Dokumenty są **fikcyjne**:
laboratorium, numer akredytacji, osoby, numery seryjne i adresy nie odpowiadają realnym
podmiotom. Nazwy i identyfikatory urządzeń odpowiadają danym startowym aplikacji, żeby
pokaz był spójny z rejestrem.

## Po co są trzy warianty

| Plik | Urządzenie | Nr świadectwa | Data wzorcowania | Jednostka | Punkty |
|---|---|---|---|---|---|
| `pdf/waga-121-A.pdf` | Waga analityczna Radwag AS 220.R2, `121/A` | `SW/2026/11/A121` | 18.11.2026 | `g` | 0 / 50 / 100 / 200 g |
| `pdf/piec-125-A.pdf` | Piec muflowy Nabertherm L 9/11, `125/A` | `SW/2026/10/A125` | 14.10.2026 | `°C` | 500 / 800 / 950 °C |
| `pdf/blaine-204-W.pdf` | Aparat Blaine'a Toni Technik ToniPERM, `204/W` | `SW/2026/11/W204` | 06.11.2026 | `cm²/g` | 2000 / 3500 / 5000 cm²/g |

Każdy dokument mieści się na jednej stronie: dane identyfikacyjne i metrologiczne oraz
tabela wyników. Taki układ jest typowy dla skróconych świadectw wzorcowania i pozwala
wgrać skan jako jeden plik.

## Jak wygląda świadectwo wzorcowania

Wzorcowy dokument akredytowanego laboratorium (wzór PCA, np. DAP-04; wzór GUM W-01)
zawiera zwykle:

**Część identyfikacyjna**

- nagłówek: nazwa, adres i dane kontaktowe laboratorium, numer akredytacji PCA (`AP xxx`),
  informacja o sygnatariuszach EA MLA i ILAC MRA,
- tytuł `ŚWIADECTWO WZORCOWANIA` (dopuszczalne `Świadectwo kalibracji`),
- data wydania, numer świadectwa, numer strony,
- `PRZEDMIOT WZORCOWANIA`: nazwa, producent, typ/model, numer fabryczny, identyfikator,
- `ZGŁASZAJĄCY` i opcjonalnie `UŻYTKOWNIK`,
- `MIEJSCE WZORCOWANIA` (gdy pomiary wykonano poza laboratorium),
- `METODA WZORCOWANIA`: identyfikator procedury, norma/metodyka,
- `WARUNKI ŚRODOWISKOWE`: temperatura, wilgotność, ciśnienie,
- `DATA WYKONANIA WZORCOWANIA` — **inna data niż data wydania**,
- `SPÓJNOŚĆ POMIAROWA`: wzorce i świadectwa, którymi odniesiono wyniki (np. GUM),
- `NIEPEWNOŚĆ POMIARU`: EA-4/02, niepewność rozszerzona `U`, `k = 2`, ok. 95 %,
- `ADIUSTACJE`: czy wykonano korekty/nastawy,
- `ZGODNOŚĆ Z WYMAGANIAMI`: opcjonalna; w naszych dokumentach jej nie oceniano, bo zgodnie
  z zadaniem decyzję OK / NOK podejmuje laboratorium użytkownika, a nie firma wzorcująca,
- podpisy osoby wykonującej i autoryzującej.

**Wyniki wzorcowania**

- `WYNIKI WZORCOWANIA` w tabeli: wartość odniesienia, wskazanie wzorcowanego przyrządu,
  błąd pomiaru, niepewność rozszerzona `U`, jednostka,
- objaśnienie znaków i niepewności,
- uwagi (metoda obciążenia, głębokość zanurzenia, liczba powtórzeń itp.).

W praktyce układy różnią się między laboratoriami; powyższe elementy są jednak powtarzalne
i to one są potrzebne do ekstrakcji.

## Co wyciąga aplikacja

Endpoint `POST /api/equipment/{equipment_id}/calibrations/extract` przyjmuje
`attachment_id` (JPEG, PNG albo PDF; PDF jest zamieniany na obrazy przez `pdftoppm`,
maks. 5 stron) i wysyła obrazy do modelu przez OpenAI-compatible
`{OCR_API_URL}/chat/completions`. Model ma zwrócić ścisły JSON:

```json
{
  "vendor": "string|null",
  "certificate_no": "string|null",
  "calibrated_month": "YYYY-MM|null",
  "adjustments": "string|null",
  "points": [
    {"point": "string", "error": "string", "uncertainty": "string", "unit": "string"}
  ],
  "confidence": {"vendor": 0.98}
}
```

Mapowanie na dokument:

| Pole API | Miejsce w dokumencie |
|---|---|
| `vendor` | nazwa laboratorium w nagłówku |
| `certificate_no` | `NR ŚWIADECTWA` |
| `calibrated_month` | `DATA WYKONANIA WZORCOWANIA` (nie `DATA WYDANIA`), jako `YYYY-MM` |
| `adjustments` | sekcja `ADIUSTACJE` |
| `points[].point` | `Wartość odniesienia` z tabeli wyników |
| `points[].error` | `Błąd pomiaru` |
| `points[].uncertainty` | `Niepewność rozszerzona U` |
| `points[].unit` | kolumna `Jednostka` |

Backend normalizuje liczby: akceptuje przecinek i kropkę dziesiętną, a w bazie i API
zapisuje je jako stringi dziesiętne (np. `"-0,0002"` → `-0.0002`). Data wzorcowania jest
w bazie pierwszym dniem miesiąca, w API jako `"YYYY-MM"`.

Przykładowa poprawna odpowiedź dla wagi:

```json
{
  "vendor": "METRUM Laboratorium Wzorcujące Sp. z o.o.",
  "certificate_no": "SW/2026/11/A121",
  "calibrated_month": "2026-11",
  "adjustments": "Bez adiustacji. Wskazania przyrządu w zakresie wzorcowania.",
  "points": [
    {"point": "0,0000", "error": "0,0000", "uncertainty": "0,0003", "unit": "g"},
    {"point": "50,0000", "error": "-0,0001", "uncertainty": "0,0003", "unit": "g"},
    {"point": "100,0000", "error": "-0,0002", "uncertainty": "0,0004", "unit": "g"},
    {"point": "200,0000", "error": "-0,0002", "uncertainty": "0,0004", "unit": "g"}
  ],
  "confidence": {"vendor": 0.99, "certificate_no": 0.99, "calibrated_month": 0.97, "points": 0.95}
}
```

## Generowanie

Wymagania: `typst` 0.15.x (wystarczy systemowy binarny, bez pakietów) oraz opcjonalnie
`pdftoppm` z Popplera do podglądów PNG.

```bash
cd docs/demo-documents
python3 generate.py
```

Skrypt waliduje pola JSON, renderuje `pdf/*.pdf` i (jeśli jest `pdftoppm`) `png/*-1.png`,
`png/*-2.png` w 150 dpi. Źródła układu: `certificate.typ`; dane: `data/*.json`.

## Wersje zdegradowane (do pokazu)

Czyste PDF-y są zbyt „idealne” na skan. `degrade.py` robi z nich zdjęcia/skany:
lekkie przechylenie i perspektywa, cień arkusza, nierówne światło, szum, delikatne
rozmycie, ciepły odcień papieru i kompresja JPEG. Tekst pozostaje czytelny dla modelu.

```bash
python3 degrade.py
```

| Czysty dokument | Zdegradowany PDF (1 strona) | Zdegradowany obraz (JPG) |
|---|---|---|
| `pdf/waga-121-A.pdf` | `degraded/pdf/waga-121-A.pdf` | `degraded/jpg/waga-121-A-1.jpg` |
| `pdf/piec-125-A.pdf` | `degraded/pdf/piec-125-A.pdf` | `degraded/jpg/piec-125-A-1.jpg` |
| `pdf/blaine-204-W.pdf` | `degraded/pdf/blaine-204-W.pdf` | `degraded/jpg/blaine-204-W-1.jpg` |

- Do formularza (przycisk wyboru pliku) wgraj **PDF** albo **JPG** — jedno i drugie zawiera
  wszystkie dane identyfikacyjne oraz tabelę wyników.
- Stopień degradacji regulują `--width`, `--dpi`, `--quality` (domyślnie 1600 px, 200 dpi,
  JPEG 78). Skrypt wymaga Pillow i `pdftoppm`; nie dodaje zależności do projektu.

## Przebieg pokazu

1. Użyj `degraded/pdf/*.pdf` (albo `degraded/jpg/*-1.jpg`).
2. Zaloguj się kontem z uprawnieniem `calibration:write` (np. `admin`; hasło ustawia
   `SEED_ADMIN_PASSWORD`).
3. Otwórz kartę urządzenia (np. `121/A`), wybierz `Wpisz wzorcowanie`, dodaj skan/zdjęcie
   świadectwa i uruchom rozpoznawanie.
4. Sprawdź proponowane pola: firma, numer świadectwa, miesiąc, adiustacje i punkty.
   Popraw, jeśli model coś pomylił.
5. Ustaw decyzję `OK` / `NOK` (to decyzja laboratorium), zapisz. Termin następnego
   wzorcowania przeliczy się z daty ze świadectwa i częstotliwości urządzenia.
6. W historii zmian pojawi się wpis `ocr_extract` z dostawcą, modelem i pewnością pól;
   oryginał skanu zostaje w załącznikach.

## Kod QR do pokazu

Gotowy kod dla urządzenia `122/A` (Termohigrometr, `public_id = CWA000122A`):

```text
docs/demo-documents/qr/122-A.png
```

Kod zawiera link:

```text
https://kits-surplus-funky-bridal.trycloudflare.com/e/CWA000122A
```

Skanuj go wewnętrznym skanerem aplikacji (`Skanuj QR`), a nie aparatem telefonu:
aparat otworzy wersję webową w przeglądarce, bo App Links / Universal Links nie są
skonfigurowane. Po zeskanowaniu aplikacja otwiera kartę `122/A` na podstawie
`public_id`, niezależnie od hosta w linku.

Regeneracja (host musi wskazywać działający serwer demo):

```bash
qrencode -o docs/demo-documents/qr/122-A.png -s 12 -m 4 -l H \
  'https://kits-surplus-funky-bridal.trycloudflare.com/e/CWA000122A'
```

Tunel `trycloudflare.com` jest tymczasowy: po jego restarcie wygeneruj kod ponownie z nowym
hostem. Kod jest przeznaczony do skanowania w przeglądarce telefonu; aplikacja natywna ma
osobny, zapisany na stałe adres serwera.

## Włączenie OCR

Funkcja jest domyślnie wyłączona. Wymagane są oba elementy:

- w ustawieniach aplikacji `ocr_enabled = true`,
- zmienne środowiskowe backendu: `OCR_API_URL` (baza API zgodnego z OpenAI, bez
  `/chat/completions`), `OCR_API_KEY`, opcjonalnie `OCR_MODEL` (domyślnie `qwen-vl-max`)
  i `OCR_TIMEOUT_S`.

Bez klucza endpoint zwraca `409 OCR_DISABLED`; formularz ręczny działa zawsze.

## Źródła

- Wzór świadectwa wzorcowania PCA (DAP-04): <https://bip.pca.gov.pl/storage/file/core_files/2023/5/17/4934c4bcd744a061820902eaee662a1c/swiadectwo_wzorcowania_pl.pdf>
- Wzór GUM W-01: <https://warszawa.gum.gov.pl/download/27/4517/W-01.pdf>
- EA-4/02 M:2022 — niepewność pomiaru przy wzorcowaniu: <https://www.pca.gov.pl/storage/file/core_files/2024/7/18/3283496950a7ad8178ee8e71b72e736c/ea-4-02_2022.pdf>
- RADWAG, niepewność pomiaru masy w praktyce: <https://radwag.com/php/moduly/produkty/pobieraj.php?url=%2Fpdf%2Fpublikacje_new%2Fpl%2Fniepewnosc_pomiaru_masy.pdf>
- Merserwis, jak czytać świadectwo wzorcowania: <https://www.merserwis.pl/blog/artykul/interpretacja-swiadectwa-wzorcowania>
