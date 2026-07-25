# MOLTEN CROWN 🔥👑

**Oryginalny slot iGaming klasy premium na Stake Engine.**
Forge‑ladder mechanika: łącz surową rudę w coraz wyższe relikwie — im wyżej
wykujesz i im goręcej rozgrzejesz piec (Heat), tym większa wypłata, aż po
Roztopioną Koronę (**15,000×**).

> To repo zawiera pełny pakiet projektowo‑implementacyjny: research, GDD, model
> matematyczny (uruchamiany, RTP **0.9650** we wszystkich trybach), pliki
> publikacyjne w formacie Stake Engine, architekturę frontendu (TypeScript,
> event‑driven) oraz **działający harness odtwarzający** realne wyniki silnika.

---

## Dokumenty (deliverables)

| Plik | Zawartość |
|---|---|
| [`RESEARCH.md`](RESEARCH.md) | Benchmark 36 gier, zasady sukcesu, luki rynkowe |
| [`CONCEPTS.md`](CONCEPTS.md) | 3 koncepty, scoring, wybór Molten Crown |
| [`GDD.md`](GDD.md) | Pełny game design (30 sekcji) |
| [`MATH_SPEC.md`](MATH_SPEC.md) | Model matematyczny, profile, bet modes, rozkłady |
| [`PAR_REPORT.md`](PAR_REPORT.md) | RTP, hit rates, buckety, feature contribution, P(max) |
| [`TECH_ARCHITECTURE.md`](TECH_ARCHITECTURE.md) | Struktura math+frontend, **kontrakt eventów**, data flow |
| [`ART_BIBLE.md`](ART_BIBLE.md) | Styl, paleta, asset list, animacje, audio, prompty |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Milestone'y, priorytety, ryzyka |
| [`QA_REPORT.md`](QA_REPORT.md) | Testy, wyniki, znane problemy |
| [`APPROVAL_CHECKLIST.md`](APPROVAL_CHECKLIST.md) | Zgodność ze Stake Engine + zasadami briefu |
| [`ASSET_PROMPTS.md`](ASSET_PROMPTS.md) | **Gotowe prompty do wygenerowania każdego assetu** + nazwy plików i rozmiary |

## Struktura repo

```
math/          Silnik matematyczny (Python) + testy + publish_files
  engine/      reusable (symbols, board, events, config, optimizer, publish, analysis)
  game/        game-specific (game_config, gamestate, run, forced_outcomes)
  tests/       test_forge / test_events_schema / test_rtp / test_maxwin
  publish_files/  index.json + lookUpTable_*.csv + books_*.jsonl.zst  (wygenerowane)
  forced/         katalog 16 reprodukowalnych scenariuszy (po `run`)
frontend/      Frontend (TypeScript, event-driven, PixiJS)
  src/         types/events, rgs/RgsClient, game/BookPlayer, game/Presenter, audio, main
  src/render/  PixiPresenter + BoardView/HeatMeter/WinBanner/Layout/tween/Particles
  src/ui/      BuyPanel (potwierdzenie zakupu), HelpScreen (paytable), Overlay, LoadingScreen
  src/i18n/    strings.ts (en/pl/de) — sterowane parametrem `lang` z RGS
  src/audio/   AudioManager + WebAudioBackend (syntezowane placeholdery)
  src/assets/  AssetLoader (preload atlasu + audio)
  src/dev/     MockRgs + devBooks.json (fixture z realnych książek, tylko DEV)
  src/render/Rig.ts   animacja kośćmi postaci (odpowiednik Spine, patrz ART_BIBLE §13)
  src/render/GlyphText.ts + UiPanel.ts  autorski krój pisma i pasek kontrolek w canvasie
  public/assets/  atlas.png, logo.png, scene_*.jpg, character.png, font.png, lobby.jpg, audio/*.ogg
  src/render/Background.ts  stos paralaksy (far/mid/near) — patrz ART_BIBLE §17
  src/render/ReelFrame.ts   kuta rama bębnów z kartuszem i nitami
  src/game/Autoplay.ts      limity autogry (czysta logika, testowana osobno)
assets/        Pipeline assetów: generate_art.py, rasterize.mjs, generate_audio.py
  tests/       smoke.mjs — test przeglądarkowy (Playwright)
  player/      self-contained replay harness (index.html) — otwórz w przeglądarce
```

---

## Szybki start

### 1. Wymagania
- Python ≥ 3.11 (repo testowane na 3.11; oficjalny SDK wymaga ≥ 3.12)
- Node ≥ 18 (frontend: dev server, build, testy przeglądarkowe)

### 2. Instalacja (math)
```bash
python3 -m pip install numpy zstandard
```

### 3. Uruchomienie symulacji + generowanie plików publikacyjnych
```bash
# szybki bieg (domyślne rozmiary):
python3 math/game/run.py

# skala produkcyjna (środowisko z większym czasem/RAM):
python3 math/game/run.py --pub 100000 --val 1000000

# pojedynczy tryb:
python3 math/game/run.py --modes base
```
Wynik: `math/publish_files/` (index.json, lookUpTable_*.csv, books_*.jsonl.zst,
`analysis.json`) + wydruk RTP / hit / vol / P(max) per tryb.

### 4. Katalog forced outcomes (QA / replay)
```bash
python3 math/game/forced_outcomes.py   # -> math/forced/*.json
```

### 5. Testy (math)
```bash
cd math
python3 tests/test_forge.py
python3 tests/test_events_schema.py
python3 tests/test_rtp.py
python3 tests/test_maxwin.py
# (jeśli zainstalowany pytest: `pytest tests/` również działa)
```

### 6. Frontend — uruchomienie gry (renderer PixiJS)
```bash
cd frontend
npm install            # pixi.js, typescript, vite, playwright
npm run devbooks       # (raz) fixture realnych książek dla MockRGS
npm run assets         # (opcjonalnie) regeneracja: symbole, tła, postać, lobby, audio
npm run dev            # http://localhost:5173  — grywalna gra w przeglądarce
npm run typecheck      # tsc --noEmit (czyste)
npm run build          # typecheck + vite build -> dist/
npm test               # 66 checków: limity autogry (18) + renderer (36) + autogra E2E (12)
```
Gra działa w pełni: SPIN, **autogra z limitami** (liczba rund, limit straty,
limit pojedynczej wygranej, stop na funkcji, stop w dowolnym momencie),
wybór trybu (Base / Stoked / Buy Forge Fury / Buy Molten Core)
z **panelem potwierdzenia zakupu** (koszt, RTP, max win), **ekran pomocy/paytable**,
loading screen z realnym preloadem, **grafika z atlasu tekstur** i **dźwięk OGG**
(WebAudio) z wyciszeniem, cząstki, poziom zakładu, SKIP, TURBO,
reduced motion, klawiatura (spacja = spin, `s` = skip). Język z parametru `?lang=`
(en/pl/de).
Tryb DEV używa `MockRgs`, który serwuje **realne książki** próbkowane wagami z
opublikowanej biblioteki — rozkład jest wierny. Produkcja: podmiana na `RgsClient`
(patrz `src/main.ts`).

### 7. Frontend — działający replay harness (bez build‑stepu)
```bash
python3 frontend/player/build_player.py   # wstrzykuje realne książki z katalogu forced
# następnie otwórz frontend/player/index.html w przeglądarce
```
Harness odtwarza realne wyniki silnika (reveal → forge → gravity → Heat → settle →
bonus → pour → maxWin) na placeholderowej oprawie, z Turbo/Skip/Reduced‑motion —
dowód, że **kontrakt eventów jest kompletny** i frontend potrafi odtworzyć każdy wynik.

### 8. Build produkcyjny (frontend)
```bash
cd frontend && npm run build   # tsc --noEmit + vite build -> dist/
```
Rozmiary bundli: gra **38.8 kB** (14.1 kB gzip), pixi 551 kB (161 kB gzip) w osobnym
chunku, fixture DEV ładowany leniwie (nie trafia do bundla gry).
Assety: obrazy **~549 kB** (atlas symboli 339 kB + 3 tła JPEG + postać + lobby tile)
oraz audio **338 kB** (14 plików OGG).

---

## Kluczowe wyniki (zmierzone) ✅

| Mode | Cost | RTP | Hit | Vol (std) | P(max win) |
|---|---|---|---|---|---|
| base | 1.00× | **96.50%** | 73% | 24.0 | 1 / 500,000 |
| ante (STOKED) | 1.25× | **96.50%** | 75% | 22.5 | 1 / 333,000 |
| bonus (Forge Fury) | 100× | **96.50%** | 100% | 250.6 | 1 / 33,000 |
| super (Molten Core) | 500× | **96.50%** | 100% | 485.1 | 1 / 2,000 |

Max win **15,000×**. Szczegóły: `PAR_REPORT.md`.

## Uwaga o statusie
Warstwa matematyczna, kontrakt eventów **oraz renderer PixiJS** są **uruchamialne i
przetestowane** w tym środowisku (36/36 checków przeglądarkowych: mobile, desktop,
locale pl, panel Buy, help screen).
Grafika (symbole, 3 tła, postać, lobby tile) i audio istnieją jako **realne pliki
assetów** (autorski wektor → atlas/JPEG; synteza numpy → OGG), a postać jest
animowana kośćmi — patrz `ART_BIBLE.md` §12–13. Ilustracja malowana przez artystę 2D
i pliki Spine (brak licencji w tym środowisku), skala symulacji 1M/mode oraz testy
E2E z realnym RGS to jasno oznaczone kolejne kroki
(`IMPLEMENTATION_PLAN.md`, `QA_REPORT.md`). Nic nie jest deklarowane jako
„zrobione”, jeśli nie zostało faktycznie uruchomione.

---

## Wgrywanie na Stake Engine (deployment)

```bash
cd frontend
npm run assets   # (raz) wygeneruj atlas, krój, tła, postać, audio
npm run build    # -> dist/
```
Wgraj **całą zawartość `dist/`** zachowując strukturę katalogów:
```
index.html
assets/index-*.js       assets/pixi-*.js
assets/atlas.png|json   assets/font.png|json   assets/character.png|json
assets/scene_*.jpg      assets/lobby.jpg       assets/audio/*.ogg
```

### Trzy rzeczy, które psuły wdrożenie (naprawione)

1. **Ścieżka bez ukośnika na końcu.** Stake Engine serwuje grę z
   `.../{gameID}/{version}/`, ale URL bywa żądany bez końcowego `/`. Przeglądarka
   rozwiązuje wtedy `./assets/index.js` względem katalogu **nadrzędnego** — sam
   bundle daje 404, więc JS nigdy się nie uruchamia i zostaje czarny ekran ze
   statycznym HTML‑em (bez żadnego błędu, bo nie ma czego zgłosić).
   `index.html` ustawia teraz `<base>` na katalog, jeśli ścieżka nie kończy się
   `/` ani `.html`. **Uwaga:** test „czy to plik” musi sprawdzać wyłącznie
   `.html` — ogólne „czy jest kropka” błędnie klasyfikuje folder wersji `1.0.0`
   jako plik.
2. **Brakujące assety przerywały start.** Pierwszy `fetch('assets/atlas.json')`
   nie był objęty `try/catch`. Teraz atlas jest opcjonalny — `SymbolSprite` ma
   fallback proceduralny, więc gra startuje i jest grywalna nawet przy 404 na
   całej grafice; problemy trafiają do `assets.warnings` i konsoli.
3. **Build używał zawsze `MockRgs`.** `rgs/session.ts` wybiera teraz **prawdziwy
   `RgsClient`, gdy w URL jest `rgs_url`**, a mocka tylko lokalnie. Wcześniej
   wgrana gra wyglądałaby poprawnie, ale nie stawiałaby realnych zakładów.

Dodatkowo każdy błąd startu pokazuje się **na ekranie** (`role="alert"`) zamiast
zostawiać czarny canvas.

### Zweryfikowane scenariusze serwowania
| Scenariusz | Wynik |
|---|---|
| `/team/game/1.0.0` (bez ukośnika) | ✅ startuje |
| `/team/game/1.0.0/` | ✅ startuje |
| `/team/game/1.0.0/index.html` | ✅ startuje |
| wszystkie assety graficzne 404 | ✅ startuje na fallbacku |
