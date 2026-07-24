# GDD.md — MOLTEN CROWN

> Game Design Document. Numeric values match `math/game/game_config.py`.
> Measured RTP / payout distribution come from simulation — see `MATH_SPEC.md`
> and `PAR_REPORT.md`. Where a value is a design target validated by sim it is
> marked ✅; where it still needs a full-scale (1M+) confirm it is marked 🟡.

---

## 1. Nazwa finalna i 10 alternatywnych

**Finalna:** **MOLTEN CROWN**

Alternatywy: 1) Emberforge Crown, 2) The Molten Throne, 3) Cinderforge,
4) Magmasmith, 5) Foundry of Kings, 6) Ashen Crown, 7) Corecrown,
8) Smelter’s Crown, 9) Obsidian Forge, 10) Kingsmelt.

*(Seria „Crown”: Molten Crown → Frost Crown → Storm Crown → Void Crown.)*

## 2. Tagline

> **„Forge the ore. Raise the heat. Claim the Crown.”**

## 3. Jednozdaniowa obietnica gameplayowa

> Łącz surową rudę w coraz wyższe relikwie — im wyżej wykujesz i im goręcej
> rozgrzejesz piec, tym większa wypłata, aż po Roztopioną Koronę (15,000×).

## 4. Świat, postacie, ton

Podziemna kuźnia w sercu wygasłego wulkanu — **The Deepforge**. Ton: dorosły,
mroczny dark‑industrial fantasy; ciężkie żelazo, płynąca lawa, iskry.
- **The Emberwright** — zakapturzony kowal‑widmo, przewodnik gracza (dorosła,
  posągowa sylwetka; brak cech dziecięcych, brak elementów atrakcyjnych dla
  nieletnich).
- **The Core** — żywe, pulsujące serce lawy w superbonusie.
Paleta: lawa (amber/pomarańcz) na bazalcie (głęboka czerń), zimny **teal** jako
akcent UI (odróżnienie od czerwono‑złotych/cukierkowych miniatur — patrz
`ART_BIBLE.md`).

## 5. Core loop

1. **Spin** wypełnia siatkę 6×5 surową rudą (5 wariantów), Fluxem i Cinderami.
2. Każda grupa **4+** ortogonalnie połączonych **identycznych** komórek **FUZUJE**
   w jedną komórkę o rangę wyżej (duża grupa skacze o więcej rang).
3. Każda fuzja podnosi **Heat** o +1 (globalny mnożnik).
4. Wyprodukowana relikwia (**Bronze+**) wypłaca `wartość_rangi × Heat` natychmiast.
5. Grawitacja + refill → możliwe kolejne fuzje (kaskada) aż plansza się ustabilizuje.
6. **3+ Cinderów** → **Forge Fury** (free spins). Brak fuzji w spinie = dead spin.

Pętla emocji: częste małe fuzje (Bronze) budują rytm; rzadkie skoki do
Iron/Silver/Gold to teasery; Gold/Mythril/Crown to kulminacje.

## 6. Layout siatki

- **6 bębnów × 5 rzędów = 30 komórek**. Model wypełnienia: niezależne losowanie
  per komórka wg wag (drop‑weight), nie taśmy — właściwe dla gry fuzyjnej.
- Współrzędne: `board[r][c]`, `r=0` u góry; grawitacja opada ku `r=4`.

## 7. System wygranych

- **Bez linii i bez ways.** Wypłata = **suma wyprodukowanych relikwii × Heat**,
  naliczana per fuzja w momencie jej powstania.
- Ruda (ranga 0) i symbole specjalne (Flux, Cinder) **nie płacą**.
- `payoutMultiplier` (format RGS) = całkowita `win × 100` (np. 1150 = 11.5×).

## 8. Lista symboli

| Symbol | Rola | Ranga | Płaci? |
|---|---|---|---|
| Ore: Ember/Slag/Ash/Coal/Soot (5 wariantów) | budulec | 0 | Nie |
| **Bronze** | relikwia | 1 | Tak (token) |
| **Iron** | relikwia | 2 | Tak |
| **Silver** | relikwia | 3 | Tak |
| **Gold** | relikwia | 4 | Tak |
| **Mythril** | relikwia | 5 | Tak |
| **Molten Crown** | top relikwia / trofeum | 6 | Tak (max) |
| **Flux** (Wild) | dołącza do jednej sąsiedniej grupy fuzji | — | Nie |
| **Cinder** (Scatter) | trigger Forge Fury | — | Nie |

Ruda występuje tylko na fill; **relikwie Bronze+ powstają wyłącznie z fuzji**
(oprócz superbonusu, gdzie plansza jest pre‑seedowana).

## 9. Paytable

**Wartość bazowa wyprodukowanej relikwii (× zakład), przed pomnożeniem przez Heat:**

| Ranga | Symbol | Wartość bazowa (×) |
|---|---|---|
| 1 | Bronze | 0.03 |
| 2 | Iron | 0.45 |
| 3 | Silver | 3.00 |
| 4 | Gold | 18.0 |
| 5 | Mythril | 95.0 |
| 6 | Molten Crown | 700.0 |

**Realna wypłata = wartość × Heat.** Przykład: wykucie Gold przy Heat ×12 =
18 × 12 = **216×**. Górny limit rundy: **15,000×** (max win).

## 10. Wildy, scattery, symbole specjalne

- **Flux (Wild):** dołącza do **jednej** najlepszej sąsiedniej grupy (najwyższa
  ranga, potem największy rozmiar); nigdy nie łączy dwóch grup; sam nie płaci;
  zużywany przy fuzji. Umożliwia domknięcie grupy 3→4 → więcej fuzji.
- **Cinder (Scatter):** 3/4/5 = 10/12/14 spinów Forge Fury. Nie fuzuje, nie płaci.
- **Molten Crown:** produkt fuzji rangi 6; wizualnie „trofeum”; przy odpowiednim
  Heat prowadzi do max win.

## 11. Zasady fuzji / kaskad

1. Znajdź **komponenty spójne** identycznych symboli (ortogonalnie).
2. **Flux** dołączany do najlepszej sąsiedniej grupy (nie scala grup).
3. Grupa o **rozmiarze ≥ 4** (łącznie z Fluxami) i **randze < 6** fuzuje.
4. **Skok rang** = `1 + (rozmiar − 4) // 3` (duża grupa skacze wyżej), sufit = ranga 6.
5. Produkt ląduje w **kotwicy** (najniższy rząd, potem skrajnie lewa kolumna);
   pozostałe komórki grupy → puste.
6. **Heat += liczba fuzji** w kroku (sufit zależny od trybu).
7. **Grawitacja** (opadanie w kolumnie) + **refill** z góry.
8. Powtarzaj aż brak grup ≥ 4 (guard: max 60 kroków; realnie 1–4).

## 12. Przebieg base game (dokładnie)

- Heat startuje na **×1** i **resetuje się co spin**. Sufit Heat base = **25**.
- Reveal → (opcjonalny **anticipation** przy 2 Cinderach) → kaskady fuzji z
  wypłatą per produkt → settle spinu → jeśli 3+ Cinderów: przejście do Forge Fury.
- Trigger naturalny: **~1/190** ✅ (base). Dead spin ~**26–27%** ✅.

## 13. Przebieg bonusu — FORGE FURY (dokładnie)

- 10/12/14 spinów (3/4/5 Cinderów). Sufit Heat = **100**.
- **KLUCZOWA ZMIANA DYNAMIKI:** **Heat NIE resetuje się** między spinami — narasta
  przez cały bonus. Gęstsza ruda (4 warianty) + więcej Fluxu → dłuższe łańcuchy.
- **Retrigger:** 3+ Cinderów w spinie → **+4 spiny** (event `retrigger`).
- Trzy akty: **Setup** (Heat 1–8, małe fuzje) → **Escalation** (Heat rośnie,
  Silver/Gold zaczynają płacić dużo) → **Payoff** (wysoki Heat × relikwie).

## 14. Przebieg superbonusu — MOLTEN CORE (dokładnie)

**Zmienia TRZY podstawowe reguły** (czytelne po 1 spinie):
1. **Pre‑seed planszy:** board nie startuje z surowej rudy — przychodzi już z
   **Bronze/Iron/Silver** (event `superSeed`). Start „w połowie drabiny”.
2. **Model akumulacji = LOCK, nie pay:** wyprodukowane relikwie **nie płacą per
   spin** — ich **wartość bazowa jest bankowana do VAULT** (event `lockUpdate`),
   a Heat rośnie (sufit **10**) i utrzymuje się przez całą rundę.
3. **Kulminacja = POUR:** po 8 spinach jeden **Wylew**: `win = Vault × Heat`
   (event `pour`). Zamiast „płać za event” → „zbieraj i wylej na końcu”.

Trzy akty: **Setup** (pierwszy Pre‑seed pokazuje potencjał) → **Escalation**
(Vault i Heat rosną widocznie) → **Payoff** (jedno wielkie Pour).

## 15. Zasady retriggerów

- Tylko w **Forge Fury**: 3+ Cinderów w danym spinie → **+4 spiny**, licznik
  aktualizowany (event `retrigger` + `spinCounter`).
- **Molten Core** nie ma retriggera (stała długość 8 spinów, kończy się Pour).

## 16. Warunki max win

- **15,000×** zakładu. Osiągane, gdy skumulowana wypłata rundy ≥ 15,000×.
- Źródła: wysoki Heat × wielokrotne relikwie Gold/Mythril/Crown (Forge Fury),
  lub duży Vault × Heat (Molten Core), lub — rzadko — kaskada base przez trigger.

## 17. Zachowanie po osiągnięciu max win

- Wypłata **klampowana** dokładnie do 15,000× (`payout_x = wincap`).
- Emitowany event **`maxWin`**, następnie `totalWinUpdate`/`finalWin`/`roundEnd`.
- **Runda natychmiast się kończy** (przerwane dalsze spiny/kaskady). Brak progresji
  poza rundą; kolejny zakład startuje czysty (stateless).

## 18. Bet modes

| Mode | Nazwa gracza | Cost | is_feature | is_buybonus | Opis |
|---|---|---|---|---|---|
| `base` | Base Game | **1.00×** | – | – | Standardowa gra; Cinder triggeruje Forge Fury. |
| `ante` | **STOKED** | **1.25×** | ✔ | – | Więcej Cinderów (~2× trigger), start Heat ×2. |
| `bonus` | **Buy Forge Fury** | **100×** | – | ✔ | Gwarantowany Forge Fury (10 spinów). |
| `super` | **Buy Molten Core** | **500×** | – | ✔ | Gwarantowany superbonus (Pre‑seed + Lock & Pour). |

Każdy mode ma **to samo docelowe RTP ≈ 96.5%** i jest **niezależny/stateless**.
Zakaz decyzji zmieniających payout po starcie; brak gamble/early‑cashout.

## 19. Koszt każdego bet mode

`Player debit = base_bet × cost_multiplier`. Base 1×, STOKED 1.25×, Forge Fury
100×, Molten Core 500× (zgodnie z RGS „Bet Modes / Cost Multipliers”).

## 20. Informacje przed zakupem trybu

Panel Buy pokazuje: nazwę trybu, koszt (× zakład i w walucie), **RTP**,
**max win 15,000×**, krótki opis mechaniki, oraz — dla zgodności — informację, że
wynik jest losowy i niezależny od poprzednich. Potwierdzenie 1 kliknięciem
(`is_buybonus`), w social‑casino z ostrzeżeniami RG.

## 21. Schemat wydarzeń i animacji (event → animacja)

| Event | Animacja |
|---|---|
| `revealBoard` | opad rudy, „klik” osadzenia |
| `anticipation` | pulsujące Cindery, przygasa muzyka |
| `forge` | rozżarzenie grupy → zlanie w relikwię, iskry, licznik Heat +1 |
| `gravity` | opadanie + refill z góry |
| `heatUpdate` | wskaźnik Heat rośnie (kolor amber→biały) |
| `settleWin` | podświetlenie relikwii, count‑up wygranej |
| `bonusStart` | przejście do kuźni bonusu (transition) |
| `spinCounter` | licznik spinów |
| `retrigger` | „+4”, błysk Cinderów |
| `superSeed` | plansza „wykuwa się” od Bronze+ |
| `lockUpdate` | relikwia leci do Vault, licznik Vault rośnie |
| `pour` | Wylew lawy, wielki count‑up |
| `maxWin` | pełnoekranowa Korona, cap |
| `finalWin` / `roundEnd` | podsumowanie, powrót |

Pełny kontrakt: `TECH_ARCHITECTURE.md`.

## 22. Win presentation tiers

| Próg (× zakład) | Tier | Prezentacja |
|---|---|---|
| ≥ 5× | **Nice** | krótki błysk, SFX lekkie |
| ≥ 20× | **Big Win** | baner, count‑up, muzyka warstwa 2 |
| ≥ 75× | **Mega Win** | pełny baner, kamera, warstwa 3 |
| ≥ 300× | **Epic Win** | sekwencja, spowolnienie |
| ≥ 1,500× | **Molten Win** | Korona, pełny ekran |
| = 15,000× | **MAX / Crown** | dedykowana kulminacja |

## 23. Zasady skipowania animacji

- Tap/klik/spacja **przewija** bieżącą animację do stanu końcowego (bez pomijania
  wypłat — wynik niezmienny, tylko szybciej). Drugi tap = od razu następny event.
- Big/Mega/Epic count‑up skracany do wartości końcowej po tapie.

## 24. Turbo i instant mode (z ograniczeniami jurysdykcyjnymi)

- **Turbo** (szybsze animacje) i **Instant** (natychmiastowy wynik) dostępne
  **tylko gdy** `jurisdiction.disabledTurbo == false` (z RGS `authenticate`).
- Gdy zablokowane — przyciski ukryte/wyłączone. `disabledFullscreen` analogicznie.
- Wynik zawsze identyczny; turbo zmienia wyłącznie tempo prezentacji.

## 25. Paytable / help screen

Ekran pomocy zawiera: drabinę rang + wartości, zasadę „ruda nie płaci, relikwia
płaci × Heat”, zasadę fuzji (4+, skok rang), Heat, opis Forge Fury i Molten Core,
tabelę bet modes z kosztami, **RTP każdego trybu** oraz **max win 15,000×**,
notę RG. Zgodnie z wymogami publikacji Stake Engine (RTP + max win widoczne).

## 26. Onboarding bez obowiązkowego tutorialu

- Pierwsze 2–3 spiny: subtelne podpowiedzi „Fuse 4+ ore → forge a relic” i licznik
  Heat z tooltipem. Znikają po pierwszym forge. Brak wymuszonego tutorialu; gra
  czytelna z obserwacji (ruda ciemna/matowa, relikwie świecą).

## 27. Accessibility

- **Reduced motion:** wyłącza shake/particle‑storm, skraca transitiony, zostawia
  czytelne stany (respektuje `prefers-reduced-motion`).
- **Daltonizm:** rangi rozróżniane **kształtem sylwetki + numerem rangi**, nie tylko
  kolorem; tryb „high‑contrast relic outlines”.
- **Sygnały dźwiękowe = wizualne odpowiedniki:** każdy stinger ma odpowiednik na
  ekranie (Heat flash, baner tier, ikona retrigger).
- **Skalowanie UI:** 3 rozmiary HUD; duże strefy dotyku (min 44px).

## 28. Localization‑ready UI

- Wszystkie stringi w plikach `i18n/{lang}.json`; obsługiwane języki RGS
  (`ar,de,en,es,fi,fr,hi,id,ja,ko,pl,pt,ru,tr,vi,zh`). RTL dla `ar`.
- Liczby/waluta formatowane wg `CurrencyMeta` (symbol, miejsca dziesiętne,
  pozycja symbolu) z kontraktu RGS. Brak tekstu wypalonego w grafice.

## 29. Responsible Gaming

- Brak progresji między zakładami, brak jackpotu, brak gamble/early‑cashout.
- Widoczne RTP i max win; komunikat „każdy spin jest niezależny i losowy”.
- Wsparcie limitów sesji/straty przez RGS (`ERR_GLE`); zegar sesji, brak
  „fałszywych near‑missów” (Cinder teaser jest uczciwy — realnie zbliża do triggera).
- Social‑casino: waluty XGC/XSC, brak elementów sugerujących gwarantowaną wygraną.

## 30. Edge cases (lista)

1. Rozłączenie w trakcie Forge Fury/Molten Core → **resume** aktywnej rundy
   (`auto_close_disabled=True`), odtworzenie stanu z eventów.
2. Max win osiągnięty w połowie kaskady → natychmiastowy stop, klamp, `maxWin`.
3. Retrigger na ostatnim spinie → dodane spiny grają.
4. Pętla kaskad (guard 60 kroków) — log, praktycznie nieosiągalne.
5. Flux bez sąsiedniej grupy → zostaje, nie płaci, refill w kolejnym kroku.
6. 5 Cinderów + jednoczesne duże fuzje w tym samym spinie.
7. Niewystarczające saldo na buy (`ERR_IPB`) → komunikat, brak zakładu.
8. Zmiana waluty/precyzji (int×10⁶) — tylko warstwa display.
9. Molten Core z pustym Vault (skrajnie rzadkie) → Pour = 0, runda ważna,
   `auto_close_disabled` pozwala domknąć.
10. Turbo zablokowane jurysdykcyjnie → UI bez turbo, wynik bez zmian.
11. Reduced motion + max win → skrócona, ale pełna prezentacja kulminacji.
12. Przepełnienie liczb — payout klampowany, precyzja int (brak float w RGS).

## Trzy przykładowe przebiegi bonusu (Forge Fury)

| Przebieg | Co się dzieje | Wypłata | Dlaczego nie „błąd”, ale i nie ukrywa niskiej wartości |
|---|---|---|---|
| **Słaby** | Mało fuzji, Heat kończy ~6, tylko Bronze/Iron | ~5–15× | Widać rytm i Heat, ale wprost mała wygrana; count‑up krótki, bez fałszywej celebracji |
| **Średni** | Heat ~20–30, kilka Silver, jeden Gold | ~60–120× | Wyraźny Escalation, satysfakcjonujący Payoff |
| **Bardzo mocny** | Retrigger, Heat ~60–90, Gold×kilka / Mythril | ~800–4,000× | Pełny łuk 3 aktów, kulminacja Mega/Epic |

Nawet słaby bonus pokazuje **działanie mechaniki** (fuzje + Heat), więc nie wygląda
na techniczny błąd; jednocześnie prezentacja **nie udaje** dużej wygranej.
