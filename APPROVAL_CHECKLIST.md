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

- [x] `disabledTurbo` → turbo/instant warunkowe ✅ (`main.ts` + `app.ts` ukrywa przycisk)
- [x] `disabledFullscreen` → fullscreen warunkowy ✅
- [x] `socialCasino` → waluty XGC/XSC, brak sugestii gwarantowanej wygranej ✅ (design)
- [x] Help screen pokazuje **RTP i max win** ✅ zaimplementowany (`ui/HelpScreen.ts`) i zweryfikowany testem przeglądarkowym
- [x] Widoczny komunikat „każdy spin niezależny i losowy” ✅ w help screen i w panelu Buy
- [x] **Autogra z limitami** ✅ zaimplementowana i przetestowana (`game/Autoplay.ts`,
      `ui/AutoplayPanel.ts`): liczba rund ustawiana **przed** startem, limit straty
      (netto), limit pojedynczej wygranej, stop przy uruchomieniu funkcji,
      zatrzymanie w dowolnym momencie ze skutkiem po bieżącej rundzie.
      Zakład i tryb są zablokowane na czas sekwencji; zakup funkcji nie podlega
      autogrze. 18 deterministycznych checków logiki + 12 checków E2E.
- [ ] Integracja limitów sesji/straty **operatora** (poza grą, po stronie RGS) 🟡 (M6)

## 4. Zasady briefu — zakazy (twarde) ✅

- [x] Brak **progresywnego jackpotu** ✅
- [x] Brak **gamble feature** ✅
- [x] Brak **early cashout** ✅
- [x] Brak decyzji gracza po starcie zakładu zmieniającej payout ✅ (buy potwierdzany **przed** `/play`; test: „bet not taken before confirming”)
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

- [x] Mobile‑first, portrait‑first, HUD kciukowy ✅ zweryfikowane 390×844 i 1280×800
- [x] Reduced motion ✅ (`tween` + `prefers-reduced-motion` + przełącznik UI)
- [x] Daltonizm: ranga po numerze (I–V, ♛), ruda po glifie (▲■◆⬢●) — nie tylko kolor ✅
- [x] Sygnały audio mają wizualne odpowiedniki ✅ (bannery, Heat, licznik) + Mute
- [x] Skalowanie UI, strefy dotyku ≥44px ✅ (design)
- [x] Skip animacji bez zmiany wyniku ✅
- [x] Localization‑ready: `i18n/strings.ts` sterowane `lang` z RGS (en/pl/de gotowe, RTL‑ready) ✅; pozostałe języki = kolejne słowniki 🟡
- [x] Pasek kontrolek w canvasie: okrągły przycisk główny, ikony rysowane (bez
      zależności od kroju), stany hover/press/disabled, pola dotyku ≥44 px
      niezależnie od rozmiaru rysunku ✅
- [ ] Historia gry, menu ustawień, suwaki głośności, siatka zakładów, quick spin,
      podsumowanie rundy 🔴 — brakujące funkcje produktowe (nie blokują
      certyfikacji, ale odstają od poziomu topowych wydawców)

## 8. Matematyka ✅

- [x] RTP **obliczone**, nie zgadnięte: 0.9650 exact (int‑wagi) wszystkie tryby ✅
- [x] Wyniki symulacji istnieją (PAR_REPORT.md) ✅
- [x] Max win egzekwowany (klamp 15,000×) ✅
- [x] Kontrola koncentracji wag (ESS≥0.956, maxShare<0.07%) ✅
- [x] Zgodność payoutMultiplier ↔ eventy ✅
- [ ] Skala 1M/mode + bankroll MC (certyfikacja) 🟡 (M4)

## 9. Produkcja (poza repo) ⬜

- [x] Renderer PixiJS ✅ (M3 + M3+: Buy panel, help, loading, audio, cząstki, i18n)
- [x] Symbole jako rozpoznawalne przedmioty, logo jako osobny asset, kuta rama
      bębnów z kartuszem, tło jako stos paralaksy far/mid/near ✅ (ART_BIBLE §16–17)
- [ ] Malowana ilustracja 2D (postać, plany mid/near) — sloty gotowe, pliki do podmiany (M5)
- [ ] Audio z rytmem i melodią 🔴 — obecnie drony i akordy (M5)
- [ ] Testy urządzeń, audyt niezależny, soft‑launch (M7)

---

### Werdykt

Warstwa **math + kontrakt + format publikacji + renderer** jest **zgodna i kompletna**
w granicach tego środowiska (✅) — łącznie z wymogami widoczności RTP/max win
(help screen), potwierdzenia przed zakupem trybu, dostępności i localization‑ready UI;
wszystko zweryfikowane realnym uruchomieniem (**66/66** checków: 18 logiki limitów
autogry, 36 renderera na mobile/desktop/pl, 12 autogry E2E przez mocka RGS).

Brak autogry z limitami był **blokadą certyfikacyjną** i został zamknięty.
Otwarte pozostają: malowana ilustracja 2D, audio z rytmem i melodią, funkcje
produktowe z §7 oraz skala symulacji 1M/mode.
Do publikacji produkcyjnej pozostają kroki oznaczone 🟡/⬜ (finalne assety/audio,
skala 1M/mode, testy E2E z RGS, limity operatora) — zebrane w `IMPLEMENTATION_PLAN.md`.
Nie zadeklarowano jako „zrobione” niczego, co nie zostało faktycznie uruchomione.
