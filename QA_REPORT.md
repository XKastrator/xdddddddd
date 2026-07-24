# QA_REPORT.md — MOLTEN CROWN

> Testy, wyniki, znane problemy. Status: ✅ wykonane i przechodzi · 🟡 częściowe /
> plan · ⬜ wymaga produkcyjnego frontendu/assetów. Reprodukcja: patrz `README.md`.

---

## 1. Testy wykonane w tym repo (uruchomione) ✅

| Test | Plik | Zakres | Wynik |
|---|---|---|---|
| Mechanika fuzji | `math/tests/test_forge.py` | rank‑jump, prób. fuzji, wild‑attach, grawitacja, determinizm | ✅ 8/8 |
| Schemat eventów | `math/tests/test_events_schema.py` | typy/pola, indeksy 0..n, finalWin==payoutMult, forced max‑win, determinizm | ✅ pass (400 książek × 4 tryby) |
| RTP / optymalizator | `math/tests/test_rtp.py` | optymalizator trafia RTP (int‑wagi), payout==eventy, pasma RTP | ✅ pass |
| Max win / stateless | `math/tests/test_maxwin.py` | brak przekroczenia capu, forced cap==15000×, brak progresji między zakładami | ✅ pass |
| Frontend typecheck | `frontend` `tsc --noEmit` | ścisłe typy TS | ✅ clean |
| Frontend build | `vite build` | bundle produkcyjny | ✅ gra 37.5 kB / 13.7 kB gzip (pixi + fixture w osobnych chunkach) |
| Player JS | `node --check` | składnia harnessu | ✅ ok |
| **Renderer w przeglądarce** | `frontend/tests/smoke.mjs` (Playwright/Chromium) | loading screen, canvas, help (RTP+max win+drabina), Escape, spin base/bonus/super, **panel Buy: potwierdzenie i brak zakładu przed Confirm**, anulowanie zakupu, bilans, brak błędów, locale `pl` — mobile 390×844 + desktop 1280×800 | ✅ **36/36** |

**Symulacja (walidacja math):** 4 tryby, publish files wygenerowane, RTP=0.9650
exact, buckety/feature/P(max) w `PAR_REPORT.md`. ✅

---

## 2. Pokrycie względem listy QA z briefu (Faza 7)

| Wymóg | Status | Uwaga |
|---|---|---|
| unit tests matematyki | ✅ | `test_forge`, `test_rtp` |
| property‑based tests | 🟡 | zasady niezmiennicze sprawdzone deterministycznie (cap, indeksy, payout==eventy); hipoteza‑style do dodania |
| event schema validation | ✅ | `test_events_schema` |
| deterministyczny replay | ✅ | ten sam seed → ta sama książka |
| poprawność payoutów | ✅ | `payoutMultiplier == finalWin×100` |
| wszystkie bet modes | ✅ | base/ante/bonus/super |
| bonus triggery | ✅ | 3/4/5 Cinderów → 10/12/14 spinów |
| retriggery | ✅ | +4 spiny (event `retrigger`, w katalogu forced) |
| superbonus | ✅ | Molten Core (pre‑seed + lock&pour) |
| max win | ✅ | klamp 15,000×, event `maxWin`, forced 200/200 |
| przerwanie połączenia / wznowienie rundy | 🟡 | kontrakt gotowy (`auto_close_disabled`, resume w `main.ts`); test E2E wymaga RGS mock |
| niewystarczające saldo | 🟡 | `ERR_IPB` mapowany w `RgsClient`; test E2E wymaga RGS mock |
| różne waluty | ✅ (logika) | waluto‑niezależna; formatowanie wg `CurrencyMeta` |
| różne wartości bet | ✅ (logika) | payout skalowany multiplikatorem; `betLevels`/`stepBet` |
| lokalizacja | ✅ | `i18n/strings.ts` (en/pl/de) sterowane parametrem `lang` z RGS, RTL‑ready; zweryfikowane w przeglądarce (pl) |
| overflow / precision | ✅ | payout int (×100), klamp capu; brak float w RGS |
| mobile layouts | ✅ | `Layout.ts` mobile‑first; zweryfikowane w przeglądarce 390×844 i 1280×800 |
| audio mute | ✅ | `AudioManager.setMuted` → `WebAudioBackend`, przełącznik Mute w UI |
| turbo / skip | ✅ | `BookPlayer.skip` + `PixiPresenter.skip`; gating `disabledTurbo` (MockRgs zwraca flagi) |
| reduced motion | ✅ | `tween` respektuje `prefers-reduced-motion` + przełącznik w UI |
| błędne odpowiedzi RGS | 🟡 | mapowanie kodów gotowe; test E2E wymaga RGS mock |

---

## 3. Katalog forced outcomes (do QA/replay) ✅

`math/forced/catalog.json` + pojedyncze pliki — **16 scenariuszy, reprodukowalne**:
dead_spin_0x, base_small/medium/strong, base_natural_bonus, base_bonus_retrigger,
bonus_weak/good/extreme/retrigger, super_typical/big, ante_bonus,
maxwin_base/bonus/super. Każdy = pełna książka z eventami + seed.

Zweryfikowane wartości (przykłady): dead=0×, base_strong=190×, bonus_extreme=576.84×,
super_big=2098×, maxwin_*=15000×.

---

## 4. Znane problemy / ograniczenia

1. 🟡 **Skala symulacji** — obecnie 100k+/mode (pub+val). Do publikacji zalecane
   1M+/mode (percentyle tail 1k–10k dla base/ante, trajektorie bankrolla).
2. ✅ **Renderer** — PixiJS + panel Buy, help/paytable, loading, WebAudio, cząstki,
   i18n; przetestowany w przeglądarce (36/36).
3. ⬜ **Assety/audio** — proceduralne placeholdery (grafika: Pixi Graphics, dźwięk:
   synteza WebAudio); finalne assety wg `ART_BIBLE.md` + Spine.
4. 🟡 **Testy E2E z RGS** — wymagają mocka RGS (resume, saldo, błędy) — do dodania.
5. 🟡 **Property‑based** — dodać testy typu Hypothesis (niezmienniki fuzji na losowych planszach).
6. `books_bonus.jsonl.zst` ~17.5 MB — akceptowalne, ale przy 1M/mode rozważyć podział.

## 5. Rekomendacja QA

Warstwa matematyczna jest **przetestowana i spójna** (RTP, eventy, cap, determinizm),
a renderer **zweryfikowany realnym uruchomieniem w przeglądarce** (36/36, mobile +
desktop + locale pl). Przed publikacją: domknąć skalę 1M/mode, dostarczyć finalne
assety graficzne/audio, dodać testy E2E z mockiem RGS (resume/saldo/błędy) oraz
testy property‑based. Żaden test wykonany w tym repo nie jest oznaczony jako
„przeszedł”, jeśli faktycznie nie został uruchomiony.
