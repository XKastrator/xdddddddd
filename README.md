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

## Struktura repo

```
math/          Silnik matematyczny (Python) + testy + publish_files
  engine/      reusable (symbols, board, events, config, optimizer, publish, analysis)
  game/        game-specific (game_config, gamestate, run, forced_outcomes)
  tests/       test_forge / test_events_schema / test_rtp / test_maxwin
  publish_files/  index.json + lookUpTable_*.csv + books_*.jsonl.zst  (wygenerowane)
  forced/         katalog 16 reprodukowalnych scenariuszy (po `run`)
frontend/      Frontend (TypeScript, event-driven)
  src/         types/events, rgs/RgsClient, game/BookPlayer, game/Presenter, audio, main
  player/      self-contained replay harness (index.html) — otwórz w przeglądarce
```

---

## Szybki start

### 1. Wymagania
- Python ≥ 3.11 (repo testowane na 3.11; oficjalny SDK wymaga ≥ 3.12)
- Node ≥ 18 (do type‑checku frontendu; opcjonalne)

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

### 6. Frontend — type‑check
```bash
cd frontend
npm install          # typescript (devDependency)
npm run typecheck    # tsc --noEmit  (powinno być czyste)
```

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
cd frontend && npm run build   # tsc -> dist/ (renderer PixiJS/Svelte = milestone M3)
```

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
Warstwa matematyczna i kontrakt są **uruchamialne i przetestowane** w tym środowisku.
Produkcyjny renderer PixiJS/Svelte, finalne assety/audio, skala symulacji 1M/mode
oraz testy E2E z RGS to jasno oznaczone kolejne kroki (`IMPLEMENTATION_PLAN.md`,
`QA_REPORT.md`). Nic nie jest deklarowane jako „zrobione”, jeśli nie zostało
faktycznie uruchomione.
