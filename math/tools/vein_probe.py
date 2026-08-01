import sys, random
sys.path.insert(0, 'math')
from engine import board as B, symbols as S
COLS, ROWS, MAX_CASCADE = 6, 5, 30
class Rng:
    def __init__(self, seed): self.r = random.Random(seed)
    def choices_weighted(self, syms, w, n): return self.r.choices(syms, weights=w, k=n)

ORE_N, ORE_W, WILD_W, SCAT_W = 4, 18.0, 10.0, 1.35
# Reshaped: the previous curve was so steep that the six-column case had to be
# scaled to a rounding error to keep RTP in range. The tail now comes from
# LENGTH x HEAT compounding inside a cascade, which is where a cascading slot's
# tail belongs, and the column count sets the shape rather than carrying it.
CP = {1: 1.0, 2: 2.2, 3: 5.0, 4: 12.0, 5: 32.0, 6: 95.0}
LB = 0.34

def run(n, seed, scale=1.0, cap=15000.0):
    rng = Rng(seed)
    ores = list(S.ORE_VARIANTS)[:ORE_N]
    syms = ores + [S.WILD, S.SCATTER]
    w = [ORE_W]*ORE_N + [WILD_W, SCAT_W]
    cp = {k: v*scale for k, v in CP.items()}
    tot = hits = capped = 0
    wins = []
    scat3 = 0
    cascade_hist = {}
    for _ in range(n):
        board = B.new_board(rng, COLS, ROWS, syms, w)
        if B.count_symbol(board, S.SCATTER) >= 3: scat3 += 1
        heat, pay, steps = 1, 0.0, 0
        while steps < MAX_CASCADE:
            st = B.resolve_veins(board, cp, LB)
            if not st.veins: break
            heat = min(heat + st.heat_gain, 25)
            pay += sum(v.value for v in st.veins) * heat
            B.apply_gravity_and_refill(board, rng, syms, w)
            steps += 1
        cascade_hist[steps] = cascade_hist.get(steps, 0) + 1
        if pay >= cap: pay = cap; capped += 1
        if pay > 0: hits += 1
        wins.append(pay); tot += pay
    wins.sort()
    return dict(rtp=tot/n, hit=hits/n, capped=capped/n, scat3=scat3/n,
                p99=wins[int(n*0.99)], p999=wins[int(n*0.999)], mx=wins[-1],
                casc=dict(sorted(cascade_hist.items())[:8]))

probe = run(40000, 3)
scale = 0.965 / probe['rtp']
print(f"unit RTP {probe['rtp']:.3f}  ->  scale x{scale:.4f}")
r = run(150000, 99, scale)
print()
print(f"RTP            {r['rtp']:.4f}")
print(f"hit rate       {r['hit']*100:.2f}%   (1 in {1/r['hit']:.1f})")
print(f"max-win rate   {r['capped']*100:.5f}%  (1 in {1/max(r['capped'],1e-12):,.0f})")
print(f"3+ cinders     {r['scat3']*100:.3f}%   (1 in {1/max(r['scat3'],1e-9):.0f})")
print(f"p99 {r['p99']:.2f}x   p99.9 {r['p999']:.2f}x   max {r['mx']:.0f}x")
print(f"cascade depth: {r['casc']}")
print()
print("COLUMN_PAY (x bet, before Heat):")
for k, v in CP.items(): print(f"  {k} kolumn: {v*scale:.4f}")
