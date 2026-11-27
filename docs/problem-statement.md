# Problem statement — Inteligentne Laboratorium

Laboratorium zakładowe kontroli jakości: jeden budynek, trzy pracownie, akredytacja
PN-EN ISO/IEC 17025 i wyniki badań, na których opiera się decyzja o dopuszczeniu wyrobu.
Nadzór nad wyposażeniem, odczynnikami i dokumentacją prowadzony jest papierowo i w Excelu.
To jest źródło problemu — nie brak kompetencji, lecz brak nośnika, który sam pilnuje terminów.

## 1. Jak laboratorium działa dziś

| Wymiar | Stan obecny | Konsekwencja |
|---|---|---|
| Lokalizacja | jedno piętro: trzy pracownie (wytrzymałościowa, paliw, analityczna), biuro, specjaliści, kierownik | nadzór rozproszony fizycznie, obieg informacji „nogami" |
| Skala i identyfikacja | kilkaset pozycji sprzętowych; kod z literą pracowni (np. `121/A`), naklejka z miesiącem i rokiem ostatniego i następnego wzorcowania | numery powtarzają się między pracowniami; naklejka nie mówi, czy termin już minął w tym miesiącu |
| Odpowiedzialność | brygadzista na pracownię (3), specjaliści, kierownik | niedopatrzenie obciąża specjalistę |
| Ewidencja | segregatory, karty papierowe, arkusze Excel; brak systemu klasy LIMS | ręczne sprawdzanie, kontrola wyrywkowa, dane w kilku miejscach |
| Dostęp i kadra | przypisanie imienne do sprzętu w karcie ewidencji; zakaz używania sprzętu innych pracowni; rotacja kadr i sezonowi praktykanci | uprawnienia trzeba egzekwować, nie tylko deklarować |
| Dokumenty i bezpieczeństwo | klasy: wewnętrzne, poufne, zastrzeżone; zaostrzone wymagania cyberbezpieczeństwa; pracownicy dysponują telefonami służbowymi | jedna wersja obowiązująca, reszta nieosiągalna; skan QR wymaga uwierzytelnienia |

## 2. Meritum: trzy zegary

Każdy element laboratorium ma termin, po którym przestaje być wiarygodny. Wszystkie trzy
zegary są dziś pilnowane ręcznie, w trzech różnych rejestrach.

### 2.1 Przyrząd → wzorcowanie, weryfikacja i sprawdzenie

- Cykle wzorcowań: 1, 2, 3 lub 4 lata — zależnie od przyrządu.
- Realizacja u dostawcy: od tygodnia do dwóch miesięcy. Część sprzętu (piece, analizatory)
  wzorcowana jest na miejscu, część wyjeżdża (z koniecznością zachowania ciągłości pracy
  w pracowni).
- Weryfikacja po powrocie: otrzymanie świadectwa wzorcowania nie przywraca przyrządu do
  pracy — specjalista musi najpierw ocenić błąd pomiaru i niepewność wobec kryteriów
  akceptacji.
- Równolegle biegną okresowe sprawdzenia wewnętrzne (wagi, temperatury).
- Brak elektronicznej ewidencji: harmonogram i karty ewidencji istnieją tylko na papierze.

### 2.2 Materiał → data ważności i zapas

- Odczynniki i certyfikowane materiały odniesienia (CRM) mają daty ważności; materiały
  sprowadzane z zagranicy wymagają wyprzedzenia nawet półrocznego.
- Potrzebne jest przewidywanie wyczerpania zapasu z planu badań i szacowanego zużycia
  w ujęciu okresowym (miesiące), a nie codzienne ewidencjonowanie mililitrów.
- Zakup to łańcuch: oferta → zapotrzebowanie → zamówienie → podpis prezesa → dostawa.
  Reakcja po fakcie jest spóźniona o cały ten łańcuch.

### 2.3 Pomiar → wynik w normie (Etap 2)

- Wynik trafia do brudnopisu, potem do zeszytu badań, potem ręcznie do arkusza Excel.
  Każde przepisanie to okazja do błędu, a kontrola jest wyrywkowa.
- Formuły w arkuszach są zablokowane, ale nikt nie wymusza reakcji na wynik poza normą
  ani poza zakresem pomiarowym.
- Wynik poza zakresem wymaga powtórki (wykluczenie błędu laboranta), a dalej decyzji:
  przekwalifikowanie wyrobu na inną markę albo aktualizacja zakresu pomiarowego.

## 3. Cel

Odpowiedź na trzy pytania bez otwierania segregatora i bez chodzenia po pracowniach:

1. **Czy mogę zmierzyć tym przyrządem?** — status urządzenia (sprawny / przeterminowany /
   w wzorcowaniu / oczekuje na ocenę), ważność wzorcowania, sprawdzeń i przypisanie
   pracownika, w czasie krótszym niż przeczytanie naklejki.
2. **Co wymaga reakcji w najbliższych tygodniach?** — jeden widok terminów: wzorcowania,
   przeglądy, ważność odczynników i CRM, z wyprzedzeniem dopasowanym do czasu realizacji.
3. **Kto i kiedy zmienił termin, wynik, dokument?** — historia odtwarzalna na potrzeby
   audytu 17025.

Skutki, które mają zniknąć: pomiar przyrządem po terminie lub niezweryfikowanym po
wzorcowaniu, badanie na przeterminowanym materiale, utracony zapas, błąd przepisywania,
decyzja kierownika na podstawie nieaktualnego arkusza.

## 4. Kierunki rozwiązania zgłoszone z laboratorium

| Kierunek | Co daje | Warunek działania |
|---|---|---|
| Harmonogram z powiadomieniami | standard miesięczny, dla wybranych pozycji wyprzedzenie 1–12 miesięcy (np. pół roku) | termin musi być policzony z danych, a nie wpisany raz |
| Kody QR + telefony służbowe | skan prowadzi do karty urządzenia, historii lub formularza wpisu | uwierzytelnienie w sieci zakładowej; blokada dla nieuprawnionych i odmowa / tryb odczytu dla praktykantów |
| Cyfrowe wpisy i skany | sprawdzenie/wzorcowanie zapisane od razu, z błędem pomiaru i niepewnością ze świadectwa, zdjęciem dokumentu | status aktywny dopiero po akceptacji specjalisty; kierownik widzi stan bez obchodu pracowni |
| Walidacja zakresów i alerty _(Etap 2)_ | podświetlenie wartości poza przedziałem z karty wyrobu, wymuszona reakcja | wpisu nie da się zamknąć bez rozstrzygnięcia (powtórka / przekwalifikowanie) |

## 5. Stanowisko projektowe

Ramy, w których te kierunki mają sens — i które wyznaczają architekturę:

- **Jedna abstrakcja: okno ważności.** Przyrząd, odczynnik, dokument i uprawnienie
  pracownika to ten sam wzorzec: „ważne od–do, na podstawie jakiego zdarzenia". Termin jest
  liczony, nie przechowywany jako edytowalne pole. Jedno miejsce może się rozjechać
  z rzeczywistością — więc nie tworzymy drugiego.
- **Podział na etapy (MVP vs Etap 2).**
  - **Etap 1 (MVP):** rejestr i zegar — pilnuje, czy wolno mierzyć (statusy, wzorcowania,
    sprawdzenia, weryfikacja świadectw), czy materiał jest ważny i czy dokument jest aktualny.
  - **Etap 2:** moduł walidacji wyników badań na podstawie kart wyrobów (cementów) i zakresów
    pomiarowych.
- **Uprawnienia z danych, nie z UI.** Pracownia i przypisanie w karcie ewidencji decydują
  o dostępie oraz klasie widocznych dokumentów (wewnętrzne / poufne / zastrzeżone); ukrycie
  przycisku nie jest kontrolą dostępu.
- **Blokada musi być nieomijalna.** Przyrząd po terminie lub bez zatwierdzonej oceny po
  wzorcowaniu nie przyjmuje wpisu. Jeśli da się obejść, wracamy do naklejki — tylko droższej.
- **Wdrożenie tylko z importem.** Jeśli istniejącej ewidencji nie da się wciągnąć
  z arkusza, nikt nie przepisze segregatorów ręcznie, a system umrze jako drugi rejestr.
- **Uniwersalność od pierwszego dnia.** Laboratorium = tenant, pracownia = jednostka,
  typ przyrządu = słownik, klucz przyrządu = `(kod, pracownia)`. Rozwiązanie ma być
  wdrażalne w kolejnych laboratoriach akredytowanych, nie tylko w tym jednym.

## 6. Poza zakresem (teraz)

Akwizycja danych z przyrządów, integracja z LIMS, OCR świadectw wzorcowania (wystarczy ręczny
wpis błędu i niepewności + skan/zdjęcie), podpisy kwalifikowane/eIDAS, rozliczanie kosztów
wzorcowań i zakupów.

## 7. Pytania otwarte

1. Kto potwierdza wykonanie sprawdzenia okresowego: brygadzista, specjalista, czy obaj
   (wpis + akceptacja)?
2. Czy sprawdzenie poza kryterium blokuje przyrząd natychmiast, czy dopiero po decyzji
   specjalisty?
3. Czy system ma ostrzegać przed wysłaniem do wzorcowania ostatniego sprawnego egzemplarza
   danego typu w pracowni?
4. Jak dokładnie wygląda ścieżka dla urządzeń wzorcowanych na miejscu (piece, analizatory)
   w porównaniu ze sprzętem wysyłanym?
5. Czy w Etapie 2 system ma jedynie blokować wynik poza normą i wymuszać powtórkę, czy także
   podpowiadać inną markę cementu spełniającą kryteria próbki?

## 8. Kryteria sukcesu (pilotaż MVP)

- **Weryfikacja gotowości przyrządu:** czas sprawdzenia statusu i uprawnień pracownika po
  skanie QR poniżej 5 sekund.
- **Zero użycia po terminie:** żaden przyrząd bez ważnego okna ważności lub zatwierdzonej
  oceny po wzorcowaniu nie pozwala na rejestrację czynności.
- **Widok zamówień jednym kliknięciem:** wygenerowanie listy pozycji (wzorcowania, przeglądy,
  odczynniki, CRM) wymagających reakcji w horyzoncie 30 i 180 dni bez otwierania segregatorów.
- **Gotowość audytowa ISO 17025:** 100% zmian terminów, statusów przyrządów, ocen świadectw
  i dokumentów odtwarzalnych w historii (kto, kiedy, na jakiej podstawie).
