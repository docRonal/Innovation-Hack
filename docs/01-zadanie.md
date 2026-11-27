# 01 — Zadanie: treść, problem, pomysł

Znaczniki źródeł używane niżej:

| Znacznik | Źródło |
|---|---|
| **[W]** | kartka z treścią wyzwania — [photo_2026-11-27_11-31-10.jpg](photo_2026-11-27_11-31-10.jpg) |
| **[M]** | rozmowa z mentorką z laboratorium (transkrypcja) |
| **[Z]** | formularz F-06.00.10 „Zakres badań…”, wyd. 16 — [oferta-badan_19.08.2026-r.pdf](oferta-badan_19.08.2026-r.pdf) |
| **[T]** | decyzje zespołu, 27.11.2026 |

Zasada: wpisujemy tylko to, co wynika z tych źródeł. Czego nie wiemy — trafia do
sekcji 5 (pytania do mentorów).

---

## 1. Treść wyzwania [W] — dosłownie

**WYZWANIE 3. INTELIGENTNE LABORATORIUM**

Obszar: Laboratorium / Digitalizacja / Automatyzacja

Eksperci:

- dr Anita Smolarek-Nowak – Kierownik Laboratorium
- Aneta Dymek – Laboratorium *(dopisek odręczny: „Kierownik”)*

### Historia problemu

Wyobraźcie sobie laboratorium przemysłowe, w którym każdego dnia wykonywane są badania
i pomiary służące kontroli jakości.

Aby wyniki były wiarygodne, laboratorium musi odpowiednio nadzorować wykorzystywane
wyposażenie.

Urządzenia pomiarowe wymagają okresowych wzorcowań, sprawdzeń i prowadzenia dokumentacji
potwierdzającej ich stan.

Każde urządzenie ma swoją historię, terminy i dokumenty, które powinny być aktualne oraz
łatwo dostępne.

W laboratorium Cementowni Warta część tych informacji jest nadzorowana z wykorzystaniem
arkuszy kalkulacyjnych i dokumentacji wymagającej ręcznej aktualizacji.

Przy większej liczbie urządzeń oznacza to konieczność regularnego kontrolowania terminów,
wyszukiwania dokumentów i sprawdzania poprawności danych.

Pomyłka może prowadzić do wykorzystania nieaktualnych informacji, przeoczenia terminu lub
konieczności dodatkowej weryfikacji dokumentacji.

Wyzwaniem jest usprawnienie nadzoru nad wyposażeniem bez utraty kontroli nad
wiarygodnością informacji.

### Wasze wyzwanie

**Jak usprawnić i zdigitalizować nadzór nad wyposażeniem laboratorium, wzorcowaniami
i powiązaną dokumentacją, aby ograniczyć pracę manualną, ryzyko błędów oraz możliwość
wykorzystania nieaktualnych informacji?**

---

## 2. Doprecyzowanie problemu

### 2.1 Jak jest dziś [M]

**Laboratorium**

- Jedno laboratorium zakładowe: jeden budynek, jedno piętro. Biuro (specjaliści, kierownik) osobno, każda pracownia w swoim pomieszczeniu.
- Pracownie: wytrzymałościowa, paliw, analityczna. Jest też pracownia środowiskowa — nie bierzemy jej pod uwagę.
- Badają cement, dodatki do cementu i surowce. Akredytacja wg PN-EN ISO/IEC 17025.
- Ludzie: pracownicy (laboranci) → brygadzista (1 na pracownię) → specjalista (każda pracownia ma swojego, siedzi w biurze) → kierownik.
- Wszyscy pracownicy mają telefony służbowe.
- Duży nacisk na cyberbezpieczeństwo: dokumenty mają etykiety (wewnętrzne / poufne / zastrzeżone).

**Wyposażenie i wzorcowanie**

- Kilkaset pozycji: od dużych analizatorów po suwmiarki i linijki.
- Kod urządzenia zawiera literę pracowni, np. `121/A` (A = analityczna). Numer może się powtarzać w różnych pracowniach — rozróżnia je litera.
- Na urządzeniu jest papierowa naklejka z datą ostatniego i następnego wzorcowania — tylko miesiąc i rok.
- Częstotliwość wzorcowania laboratorium ustala samo i jest stała dla urządzenia: co 1, 2, 3 lub 4 lata.
- Harmonogramy wzorcowań są robione ręcznie, osobno dla każdej pracowni. Raz w miesiącu specjalista je przegląda i sprawdza, co trzeba wysłać.
- Sprzęt wysyła się do kilku firm zewnętrznych (np. termohigrometry do jednej, termometry szklane do innej, wzorce do GUM). Czas realizacji: od ~1 tygodnia do ~2 miesięcy. Piece i analizatory wzorcuje się na miejscu.
- Wysyłki są grupowane (np. 3 razy w roku po kilka sztuk), bo na pracowni zawsze musi zostać sprzęt. Ofertowanie i zamawianie „to nie jest duży problem” — problemem jest pilnowanie czasu.
- Firma odsyła papierowe świadectwo wzorcowania: głównie błąd pomiaru i niepewność (np. wzorzec 500 g → 499,499 g ± niepewność). **Czy sprzęt dalej spełnia kryteria — ocenia samo laboratorium**, nie firma.
- Sprawdzenia okresowe (np. temperatura raz w miesiącu, waga raz na kwartał) robią pracownicy pracowni. Zapis: papierowe karty ewidencji w segregatorze na pracowni — żeby coś sprawdzić, trzeba tam pójść.
- W karcie ewidencji urządzenia jest lista osób upoważnionych. Pracownik jednej pracowni nie jest upoważniony do sprzętu innej. Rezerwacji urządzeń nie ma.
- Nic z tego nie jest prowadzone elektronicznie, nawet w Excelu. Inwentaryzacja też na papierze.

**Odczynniki i certyfikowane materiały odniesienia (CRM)**

- Liczą się dwie rzeczy: data ważności i ilość.
- Badania idą wg planu badań, więc zużycie da się oszacować (np. 1 l HCl wystarcza na ~2 tygodnie; badanie SO₃ dla 10 marek cementu dziennie, po ~10 ml chlorku baru).
- Zdarza się, że pracownik przychodzi z pustym opakowaniem.
- Zakup trwa: zapytanie o ofertę → zapotrzebowanie → zamówienie → podpis prezesa → wysłanie zamówienia → dostawa. CRM z zagranicy (np. z USA) — bardzo długo, stąd wyprzedzenie nawet ~6 miesięcy.
- Pracownicy **nie** będą codziennie wpisywać zużycia („to się nie sprawdzi na pewno”). Realnie: raz w tygodniu albo raz w miesiącu.

**Wyniki badań**

- Droga wyniku: brudnopis → zeszyt badań → arkusz Excel. Nie ma LIMS. Przy przepisywaniu powstają błędy; biuro kontroluje je wyrywkowo.
- Arkusze Excel są zablokowane: pracownik wpisuje tylko wynik, formuł nie zmieni.
- Po wpisaniu wyniku pracownicy nie sprawdzają, czy jest poza zakresem. Jest rotacja, nowi pracownicy, dużo metodyk.
- Wynik poza normą → powtórzenie badania i wykluczenie błędu laboranta; dopiero potem dalsze działania (np. przekwalifikowanie cementu na inną markę).

**Uniwersalność**

- Rozwiązanie ma być uniwersalne, nie tylko dla Warty (uwaga pana Krzysztofa). Mentorka: każde laboratorium akredytowane ma te same wymagania, więc przyda się każdemu.

### 2.2 Problem — doprecyzowany

**Kto ma problem:** specjalista w biurze laboratorium, który odpowiada za nadzór nad
wyposażeniem i odczynnikami.

**Problem:** musi ręcznie pilnować terminów kilkuset urządzeń oraz ważności i ilości
odczynników, choć sam nie ma z nimi kontaktu, a dane leżą na papierze w różnych miejscach.

**Skutki (z rozmowy):**

- urządzenie może wpaść w „okres bez wzorcowania”,
- odczynnik kończy się nagle, a zakup trwa tygodnie,
- wynik spoza zakresu wychodzi dopiero przy wyrywkowej kontroli,
- za przeoczenie odpowiada specjalista: „jak coś jest niedopilnowane, to potem to spada na mnie”.

**Przyczyny:**

1. Nie ma jednego miejsca z danymi: naklejki, ręczne harmonogramy, karty w segregatorach na pracowniach.
2. Kto pilnuje terminów (biuro) ≠ kto używa sprzętu i odczynników (pracownie). Pracownicy nie patrzą na daty i nie wiedzą, ile trwa zakup albo wzorcowanie.
3. Brak przypomnień — jest tylko comiesięczny ręczny przegląd, a potrzebne wyprzedzenie to od ~1 miesiąca (wzorcowanie) do ~6 miesięcy (CRM z zagranicy).
4. Wyniki są przepisywane trzy razy i nikt nie sprawdza zakresu przy wpisie.

**Czego chce mentorka:**

- „żebym nie musiała otwierać harmonogramu wzorcowania” — wystarczy powiadomienie;
- harmonogram, w którym otwiera pracownię albo urządzenie i od razu widzi terminy;
- pracownik wpisuje sprawdzenie z telefonu, a ona od razu widzi to na komputerze;
- cel to nie „zero papieru”, tylko szybki dostęp: „żeby szybciej można było dostać się do tej dokumentacji”.

---

## 3. Nasz pomysł

### 3.1 Idea w jednym zdaniu

Jedna aplikacja dla biura i pracowni: w jednym miejscu cały sprzęt, odczynniki i ich
terminy; system sam przypomina z wyprzedzeniem ustawionym dla każdej pozycji
(1–12 miesięcy), a wpisy z pracowni (sprawdzenia, stany odczynników, wyniki) trafiają od
razu do biura — z kontrolą uprawnień i zakresów.

**Zasada [T]: wszystko jest konfigurowalne.** Szczegóły (częstotliwości, wyprzedzenia, progi,
kto co wpisuje i kto dostaje powiadomienia, pola formularzy, reakcja na błąd) ustawia się
w systemie, a nie na sztywno w kodzie. Produkt ma być uniwersalny dla różnych firm, nie tylko
dla Warty.

### 3.2 Role [T]

| Rola | Kto | Co robi |
|---|---|---|
| **Kierownik** | kierownik laboratorium | otrzymuje wygenerowane dokumenty/raporty, przegląda wykresy, wyniki weryfikacji danych i ogólny stan nadzoru (zakres dostępu konfigurowalny) |
| **Admin** | specjalista z biura | prowadzi rejestr urządzeń i odczynników, ustawia terminy, progi i wyprzedzenia, wpisuje wyniki wzorcowań, dostaje powiadomienia, generuje i wysyła dokumenty do kierownika, widzi harmonogram pracowni (zakres widoczności konfigurowalny) |
| **Pracownik pracowni** | laborant | wpisuje sprawdzenia, próbki, stany odczynników i wyniki badań — tylko dla urządzeń, do których jest upoważniony |

### 3.3 Funkcje

| # | Funkcja | Co robi | Źródło | Otwarte |
|---|---|---|---|---|
| 1 | Rejestr urządzeń | Spis sprzętu każdej pracowni (inwentaryzacja urządzeń): kod (np. `121/A`), pracownia, częstotliwość wzorcowania, ostatnie i następne wzorcowanie. | [T] [M] | pyt. 6 |
| 2 | Harmonogram / tabela terminów | Widok jednej pracowni albo wszystkich: co jest i kiedy mija termin (wzorcowanie, sprawdzenie, ważność odczynnika). Zastępuje ręczne harmonogramy. | [T] [M] | — |
| 3 | Powiadomienia w aplikacji | Przypomnienie przed terminem. Wyprzedzenie ustawiane dla każdej pozycji osobno, w miesiącach: 1–12 (typowo 1 mies. dla wzorcowania, ~6 mies. dla CRM z zagranicy). Także: mało odczynnika, kończy się ważność. Odbiorcy i kanał — konfigurowalne. | [T] [M] | — |
| 4 | Wpis wyniku wzorcowania | Po powrocie świadectwa admin wpisuje: firmę, błąd pomiaru, niepewność, opcjonalnie skan świadectwa. OCR pełnego raportu wzorcowania (zewnętrzne API: model multimodalny/LLM albo OCR, np. Qwen-VL) proponuje pola formularza — admin sprawdza i **sam zaznacza OK / nie OK**. Następny termin = data ze świadectwa + częstotliwość urządzenia; wystarczy miesiąc i rok. Parametry i pola są konfigurowalne. | [T] [M] | pyt. 2, 23 |
| 5 | Sprawdzenia okresowe | Pracownik zapisuje sprawdzenie (np. temperatura co miesiąc, waga co kwartał) z telefonu zamiast w papierowej karcie; admin widzi to od razu. | [T] [M] | pyt. 4 |
| 6 | Kody QR i NFC na urządzeniach | Etykieta z QR i opcjonalny tag NFC przy urządzeniu; oba niosą ten sam link. Skan telefonem służbowym albo zbliżenie telefonu → karta urządzenia (terminy, historia) i szybki wpis sprawdzenia. QR zostaje, bo działa z każdego aparatu; NFC jest wygodniejszym nośnikiem tego samego identyfikatora. | [T] [M] | pyt. 24 |
| 7 | Uprawnienia do urządzeń | Lista osób upoważnionych do urządzenia (jak w karcie ewidencji). Nieupoważniony po skanie widzi „brak uprawnień” i nic nie wpisze. | [T] [M] | — |
| 8 | Odczynniki i CRM | Pracownik okresowo (raz w tygodniu / miesiącu) wpisuje, ile zostało. Poniżej progu minimalnego → powiadomienie „mało”. Data ważności → powiadomienie z wyprzedzeniem. Bez codziennego wpisywania zużycia. Częstotliwość, kto wpisuje i próg — konfigurowalne. | [T] [M] | — |
| 9 | Kontrola zakresu wyników (cement) | Przy wpisie wyniku system sprawdza **tylko**, czy wartość mieści się w zakresie z formularza (sekcja 4). Poza zakresem → błąd na czerwono. Nie oceniamy, czy wynik jest „dobry” — tylko zakres. Reakcja na błąd (blokada / oznaczenie) — konfigurowalna. Dane przykładowe. | [T] [M] [Z] | — |
| 10 | Wykresy z próbek i weryfikacja danych | Na podstawie pomiarów z próbek wykonywanych przez pracowników system generuje wykres oraz sprawdza dane względem ustalonego progu (np. wynikającego ze wzorcowania — próg i kryteria weryfikacji są konfigurowalne). | [T] | — |
| 11 | Generator dokumentu i wysyłka do kierownika | System generuje gotowy dokument/raport (m.in. dane z próbek, wykresy i wynik weryfikacji) oraz umożliwia jego bezpośrednią wysyłkę do kierownika (zakres raportu i kanał wysyłki konfigurowalne). | [T] | — |

### 3.4 Czego nie robimy (na razie)

- Pracownia środowiskowa; z formularza bierzemy tylko cement (pomijamy gazy, środowisko, paliwa, popioły, sam klinkier) [T] [M].
- Ocena wyniku względem karty wyrobu danej marki cementu — sprawdzamy tylko zakres [T].
- Prognoza zużycia odczynników z planu badań — wybraliśmy stan okresowy + próg [T].
- Automatyczna ocena OK / nie OK po wzorcowaniu — nawet gdy pola wypełni OCR, decyduje admin [T].
- OCR jako jedyna droga wpisu — świadectwo zawsze można wpisać ręcznie; OCR (zewnętrzne API: LLM multimodalny albo OCR, np. Qwen-VL) tylko proponuje wartości i wymaga zatwierdzenia [T]. Wysyłka skanu do zewnętrznego dostawcy jest wyłączona domyślnie (pyt. 23).
- Obsługa ofert i zamówień (wzorcowania, odczynniki) — problemem jest czas, nie sam proces [M].
- Rezerwacja urządzeń — w laboratorium jej nie ma [M].
- Pełny system wyników (LIMS) — pokazujemy tylko mechanizm kontroli zakresu, „tu chodzi o jakiś mechanizm działania” [M].

---

## 4. Dane do kontroli zakresu — cement [Z]

Źródło: formularz F-06.00.10 „Zakres badań, pomiarów i analiz wykonywanych przez Zakładowe
Laboratorium Cementowni „Warta” S.A. objętych wymaganiami normy PN-EN ISO/IEC 17025:2018-02”,
wydanie 16, obowiązuje od 19.08.2026. Tylko wiersze, w których przedmiot badań zawiera cement.

**Czego potrzeba do kontroli zakresu:** na każdy parametr — nazwa, jednostka, min, max.
Wszystko jest w tabeli. Do demo dochodzą tylko przykładowe wyniki do wpisania; mentorka:
możemy bazować na przykładowych wartościach, bo „tu chodzi o jakiś mechanizm działania”.

| Przedmiot badań | Parametr | Zakres (min–max) | Jednostka | Metoda / dokument | A/NA |
|---|---|---|---|---|---|
| Cement | wytrzymałość zapraw na ściskanie | 4,00–250,00 / 2,5–156,3 | kN / MPa | badania niszczące, PN-EN 196-1:2016-07 | A |
| Cement | wytrzymałość zapraw na zginanie | 0,10–10,00 / 0,2–23,4 | kN / MPa | badania niszczące, PN-EN 196-1:2016-07 | A |
| Cement | konsystencja zaczynów normowych | brak („–”) | — | aparat Vicat'a, PN-EN 196-3:2016-12 | A |
| Cement | czas wiązania zaczynów normowych | 10–1000 | min | aparat Vicat'a, PN-EN 196-3:2016-12 | A |
| Cement | stałość objętości zaczynów normowych | 0,0–50,0 | mm | pierścienie le Chateliera, PN-EN 196-3:2016-12 | A |
| Klinkier portlandzki, cement | straty prażenia | 0,10–8,20 | % | wagowa, PN-EN 196-2:2026-04 | NA |
| Klinkier portlandzki, cement | zawartość SiO₂ | 19,00–31,00 | % | wagowa, PN-EN 196-2:2026-04 | NA |
| Klinkier portlandzki, cement | zawartość Al₂O₃ | 3,10–11,00 | % | miareczkowa, PN-EN 196-2:2026-04 | NA |
| Klinkier portlandzki, cement | zawartość Fe₂O₃ | 2,20–4,80 | % | miareczkowa, PN-EN 196-2:2026-04 | NA |
| Klinkier portlandzki, cement | zawartość SO₃ | 0,10–3,20 | % | wagowa, PN-EN 196-2:2026-04 | NA |
| Klinkier portlandzki, cement | zawartość Na₂O | 0,08–0,50 | % | fotometria płomieniowa, PN-EN 196-2:2026-04 | NA |
| Klinkier portlandzki, cement | zawartość K₂O | 0,10–1,40 | % | fotometria płomieniowa, PN-EN 196-2:2026-04 | NA |
| Klinkier portlandzki, cement | zawartość Cl⁻ | 0,005–0,105 | % | metoda Volharda, PN-EN 196-2:2026-04 | NA |
| Klinkier portlandzki, cement | pozostałości nierozpuszczalne | 0,10–19,00 | % | wagowa, PN-EN 196-2:2026-04 | NA |
| Cement | zawartość CaO | 43,50–66,00 | % | miareczkowa, PN-EN 196-2:2026-04 | NA |
| Cement | zawartość MgO | 0,70–3,00 | % | miareczkowa, PN-EN 196-2:2026-04 | NA |
| Klinkier portlandzki, cement | zawartość chromu (VI) | 0,00000–0,00024 | % | spektrofotometryczna, PN-EN 196-10:2016-07 | NA |
| Cement, klinkier i inne materiały | zawartość rtęci | 0,010–20,0 | mg/kg | absorpcyjna spektrometria atomowa techniką amalgamacji, PB-14.NZ.PA wyd. 2 z 13.03.2024 | NA |
| Cementy, klinkier portlandzki | gęstość właściwa | 2,70–3,20 | g/cm³ | piknometr helowy, PN-EN 196-6:2019-01 | NA |
| Cementy, klinkier portlandzki | powierzchnia właściwa | 2800–4900 | cm²/g | przepuszczalność powietrza Blaine'a, PN-EN 196-6:2019-01 | NA |
| Cementy | skurcz | 0,25–0,65 | mm/m | Graff-Kaufmanna, PB-03.NZ.PW wyd. 1 z 01.08.2008 | NA |
| Cementy | ciepło hydratacji | 200–400 | J/g | kalorymetr semi-adiabatyczny, PN-EN 196-9:2010 | NA |
| Cementy | gęstość nasypowa | 1,10–1,40 | g/cm³ | wagowa, PN 80-C-04532 | NA |

Uwagi:

- A = badanie akredytowane (AB 1119), NA = nieakredytowane.
- Konsystencja zaczynów normowych nie ma zakresu — tego parametru nie da się sprawdzać.
- Wytrzymałość ma dwa zakresy: w kN i w MPa.
- Uwaga z formularza: „Wyniki < i > zakresu akredytacji, które są objęte systemem,
  Laboratorium weryfikuje na bieżąco potwierdzając ich zgodność z wymaganiami.” Mentorka:
  zakresy ustalają na podstawie próbek i mogą je poszerzać [M]. Reakcja po błędzie
  jest konfigurowalna [T].

---

## 5. Pytania do mentorów

Pytania o szczegóły (co ile, kto, jakie pola, jaka reakcja) są zamknięte jedną odpowiedzią
zespołu [T]: **to jest konfigurowalne**, bo produkt ma być uniwersalny między firmami.
Przekreślone = zamknięte. Zostają pytania o fakty i o środowisko, których nie ustawimy.

**A. Wzorcowanie, sprawdzenia, inwentaryzacja**

1. ~~Od jakiej daty liczycie następne wzorcowanie: od daty ze świadectwa czy od poprzedniego terminu z harmonogramu? Czy w systemie wystarczy miesiąc i rok, jak na naklejce?~~
   **Odpowiedź [T]:** od daty ze świadectwa; wystarczy miesiąc i rok. Parametry są konfigurowalne, szczegóły nie są ważne.
2. Co się dzieje z urządzeniem, które po wzorcowaniu jest „nie OK” (wycofanie, naprawa, ponowne wzorcowanie)? Jaki status ma mieć w systemie?
3. ~~Jakie dane ze świadectwa wzorcowania są Wam potrzebne poza błędem pomiaru i niepewnością?~~ → konfigurowalne.
4. ~~Co pracownik zapisuje przy sprawdzeniu okresowym?~~ → konfigurowalne. Czy możemy zobaczyć pusty wzór karty ewidencji i harmonogramu wzorcowań (bez danych)? — do przykładowych danych w demo.
5. Kartka z wyzwaniem mówi o „arkuszach kalkulacyjnych”, a w rozmowie usłyszeliśmy, że nadzór nad sprzętem jest tylko na papierze. Co dziś jest w arkuszach?
6. Inwentaryzacja urządzeń: chodzi o sam spis sprzętu w pracowni, czy też o okresowe sprawdzenie, że sprzęt fizycznie jest na miejscu? (~~Jak często?~~ → konfigurowalne.)

**B. Powiadomienia i role**

7. ~~Kto ma dostawać powiadomienia: tylko specjalista, czy też brygadzista danej pracowni?~~ → konfigurowalne.
8. ~~Każda pracownia ma swojego specjalistę — czy specjalista ma widzieć i zarządzać tylko swoją pracownią, czy wszystkimi?~~ → konfigurowalne.
9. ~~Czy powiadomienie w aplikacji wystarczy?~~ → tak; powiadomienia w aplikacji plus push.

**C. Odczynniki i CRM**

10. ~~Kto i jak często realnie może wpisywać stan odczynników — każdy laborant czy brygadzista; raz w tygodniu czy raz w miesiącu?~~ → konfigurowalne.
11. ~~Kto ustala próg minimalny dla odczynnika i od czego on zależy?~~ → konfigurowalne.

**D. Wyniki**

12. ~~Wynik poza zakresem: blokujemy zapis do czasu powtórzenia badania, czy zapisujemy go z oznaczeniem „poza zakresem” i wymagamy powtórzenia?~~ → konfigurowalne.

**E. Dostęp, bezpieczeństwo, audyt**

13. Gdzie aplikacja może działać (serwer w zakładzie czy chmura)? Czy telefony służbowe mają dostęp do sieci na pracowniach?
14. Czy dane w aplikacji podlegają etykietowaniu (wewnętrzne / poufne / zastrzeżone)?
15. Czy przy audycie potrzebny jest wydruk lub eksport historii urządzenia? (W rozmowie to pytanie zostało bez jasnej odpowiedzi.)

**F. Dane do demo, uniwersalność**

16. Czy możecie podać kilka przykładowych pozycji do demo: urządzenia z kodami (jaką literę mają pracownie wytrzymałościowa i paliw, skoro analityczna to A?) oraz kilka odczynników i CRM?
17. Do organizatorów: co ma pokazać „uniwersalność” rozwiązania (uwaga pana Krzysztofa)?

**G. Liczby do KPI i kosztów** (zastępują założenia [Z] w [05-kryteria.md](05-kryteria.md) §a4, §a5)

18. Ile dokładnie urządzeń jest w każdej pracowni i jaki jest typowy interwał wzorcowania?
19. Ile czasu zajmuje dziś comiesięczny przegląd harmonogramów i jak często ktoś idzie do segregatora po zapis?
20. Ile razy w ostatnim roku termin został przeoczony albo zabrakło odczynnika — i co to kosztowało (wzorcowanie awaryjne, powtórzone badania)?
21. Jaka jest infrastruktura IT (serwer lub maszyna wirtualna, kto utrzymuje) i ile osób używałoby systemu?
22. Do organizatorów: ile trwa prezentacja i Q&A?

**H. Identyfikacja i OCR**

23. Czy skany świadectw wzorcowania mogą być wysyłane do zewnętrznego dostawcy OCR/LLM (np. Qwen-VL, OpenAI) — jaki kraj/region, czy jest umowa powierzenia przetwarzania? Który dostawca jest dopuszczony? (Do czasu odpowiedzi funkcja jest wyłączona, wpis ręczny działa.)
24. Czy można nakleić na urządzenia tagi NFC (miejsce na naklejkę, koszt, kto zapisuje link)? QR wystarcza do startu.
