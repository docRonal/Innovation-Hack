# Problem statement — Inteligentne Laboratorium

Laboratorium zakładowe kontroli jakości: jeden budynek, trzy pracownie, akredytacja
PN-EN ISO/IEC 17025 i wyniki badań, na których opiera się decyzja o dopuszczeniu wyrobu.
Nadzór nad wyposażeniem, odczynnikami i dokumentacją prowadzony jest papierowo i w Excelu.
To jest źródło problemu — nie brak kompetencji, lecz brak nośnika, który sam pilnuje terminów.

## 1. Jak laboratorium działa dziś

| Wymiar | Stan obecny | Konsekwencja |
|---|---|---|
| Lokalizacja | jedno piętro: trzy pracownie (wytrzymałościowa, paliw, analityczna), biuro, specjaliści, kierownik | nadzór rozproszony fizycznie, obieg informacji „nogami" |
| Identyfikacja sprzętu | kod z literą pracowni (np. `/A`), naklejka z miesiącem i rokiem ostatniego i następnego wzorcowania | naklejka nie mówi, czy termin już minął w tym miesiącu |
| Odpowiedzialność | brygadzista na pracownię (3), specjaliści, kierownik | niedopatrzenie obciąża specjalistę |
| Ewidencja | segregatory, karty papierowe, arkusze Excel; brak systemu klasy LIMS | ręczne sprawdzanie, kontrola wyrywkowa, dane w kilku miejscach |
| Dostęp | przypisanie pracownika do sprzętu w karcie ewidencji; zakaz używania sprzętu innych pracowni | uprawnienia trzeba egzekwować, nie tylko deklarować |
| Dokumenty | klasy: wewnętrzne, poufne, zastrzeżone; zaostrzone wymagania cyberbezpieczeństwa | jedna wersja obowiązująca, reszta nieosiągalna |

## 2. Meritum: trzy zegary

Każdy element laboratorium ma termin, po którym przestaje być wiarygodny. Wszystkie trzy
zegary są dziś pilnowane ręcznie, w trzech różnych rejestrach.

### 2.1 Przyrząd → wzorcowanie i sprawdzenie

- Cykle wzorcowań: 1, 2, 3 lub 4 lata — zależnie od przyrządu.
- Realizacja u dostawcy: od tygodnia do dwóch miesięcy. Część sprzętu (piece, analizatory)
  wzorcowana jest na miejscu, część wyjeżdża.
- Równolegle biegną okresowe sprawdzenia (wagi, temperatury).
- Brak elektronicznej ewidencji: harmonogram istnieje tylko na papierze.

### 2.2 Materiał → data ważności i zapas

- Odczynniki i certyfikowane materiały odniesienia (CRM) mają daty ważności; materiały
  sprowadzane z zagranicy wymagają wyprzedzenia nawet półrocznego.
- Potrzebne jest przewidywanie wyczerpania zapasu z planu badań i szacowanego zużycia
  w ujęciu okresowym (miesiące), a nie codzienne ewidencjonowanie mililitrów.
- Zakup to łańcuch: oferta → zapotrzebowanie → zamówienie → podpis prezesa → dostawa.
  Reakcja po fakcie jest spóźniona o cały ten łańcuch.

### 2.3 Pomiar → wynik w normie

- Wynik trafia do brudnopisu, potem do zeszytu badań, potem ręcznie do arkusza Excel.
  Każde przepisanie to okazja do błędu, a kontrola jest wyrywkowa.
- Formuły w arkuszach są zablokowane, ale nikt nie wymusza reakcji na wynik poza normą
  ani poza zakresem pomiarowym.
- Wynik poza zakresem wymaga powtórki (wykluczenie błędu laboranta), a dalej decyzji:
  przekwalifikowanie na inną markę albo aktualizacja zakresu pomiarowego.

## 3. Cel

Odpowiedź na trzy pytania bez otwierania segregatora i bez chodzenia po pracowniach:

1. **Czy mogę zmierzyć tym przyrządem?** — ważność wzorcowania, sprawdzeń i przypisanie
   pracownika, w czasie krótszym niż przeczytanie naklejki.
2. **Co wymaga reakcji w najbliższych tygodniach?** — jeden widok terminów: wzorcowania,
   przeglądy, ważność odczynników i CRM, z wyprzedzeniem dopasowanym do czasu realizacji.
3. **Kto i kiedy zmienił termin, wynik, dokument?** — historia odtwarzalna na potrzeby
   audytu 17025.

Skutki, które mają zniknąć: pomiar przyrządem po terminie, badanie na przeterminowanym
materiale, utracony zapas, błąd przepisywania, decyzja kierownika na podstawie nieaktualnego
arkusza.

## 4. Kierunki rozwiązania zgłoszone z laboratorium

| Kierunek | Co daje | Warunek działania |
|---|---|---|
| Harmonogram z powiadomieniami | standard miesięczny, dla wybranych pozycji wyprzedzenie 1–12 miesięcy (np. pół roku) | termin musi być policzony z danych, a nie wpisany raz |
| Kody QR + telefony służbowe | skan prowadzi do karty urządzenia, historii lub formularza wpisu | uprawnienia: blokada dla nieuprawnionych, odrębny widok dla praktykantów |
| Cyfrowe wpisy i skany | sprawdzenie/wzorcowanie zapisane od razu, z błędem pomiaru i niepewnością ze świadectwa, zdjęciem dokumentu | kierownik widzi status bez obchodu pracowni |
| Walidacja zakresów i alerty | podświetlenie wartości poza przedziałem, wymuszona reakcja | wpisu nie da się zamknąć bez rozstrzygnięcia |

## 5. Stanowisko projektowe

Ramy, w których te kierunki mają sens — i które wyznaczają architekturę:

- **Jedna abstrakcja: okno ważności.** Przyrząd, odczynnik, dokument i uprawnienie
  pracownika to ten sam wzorzec: „ważne od–do, na podstawie jakiego zdarzenia". Termin jest
  liczony, nie przechowywany jako edytowalne pole. Jedno miejsce może się rozjechać
  z rzeczywistością — więc nie tworzymy drugiego.
- **Rejestr i zegar, nie LIMS.** System nie liczy wyników badań; pilnuje, czy wolno mierzyć
  i czy dokument jest aktualny. Wyniki zostają tam, gdzie są, dopóki walidacja zakresów nie
  wejdzie do zakresu.
- **Uprawnienia z danych, nie z UI.** Pracownia i przypisanie w karcie ewidencji decydują
  o dostępie; ukrycie przycisku nie jest kontrolą dostępu.
- **Blokada musi być nieomijalna.** Przyrząd po terminie nie przyjmuje wpisu wyniku.
  Jeśli da się obejść, wracamy do naklejki — tylko droższej.
- **Wdrożenie tylko z importem.** Jeśli istniejącej ewidencji nie da się wciągnąć
  z arkusza, nikt nie przepisze segregatorów ręcznie, a system umrze jako drugi rejestr.
- **Uniwersalność od pierwszego dnia.** Laboratorium = tenant, pracownia = jednostka,
  typ przyrządu = słownik. Rozwiązanie ma być wdrażalne w kolejnych laboratoriach
  akredytowanych, nie tylko w tym jednym.

## 6. Poza zakresem (teraz)

Akwizycja danych z przyrządów, integracja z LIMS, podpisy kwalifikowane/eIDAS,
rozliczanie kosztów wzorcowań i zakupów.

## 7. Pytania otwarte

1. Kto potwierdza wykonanie sprawdzenia: brygadzista, specjalista, czy obaj (wpis + akceptacja)?
2. Czy sprawdzenie poza kryterium blokuje przyrząd natychmiast, czy dopiero po decyzji specjalisty?
3. Jaka jest skala startowa: liczba przyrządów, pozycji materiałowych i pracowników?
4. Czy wyniki badań wchodzą w zakres pierwszej wersji, czy tylko nadzór nad wyposażeniem
   i materiałami?
