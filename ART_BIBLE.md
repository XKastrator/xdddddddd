# ART_BIBLE.md — MOLTEN CROWN

> Kierunek artystyczny + pełna lista assetów + animacje + audio.
> Obecne assety w `frontend/player/` to **funkcjonalne placeholdery** (kształty/CSS),
> nie finalna oprawa. Poniżej prompty produkcyjne dla artysty/generatora.

---

## 1. Moodboard (opisowo)

Podziemna kuźnia w martwym wulkanie — „**Deepforge**”. Ciężkie, dorosłe
dark‑industrial fantasy: kute żelazo, pękające bazaltowe płyty, rzeki lawy w
szczelinach, iskry i żar. Klimat bliski „kowalskiej katedry” — monumentalny,
gorący, groźny, ale nie horror. Zero elementów dziecięcych/cukierkowych.

Referencje nastroju (nie do kopiowania): rozżarzony metal w hucie, obsydian,
brązowy patynowany metal, chłodny teal poświaty magii kontrastujący z pomarańczą lawy.

## 2. Paleta funkcjonalna

| Rola | Kolor | Hex |
|---|---|---|
| Tło głębi (bazalt) | czerń wulkaniczna | `#0a0806` / `#14100c` |
| Lawa / żar (akcent energii) | amber → pomarańcz | `#ff7a18` / `#ffb347` |
| Akcent magii / UI aktywne | teal | `#37e0c8` |
| Złoto (Gold/nagroda) | ciepłe złoto | `#f2c14e` |
| Tekst | kość słoniowa | `#f4ece0` |
| Tekst wygaszony | popiół | `#9a8c78` |

Zasada: **lawa (amber) = energia/Heat**, **teal = magia/interfejs**, złoto tylko dla
nagród (Gold/Crown/Big Win). Ta paleta celowo odróżnia grę od czerwono‑złotych i
cukierkowych miniatur w lobby (`RESEARCH.md` §7).

## 3. Silhouette language

Rangi muszą być rozpoznawalne **po sylwetce i numerze rangi**, nie tylko kolorze
(daltonizm). Propozycja sylwetek:
- **Ruda (0):** matowe, nieregularne bryły (5 wariantów o różnym kształcie/teksturze).
- **Bronze (1):** prosty sztabka/nit. **Iron (2):** kątownik/okucie.
- **Silver (3):** wypolerowana płytka. **Gold (4):** moneta/kły. **Mythril (5):** kryształ.
- **Molten Crown (6):** korona z płynnego metalu (focal point / trofeum).
- **Flux (wild):** wirująca teal‑plazma. **Cinder (scatter):** żarząca się iskra‑gwiazda.

## 4. Styl symboli / tła / UI

- **Symbole:** ruda ciemna/matowa (czytelnie „nie płaci”), relikwie świecące (emisja
  wewnętrzna), im wyższa ranga tym intensywniejsza poświata + metaliczny bevel.
- **Tło:** statyczna „ściana kuźni” z wolno pulsującą lawą w tle; nie może
  konkurować z planszą (niski kontrast, ciemne).
- **UI:** ciemne panele z cienką krawędzią `#2a2018`, akcenty amber/teal; duże strefy
  dotyku (≥44px), HUD u dołu (kciukowy), licznik **Heat** jako pasek amber→biały.

## 5. Wygląd bonusu vs superbonusu (wizualnie różne)

- **Forge Fury (bonus):** kuźnia „rozgrzana” — cieplejsze tło, pasek Heat trwały (nie
  resetuje), iskry gęstsze z każdym forge. Kolor dominujący: amber.
- **Molten Core (super):** zejście do **rdzenia lawy** — tło jaśniejsze/pomarańczowe,
  po bokach **Vault** (taca zbieranych relikwii) i wskaźnik rosnący; kulminacja
  **Pour** = przechylenie kadzi i wylew lawy. Kolor dominujący: biało‑pomarańczowy żar.
  Natychmiast odróżnialny od Forge Fury po 1 spinie (pre‑seed + Vault).

## 6. Animacje

| Typ | Opis |
|---|---|
| Idle | wolny „oddech” lawy w tle, subtelne drżenie żaru na relikwiach |
| Hit (forge) | grupa rozżarza się → zlewa w produkt w kotwicy, snop iskier, Heat +1 tick |
| Gravity | opad komórek z „klik” osadzenia, refill z góry |
| Anticipation | 2 Cindery pulsują, tło przygasa, dźwięk narasta |
| Transition | base→bonus: kamera „schodzi” w głąb kuźni |
| Big win presentation | patrz progi §22 GDD (Nice→Crown), count‑up + kamera |
| Max win | pełnoekranowa Korona z płynnego metalu, cap 15,000× |

## 7. Big win presentation (tiers)

Nice(≥5×) · Big(≥20×) · Mega(≥75×) · Epic(≥300×) · Molten(≥1,500×) · MAX(15,000×).
Każdy tier: dłuższy count‑up, mocniejszy stinger, kolejna warstwa muzyki, kamera.

## 8. Thumbnail / lobby tile (wymagania)

- **Focal point:** jedna **Roztopiona Korona** świecąca na ciemnym bazalcie.
- Czytelny w małym rozmiarze; **bez drobnego tekstu**; jeden puls żaru jeśli animowany.
- Paleta amber‑na‑czerni + teal akcent — odróżnia od czerwono‑złotych/cukierkowych.
- Komunikuje charakter (kuźnia/forge, nagroda=korona) bez wprowadzania w błąd co do wypłat.

## 9. Pełna lista assetów (do produkcji)

**Symbole (spritesheets/Spine):** 5 wariantów rudy, Bronze, Iron, Silver, Gold,
Mythril, Crown, Flux, Cinder — każdy: idle, hit/forge, destroy. (≈13 symboli × 3 stany).
**Tła:** base kuźnia, Forge Fury (rozgrzana), Molten Core (rdzeń), loading.
**UI:** ramka planszy, HUD (bet, balance, win, spins), pasek Heat, panel Buy (×2),
przyciski spin/turbo/skip/menu/info, ikony accessibility.
**Particles:** iskry forge, żar idle, snop przy big win, wylew Pour, cząstki Heat.
**Spine (opcjonalnie):** Emberwright (przewodnik), kadź Pour, korona max‑win.
**Audio (patrz §10).**

## 10. Audio — warstwy, ducking, priorytety

Warstwy (implementacja: `frontend/src/audio/AudioManager.ts`):
`base ambience` · `spin` · `win` · `forge (mechanic)` · `heat` · `bonus` · `super`
· `big win` · `max win`.

- **Intensywność muzyki tracka Heat** (0..cap → 0.5..1.0 głośności bedu) — eskalacja
  słyszalna bez chaosu.
- **Ducking:** stingery o priorytecie ≥4 (bonus/super/bigwin/maxwin) ściszają bed do
  0.25 na ~600 ms, by odczyt był czysty.
- **Priorytety SFX:** ambience(0) < spin(1) < win/forge(2) < heat(3) < bonus(4) <
  super(5) < bigwin(6) < maxwin(10); niższy nie przerywa wyższego (poza ≥4).
- **Accessibility:** każdy sygnał audio ma **wizualny odpowiednik** (Heat flash, baner
  tier, ikona retrigger) — wymóg dostępności.

Prompty produkcyjne audio (skrót): ciężki kowalski bed z niskim dronem lawy;
forge = metaliczny „clank” + syk rozżarzenia; heat tick = wznoszący ping; Pour =
narastający grzmot + lejąca się lawa; max win = chóralny hit + dzwon korony.

## 11. Prompty produkcyjne grafiki (przykłady dla artysty/generatora)

- *Lobby tile:* „Molten crown of flowing liquid metal, glowing amber, on cracked black
  basalt, single focal point, dark dramatic lighting, teal rim light, no text, game
  icon composition, high contrast, adult dark‑fantasy forge theme.”
- *Relic symbol (Gold):* „Ornate cast‑gold relic token, emissive warm glow, metallic
  bevel, isolated on transparent, game slot symbol, readable silhouette.”
- *Background (Molten Core):* „Underground volcanic forge core, rivers of lava, glowing
  orange ambient, distant anvils, cinematic, low‑contrast so foreground UI reads.”

Placeholdery (obecne w `player/index.html`) zastąpić finalnymi assetami wg powyższego.
