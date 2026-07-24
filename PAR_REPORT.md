# PAR_REPORT.md — MOLTEN CROWN (Probability & Accounting Report)

> Źródło danych: `math/publish_files/analysis.json`, wygenerowane przez
> `math/game/run.py` (weighted = rozkład publikowany; natural = niezależna
> walidacja Monte‑Carlo). Reprodukcja: `python math/game/run.py`.
> Wszystkie wartości „weighted” są **zmierzone** ✅.

**Game:** Molten Crown · **Game ID:** `molten_crown` · **Wincap:** 15,000× ·
**Docelowe RTP:** 96.50% (wszystkie tryby) · **Osiągnięte RTP:** 96.50% (± <0.02pp).

---

## 1. Podsumowanie RTP i kluczowych metryk (weighted, publikowane) ✅

| Mode | Cost | RTP | Hit rate | Dead‑spin | Median win | Std (vol) | P(max win) | 1 in |
|---|---|---|---|---|---|---|---|---|
| base | 1.00× | 96.500% | 73.08% | 26.92% | 0.06× | 24.0 | 2.00e‑6 | 500,000 |
| ante (STOKED) | 1.25× | 96.500% | 75.16% | 24.84% | 0.09× | 22.5 | 3.00e‑6 | 333,333 |
| bonus (Forge Fury) | 100× | 96.500% | 100% | 0% | 54.03× | 250.6 | 3.00e‑5 | 33,333 |
| super (Molten Core) | 500× | 96.500% | 100% | 0% | 412.80× | 485.1 | 5.00e‑4 | 2,000 |

**Naturalne RTP (walidacja, bez re‑ważenia):** base 0.8014 (N=250k), ante 1.0537
(N=120k), bonus 0.8465 (N=40k), super 1.1588 (N=30k). Odchylenie od docelowego
jest korygowane przez optymalizator wag przy **ESS/N ≥ 0.956** (minimalna deformacja).

---

## 2. Rozkład wypłat (payout buckets) — udział prawdopodobieństwa ✅

| Bucket (× zakład) | base | ante | bonus | super |
|---|---:|---:|---:|---:|
| **0x** | 26.9202% | 24.8436% | 0% | 0% |
| 0–1x | 64.9375% | 62.2374% | 0% | 0.0826% |
| 1–5x | 6.4804% | 10.5873% | 0.2423% | 0.3797% |
| 5–10x | 0.9487% | 1.0580% | 1.5530% | 0.3788% |
| 10–50x | 0.3253% | 0.7945% | 44.4886% | 4.8293% |
| 50–100x | 0.2062% | 0.3137% | 30.8169% | 5.3654% |
| 100–500x | 0.1641% | 0.1613% | 20.9551% | 51.1146% |
| 500–1,000x | 0.01729% | 0.00377% | 1.3479% | 29.7083% |
| 1,000–10,000x | <1e‑4 | <1e‑4 | 0.5932% | 8.0912% |
| >10,000x | 2.0e‑6 | 3.0e‑6 | 3.0e‑5 | 5.0e‑4 |
| **= 15,000× (MAX)** | 2.0e‑6 | 3.0e‑6 | 3.0e‑5 | 5.0e‑4 |

Interpretacja:
- **base**: „żywy” base — 73% spinów płaci (głównie 0–1× drobne Bronze), z uczciwym
  tailem do capu przez feature; medium‑win 100–500× istnieje (0.16%).
- **bonus**: masa w 10–100× (75%), realny tail 100–1000× (22%), ekstrem do 15,000×.
- **super**: masa w 100–1000× (81%), 8% w 1k–10k, kulminacja do capu 1/2000.

---

## 3. Feature contribution (udział w RTP) ✅

| Mode | base‑spin | free/super feature | wincap (forced tail) |
|---|---:|---:|---:|
| base | 0.3645 (37.77%) | 0.5705 (59.12%) | 0.0300 (3.11%) |
| ante | 0.4201 (43.53%) | 0.5089 (52.74%) | 0.0360 (3.73%) |
| bonus | — | 0.9607 (99.55%) | 0.0043 (0.45%) |
| super | — | 0.9500 (98.44%) | 0.0150 (1.56%) |

Base game samodzielnie zwraca ~37.8% RTP — spełnia wymóg „base atrakcyjny bez
kupowania bonusu”, a jednocześnie feature to główny nośnik dużych wygranych.

---

## 4. Prawdopodobieństwo max win (headline) ✅

| Mode | P(max) | 1 in | Kontekst |
|---|---|---|---|
| base | 2.0e‑6 | 500,000 spinów | realistyczne dla 15,000× high‑vol |
| ante | 3.0e‑6 | 333,333 | ~1.5× base (ante) |
| bonus | 3.0e‑5 | 33,333 buyów | 150× wartości buy |
| super | 5.0e‑4 | 2,000 buyów | 30× wartości buy |

Wartości są **jawnie ustawione i przypięte** przez optymalizator (parametr
`P_MAXWIN` w `run.py`), a nie przypadkowym artefaktem tilt‑u.

---

## 5. Optymalizator — zdrowie rozkładu ✅

| Mode | λ (tilt) | ESS / N | max udział 1 książki | RTP int‑wagi |
|---|---|---|---|---|
| base | 0.584 | 0.9989 | 0.0060% | 0.9650000 |
| ante | −0.282 | 0.9990 | 0.0050% | 0.9650000 |
| bonus | 2.135 | 0.9868 | 0.0682% | 0.9650000 |
| super | −4.791 | 0.9556 | 0.0165% | 0.9649999 |

ESS/N bliskie 1 = rozkład publikowany praktycznie nieodróżnialny od naturalnego
kształtu gry (poza celowym przypięciem RTP i P(max)). Żadna pojedyncza runda nie
jest wybierana nieproporcjonalnie często (max < 0.07%).

---

## 6. Rozmiary plików publikacyjnych (zst) ✅

| Mode | books (skompresowane) | lookup CSV | książek w puli |
|---|---|---|---|
| base | 2.64 MB | 0.49 MB | 30,030 |
| ante | 1.92 MB | 0.32 MB | 20,020 |
| bonus | 17.46 MB | 0.22 MB | 12,048 |
| super | 7.72 MB | 0.15 MB | 8,048 |

---

## 7. Statusy i rekomendacje

- ✅ **Wykonane:** pełna symulacja 4 trybów, RTP=0.9650 exact, buckety, feature
  contribution, P(max), ESS, PAR. Testy zgodności payout↔eventy i max‑win.
- 🟡 **Rekomendacja przed publikacją produkcyjną:** uruchomić `--pub 100000
  --val 1000000` na każdym trybie (środowisko z większym czasem/RAM) dla domknięcia
  percentyli tail 1k–10k i trajektorii bankrolla; dodać skrypt Monte‑Carlo bankroll.
- 🧠 **Ocena:** rozkłady są wiarygodne, o zdrowej strukturze medium/tail; profil C
  (very‑high vol z żywym base) zgodny z celami produktu i briefu.
