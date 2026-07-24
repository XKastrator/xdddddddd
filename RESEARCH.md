# RESEARCH.md — Rynek slotów iGaming premium (Stake Engine + top providerzy)

> **Cel dokumentu:** benchmark 30+ gier, wnioski projektowe i lista zasad sukcesu,
> na których oparto koncept **MOLTEN CROWN** (patrz `CONCEPTS.md`, `GDD.md`).
>
> **Legenda wiarygodności** — każda dana jest oznaczona:
> - ✅ **[FAKT]** — zweryfikowane w źródle (oficjalny SDK / help file / recenzja / oficjalny post).
> - 🟡 **[EST]** — estymacja z wielu wtórnych źródeł lub uśrednienie; może się różnić między jurysdykcjami/wersjami RTP.
> - 🧠 **[WNIOSEK]** — własna analiza projektowa zespołu.
>
> **Data researchu:** 2026-07-24. **Uwaga:** RTP wielu gier ma warianty (94/96%); podaję najczęściej publikowany.

---

## 0. Źródła (zweryfikowane w tej sesji)

**Oficjalne Stake Engine / SDK (odczytane z `raw.githubusercontent.com/StakeEngine/math-sdk/main`):**
- `docs/rgs_docs/RGS.md` — kontrakt RGS (endpointy, waluty, jurisdiction flags). ✅
- `docs/rgs_docs/data_format.md` — format plików publikacyjnych (`index.json`, lookup CSV, books jsonl.zst). ✅
- `docs/math_docs/directory.md` — struktura katalogów SDK i gier przykładowych. ✅
- `docs/math_docs/gamestate_section/events_info.md` — model eventów. ✅
- `docs/math_docs/gamestate_section/configuration_section/betmode_overview.md` — BetMode/Distribution. ✅
- `games/0_0_lines/{run.py,game_config.py}` — realny kod gry przykładowej. ✅

**Rynek / rankingi (WebSearch, 2026-07):**
- iGamingToday — „Stake Engine update: New games smash one million bets barrier”; „Stake unveils new Stake Engine”.
- Roshtein.com — „Everything You Need to Know About the Stake Engine”.
- stakecruncher.com/slots-tracker — live tracker turnover (1200+ gier, odświeżany co 15 min) *(strona zablokowana przez egress; dane z opisu w wynikach wyszukiwania)*.
- Stake.us / Stake.com strony gier (Twist Gaming: Realm of Rats/2, Lab of Lunacy, Samurai Dogs Unleashed).
- Help files / recenzje providerów: Hacksaw (RIP City, Le Bandit), Nolimit City (Fire in the Hole 2, San Quentin), Pragmatic, Push, Relax, BTG, Play'n GO, ELK, Print.

**Kluczowe fakty rynkowe:**
- ✅ **[FAKT]** W ostatnich 12 mies. gry zbudowane na Stake Engine wygenerowały **~$3.31 mld turnover** (Stake, via iGamingToday/NEXT.io).
- ✅ **[FAKT]** Twist Gaming (Realm of Rats, Lab of Lunacy, Samurai Dogs Unleashed) to najczęściej grane tytuły Stake Engine w Q1 2025; Pixel Cafe > 3 mln zakładów, Pixel Farm > 1 mln.
- 🟡 **[EST]** Top-50 Stake „by total bets” (2026) obejmuje m.in. Massive Studios *Jawsome* (~#17), *Serpentina* (~#23), Twist *Samurai Dogs Unleashed* (~#25).
- ✅ **[FAKT]** Studia na Stake Engine: Twist Gaming, Titan Gaming, Massive Studios, Paperclip Gaming i in.

---

## 1. Kontekst techniczny Stake Engine (wpływa na design)

| Element | Zweryfikowana zasada | Konsekwencja projektowa |
|---|---|---|
| Pliki publikacyjne | `index.json` + lookup CSV (`uint64`: id, prob, payoutMult) + books `.jsonl.zst` (`id`,`events`,`payoutMultiplier`) ✅ | Cała matematyka to **dyskretny zbiór rund** z wagami — projekt musi dać się sprowadzić do skończonej dystrybucji. |
| `payoutMultiplier` | Integer, 1150 = 11.5× ✅ | Wewnętrznie trzymamy multiplikatory ×100 → brak błędów zmiennoprzecinkowych. |
| RGS URL | `sessionID`, `lang`, `device`, `rgs_url` (dynamiczny) ✅ | Frontend czyta z query params; zero hardkodu. |
| Endpointy | authenticate / balance / play / end-round / bet-event ✅ | Klient RGS event-driven; brak liczenia payoutów po stronie klienta. |
| Round resume | authenticate zwraca aktywną rundę; `auto_close_disabled` dla bonusu ✅ | Bonus/superbonus musi być wznawialny; frontend odtwarza stan z eventów. |
| jurisdiction | `socialCasino`, `disabledTurbo`, `disabledFullscreen` ✅ | Turbo/fullscreen/autoplay warunkowe; brak „gamble” w social. |
| Waluty | 21 walut, wartości int×10⁶; waluta = tylko warstwa display ✅ | Logika gry waluto-niezależna; formatowanie w UI. |

---

## 2. BENCHMARK — 30+ gier

### 2A. Stake Engine — liderzy turnover / all-time / breakout

| # | Gra | Studio / rok | Siatka | Naliczanie | Core loop | Base modifiers | Wejście do bonusu | Bonus | Super/odpowiednik | Buy/ante | RTP | Volat. | Max win | Bonus hit | Charakterystyczny moment | Streamowalność | Czego NIE kopiować |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Realm of Rats** | Twist / 2024 🟡 | 6×5 | Cluster (8+) | Kaskady klastrowe | Spawn wildów | Scatter → free spins | Free spins + progresywny mult | Wyższy tier free spins 🟡 | Buy 🟡 | 97% ✅ | Medium 🟡 | 10,000× ✅ | 🟡 ~1/180 | Progresywny mult rośnie w kaskadach | Kaskadowe łańcuchy, „jeszcze jeden” | Konkretny theme/postać |
| 2 | **Realm of Rats 2** | Twist / 2025 🟡 | 6×5 | Cluster | j.w. + ulepszenia | j.w. | Scatter | Free spins | Enhanced tier 🟡 | Buy | 97% 🟡 | Medium-high 🟡 | 10,000×🟡 | — | Sequel — utrzymanie serii | Rozpoznawalna marka | Sequel-izacja |
| 3 | **Lab of Lunacy** | Twist / 2024 | 🟡 6×5 | Cluster | Kaskady + spawn wild | Spawning wilds | Scatter | Free spins z **progresywnym mult** ✅ | — | Buy | 97% ✅ | High 🟡 | 5,000× ✅ | 🟡 | Progresywny mult w bonusie | Build-up mult | Layout/postacie |
| 4 | **Samurai Dogs Unleashed** | Twist / 2025 | 🟡 | ways/cluster 🟡 | — | — | Scatter | Free spins | „Unleashed” tier 🟡 | Buy | 97% ✅ | Medium 🟡 | 10,000× ✅ | — | „Unleashed” eskalacja | Marka/postać | Theme |
| 5 | **Pixel Cafe** | Twist / 2024 | 🟡 | cluster/tumble 🟡 | Pixelowy tumble | — | Scatter | Free spins | — | Buy | 🟡 96–97% | Medium | 🟡 5,000×+ | — | > 3 mln zakładów (retencja) | Prosty, „comfort” loop | Pixel-art identity |
| 6 | **Pixel Farm** | Twist / 2024 | 🟡 | cluster 🟡 | — | — | Scatter | Free spins | — | Buy | 🟡 | Medium | 🟡 | — | > 1 mln zakładów | Casual retencja | — |
| 7 | **Jawsome** | Massive Studios / 2025 🟡 | 🟡 | 🟡 hold&win/ways | Rekiny/ocean | — | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 96% | High 🟡 | 🟡 | — | Top-20 Stake by bets | Silny theme | Theme |
| 8 | **Serpentina** | Massive Studios / 2025 🟡 | 🟡 | 🟡 | Wężowy | — | — | — | — | — | 🟡 | 🟡 | 🟡 | — | Top-25 by bets | — | — |
| 9 | **Drac Stacks** | Massive Studios 🟡 | 🟡 | stacks/hold&win 🟡 | Wampiry, stacki | — | — | Hold & win 🟡 | — | — | 🟡 96% | High 🟡 | 🟡 | — | Stacki symboli | Hold&win napięcie | Theme |
| 10 | **Bonsai Banzai** | Massive Studios 🟡 | 🟡 | 🟡 | Japoński ogród | — | — | — | — | — | 🟡 | 🟡 | 🟡 | — | — | Estetyka | — |
| 11 | **Puffer Stacks** | Titan Gaming 🟡 | 🟡 | stacks 🟡 | Rozdmuchane stacki | Expanding sym | — | 🟡 | — | — | 🟡 96% | 🟡 | 🟡 | — | Puffer „rozdyma” symbole | Wizualny gag | Postać |
| 12 | **Dragon Fiesta** | Titan Gaming 🟡 | 🟡 | 🟡 | Smoki/fiesta | — | — | — | — | — | 🟡 | 🟡 | 🟡 | — | — | — | — |
| 13 | **Biker Bucks** | Twist 🟡 | 🟡 | 🟡 | Motocykle | — | — | — | — | — | 🟡 | 🟡 | 🟡 | — | — | Theme | — |

*(Uwaga: dokładne parametry gier natywnych Stake Engine są słabo udokumentowane publicznie → duży udział 🟡[EST]. Zweryfikowane twardo: nazwy studiów/gier, RTP Twist ~97%, max winy Twist 5k–10k×, turnover $3.31 mld, rankingi „top-N by bets”.)*

### 2B. Zewnętrzni providerzy — gry-wzorce i mechaniki

| # | Gra | Provider / rok | Siatka | Naliczanie | Core loop | Base modifiers | Wejście do bonusu | Bonus | Superbonus | Buy/ante | RTP | Volat. | Max win | Charakterystyczny moment | Streamowalność | Czego NIE kopiować |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 14 | **Wanted Dead or a Wild** | Hacksaw / 2021 | 5×5 | ways | Western, tryby | Sticky wild multipliers | 3 scatter | **3 różne** free-spin tryby (Duel/Wanted/Great Train) | Great Train Robbery = mega tier | Buy | 96.38% ✅ 🟡 | Extreme ✅ | 12,500× ✅ | Wybór trybu = różne dyspersje | Ekstremalny tail, „train” | 3-tryby, postacie, nazwy |
| 15 | **RIP City** | Hacksaw / 2025-02 ✅ | 5×5, 19 linii ✅ | lines | Cat vs mouse | Expanding wild (Ro$$) ✅ | 3 scatter | **Dwa** bonusy: Maxx / Ross ✅ | Premium reel-activation ✅ | Buy | 96.22% ✅ | Med-high ✅ | 12,500× ✅ | Ekspandujący kot | Dual-bonus wybór | Postacie/nazwy bonusów |
| 16 | **Le Bandit** | Hacksaw / 2023-08 ✅ | 6×5 cluster ✅ | cluster | Paryski heist | **Super Cascade** (usuwa cały typ) ✅ | scatter | Free spins + Golden Squares ✅ | — | Buy | 96.31% 🟡 | High ✅ | 10,000× ✅ | Super Cascade czyszczący typ | „Win-to-win” Golden Squares | Super Cascade (chronione), theme |
| 17 | **Chaos Crew / 2** | Hacksaw | 🟡 6×5 | cluster/ways | Punk/graffiti | Multiplier sym | scatter | Free spins | — | Buy | 96.3% 🟡 | High | 10,000×+ 🟡 | Marka streamerska | Rozpoznawalny brand | Brand/postacie |
| 18 | **Fire in the Hole 2** | Nolimit City / 2024 ✅ | 6-reel, 486→46,656 ways ✅ | ways (rozszerzane) | Górnictwo | **xBomb** (mnożnik+usuwanie), **xSplit**, kolapsy ✅ | Lucky Wagon scatter | Free spins z persistent mult | Bonus buy tiers | 96.06% 🟡 | Extreme ✅ | 🟡 60,000×+ | xBomb łańcuch mnożników | Ekstremalny potencjał | xBomb/xWays/xSplit® (znaki tow.) |
| 19 | **San Quentin xWays** | Nolimit City / 2021 ✅ | 6-reel | xWays/ways | Więzienie | **xWays** (2–4 kopie), Jumping Wilds, **enhancer cells** ✅ | scatter | Free spins + enhancer | Lockdown Spins 🟡 | Buy | 96.03% 🟡 | Extreme ✅ | 150,000× 🟡 | Enhancer cell odsłania mnożnik | Brutalny tail | xWays®, enhancer cells, theme |
| 20 | **Mental / Mental 2** | Nolimit City | 🟡 | ways/xWays | Horror azyl | xBomb, xWays, sticky | scatter | Free spins | Padded Cell 🟡 | Buy | 96% 🟡 | Extreme | 66,666×+ 🟡 | Ekstremalny klimat | Shock value | Theme (kontrowersyjny), nazwy |
| 21 | **Gates of Olympus** | Pragmatic / 2021 ✅ | 6×5 | scatter-pays (8+) | Grecki bóg | **Random multiplier orbs** (spadające) ✅ | 4 scatter | Free spins z sumowaniem mnożników ✅ | Ante bet (×1.25) ✅ | Buy + Ante | 96.5% ✅ 🟡 | High ✅ | 5,000× ✅ | Zeus rzuca mnożniki | „Multiplier print” | Random mult orbs (cliché!), Zeus |
| 22 | **Sugar Rush** | Pragmatic / 2022 ✅ | 7×7 cluster ✅ | cluster + tumble | Cukierki | **Multiplier spots** rosnące na pozycji ✅ | scatter | Free spins z persistent multiplier spots ✅ | Ante + Buy | 96.5% ✅ 🟡 | High ✅ | 5,000× ✅ | Rosnące pola mnożników | Board „ładuje się” | Persistent grid multipliers, candy |
| 23 | **Sweet Bonanza** | Pragmatic / 2019 ✅ | 6×5 | scatter-pays (8+) tumble | Owoce | Multiplier bombs (2–100×) | 4 scatter | Free spins | Ante/Buy | 96.5% ✅ 🟡 | High-med ✅ | 21,100× ✅ | Bomba ×100 | Casual + tail | Tumble+bomby (dokładnie ten cliché) |
| 24 | **Razor Shark** | Push / 2019 ✅ | 5×4 | ways | Podwodny | **Mystery stacks** + Nudge, growing reveal | scatter | Free spins z nieskończonym mult (dopóki mystery) ✅ | — | (późn. buy) | 96.7% ✅ | High ✅ | 50,000× ✅ | Mystery odkrywa mnożnik, mult nie resetuje | „Mystery print”, brak capu mult | Mystery stacks, theme |
| 25 | **Fat Rabbit / Fat Banker** | Push | 5×4 / 🟡 | ways | „Fat” seria | Symbol zjada innych, rośnie | scatter | Free spins | — | Buy | 96.4% 🟡 | High | 🟡 | „Fat” symbol rośnie i zbiera | Growing collector | „Fat” brand |
| 26 | **Money Train 3 / 4** | Relax / 2022–24 ✅ | 5×4 (6×?) | — | Hold & win bonus | — | 3+ bonus scatter | **Respin hold & collect** z symbolami-akcjami (Collector/Payer/Necromancer) ✅ | „Persistent” tiers, big money | Buy | 96–98% 🟡 | Extreme ✅ | 100,000× ✅ | Necromancer wskrzesza symbole | Kulminacja hold&win | Symbol-actions, brand, postacie |
| 27 | **Temple Tumble 1/2** | Relax / 2019–22 ✅ | 6×6 megaways-tumble | tumble | Świątynia | Znikające reele | scatter | Free spins | — | Buy | 96.2% 🟡 | High | 🟡 7,500×+ | Reele znikają | Tumble comfort | — |
| 28 | **Book of Dead** | Play'n GO / 2016 ✅ | 5×3 | lines | Egipt, Rich Wilde | Expanding symbol w bonusie ✅ | 3 book scatter | Free spins z 1 expanding symbol ✅ | — | (buy w niekt.) | 96.21% ✅ | High ✅ | 5,000× ✅ | Losowanie expanding symbol | Klasyk „book” | Book mechanic (kanon), Rich Wilde |
| 29 | **Rise of Olympus 1000** | Play'n GO / 2023 🟡 | 5×5 grid | cluster | Grecki | Bóg-akcje (Zeus/Hades/Athena) + mult grid | — | Feature z mnożnikami | 1000× cap mult 🟡 | Buy | 96.2% 🟡 | High | 10,000× 🟡 | Wybór boga | God-choice | Bogowie, nazwy |
| 30 | **Cygnus 1/2/3** | ELK / 2021–24 ✅ | 6×5 grid | pay-both-ways/grid | Egipt kosmiczny | Gravity/Drop mechanic, mnożniki na kolumnach ✅ | scatter | Free spins z mnożnikami kolumn | — | Buy | 96% 🟡 | High | 20,000×+ 🟡 | Kolumny-mnożniki rosną | Kolumnowa eskalacja | Gravity brand, theme |
| 31 | **Nitropolis 1–4** | ELK / 2021–24 ✅ | rozszerzana siatka (X-iter) | ways | Post-apo zwierzęta | **Grid expansion** wierszami | scatter | Free spins, X-iter buy | — | X-iter (multi-buy) ✅ | 95–96% 🟡 | Extreme | 🟡 20,000×+ | Siatka rośnie w pionie | X-iter multi-tier buy | Grid-expand, X-iter, postacie |
| 32 | **Bonanza / Extra Chilli** | BTG / 2016–18 ✅ | 6-reel **Megaways** ✅ | ways (117,649) | Kopalnia/chilli | Reel top row, tumble | 4 scatter | Free spins + unlimited mult (tumble) ✅ | Feature Drop (buy) | 96% ✅ | High ✅ | 🟡 10k–20k× | Megaways liczba ways | Kanon Megaways | Megaways® (licencja!), theme |
| 33 | **Wild Wild Bananas / Coins of Fortune** | Print Studios / 2023–24 🟡 | 🟡 6×5 | cluster/ways | Małpy/piraci | Collector/booster | scatter | Free spins | — | Buy | 96.2% 🟡 | High | 🟡 12k–25k× | Charakterny booster | Klarowny loop | Brand/postać |
| 34 | **Punk Toilet / Le Viking** | Print Studios 🟡 | 🟡 | ways | Punk/Wiking | — | scatter | Free spins | — | Buy | 96% 🟡 | High | 🟡 | Charakterystyczny humor | Osobowość | Theme |
| 35 | **Dead or Alive 2** | NetEnt / 2019 ✅ | 5×3 | lines | Western | Sticky wild + mnożniki (3 tryby free) ✅ | 3 scatter | 3 tryby free spins | High Noon tier | — | 96.8% ✅ | Extreme ✅ | 100,000×+ ✅ | Sticky wild line w High Noon | Ekstremalny sticky | Theme, 3-tryby |
| 36 | **Gates of Heaven / Big Bass** (ser.) | Reel Kingdom/Pragmatic / 2024–26 🟡 | 5×3 / 6×5 | lines/scatter | Wędkarstwo/niebo | Collector (fisherman) | scatter | Free spins + collect ×money | Multi-tier buy | 96.5% 🟡 | Med-high | 🟡 5k–10k× | Fisherman zbiera money-fish | Prosty collect loop | Big Bass brand |

**Łącznie: 36 pozycji** (13 Stake Engine + 23 zewnętrznych), pokrywające studia: Twist, Massive, Titan, Paperclip (Stake Engine) oraz Hacksaw, Nolimit City, Pragmatic, Push, Relax, Play'n GO, ELK, BTG, Print, NetEnt, Reel Kingdom.

---

## 3. Analiza rozkładu emocji sesji (nie tylko grafika i max win)

🧠 **[WNIOSEK]** Analiza tempa w topowych grach:

| Wymiar | Dobre gry (np. Razor Shark, Sugar Rush, Money Train) | Słabe gry |
|---|---|---|
| Częstotliwość małych zdarzeń | Co 1–3 spiny „coś się dzieje” (spawn, teaser, near-scatter) | Długie martwe serie bez feedbacku |
| Długość pustych fragmentów | Krótkie; dead-spin ma mikro-animację, nie pustkę | 10+ pustych spinów pod rząd |
| Częstotliwość teaserów | 2 scattery / 1 od triggera regularnie „drażnią” | Trigger bez zapowiedzi (nagły) lub fałszywy near-miss |
| Tempo eskalacji | Wyraźne rampy (mult rośnie, siatka rośnie, meter się ładuje) | Płaska krzywa, wszystko naraz |
| Struktura bonusu | **Setup → Escalation → Payoff** czytelne (np. Money Train: zbieranie → respiny → kulminacja) | Bonus = tylko „więcej spinów”, bez łuku |
| Zrozumiałość dużej wygranej | Gracz widzi **łańcuch przyczynowy** (mult ×5 × 8 symboli) | „Nagle 2000×” bez wyjaśnienia |

**Wniosek kluczowy:** turnover generują gry, w których gracz **rozumie, dlaczego wygrał**, i widzi **rosnący potencjał** zanim wygra — nie te z najwyższym max winem w marketingu.

---

## 4. 12 zasad sukcesu topowych slotów (🧠 synteza)

1. **Jedna ownable mechanika** rozpoznawalna po 1 GIF-ie (xBomb, Mystery Stacks, Money Cart, Super Cascade).
2. **Base game gra się sam** — modifier co kilka spinów, nie tylko „czekanie na scatter”.
3. **Widoczna eskalacja** — mnożnik/siatka/meter, który *rośnie na oczach* (dopamina antycypacji > dopamina wypłaty).
4. **Bonus ma łuk trzech aktów** (setup/escalation/payoff), nie „więcej spinów”.
5. **Superbonus zmienia regułę**, nie parametr (inny start planszy / inna akumulacja / inna kulminacja).
6. **Teasery są uczciwe** — 2 scattery realnie zbliżają do triggera; brak fałszywych near-missów.
7. **Czytelny łańcuch przyczynowy wygranej** — gracz umie opowiedzieć „dlaczego”.
8. **Ekstremalny, ale rzadki tail** dla klipów streamerskich, przy wiarygodnych medium winach.
9. **Bet modes zamiast jednego RTP** — ante/buy dają graczowi kontrolę dyspersji przed zakładem.
10. **Big-win presentation z eskalacją progów** (Nice/Big/Mega/Epic + skip).
11. **Mobile-first, portrait-first** — 70%+ ruchu to telefon; UI kciukowy, czytelny w słońcu.
12. **Lobby tile z jednym focal pointem** i odróżnialną paletą (nie kolejny czerwono-złoty).

## 5. 10 najczęstszych błędów słabych slotów (🧠)

1. **Mechanic soup** — 5 mechanik naraz, żadnej nie da się wyjaśnić.
2. Bonus = tylko więcej spinów; brak łuku i kulminacji.
3. Superbonus = ten sam bonus z lepszymi reelami (brak zmiany reguły).
4. Martwe base game — 20 spinów bez żadnego feedbacku.
5. Nagły trigger bez teaserów → brak napięcia.
6. **Fałszywe near-missy** / celowo mylące animacje (ryzyko compliance).
7. Max win w marketingu bez wiarygodnego medium-win (pusty rozkład).
8. Payout niejasny — gracz nie wie, dlaczego wygrał.
9. UI desktop-first, nieczytelny na telefonie w pionie.
10. Skopiowany theme/mechanika (reskin) → brak tożsamości, brak retencji.

## 6. 5 niezagospodarowanych kierunków mechanicznych (🧠 [WNIOSEK])

1. **Deterministyczna eskalacja mnożnika przez akcję gracza-ekonomii planszy** (mult rośnie z *liczby fuzji/łączeń*, nie z losowych spadających orbów). → rzadkie; większość to random mult (Gates/Sweet Bonanza).
2. **Progresja rang symboli („ladder”/fusion)** jako oś wypłaty — łączenie w wyższy symbol, płatny dopiero od pewnej rangi. Podejmowane rzadko i zwykle mylnie (tylko upgrade wildów).
3. **Superbonus jako zmiana modelu wypłaty** z „płać za event” na „zbieraj i wylej na końcu” (lock & pour), przy zachowaniu tej samej mechaniki core. Rzadkie i mocne.
4. **Meter globalny, który jest jednocześnie mnożnikiem i licznikiem postępu** (podwójny odczyt jednej liczby) — redukuje UI do jednego wskaźnika.
5. **Board pre-seeding** (superbonus startuje z wyższego stanu) zamiast „więcej/lepsze reele” — natychmiast czytelna różnica.

→ **Molten Crown** łączy 1+2+3+4+5 w jeden spójny, prosty loop (patrz `CONCEPTS.md`).

## 7. 5 sposobów wyróżnienia w lobby Stake (🧠)

1. **Paleta „molten teal-on-basalt”** — pomarańcz lawy + głęboka czerń bazaltu + zimny teal akcentu; odróżnia od czerwono-złotych i cukierkowych miniatur.
2. **Focal point = jeden świecący obiekt** (Molten Crown) — czytelny w miniaturze bez tekstu.
3. **Ruch na tile** (jeśli animowany) = pojedynczy puls żaru, nie chaos.
4. **Nazwa jedno-słowna, mocna sylwetka** litery.
5. **Obietnica mechaniki w ikonie** (ślad „rang ladder” jako subtelny motyw), bez wprowadzania w błąd co do wypłat.

## 8. Turnover vs. „tylko efektowne wizualnie” (🧠 [WNIOSEK])

| Generuje turnover | Tylko efektowne |
|---|---|
| Czytelny loop, gracz wraca „na jeszcze jeden” | Wow na 5 min, potem nuda |
| Uczciwe teasery, rytm zdarzeń | Długie martwe serie |
| Bonus z łukiem i wiarygodnym medium-win | Bonus „wszystko albo nic” bez środka |
| Bet modes = kontrola gracza | Jeden sztywny RTP |
| Mobilny, szybki, skip/turbo | Ciężki, wolny, desktop-first |
| Rozpoznawalna mechanika (klipowalna) | Ładna grafika bez ownable hooka |
| Stabilna wariancja medium-tier | Tylko ekstremalny tail (frustracja) |

---

## 9. Elementy, których NIE wolno kopiować (compliance/IP guardrails)

- Chronione nazwy mechanik: **Megaways®**, **xWays®/xBomb®/xSplit®**, **Money Cart/Money Train** symbol-actions, **Super Cascade**, **Mystery Stacks** brand, **X-iter**, **Feature Drop** (jako nazwa).
- Postacie/nazwy: Rich Wilde, Ro$$, Zeus-as-character-art, Necromancer/Collector postacie, brandy studiów.
- Dokładne kombinacje funkcji konkretnej gry (np. „3 tryby free jak Wanted”, „bogowie-akcje jak Rise of Olympus”).
- Layouty UI i sekwencje animacji 1:1.
- **Cliché do unikania:** „tumble + losowe spadające bomby-mnożniki + free spins z sumą mnożników” (Sweet Bonanza/Gates) — to jest dokładnie to, czego brief zakazuje.

**Nasza odpowiedź:** mnożnik **zarabiany deterministycznie** (Heat z liczby fuzji), wypłata od **rang relikwii**, superbonus = **zmiana modelu na lock&pour z pre-seedingiem**. To nowy, samodzielny IP — szczegóły w `CONCEPTS.md` i `GDD.md`.
