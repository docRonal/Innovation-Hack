# Problem statement — Inteligentne Laboratorium

Źródła: transkrypcja opisu problemu hackathonu „Inteligentne Laboratorium" oraz materiał
uzupełniający „Najważniejsze informacje do projektu".

Treść poniżej jest dosłowna — bez interpretacji, uzupełnień i założeń. Zachowano pisownię
oryginałów; ujednolicono wyłącznie formatowanie list i nagłówków.

---

## 1. Treść zadania

### Historia problemu

Wyobraźcie sobie laboratorium przemysłowe, w którym każdego dnia wykonywane są badania
i pomiary służące kontroli jakości. Aby wyniki były wiarygodne, laboratorium musi
odpowiednio nadzorować wykorzystywane wyposażenie.

Urządzenia pomiarowe wymagają:

- Okresowych wzorcowań
- Regularnych sprawdzeń
- Prowadzenia dokumentacji potwierdzającej ich stan

Każde urządzenie ma swoją historię, terminy oraz dokumenty, które powinny być zawsze
aktualne i łatwo dostępne.

### Wyzwanie

**Jak usprawnić i zdigitalizować nadzór nad wyposażeniem laboratorium, wzorcowaniami
i powiązaną dokumentacją?**

Celem rozwiązania jest:

- Ograniczenie pracy manualnej
- Zmniejszenie ryzyka błędów
- Wyeliminowanie możliwości wykorzystania nieaktualnych informacji

## 2. Struktura i organizacja laboratorium

- **Jedna lokalizacja:** laboratorium zakładowe mieści się w jednym budynku, na jednym piętrze (podział na osobne pomieszczenia/pracownie, biuro, specjalistów i kierownika).
- **Trzy pracownie:** wytrzymałościowa, paliw oraz analityczna; każda ma własny sprzęt oznaczony kodem z literą pracowni (np. `/A`) oraz własnego brygadzistę (3 brygadzistów – po jednym na pracownię), a także specjalistów i kierownika.
- **Uprawnienia i dostęp:** obowiązuje akredytacja (norma 17025) oraz zaostrzone podejście do cyberbezpieczeństwa i podziału dokumentów (wewnętrzne, poufne, zastrzeżone). Pracownicy nie mogą używać sprzętu z innych pracowni ani sprzętu, do którego nie są przypisani w karcie ewidencji.
- **Szersze zastosowanie:** rozwiązanie powinno być uniwersalne dla laboratoriów akredytowanych o podobnych wymaganiach (nie tylko pod kątem jednej konkretnej firmy, ale też pod kątem przyszłych wdrożeń/prezentacji).

## 3. Główne problemy i obszary do zaadresowania

1. **Ręczne pilnowanie terminów wzorcowań i przeglądów:**
   - harmonogramy są prowadzone ręcznie, a naklejki na sprzęcie zawierają często tylko miesiąc i rok (ostatniego i następnego wzorcowania).
   - różne częstotliwości wzorcowań (np. co rok, co 2, 3 lub 4 lata) oraz różne czasy realizacji u zewnętrznych dostawców (od tygodnia do nawet 2 miesięcy).
   - część sprzętu (np. piece, analizatory) jest wzorcowana na miejscu, a część wysyłana; dodatkowo prowadzone są okresowe sprawdzenia (np. wagi, temperatury).
   - brak elektronicznej ewidencji – dane są w segregatorach / kartach papierowych, co wymusza ręczne sprawdzanie i rodzi ryzyko niedopatrzeń (odpowiedzialność spada na specjalistę).
2. **Odczynniki chemiczne i certyfikowane materiały odniesienia (CRM):**
   - kluczowe są **daty ważności** (np. na materiały sprowadzane z zagranicy czeka się długo, więc przydaje się wyprzedzenie nawet półroczne) oraz **przewidywanie wyczerpania zapasów** na podstawie planu badań i szacowanego zużycia (np. w ujęciu okresowym / w miesiącach, a nie codziennym wpisywaniu każdego mililitra).
   - długi proces zakupowy (oferta, zapotrzebowanie, zamówienie, podpis prezesa, oczekiwanie na dostawę), dlatego błędy i brak reakcji z wyprzedzeniem są dotkliwe.
3. **Przepływ danych, wyniki badań i walidacja zakresów:**
   - pracownicy notują wyniki w zeszytach/brudnopisach, przenoszą do zeszytu badań, a potem ręcznie wpisują do arkuszy Excel (brak systemu klasy LIMS) – ryzyko błędów przy przepisywaniu i kontroli wyrywkowej.
   - w Excelu arkusze obliczeniowe są chronione (komórki zablokowane przed zmianą formuł, wpisuje się tylko dane), ale pracownicy nie zawsze reagują na wyniki poza normą / poza zakresem.
   - przy wyniku poza normą / poza zakresem pomiarowym konieczna jest powtórka analizy (wykluczenie błędu laboranta), a następnie ewentualne działania (np. przekwalifikowanie na inną markę, jeśli dotyczy wyrobu/cementu) lub aktualizacja zakresów pomiarowych (np. na podstawie próbek).

## 4. Propozycje funkcji i kierunki rozwoju projektu

- **Interaktywny harmonogram i powiadomienia z wyprzedzeniem:**
  - podgląd urządzeń/pracowni i zbliżających się terminów (wzorcowań, przeglądów okresowych, dat ważności odczynników/CRM), najlepiej w widoku tabelarycznym / według pracowni i terminów.
  - powiadomienia wyprzedzające (np. miesięczne standardowo, a dla wybranych pozycji/sprzętu/materiałów z możliwością ustawienia wyprzedzenia w miesiącach, np. 1–12 miesięcy, np. pół roku).
- **Szybki dostęp przez kody QR i telefony służbowe:**
  - pracownicy mają telefony służbowe, a urządzenia mają kody/identyfikatory – skanowanie kodu QR mogłoby prowadzić do informacji o urządzeniu, historii/karty czy formularza sprawdzenia/wpisu (z uwzględnieniem uprawnień użytkownika – np. blokada dla osób nieuprawnionych lub odrębny widok/test dla praktykantów).
- **Cyfryzacja wpisów i raportów (zamiast szukania po segregatorach):**
  - możliwość szybkiego zapisania faktu wykonania sprawdzenia/wzorcowania czy wprowadzenia kluczowych danych (np. błędu pomiaru i niepewności ze świadectwa wzorcowania, skanu/zdjęcia dokumentu) tak, aby osoba zarządzająca widziała status i historię bez chodzenia po pracowniach.
- **Walidacja danych i automatyczne alerty w arkuszach/formularzach:**
  - sprawdzanie zakresów/norm (np. podświetlanie wartości poza dopuszczalnym przedziałem) i wymuszanie reakcji/powtórzenia pomiaru przed zamknięciem wpisu.
