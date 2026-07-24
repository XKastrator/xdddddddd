# MATH_SPEC.md — MOLTEN CROWN

> Model matematyczny + wszystkie parametry + profile volatility + bet modes +
> rozkład wypłat. **Wszystkie liczby „weighted” pochodzą z realnej symulacji**
> (`math/game/run.py`, wynik w `math/publish_files/analysis.json`), nie są zgadywane.
> Legenda: ✅ zmierzone/wykonane · 🟡 oszacowane / do potwierdzenia w 1M+ · 🧠 wniosek.

---

## 0. Jak liczone jest RTP (nie „deklarowane”)

```
RTP = Σ(waga_i × payoutMultiplier_i) / (Σ waga_i × cost × 100)
```
- `payoutMultiplier_i` = całkowity wynik rundy i (×100, format RGS).
- `waga_i` = całkowita waga rundy z lookup‑table (kolumna `round_probability`).
- Wagi wyznacza **optymalizator** (`engine/optimizer.py`): tilt maks‑entropii,
  który (a) trafia dokładnie w docelowe RTP i (b) przypina realistyczne
  prawdopodobieństwo max‑winu. Dodatkowo raportujemy **naturalne RTP** (czysta
  symulacja Monte‑Carlo bez re‑ważenia) jako niezależny, uczciwy kontroler.

**Tolerancja końcowa RTP:** cel 0.9650, osiągnięte **0.9650 ± < 0.0002** (int‑wagi) ✅.

---

## 1. Trzy rozważane profile matematyczne (i wybór)

| Profil | RTP | Base hit | Bonus freq | Bonus śr. | Charakter | Werdykt |
|---|---|---|---|---|---|---|
| **A. High‑vol mainstream** | 96.5% | ~0.60 | ~1/150 | ~70× | Stabilniejszy base, mniejszy tail | odrzucony (za mało streamer‑tail) |
| **B. Extreme / streamer** | 96.5% | ~0.45 | ~1/260 | ~120× | Rzadki bonus, ekstremalny tail | odrzucony (za dużo dead‑time) |
| **C. High‑vol z żywym base** ✅ | 96.5% | **0.73** | **~1/200** | **~96.5×** | Częste małe fuzje (rytm) + mocny tail | **WYBRANY** |

**Uzasadnienie wyboru C (🧠):** research (`RESEARCH.md` §3–4) pokazał, że turnover
generują gry z **częstymi małymi zdarzeniami** i uczciwymi teaserami, nie tylko z
ekstremalnym tailem. Profil C daje rytm (73% spinów coś fuzuje — głównie Bronze,
drobne), przy zachowaniu ekstremalnego tail (max 15,000×, super do 1/2000).
Base pozostaje grywalny bez kupowania bonusu (feature contribution: base‑spin
~37.8% RTP, feature ~59% — patrz §5).

---

## 2. Parametry rdzenia (z `game_config.py`)

| Parametr | Wartość |
|---|---|
| Siatka | 6×5 (30 komórek), model drop‑weight per komórka |
| Ranga płacąca min. | Bronze (ranga 1) |
| Próg fuzji | 4 połączone identyczne (ortogonalnie) |
| Skok rang | `1 + (rozmiar−4)//3`, sufit ranga 6 |
| Paytable (×, przed Heat) | Bronze 0.03 · Iron 0.45 · Silver 3.0 · Gold 18 · Mythril 95 · Crown 700 |
| Heat | `1 + Σ fuzji`; sufit base 25 / bonus 100 / super 10 |
| Free spins | 3/4/5 Cindera → 10/12/14 spinów; retrigger +4 |
| Super | 8 spinów, pre‑seed, lock&pour |
| Wincap | 15,000× |

Wagi wypełnienia (base): 5 wariantów rudy ×18, Flux 3, Cinder 1.10.
Bonus: 4 warianty ×22, Flux 7, Cinder 1.10. Ante: rudy ×17, Flux 4, Cinder 1.30.
Super pre‑seed: O1‑O3 ×12, Bronze 24, Iron 18, Silver 14, Flux 6.

---

## 3. Bet modes — parametry i zmierzone wyniki ✅

| Mode | cost | target RTP | **RTP (int‑wagi)** | hit | median | std (vol_index) | **P(max win)** | natural RTP (val N) |
|---|---|---|---|---|---|---|---|---|
| **base** | 1.00 | 0.965 | **0.96500** ✅ | 0.731 | 0.06× | 24.0 | **2.0e‑6 (1/500k)** | 0.8014 (250k) |
| **ante** | 1.25 | 0.965 | **0.96500** ✅ | 0.752 | 0.09× | 22.5 | **3.0e‑6 (1/333k)** | 1.0537 (120k) |
| **bonus** (Forge Fury) | 100 | 0.965 | **0.96500** ✅ | 1.000 | 54.0× | 2.51 | **3.0e‑5 (1/33k)** | 0.8465 (40k) |
| **super** (Molten Core) | 500 | 0.965 | **0.96500** ✅ | 1.000 | 412.8× | 0.97 | **5.0e‑4 (1/2000)** | 1.1588 (30k) |

- `vol_index` = odchylenie standardowe payoutu w jednostkach zakładu / cost — nasza
  jawna miara volatility. Base vol 24.0 = **very high volatility**.
- Optymalizator: ESS/N = base 0.999, ante 0.999, bonus 0.987, super 0.956 →
  **minimalna deformacja** względem naturalnego rozkładu; max udział pojedynczej
  książki < 0.07% (żaden wynik nie jest wybierany nieproporcjonalnie — spełnia
  wymóg „kontrola koncentracji wag”). ✅

### Sposób generowania wyników / kryteria symulacyjne
- Każda książka = pełna rozegrana runda z deterministycznym seedem (reprodukcja).
- Kryteria dystrybucji per mode: `basegame` / `freegame` / `supergame` / `wincap`
  (forced max‑win, konstruowany „hot”, przypięty do P(max)).
- % RTP przypisany częściom mechaniki → §5.

---

## 4. Rozkład wypłat (payout buckets) — weighted, zmierzone ✅

| Bucket (×) | base | ante | bonus | super |
|---|---|---|---|---|
| 0x (dead) | 26.92% | 24.84% | 0% | 0% |
| 0–1x | 64.94% | 62.24% | 0% | 0.08% |
| 1–5x | 6.48% | 10.59% | 0.24% | 0.38% |
| 5–10x | 0.95% | 1.06% | 1.55% | 0.38% |
| 10–50x | 0.33% | 0.79% | 44.49% | 4.83% |
| 50–100x | 0.206% | 0.314% | 30.82% | 5.37% |
| 100–500x | 0.164% | 0.161% | 20.96% | 51.11% |
| 500–1,000x | 0.017% | 0.0038% | 1.35% | 29.71% |
| 1,000–10,000x | ~0%* | ~0%* | 0.59% | 8.09% |
| >10,000x (do max) | 2.0e‑6 | 3.0e‑6 | 3.0e‑5 | 5.0e‑4 |
| **max win 15,000×** | 2.0e‑6 | 3.0e‑6 | 3.0e‑5 | 5.0e‑4 |

\*base/ante 1k–10k: udział niezerowy, ale < 1e‑4 (mieści się w 100–500/500–1k tailu i forced‑cap). Naturalny max base (250k próbek) = **2,403×**; publikowany tail sięga capu przez forced‑wincap.

🧠 **Wniosek:** rozkład tworzy **wiarygodne medium wins** (base 100–500× ~0.16%,
bonus 100–500× ~21%), **duże wygrane** (super 500–1k× ~30%) i **ekstremalny tail**
(max 15,000×). Nie jest to „pusty” rozkład z wysokim max‑winem tylko w marketingu.

---

## 5. Podział RTP: base‑game vs feature (feature contribution) ✅

| Mode | base‑spin | feature (free/super) | wincap tail |
|---|---|---|---|
| base | **37.8%** (0.365 RTP) | 59.1% (0.571 RTP) | 3.1% (0.030 RTP) |
| ante | 43.5% | 52.7% | 3.7% |
| bonus | — | 99.55% | 0.45% |
| super | — | 98.4% | 1.6% |

Base gra „sama” daje ~0.365 RTP (37.8%) — gracz nie musi kupować bonusu, by grać
z sensem; jednocześnie feature to główny nośnik dużych wygranych (zgodnie z
najlepszymi grami rynku).

---

## 6. Wariancja / odchylenie / indeks volatility ✅

| Mode | wariancja (×²) | std (×) | vol_index | klasa |
|---|---|---|---|---|
| base | 575.5 | 24.0 | 24.0 | Very High |
| ante | 790.7 | 28.1 | 22.5 | Very High |
| bonus | 62,821 | 250.6 | 2.51 | High (na jednostkę bonusu) |
| super | 235,284 | 485.1 | 0.97 | Medium‑High (na jednostkę buy) |

## 7. Zachowanie bankrolla — sesje 100 / 300 / 1000 spinów (🟡 estymacja z rozkładu)

Bazując na zmierzonym rozkładzie base (RTP 0.965, hit 0.731, vol 24.0), zakład 1u:

| Sesja | Oczek. zwrot | Typowy zakres (P25–P75) 🟡 | Szansa ≥1 „Big” (≥20×) 🟡 | Szansa trafić bonus 🟡 |
|---|---|---|---|---|
| 100 spinów | ~96.5u z 100u | 55–110u | ~7% | ~40% (≥1) |
| 300 spinów | ~290u z 300u | 190–330u | ~19% | ~78% |
| 1000 spinów | ~965u z 1000u | 720–1120u | ~50% | ~99% |

🧠 Charakter: częste małe zwroty (0–1×) utrzymują sesję, rzadkie bonusy i tail
dają skoki. Dokładne trajektorie: `PAR_REPORT.md` + rekomendacja pełnej symulacji
1M/mode i Monte‑Carlo bankroll (plan w §9).

## 8. Kontrole jakości symulacji (wykonane / plan)

| Test | Status |
|---|---|
| Reprodukowalne seedy | ✅ (deterministyczny replay, `test_events_schema`) |
| ≥100k rezultatów/mode (1. iteracja) | ✅ (base 280k+, ante 140k+, bonus 52k+, super 38k+ łącznie pub+val) |
| 1M+/mode docelowo | 🟡 plan: `python game/run.py --pub 100000 --val 1000000` |
| Optymalizacja wag do RTP | ✅ (0.9650 exact) |
| Raport hit‑rate / buckets | ✅ (§3–4) |
| Test koncentracji wag (ESS, max share) | ✅ (ESS≥0.956, maxShare<0.07%) |
| Test zgodności payoutMultiplier ↔ eventy | ✅ (`test_rtp.test_pay_equals_events_payout`, `test_events_schema`) |
| Test max‑win termination | ✅ (`test_maxwin`) |
| PAR sheet | ✅ `PAR_REPORT.md` |
| Bankroll trajectories (pełne MC) | 🟡 plan (skrypt do dodania) |

## 9. Założenia matematyczne i wartości do dalszego tuningu

- **Założenie:** model wypełnienia = niezależne drop‑weight per komórka (nie taśmy).
  Uproszczenie właściwe dla gry fuzyjnej; taśmy można wprowadzić bez zmiany kontraktu.
- **Do potwierdzenia 1M+/mode (🟡):** dokładne prawdopodobieństwa w bucketach
  1k–10k dla base/ante (obecnie < 1e‑4, próbka je „rozmywa”); mediana/percentyle
  bankrolla; stabilność P(max) super przy większej próbie.
- **Świadomie ustawione (nie zgadnięte):** P(max) per mode (base 2e‑6 … super 5e‑4)
  — wartości wybrane jako realistyczne i przypięte przez optymalizator; można je
  dostroić jednym parametrem `P_MAXWIN` w `run.py`.
- **Tolerancja RTP:** < 0.0002 (int‑wagi) — węższa niż typowe ±0.5pp.
