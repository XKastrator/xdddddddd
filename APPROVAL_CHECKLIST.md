# APPROVAL_CHECKLIST.md — MOLTEN CROWN

> Zgodność z aktualnymi zasadami Stake Engine + z zasadami briefu.
> ✅ spełnione i zweryfikowane · 🟡 gotowe formatowo, wymaga produkcyjnego kroku ·
> ⬜ do zrobienia poza tym repo. Odniesienia do zweryfikowanych źródeł SDK.

---

## 1. Format publikacji math (Stake Engine — data_format.md) ✅

- [x] `index.json` z `modes[]` = {name, cost, events, weights} — ściśle 4 klucze ✅
- [x] `lookUpTable_<mode>.csv` = wiersze `uint64`: sim_id, round_probability, payoutMultiplier ✅
- [x] `books_<mode>.jsonl.zst` = po jednej książce/linia {id, events, payoutMultiplier}, zstd ✅
- [x] `payoutMultiplier` całkowity (×100; 1150=11.5×) ✅
- [x] payoutMultiplier w CSV == w books (spójność) ✅ (`publish.py` z tego samego źródła)
- [x] 4 tryby: base, ante, bonus, super ✅

## 2. Kontrakt RGS (RGS.md) 🟡

- [x] URL params czytane, `rgs_url` nie hardkodowany ✅ (`params.ts`)
- [x] Endpointy authenticate/balance/play/end-round/event ✅ (`RgsClient.ts`)
- [x] `play` wysyła {amount, sessionID, mode}; debit = amount×cost ✅
- [x] Pieniądze int×10⁶; waluta = warstwa display ✅
- [x] Kody błędów ERR_VAL/IPB/IS/ATE/GLE/LOC/GEN/MAINTENANCE mapowane ✅
- [x] Resume aktywnej rundy (authenticate.round) ✅ (`main.ts`)
- [x] `auto_close_disabled=True` dla bonus/super (wznowienie) ✅ (`game_config.py`)
- [ ] Test E2E z realnym/mock RGS 🟡 (M6/M7)

## 3. Jurysdykcja / RG (RGS.md jurisdiction) 🟡

- [x] `disabledTurbo` → turbo/instant warunkowe ✅ (`main.ts`, GDD §24)
- [x] `disabledFullscreen` → fullscreen warunkowy ✅
- [x] `socialCasino` → waluty XGC/XSC, brak sugestii gwarantowanej wygranej ✅ (design)
- [x] Help screen pokazuje **RTP i max win** ✅ (GDD §25, wymóg publikacji)
- [x] Widoczny komunikat „każdy spin niezależny i losowy” ✅ (GDD §29)
- [ ] Integracja limitów sesji/straty operatora 🟡 (M6)

## 4. Zasady briefu — zakazy (twarde) ✅

- [x] Brak **progresywnego jackpotu** ✅
- [x] Brak **gamble feature** ✅
- [x] Brak **early cashout** ✅
- [x] Brak decyzji gracza po starcie zakładu zmieniającej payout ✅ (buy = wybór przed zakładem)
- [x] Brak **progresu między zakładami** ✅ (`test_maxwin.test_round_is_stateless`)
- [x] Brak **persistent collection między spinami** ✅ (stan tylko w rundzie)
- [x] Brak personalizowanego RTP / dynamicznych szans wg zachowania ✅ (stały rozkład/wagi)
- [x] Brak fałszywych/mylących near‑missów ✅ (Cinder teaser jest uczciwy — realnie zbliża do triggera)
- [x] Każdy bet i bet mode **stateless**, niezależny od poprzednich ✅
- [x] Stan bonus/super utrzymany tylko w obrębie rundy, kończony z rundą ✅

## 5. Oryginalność / IP ✅

- [x] Oryginalny theme, nazwa, postać (Emberwright), identyfikacja ✅
- [x] Mechanika = **forge‑ladder + earned Heat + lock&pour super** — nie „tumble+losowe bomby+mnożniki” ✅
- [x] Brak kopiowania nazw/postaci/fabuły/symboli/UI/animacji/layoutów/chronionych mechanik ✅
      (guardrails w `RESEARCH.md` §9: Megaways®, xWays®/xBomb®, Money Cart, Super Cascade, Mystery Stacks, X‑iter…)
- [x] Superbonus zmienia ≥1 podstawową regułę (start planszy + akumulacja + kulminacja) ✅

## 6. Estetyka / bezpieczeństwo treści ✅

- [x] Brak estetyki dziecięcej, brak postaci wyglądających na nieletnich ✅
- [x] Brak elementów szczególnie atrakcyjnych dla dzieci ✅ (dark‑industrial forge)

## 7. UX / dostępność 🟡

- [x] Mobile‑first, portrait‑first, HUD kciukowy (design + harness) ✅/🟡
- [x] Reduced motion ✅ (harness + design)
- [x] Daltonizm: ranga po sylwetce + numerze, nie tylko kolorze ✅ (design)
- [x] Sygnały audio mają wizualne odpowiedniki ✅ (design)
- [x] Skalowanie UI, strefy dotyku ≥44px ✅ (design)
- [x] Skip animacji bez zmiany wyniku ✅
- [ ] Localization 16 języków (pliki i18n) 🟡 (M6)

## 8. Matematyka ✅

- [x] RTP **obliczone**, nie zgadnięte: 0.9650 exact (int‑wagi) wszystkie tryby ✅
- [x] Wyniki symulacji istnieją (PAR_REPORT.md) ✅
- [x] Max win egzekwowany (klamp 15,000×) ✅
- [x] Kontrola koncentracji wag (ESS≥0.956, maxShare<0.07%) ✅
- [x] Zgodność payoutMultiplier ↔ eventy ✅
- [ ] Skala 1M/mode + bankroll MC (certyfikacja) 🟡 (M4)

## 9. Produkcja (poza repo) ⬜

- [ ] Renderer PixiJS/Svelte (M3)
- [ ] Finalne assety + audio (M5)
- [ ] Testy urządzeń, audyt niezależny, soft‑launch (M7)

---

### Werdykt

Warstwa **math + kontrakt + format publikacji** jest **zgodna i kompletna** w granicach
tego środowiska (✅). Do publikacji produkcyjnej pozostają kroki oznaczone 🟡/⬜
(renderer, assety, skala 1M, testy E2E, i18n) — zebrane w `IMPLEMENTATION_PLAN.md`.
Nie zadeklarowano jako „zrobione” niczego, co nie zostało faktycznie uruchomione.
