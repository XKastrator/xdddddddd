# IMPLEMENTATION_PLAN.md — MOLTEN CROWN

> Milestone'y, priorytety, zależności, ryzyka. Status: ✅ done · 🟡 partial · ⬜ todo.

---

## 0. Stan obecny (co jest zrobione w tym repo)

| Obszar | Status |
|---|---|
| Research rynku (36 gier) | ✅ `RESEARCH.md` |
| Koncepty + wybór | ✅ `CONCEPTS.md` |
| GDD | ✅ `GDD.md` |
| Silnik math (format Stake Engine) | ✅ `math/` — uruchamiany, RTP=0.9650 |
| Symulacje 4 trybów + publish files | ✅ `math/publish_files/` |
| MATH_SPEC + PAR | ✅ z realnych danych |
| Event contract | ✅ `TECH_ARCHITECTURE.md` + `frontend/src/types/events.ts` |
| Frontend architektura (TS) | ✅ `frontend/src/` (tsc clean) |
| Runnable replay harness | ✅ `frontend/player/index.html` |
| Testy (math) | ✅ `math/tests/` |
| Art bible + prompty | ✅ `ART_BIBLE.md` |
| **Produkcyjny renderer PixiJS** | ✅ `frontend/src/render/` — działa w przeglądarce, 12/12 checków |
| Finalne assety/audio | ⬜ (proceduralne placeholdery + prompty w ART_BIBLE) |
| Symulacja 1M/mode | 🟡 (100k+ zrobione; skala do zwiększenia) |

---

## 1. Milestone'y

### M1 — Math foundation ✅ (DONE)
Silnik, mechanika forge/Heat/lock&pour, 4 tryby, optymalizator RTP+P(max),
publish files, testy, PAR. **Zależności:** brak. **Wynik:** RTP 0.9650 exact.

### M2 — Frontend vertical slice ✅ (DONE)
Kontrakt eventów, RgsClient, BookPlayer, Presenter, DOM harness odtwarzający
realne książki. **Zależności:** M1 (książki/eventy).

### M3 — Produkcyjny renderer (PixiJS) ✅ (DONE)
Zaimplementowane: `PixiPresenter` (wszystkie 16 eventów), `BoardView` (puls fuzji,
pop produktu, opadanie grawitacyjne), `HeatMeter`, `WinBanner` (tiery + count‑up),
`Layout` (mobile‑first, portrait/landscape/desktop), `tween` (skip + reduced motion),
`Particles` (pooled iskry: forge / pour / max win), shell DOM z dostępnymi
kontrolkami, `MockRgs` (realne książki), Vite build.
**M3+ (również DONE):** `BuyPanel` (potwierdzenie przed zakładem: koszt ×+waluta,
RTP, max win, nota o losowości), `HelpScreen` (zasady, drabina rang, symbole
specjalne, bonus/super, tryby, **RTP + max win**, RG), `Overlay` (dostępny modal:
role=dialog, Escape, focus restore), `LoadingScreen` (realny progres),
`WebAudioBackend` (syntezowane placeholdery SFX + ducking, autoplay‑safe),
**i18n en/pl/de** + `currency.ts` wg `CurrencyMeta` RGS.
**Test przeglądarkowy: 36/36 ✅** (mobile + desktop + locale pl).
**Pozostaje:** finalne assety graficzne/audio (M5), Spine.

### M4 — Skala matematyki + certyfikacja ⬜/🟡
1M+/mode, pełne bankroll MC, PAR sheet do audytu, replay‑verification vs frontend.
**Zależności:** M1. **Priorytet:** wysoki przed publikacją. **Szac.:** 1 tydz.

### M5 — Art & audio produkcyjne ⬜
Symbole (13×3 stany), tła (4), UI, particles, Spine, audio (9 warstw), lobby tile.
**Zależności:** ART_BIBLE. **Priorytet:** wysoki (równolegle z M3). **Szac.:** 4–6 tyg.

### M6 — Integracja RGS + zgodność ⬜
Podpięcie do realnego RGS, resume rundy, jurisdiction flags, lokalizacja (16 języków),
help screen z RTP/max‑win, RG. **Zależności:** M3, M4. **Szac.:** 2 tyg.

### M7 — QA + certyfikacja + launch ⬜
Pełny plan testów (`QA_REPORT.md`), testy urządzeń, audyt math, checklista publikacyjna
(`APPROVAL_CHECKLIST.md`), soft‑launch. **Zależności:** wszystkie. **Szac.:** 2–3 tyg.

---

## 2. Ścieżka krytyczna / zależności

```
M1 ✅ ──▶ M2 ✅ ──▶ M3 ──▶ M6 ──▶ M7
   └──▶ M4 ──────────────▶ M7
M5 (równolegle) ─────▶ M3, M6
```

## 3. Priorytety (kolejność)

1. M3 (renderer) + M5 (art) — to widoczny produkt.
2. M4 (skala/certyfikacja math) — konieczne do publikacji.
3. M6 (RGS/compliance/i18n).
4. M7 (QA/launch).

## 4. Rejestr ryzyk

| Ryzyko | P | Wpływ | Mitigacja |
|---|---|---|---|
| Fuzja‑drabina trudna do dostrojenia (steep tail) | śr | wys | ✅ rozwiązane: rank‑jump + Heat + optymalizator wag |
| Niezrozumienie „ruda nie płaci” | śr | śr | onboarding, kolor/glow, help screen; base hit 73% daje feedback |
| Duże pliki books (bonus 17MB) | nis | nis | akceptowalne; można dzielić/streamować |
| Wydajność mobilna przy particles | śr | śr | atlasy, pooling, degradacja (reduced motion) |
| Rozjazd math↔frontend eventów | nis | wys | ✅ jeden kontrakt + testy zgodności payout↔eventy |
| P(max) zbyt hojne (marketing/compliance) | nis | śr | ✅ przypięte realistycznie (base 1/500k … super 1/2000) |
| Estetyka „dorosła” a granica dziecięca | nis | wys | ✅ brak postaci nieletnich, dark‑forge, RG |
| Skala 1M/mode czasochłonna | śr | nis | 🟡 plan `--pub/--val` na mocniejszym środowisku |

## 5. Definicja „gotowe do publikacji” (skrót)

Math 1M/mode zcertyfikowane · renderer produkcyjny · assety finalne · i18n 16 języków
· help z RTP/max‑win · resume rundy · jurisdiction flags · QA urządzeń · checklista
`APPROVAL_CHECKLIST.md` w 100% ✅.
