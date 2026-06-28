# HackYeah 2026 — Sport & Healthcare — MoveLens

> Plik kontekstu dla Claude Code. Czytany na starcie każdej sesji i traktowany jako stała instrukcja projektu.
> WAŻNE: w repo ten plik MUSI nazywać się `CLAUDE.md` (w korzeniu, obok package.json), inaczej Claude Code nie wczyta go automatycznie.
> Zanim cokolwiek zmienisz — przeczytaj całość i zrób krótki zwiad po kodzie.

---

## 1. Co to jest

**MoveLens** to mobilna aplikacja tworzona na hackathon **HackYeah 2026** (3–4 października 2026, Tauron Arena Kraków), kategoria **Sport & Healthcare**.

To **osobisty trener techniki ruchu**: przez kamerę telefonu analizuje wykonanie ćwiczeń w czasie rzeczywistym, pokazuje co robisz źle i jak poprawić — telefon staje się „soczewką", przez którą widać Twój ruch. Druga warstwa: łączy **rozproszone dane o zdrowiu** (eksport z Apple Health, Google Fit, wyniki badań w PDF) w jedno miejsce i zamienia je w czytelne wnioski i działania.

Sedno briefu, które realizujemy: dane o zdrowiu są dziś rozproszone, nieczytelne i nie przekładają się na działanie. MoveLens robi pętlę **mierz jakość ruchu → zinterpretuj dane → podejmij lepszą decyzję**. To NIE jest kolejny fitness-tracker ani licznik kroków.

**Selling pointy (na pitch i do README):**
- Analiza pozy leci **w całości na urządzeniu** (MediaPipe) — obraz z kamery nigdy nie opuszcza telefonu. „Prywatność by design".
- Cały stack **open-source / darmowy** — zero licencji (wymóg z briefu).
- Każdy telefon staje się **laboratorium ruchu** — jakość ruchu (głębokość, technika, symetria) to sygnał zdrowia, który normalnie mierzy się tylko w klinice.
- Warstwa „agregacja → interpretacja → działanie", w tym **podsumowanie dla lekarza** — realnie domyka dostęp do opieki.

**Czego punktuje jury (Open Tasks):** Idea & Innovation 30%, Relation to Category 20%, Practical Applicability 20%, Design 20%, Completeness 10%. Wniosek: liczy się odważny pomysł + piękny, spójny UI + wiarygodne, działające demo. Nie budujemy wszystkiego — budujemy jeden mocny, działający rdzeń (ekran „Ćwicz") i resztę spójnie wokół niego.

---

## 2. Stack i ograniczenia

- **React + Tailwind + shadcn/ui.** Mobile-first, działa w przeglądarce telefonu.
- **Wykrywanie pozy: MediaPipe Tasks Vision (PoseLandmarker), ładowane z CDN.** Na urządzeniu, za darmo, bez licencji.
  - WASM/fileset: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm`
  - Model: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
  - `runningMode: VIDEO`, detekcja co klatkę przez `requestAnimationFrame`.
- **Kamera przez `getUserMedia`** (z przełącznikiem przód/tył). Cała analiza lokalnie — obraz NIE jest nigdzie wysyłany.
- Font Inter. Zaokrąglenia `rounded-2xl`, subtelne cienie `shadow-sm`.
- Tylko źródła open-source / darmowe. Bez płatnych API i bibliotek licencyjnych.

---

## 3. Architektura — co jest święte

Logika analizy ruchu to serce projektu i punkt styku Lovable → Claude Code. **Trzymaj ją oddzieloną od UI:**

- **`src/lib/pose/`** — cała detekcja pozy i ocena techniki: ładowanie modelu, hook `usePoseAnalysis`, funkcje liczące kąty, maszyna stanów powtórzeń, scoring formy, wygładzanie sygnału. Dobrze skomentowane. Tu odbywa się całe późniejsze dostrajanie — UI nie powinno znać szczegółów liczenia.
- **`src/lib/health/`** — warstwa danych zdrowotnych (patrz sekcja 7). Otypowane funkcje zwracające dane; teraz mock, później realne parsowanie / API. Ekrany czytają tylko z tej warstwy, nigdy nie trzymają danych na sztywno.
- UI (ekrany, komponenty) korzysta z powyższych modułów — bez wplatania w komponenty matematyki pozy ani parsowania plików.

Powód: dzięki temu dostrajanie analizy i podłączanie prawdziwych danych nie wymaga dotykania ekranów, a Andrzej może podmienić środek funkcji w `src/lib/health/` bez ruszania frontu.

---

## 4. System projektowy (paleta: delikatna, „lekarska" zieleń — gustownie)

Czysto, klinicznie, dużo światła, spokój. Bez krzykliwych gradientów, bez ciężkich cieni, bez czerwieni alarmowej.

**Kolory**
- Tło aplikacji: `#F4F8F6` (delikatny miętowy off-white)
- Karty / powierzchnie: `#FFFFFF`
- Zieleń wiodąca (akcent, aktywna zakładka, szkielet pozy, przyciski): `#3FA98D`
- Zieleń głęboka (nagłówki-akcent, hover CTA): `#1E7C64`
- Delikatny zielony tint (chipy, tła sekcji, tor pierścieni): `#E5F2EC`
- „Dobra forma": `#34B27B`
- „Do poprawy" (łagodnie): bursztyn `#E0A458`; mocniejszy błąd: stonowany koral `#E0735E`
- Tekst nagłówków: `#14302A`; tekst zwykły: `#5A6B65`; hairline / ramki: `#E4EDE9`

**Zasady:** estetyka spokojna i uspokajająca; elementy dotykowe min. 44px; spójność tokenów ważniejsza niż kreatywność.

---

## 5. Struktura nawigacji

Dolny pasek, 4 zakładki: **Dziś**, **Ćwicz** (HERO), **Postępy**, **Dane**. Aktywna zakładka w zieleni `#3FA98D`.

---

## 6. Ekran „Ćwicz" — SERCE aplikacji

Priorytet jakości. To ten ekran ma działać i robić wrażenie; pozostałe mogą stać na danych przykładowych.

**Przepływ:**
1. **Wybór ćwiczenia** — karty: „Przysiad" (flagowe, pełna analiza), „Pompka", „Deska", „Wykrok" (te trzy: liczenie powtórzeń/czasu + szkielet, analiza uproszczona). Każda karta: nazwa, ikona, krótki opis, „na co zwrócimy uwagę".
2. **Przygotowanie** — instrukcja na półprzezroczystej nakładce: „Oprzyj telefon o coś, stań BOKIEM do kamery, 2–3 m, tak aby było widać całą sylwetkę". Przycisk „Zaczynamy" + prośba o dostęp do kamery.
3. **Trening na żywo:**
   - Pełnoekranowy obraz z kamery (mirror) + canvas ze szkieletem pozy: stawy jako miękkie kropki, połączenia w `#3FA98D`. Przy błędzie techniki dana kończyna zmienia kolor na bursztyn/koral.
   - U góry: nazwa ćwiczenia + DUŻY licznik powtórzeń.
   - Pierścień „Jakość" (Form Score 0–100) liczony na bieżąco.
   - Na dole rząd chipów zmieniających kolor i tekst na żywo: „Głębokość", „Kolana", „Plecy", „Tempo" (zielony = ok, bursztyn = popraw + krótka rada).
   - Przyciski: Stop/Pauza, przełącz kamerę.
4. **Podsumowanie serii:** liczba powtórzeń, średnia głębokość, średni Form Score, JEDNA najważniejsza rzecz do poprawy → zapis do „Postępów".

**Logika analizy PRZYSIADU (realnie w `src/lib/pose/`):**
Landmarki (MediaPipe Pose, 33 pkt): barki 11/12, biodra 23/24, kolana 25/26, kostki 27/28.
- **Kąt kolana** = kąt między wektorami biodro→kolano i kostka→kolano.
- **Powtórzenie (maszyna stanów):** „góra" gdy kąt kolana > 160°; schodzenie; „dół" gdy kąt kolana < 100° (~równolegle). Zlicz powtórzenie przy przejściu dół→góra.
- **Głębokość:** powrót w górę przed osiągnięciem < ~100° → chip bursztyn „Zejdź niżej".
- **Plecy:** kąt linii bark–biodro względem pionu; nadmierne pochylenie (> ~50°) → „Trzymaj plecy prosto, klatka wyżej".
- **Kolana (koślawość):** pozycja X kolana względem kostki/biodra; kolano ucieka do środka → „Kolana na zewnątrz".
- **Tempo:** powtórzenie krótsze niż ~1 s → zbyt szybkie.
- **Symetria:** różnica kąta lewego i prawego kolana → uwaga w podsumowaniu.
- **Form Score** = złożenie: głębokość + plecy + kolana + tempo.
- **Wygładzanie:** średnia ruchoma z ~5 klatek, żeby chipy nie migotały.

Pozostałe ćwiczenia: na razie liczenie powtórzeń/czasu + szkielet, bez pełnej oceny.

---

## 7. Pozostałe ekrany

**Dziś (dashboard holistyczny):** pierścień „Gotowość" (regeneracja/tętno — dane przykładowe), karta „Sugerowana sesja na dziś" (np. Przysiady 3×10) z przejściem do „Ćwicz", karta „Co mówią Twoje dane" z 1–2 wnioskami ludzkim językiem, skrót do ostatniego treningu.

**Postępy (trendy, recharts):** liczba powtórzeń w czasie, średnia głębokość przysiadu (rośnie = postęp), trend Form Score, zakres ruchu, lista ostatnich sesji z oceną. Pointa: śledzimy JAKOŚĆ ruchu w tygodniach, nie tylko ilość.

**Dane (agregacja → interpretacja → działanie):**
- Karty importu: „Apple Health (plik export.xml)", „Google Fit / Health Connect", „Wyniki badań (PDF)".
- Jedna wspólna **oś czasu zdrowia**: aktywność, tętno, sen, wyniki badań w jednym miejscu.
- Karta „Najważniejsze wskaźniki" + 2–3 wnioski ludzkim językiem.
- Przycisk **„Podsumowanie dla lekarza"** → 1-stronicowe, czytelne podsumowanie do pokazania na wizycie.

---

## 8. Dane i źródła (wszystko open-source / darmowe)

Na razie **warstwa wizualna z realistycznymi danymi przykładowymi** (po polsku) w `src/lib/health/`. Realne parsowanie dokładamy później (w Claude Code).

Docelowe, darmowe źródła:
- **Apple Health** — eksport użytkownika `export.xml` (plik, nie API, nie licencja).
- **Google Fit / Health Connect** — eksport / Google Takeout.
- **Wyniki badań (PDF)** — OCR przez **Tesseract** (open-source).
- **Open Food Facts** — otwarta baza żywności (gdyby doszedł wątek odżywiania).
- Opcjonalnie środowiskowe: **GIOŚ** (jakość powietrza), **Open-Meteo** (pogoda bez klucza).
- **FHIR** jako wewnętrzny standard porządkowania danych zdrowotnych.
- Interpretacja danych ludzkim językiem: docelowo otwarty LLM (np. Llama/Mistral) po stronie małego backendu — front woła tylko warstwę `src/lib/health/`.

Zasada: parametry i wnioski to **informacja i wsparcie decyzji**, a nie diagnoza.

---

## 9. Prywatność i disclaimer

- Widoczny komunikat na ekranie „Ćwicz": „Analiza odbywa się na Twoim urządzeniu. Obraz nie jest nigdzie wysyłany."
- Delikatny disclaimer (stopka/ustawienia): „MoveLens wspiera świadomy ruch i nie zastępuje konsultacji z lekarzem ani fizjoterapeutą." Framujemy produkt jako wsparcie dobrostanu, NIE wyrób medyczny.

---

## 10. Stan i plan

- **Zbudowane w Lovable:** skorupa UI, nawigacja 4 zakładek, ekran „Ćwicz" działający na MediaPipe (analiza przysiadu na mockach/realnie), pozostałe ekrany na danych przykładowych.
- **Do zrobienia w Claude Code (tu):**
  1. Dostrojenie analizy ruchu: progi kątów, wygładzanie, mniej szumu, stabilniejsze liczenie powtórzeń.
  2. Kolejne ćwiczenia z pełną oceną (pompka, deska, wykrok).
  3. Realne parsowanie plików: `export.xml` z Apple Health, OCR wyników (Tesseract).
  4. Warstwa interpretacji (wnioski / „podsumowanie dla lekarza") na realnych danych.

---

## 11. Zasady pracy z tym repo

- Zacznij od **zwiadu**: przeczytaj ten plik i obejrzyj strukturę (`src/lib/pose/`, `src/lib/health/`, ekrany), zanim cokolwiek zmienisz.
- Logikę pozy i danych trzymaj w `src/lib/...`, oddzieloną od UI.
- Trzymaj tokeny i komponenty z sekcji 4. Spójność > kreatywność.
- Pracuj **małymi krokami**; przy większych zmianach pokaż diff/plan przed wprowadzeniem.
- Po każdym działającym kroku rób **commit** (`git commit`) — siatka bezpieczeństwa na hackathonie.
- Sekrety (klucze, jeśli dojdzie backend) w `.env.local`; upewnij się, że `.env.local` jest w `.gitignore`. Nigdy nie commituj sekretów.
- Priorytet zawsze: działający, kompilujący się build z sercem w ekranie „Ćwicz".
