# CONCEPTS.md — Trzy oryginalne koncepty + scoring + wybór

> Zasada projektowa (z briefu): **jedna mechanika główna**, max 2 wspierające, max 3 równocześnie widoczne
> stany specjalne, jasny związek przyczynowo-skutkowy. Żaden koncept nie jest „mechanic soup”.
> Wszystkie są **stateless per-bet**; stan tylko w obrębie rundy bonusowej.

---

## Koncept A — **MOLTEN CROWN** *(rekomendowany)*

- **Elevator pitch:** *Łączysz surową rudę w coraz wyższe relikwie na rozżarzonej kuźni — im wyżej wykujesz i im goręcej pracuje piec, tym większa wypłata, aż po Roztopioną Koronę.*
- **Theme / świat:** Podziemna, mroczna kuźnia w martwym wulkanie; dorosły dark-industrial fantasy. Paleta: lawa (pomarańcz/amber) na bazalcie (głęboka czerń) z zimnym teal akcentem. Postać-przewodnik: **Kowal-Widmo (The Emberwright)** — zakapturzona, dorosła sylwetka; brak elementów dziecięcych.
- **Grupa docelowa:** pełnoletni gracze high-vol lubiący „build-up”/eskalację (fani Razor Shark, Money Train, Fire in the Hole) + widzowie streamów.
- **Mechanika główna (jedno zdanie):** *Sąsiadujące grupy 4+ tej samej rangi rudy FUZUJĄ w jedną relikwię o rangę wyżej; płacisz tylko za relikwie od rangi Iron w górę, pomnożone przez licznik **Heat**, który rośnie o +1 z każdą fuzją.*
- **Base game:** 6×5. Spin wypełnia planszę rudą (5 niskich rang). Grupy 4+ (ortogonalnie połączone) tej samej rangi → fuzja w 1 symbol rangę wyżej (spada grawitacyjnie, refill z góry). Każda fuzja: +1 Heat (globalny mnożnik, start x1). Gdy fuzje ustają → wypłata = Σ(wartość relikwii Iron+ × Heat). Ruda Copper/Bronze płaci 0 (to „budulec”). Scatter **Cinder** zbiera się do bonusu.
- **Bonus — FORGE FURY (free spins):** Heat **nie resetuje** się między spinami rundy — narasta przez cały bonus. Zmiana dynamiki: z „krótkiej rampy w 1 spinie” na „długą rampę przez całą rundę”. Setup: niski Heat. Escalation: Heat rośnie. Payoff: fuzje przy wysokim Heat płacą ogromnie.
- **Superbonus — MOLTEN CORE:** **zmienia trzy reguły naraz** (czytelne po 1 spinie): (1) plansza **pre-seed** — startuje od rangi Iron (nie od Copper); (2) reguła akumulacji: relikwie **LOCK** i nie znikają — każda wykuta relikwia zostaje; (3) kulminacja: runda kończy się jednym **POUR (Wylaniem)** = Σ zablokowanych relikwii × końcowy Heat. Z „płać za event” na „zbieraj i wylej na końcu”.
- **Triggerowanie:** naturalnie 3/4/5 scatterów **Cinder** → Forge Fury (8/10/12 spinów); **Molten Core** naturalnie przez rzadki „Crown Cinder” (złoty scatter) lub buy.
- **Bet modes:** BASE (1×), STOKED ante (1.25×, +Heat start/scatter chance), BUY Forge Fury (~100×), BUY Molten Core (~500×).
- **Przykładowa mocna runda (base):** ruda Bronze×9 fuzuje→Iron; sąsiedztwo Iron×4 fuzuje→Silver (Heat x3); refill daje Silver×4→Gold (Heat x5); wypłata Gold×1 (wartość 40) × Heat 5 = 200× — czytelny łańcuch.
- **Volatility:** High (base), Extreme (Molten Core).
- **Max win:** **15,000×** (wykucie Molten Crown / pełny Pour).
- **Bonus frequency:** ~1/170 (base natural) 🟡.
- **Streamerski powód:** licznik Heat rośnie na oczach + „czy dojdzie do Korony?” — pojedynczy, klipowalny wskaźnik; POUR w superbonusie = jedna wielka kulminacja.
- **Ryzyko matematyczne:** kaskadowa fuzja ma długi tail — trzeba uważnie ograniczyć rozkład Heat i częstość top-rang (ryzyko rozjazdu RTP). **Średnie.**
- **Ryzyko implementacyjne:** logika fuzji + grawitacja + eventy per-krok — więcej eventów niż w prostym lines. **Średnie.**
- **Ryzyko niezrozumienia:** „co płaci?” musi być krystaliczne (ruda ≠ płaci, relikwia = płaci). Rozwiązane onboardingiem/kolorem. **Niskie-średnie.**
- **Element odróżniający:** mnożnik **zarabiany** (nie losowy), wypłata od **rang**, superbonus = **zmiana modelu na lock&pour + pre-seed**. Nie jest to tumble+bomby.

---

## Koncept B — **UNDERTOW** (kierunkowa grawitacja klastrowa)

- **Elevator pitch:** *Prąd oceaniczny zmienia kierunek grawitacji co spin — te same symbole spadają raz w dół, raz w bok, tworząc wciąż nowe klastry.*
- **Theme:** Abyssal trench / leviathan; ciemny błękit-czerń, bioluminescencja. Dorosły, „deep horror-lite”.
- **Mechanika główna (1 zdanie):** *Wygrane klastrowe (5+), po których symbole opadają w **aktualnym kierunku Prądu** (dół/lewo/prawo), a nie zawsze w dół — kierunek pokazuje strzałka i zmienia się co spin/kaskadę.*
- **Base:** 7×7 cluster + tumble; kierunek grawitacji z **Current Compass** (1 z 4). Wsparcie: **Whirlpool** wciąga symbole do środka (respin).
- **Bonus — RIPTIDE:** kierunek zmienia się **w trakcie tej samej kaskady** (multi-directional), mnożnik za każdą zmianę kierunku.
- **Superbonus — MAELSTROM:** grawitacja **spiralna** (ku środkowi) — całkowicie inna reguła tworzenia klastrów; kulminacja gdy środek 3×3 wypełni się jednym symbolem.
- **Bet modes:** BASE, ante (silniejszy Whirlpool), BUY Riptide, BUY Maelstrom.
- **Volatility:** High. **Max win:** 20,000× 🟡. **Bonus freq:** ~1/200.
- **Streamerski powód:** nieprzewidywalny board, „gdzie spadnie?”.
- **Ryzyka:** *matematyczne* — spiralna grawitacja trudna do zbalansowania (wysokie); *implementacyjne* — 4 kierunki grawitacji + spirala = dużo edge-case'ów (wysokie); *zrozumienie* — kierunkowa grawitacja bywa dezorientująca (średnie).
- **Element odróżniający:** kierunkowa/spiralna grawitacja jako oś (rzadkie), ale ryzyko dezorientacji.

---

## Koncept C — **VOLT CONDUIT** (obwód / przewodzenie)

- **Elevator pitch:** *Ładunek wchodzi z lewej i przepływa przez połączone ogniwa — im dalej dojdzie prąd, tym większa wypłata.*
- **Theme:** Retro-futurystyczna wieża energetyczna „Tesla noir”; grafit + elektryczny cyan.
- **Mechanika główna (1 zdanie):** *Wypłata zależy od **długości ścieżki przewodzenia** — ładunek startuje z lewej kolumny i płynie ortogonalnie przez sąsiadujące ogniwa tej samej barwy; liczy się zasięg (ile kolumn/komórek osiągnie), nie liczba symboli.*
- **Base:** 6×5; symbole = ogniwa 3 barw + izolatory. **Conductor wild** łączy barwy. Wsparcie: **Capacitor** magazynuje mnożnik do rozładowania.
- **Bonus — OVERLOAD:** wiele źródeł ładunku (z 4 stron), przecięcia ścieżek = mnożnik.
- **Superbonus — SHORT CIRCUIT:** cała plansza pod napięciem; reguła: każda kompletna ścieżka **od krawędzi do krawędzi** wypłaca cały „bank” napięcia × liczba przecięć.
- **Bet modes:** BASE, ante (więcej conductorów), BUY Overload, BUY Short Circuit.
- **Volatility:** High-Extreme. **Max win:** 25,000× 🟡. **Bonus freq:** ~1/220.
- **Streamerski powód:** „czy prąd przejdzie całą planszę?” napięcie ścieżki.
- **Ryzyka:** *matematyczne* — pathfinding-payout ma ciężki, skośny rozkład, trudny tuning (wysokie); *implementacyjne* — logika ścieżek + wizualizacja przepływu (wysokie); *zrozumienie* — „zasięg ≠ liczba symboli” wymaga nauki (średnie-wysokie).
- **Element odróżniający:** payout od ścieżki/zasięgu (bardzo rzadkie), ale najtrudniejszy do wyjaśnienia i strojenia.

---

## Scoring (1–10; wyżej = lepiej)

| Kryterium (waga) | A · MOLTEN CROWN | B · UNDERTOW | C · VOLT CONDUIT |
|---|:--:|:--:|:--:|
| Oryginalność | 9 | 8 | 9 |
| Prostota wyjaśnienia | 9 | 6 | 5 |
| Jakość base game | 9 | 8 | 7 |
| Jakość bonusu | 9 | 8 | 8 |
| Jakość superbonusu | 10 | 8 | 8 |
| Potencjał streamerski | 9 | 8 | 8 |
| Potencjał lobby CTR | 9 | 8 | 7 |
| Strojenie matematyczne | 8 | 6 | 5 |
| Zgodność ze Stake Engine | 10 | 9 | 8 |
| Wykonalność produkcyjna | 8 | 6 | 5 |
| Wydajność mobilna | 8 | 7 | 6 |
| Budowa marki/serii | 9 | 8 | 7 |
| **Suma (max 120)** | **107** | **90** | **83** |

## Wybór finalny: **KONCEPT A — MOLTEN CROWN**

🧠 **[WNIOSEK / uzasadnienie na bazie researchu]:**

1. **Najlepszy stosunek oryginalność ÷ prostota.** Research (§6 RESEARCH.md) wskazał, że rynek nasycony jest „random multiplier” (Gates/Sweet Bonanza) i „tumble+bomby”. Molten Crown daje mnożnik **zarabiany deterministycznie** (Heat = liczba fuzji) i wypłatę **od rang** — nowy hook, a mimo to opisywalny jednym zdaniem. Undertow/Volt są oryginalne, ale przełamują zasadę „czytelne w pierwszych 10 spinach”.
2. **Superbonus spełnia twardy wymóg zmiany reguły** najlepiej z trzech: Molten Core zmienia **start planszy + model akumulacji + kulminację** naraz, pozostając czytelny po 1 spinie (lock & pour).
3. **Strojenie matematyczne** jest najbardziej wykonalne: dyskretna drabina rang + skończony rozkład Heat → łatwiej sprowadzić do skończonej dystrybucji rund (wymóg lookup CSV). Pathfinding (C) i spiralna grawitacja (B) mają rozkłady trudne do kontroli i publikacji.
4. **Wybór NIE jest „najbardziej skomplikowany”** — przeciwnie, jest najprostszy do wyjaśnienia przy najwyższej ocenie superbonusu; zgodnie z briefem nie premiuję złożoności.
5. **Lobby/brand:** paleta molten-teal-on-basalt i focal point „Korona” dają wyróżnienie w lobby (RESEARCH §7); jednosłowna nazwa i „Crown” jako trofeum max-winu wspierają serię (Molten Crown → np. „Frost Crown”, „Storm Crown”).

Wybrana **oś nazewnicza**: *Crown* jako trofeum max-winu i potencjalna seria. Pełny GDD → `GDD.md`.
