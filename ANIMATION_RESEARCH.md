# ANIMATION_RESEARCH.md — co robią topowi wydawcy i czego brakowało nam

> Podział jak w całym repo: **[FAKT]** — zweryfikowane źródłem lub pomiarem ·
> **[SZAC]** — oszacowanie · **[WNIOSEK]** — moja własna ocena projektowa.

---

## 0. Uczciwie o jakości źródeł

Publiczne piśmiennictwo o animacji slotów to w większości treść SEO pisana pod
afiliację, nie materiał techniczny. Przeszukałem je i wyciągnąłem tylko te
stwierdzenia, które są konkretne i sprawdzalne; resztę odrzuciłem. **Nie mam
dostępu do materiałów wewnętrznych żadnego wydawcy** i nie zamierzam udawać, że
mam. Najmocniejszym dowodem pozostają same gry — a te oglądałem wyłącznie
pośrednio, przez opisy i twój screenshot.

Dlatego najważniejsza część tego dokumentu to nie cudze cytaty, tylko **audyt
naszej własnej gry** (§2), który zrobiłem czytając jej kod. Ten fragment jest w
100 % sprawdzalny — plik i linia są podane.

---

## 1. Co udało się ustalić ze źródeł

**[FAKT] Profil ruchu bębna.** Przyspieszenie narasta przez ok. 0–100 ms,
prędkość szczytowa utrzymuje się krótko, po czym zatrzymanie prowadzi krzywa
ease‑out; kolumny zatrzymują się **z przesunięciem**, nie równocześnie, bo
jednoczesny stop czyta się mechanicznie.
([on-magazine.co.uk](https://www.on-magazine.co.uk/stuff/gaming/how-millisecond-level-timing-in-slot-animations-shapes-player-emotion-and-perceived-luck/))

**[FAKT] Czym jest anticipation.** To celowe spowolnienie bębna **zanim się
zatrzyma**, uruchamiane, gdy wcześniejsze bębny już wyłożyły symbole
umożliwiające istotny wynik. Czyli: sygnał jest sterowany stanem planszy, nie
losowany dla efektu.
([editionscomplexe.com](https://www.editionscomplexe.com/what-anticipation-animations-signal-during-online-slot-spins/))

**[FAKT] Spójność easingu i synchronizacja z dźwiękiem.** Funkcje easingu mają
naśladować ruch fizyczny; niespójność między elementami czyta się jako
zerwanie immersji. Beat animacji ma być zsynchronizowany z dźwiękiem.
([zvky.com](https://www.zvky.com/blogs/articles/slot-game-animations-how-motion-and-visual-effects-improve-gameplay))

**[FAKT] Tryb ograniczonej animacji to funkcja produkcyjna, nie ustępstwo.**
Pragmatic Play dostarcza „Battery Saver" — obniża intensywność animacji, żeby
oszczędzić baterię na mobile.
([nuxgame.com](https://nuxgame.com/blog/best-nolimit-city-online-slots-games))

**[FAKT] Progi tierów wygranej nie są branżowym standardem — różnią się
kilkukrotnie.** Udokumentowany przykład (Wizard of Oz Slots): Big 8–15×, Mega
15–25×, Epic 25–35×, powyżej 35×. Uzus graczy bywa zupełnie inny: „nice"
50–100×, „big" 200–500×, „epic" 1000×+.
([zyngasupport.helpshift.com](https://zyngasupport.helpshift.com/hc/en/23-wizard-of-oz-slots/faq/13155-what-are-the-types-of-wins/),
[slotcatalog.com](https://slotcatalog.com/en/Big-Slot-Wins))

**[FAKT] Nolimit City buduje dramaturgię na mechanice, nie na efektach.**
xNudge przesuwa wilda o jedno pole na raz, podnosząc mnożnik przy każdym ruchu —
napięcie bierze się z tego, że każdy krok jest widoczny i policzalny.
([nuxgame.com](https://nuxgame.com/blog/best-nolimit-city-online-slots-games))

**[WNIOSEK]** Wspólny mianownik tych faktów: w dobrym slocie **ruch niesie
informację**. Bęben zwalnia, bo coś się może wydarzyć. Wild przesuwa się o
jedno pole, bo mnożnik urósł o jeden. Animacja, która nic nie komunikuje, jest
tylko opóźnieniem między zakładem a wynikiem.

---

## 2. Audyt naszej gry — stan sprzed tej zmiany (w 100 % sprawdzalny)

| Co | Stan | Dowód |
|---|---|---|
| **Wejście planszy** | **Brak.** `revealBoard` wołało `setBoard()`, które ustawia wszystkie 30 komórek w JEDNEJ klatce, a potem czekało 220 ms. | `PixiPresenter.revealBoard` → `BoardView.setBoard` |
| Anticipation | Zmiana napisu + drgnięcie sceny o 2.5 px. Żadna kolumna nie była wstrzymywana. | `PixiPresenter.anticipation` |
| Kaskada | Spadek o `cell * 1.15` z narastaniem alfy — symbole **przenikały** zamiast wpadać. | `BoardView.gravity` |
| Maska planszy | Brak. Bez niej symbol nie może być „za ramą", więc jedyne dostępne wejście to przenikanie. | `BoardView` (konstruktor) |
| Fuzja, squash, shake, cząstki, tiery wygranej | **Są i działają.** | `BoardView.forge`, `juice.ts`, `WinBanner` |

**[WNIOSEK] To była jedna, konkretna dziura, nie „ogólny brak dopieszczenia".**
Warstwa „juice" była zbudowana porządnie — impact shake, squash‑and‑stretch,
magnet‑in przy fuzji, cząstki, tiery. Ale wszystko to działo się **po** tym, jak
plansza już się teleportowała. Slot, w którym plansza pojawia się w jednej
klatce, nie ma spinu — gracz widzi podmianę obrazka. Każdy inny efekt jest
nakładany na ten fundamentalny brak i dlatego nie ratuje wrażenia.

---

## 3. Co zaimplementowano

### 3.1 Wejście planszy — `BoardView.reveal()`

Symbole **wpadają do siatki kolumnami**, z góry, spoza obudowy. Profil ruchu
zgodny z §1: krótkie wejście, ease‑out na zatrzymaniu, przesunięcie startu
między kolumnami (0.34 długości spadku), wewnątrz kolumny wiersze schodzą jak
taśma (0.05 przesunięcia na wiersz). Dolny rząd dostaje squash na lądowaniu —
squash na wszystkich trzydziestu byłby szumem, nie akcentem.

Warunkiem koniecznym była **maska warstwy symboli**: bez niej symbol nie może
istnieć poza siatką, więc nie ma czego animować. Maska jest wielkości siatki,
nie ekranu — koszt fill‑rate mieści się w budżecie opisanym w
`TECH_ARCHITECTURE.md` §7.

### 3.2 Anticipation, która faktycznie wstrzymuje kolumny

Gdy na planszy są **dokładnie dwa** Cindery, dwie ostatnie kolumny lądują
**pojedynczo i wolniej** (1.35× czasu spadku każda, bez nakładania), a potem
pulsują. Przy trzech i więcej trigger jest już przesądzony — przeciąganie
byłoby napięciem o nic.

**Sterowane liczbą scatterów, którą książka już niesie** — czyli tym samym
warunkiem, który opisuje §1. Prezentacja nigdy nie obiecuje czegoś, czego runda
nie może dostarczyć; to też wymóg z briefu (zakaz fałszywych near‑missów).

### 3.3 Kaskada spada zza ramy

`gravity` używa teraz tej samej maski i spada z wysokości całej planszy zamiast
przenikać z jednej komórki wyżej.

---

## 4. Czego nadal brakuje (uczciwa lista)

1. **[WNIOSEK] Audio bez rytmu i melodii** — nadal drony i akordy. To jest teraz
   najsłabsze ogniwo i słychać je natychmiast. §1 mówi wprost, że beat animacji
   ma być zsynchronizowany z dźwiękiem; my nie mamy z czym synchronizować.
2. **[WNIOSEK] Symbole nie mają animacji klatkowych.** Relikwie oddychają
   proceduralnie (skala + alfa), ale nie mają wygrywającej pętli. Wymaga
   spritesheetów, czyli assetów, których nie mam.
3. **[WNIOSEK] Brak przejścia do bonusu.** Wejście w rundę bonusową to zmiana
   sceny i baner — bez sekwencji przejścia, którą ma każda gra z §1.
4. **[SZAC] Tiery wygranej** mamy oparte na własnych progach; §1 pokazuje, że
   branża nie ma tu standardu, więc to świadoma decyzja, a nie odwzorowanie.

---

## Źródła

- [The Slow Spin Effect: millisecond-level timing in slot animations — On: Yorkshire Magazine](https://www.on-magazine.co.uk/stuff/gaming/how-millisecond-level-timing-in-slot-animations-shapes-player-emotion-and-perceived-luck/)
- [What anticipation animations signal during online slot spins — Editions Complexe](https://www.editionscomplexe.com/what-anticipation-animations-signal-during-online-slot-spins/)
- [Slot Game Animations: How Motion and Visual Effects Improve Gameplay — Zvky Design Studio](https://www.zvky.com/blogs/articles/slot-game-animations-how-motion-and-visual-effects-improve-gameplay)
- [Best Nolimit City Online Slots — Nuxgame](https://nuxgame.com/blog/best-nolimit-city-online-slots-games)
- [What are the types of Wins? — Wizard of Oz Slots Help Center](https://zyngasupport.helpshift.com/hc/en/23-wizard-of-oz-slots/faq/13155-what-are-the-types-of-wins/)
- [Big Win Slots — SlotCatalog](https://slotcatalog.com/en/Big-Slot-Wins)
- [How Slot Transition Smoothness Reduces Fatigue — Crafting Code Tech](https://craftingcodetech.com/how-slot-transition-smoothness-reduces-fatigue/)
