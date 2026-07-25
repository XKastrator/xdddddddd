# Prompty do wygenerowania assetów (ChatGPT / GPT Image)

Ten plik zawiera gotowe prompty dla **każdego** pliku graficznego, którego
potrzebuje gra, plus dokładne nazwy plików, rozmiary i formaty. Pliki wrzucone
do `frontend/public/assets/` wchodzą do gry **bez żadnej zmiany w kodzie** —
sloty są już zrobione (patrz `ART_BIBLE.md` §17).

---

## 0. Zanim zaczniesz — 6 rzeczy, które decydują o wyniku

**1. Spójność to najtrudniejsza część, nie jakość pojedynczego obrazka.**
Trzynaście symboli narysowanych w trzynastu różnych stylach wygląda gorzej niż
trzynaście przeciętnych, ale spójnych. Dlatego:

- generuj **wszystko w jednej rozmowie**, nigdy nie zaczynaj nowej w połowie;
- pierwszy obrazek jest wzorcem — przy kolejnych pisz
  *„Same style, same lighting, same rendering technique, same outline weight as
  the previous image. Now: …"*;
- najlepszy trik: **arkusz kontaktowy**. Poproś o 4 symbole naraz w siatce 2×2
  na jednym obrazku — model wymusza wtedy spójność sam z siebie. Potem wytnij
  i powiększ każdy osobno.

**2. Przezroczystość.** Czat zwykle nie odda prawdziwej alfy. Proś o
*„isolated on a plain solid #FF00FF magenta background, no shadow touching the
background"* i wytnij tło (`rembg`, remove.bg, Photoshop → Select Subject).
Magenta, bo nie występuje nigdzie w palecie gry, więc keying nie zje krawędzi.

**3. Rozmiary.** Model i tak generuje 1024×1024 (albo 1536×1024). Nie proś o
dziwne wymiary — generuj kwadrat i przeskaluj. Docelowe rozmiary są w tabelach
niżej.

**4. Zero tekstu.** Modele obrazowe rozwalają litery. Żaden prompt poza logo nie
zawiera tekstu, a przy logo i tak zalecam zostawić napis z kodu.

**5. Paleta gry — wklejaj ją, żeby grafika pasowała do UI:**

```
bursztyn  #ff7a18    jasny bursztyn #ffb347    złoto #f2c14e
turkus    #37e0c8    tło            #0a0806    panel #14100c
ruda: malachit #2fbf6a · azuryt #2f7fdf · cynober #e0452a
      siarka   #c9d423 · ametyst #9a4fe0
```

**6. Nie wypalaj w plikach:** winiety, poświaty podłogi, ramki bębnów, cieni
rzucanych na podłoże. To wszystko rysuje kod i podwoi się.

---

## 1. KOTWICA STYLU — wklej to na początku KAŻDEGO promptu na symbol

```
Premium casino slot game symbol, hand-painted digital illustration in a dark
fantasy forge setting. A single object, centered, isolated on a plain solid
#FF00FF magenta background. Strong directional key light from the upper left;
a warm orange rim light from below, as if lit by a forge fire. Rich painterly
rendering with visible material texture, metal grain, chips and honest wear.
Bold, instantly readable silhouette that still reads at 80x80 pixels. Thick
soft dark contour around the object. Painterly, NOT flat vector, NOT cel
shaded, NOT 3D render, NOT glossy plastic. No text, no numbers, no logo, no
frame, no border, no ground shadow. Square composition, the object fills about
80% of the frame.
```

Do tego doklejasz jedno zdanie opisu obiektu z tabel poniżej.

---

## 2. Symbole — 13 plików → `atlas.png`

Docelowo: **1024×1024 każdy**, PNG z alfą. Ja z nich składam atlas
(256 px/komórkę) i regeneruję `atlas.json`.

### 2.1 Ruda (5 wariantów, nie płacą — to paliwo)

Wszystkie mają **tę samą ciemną skalną osnowę**, różnią się wyłącznie
minerałem i kształtem bryły. To jest celowe: ruda ma czytać się jako jeden
bezwartościowy materiał, a kolor ma rozdzielać warianty.

| # | Plik | Zdanie do doklejenia |
|---|---|---|
| O1 | `sym_O1.png` | `A chunk of raw ore: a rough dark grey-brown pentagon-shaped rock, broken open, with a cluster of glowing malachite-green crystal prisms growing out of its heart. Crystal colour #2fbf6a with pale green highlights.` |
| O2 | `sym_O2.png` | `A chunk of raw ore: a rough dark grey-brown blocky cube-shaped rock, broken open, with a cluster of deep azurite-blue crystal prisms growing out of its heart. Crystal colour #2f7fdf with pale blue highlights.` |
| O3 | `sym_O3.png` | `A chunk of raw ore: a rough dark grey-brown diamond-shaped rock, broken open, with a cluster of cinnabar-red crystal prisms growing out of its heart. Crystal colour #e0452a with warm pink highlights.` |
| O4 | `sym_O4.png` | `A chunk of raw ore: a rough dark grey-brown hexagonal rock, broken open, with a cluster of sulphur-yellow crystal prisms growing out of its heart. Crystal colour #c9d423 with pale lime highlights.` |
| O5 | `sym_O5.png` | `A chunk of raw ore: a rough dark grey-brown rounded nodule, broken open, with a cluster of amethyst-violet crystal prisms growing out of its heart. Crystal colour #9a4fe0 with pale lilac highlights.` |

> **Wskazówka:** wygeneruj całą piątkę jako jeden arkusz 2×3. Prompt:
> *„A contact sheet, 3 columns by 2 rows on a plain magenta background, showing
> five different chunks of raw crystal ore in one consistent painted style: …"*
> i wypunktuj pięć wariantów. Spójność będzie znacznie lepsza.

### 2.2 Relikwie (6 rang — te płacą)

Drabina musi rosnąć **wizualnie**: im wyżej, tym cenniejszy materiał, więcej
zdobienia i mocniejsza własna poświata.

| Ranga | Plik | Zdanie do doklejenia |
|---|---|---|
| I | `sym_BRONZE.png` | `A freshly cast bronze ingot, a heavy trapezoidal bar straight out of the mould, warm brown-gold metal with a rough cast top face and a cooling seam down the front. Lowest tier: matte, almost no glow.` |
| II | `sym_IRON.png` | `A blacksmith's forge hammer: a heavy rectangular iron head with flared, worn striking faces, mounted on a thick ash-wood haft with an iron collar and two rivets. Cool grey steel and warm brown wood.` |
| III | `sym_SILVER.png` | `A silver heater shield with a horizontal bronze band across the middle, a domed central boss, riveted edge binding and battle scratches. Cool bright silver with warm bronze accents. Faint glow.` |
| IV | `sym_GOLD.png` | `An ornate gold chalice on a flared foot, its bowl brimming with molten gold that glows from inside, set with two small pale gems on the rim and one orange gem on the knop. Strong warm glow.` |
| V | `sym_MYTHRIL.png` | `A mythril longsword standing point-up: a slender double-edged blade with a glowing fuller down the centre, a straight crossguard, leather-wrapped grip and a flat disc pommel set with a pale gem. The metal is luminous mint-teal #37e0c8 and clearly magical. Strong cold glow.` |
| VI | `sym_CROWN.png` | `The Molten Crown: a heavy crown of five tall points, forged from gold that is still partly liquid, with molten orange metal running down between the points and three white-hot gems set into the band. It glows from within like something just pulled out of a furnace. The single most valuable object in the set — maximum glow, maximum ornament.` |

### 2.3 Symbole specjalne

| Rola | Plik | Zdanie do doklejenia |
|---|---|---|
| WILD | `sym_FLUX.png` | `A single suspended droplet of luminous molten flux, teardrop-shaped, glass-like and translucent, glowing bright cyan-teal #37e0c8 from its core, with a white-hot centre and light refracting through it. Weightless, floating, clearly magical.` |
| SCATTER | `sym_CINDER.png` | `A four-pointed burning cinder — a blazing ember star with long sharp points, a white-hot core and orange #ff7a18 flame licking off the tips, throwing sparks. Brightest, most attention-grabbing object in the whole set.` |

---

## 3. Tła — 9 plików (3 sceny × 3 plany)

Tło to **stos paralaksy**, nie jedna tapeta. Trzy plany przesuwają się z różną
prędkością, dlatego muszą być osobnymi plikami — inaczej scena spłaszczy się z
powrotem do jednej płachty.

| Plan | Plik | Rozmiar | Format | Alfa |
|---|---|---|---|---|
| daleki | `scene_{X}.jpg` | 1024×1024 | JPEG | nie |
| średni | `scene_{X}_mid.png` | 1024×1024 | PNG | **tak** |
| bliski | `scene_{X}_near.png` | 1024×1024 | PNG | **tak** |

gdzie `{X}` = `base` / `bonus` / `super`.

**Krytyczne dla wszystkich dziewięciu:** *„Keep the centre of the image dark,
empty and low contrast — the game grid is drawn on top of it and must stay
readable. All detail belongs at the edges."* Bez tego dostaniesz ładne tło,
na którym nie widać planszy.

### 3.1 Plan daleki — sama jaskinia

```
A wide painted environment background for a dark fantasy slot game: the inside
of a vast underground forge cavern. Cold dark basalt rock, deep shadows, glowing
lava seams cracking across the cavern floor, embers drifting in the air. Painted
concept-art style, atmospheric, moody. IMPORTANT: no columns, no pillars, no
architecture, no props, no characters, no vignette, no dark corners — this is
only the far distance. Keep the centre dark, empty and low contrast. No text.
Square 1:1 composition.
```

Warianty:

| Plik | Doklej |
|---|---|
| `scene_base.jpg` | `The forge is at rest: mostly cold blue-grey stone, embers banked low, only a few dull orange lava seams near the floor. Restrained and quiet.` |
| `scene_bonus.jpg` | `The forge is stoked: the same cavern much hotter, lava seams brighter and wider, orange light rising up the walls, far more embers in the air.` |
| `scene_super.jpg` | `The molten core: the cavern has descended to a lava lake. The lower half of the image is glowing molten rock, intense orange and white heat, the air visibly shimmering.` |

### 3.2 Plan średni — architektura

```
Painted architectural elements for a dark fantasy forge, isolated on a plain
solid #FF00FF magenta background with nothing else in the image. Two massive
basalt stone columns, one at the far left edge and one at the far right edge,
running the full height of the image, with carved capitals and bases and thin
glowing lava seams running down the stone. Between them at the top, a heavy
stone vault arch spanning the width. THE ENTIRE CENTRE AND LOWER MIDDLE OF THE
IMAGE MUST BE COMPLETELY EMPTY MAGENTA — the game grid goes there. Painted
concept-art style, warm rim light from below. No text, no characters, no props.
Square 1:1.
```

Warianty: `_mid` dla `base` chłodny i ciemny, dla `bonus` mocniej podświetlony
od dołu pomarańczem, dla `super` kamień rozgrzany do czerwoności przy podstawie.

### 3.3 Plan bliski — pierwszy plan

```
Painted foreground props for a dark fantasy forge, isolated on a plain solid
#FF00FF magenta background. Along the BOTTOM EDGE only: a heavy stone floor
ledge running the full width, with a glowing molten seam along its top edge, an
anvil silhouette on the left and a fire brazier on the right. In the TOP LEFT
and TOP RIGHT CORNERS only: heavy iron chains hanging down from above, and a
hanging iron lantern. Everything else in the image must be completely empty
magenta. These are dark foreground silhouettes, nearly black, lit only by rim
light. Painted style. No text, no characters. Square 1:1.
```

---

## 4. Postać — Kowal (Emberwright)

| Plik | Rozmiar | Format |
|---|---|---|
| `character.png` | 1024×1536 (pion) | PNG z alfą |

```
A full-body character illustration for a dark fantasy slot game: a master
blacksmith standing at his forge, seen from the front, isolated on a plain solid
#FF00FF magenta background. A broad-shouldered adult man in his fifties, weather-
beaten face, heavy grey-streaked beard, deep-set eyes, a leather apron over a
soot-stained tunic, thick bracers, a wide belt with a heavy buckle, one gloved
hand resting on a large forge hammer whose head sits on the ground. Strong warm
orange rim light from the forge on his left side, cool dark shadow elsewhere.
Painted concept-art style, confident brushwork, heroic but grounded and worn —
he looks like he has actually worked. Clearly an adult, dignified, not cute, not
stylised, not chibi. No text, no logo, no ground shadow. Vertical 2:3
composition, the figure fills the frame from head to feet.
```

> **Uwaga techniczna:** obecny kod animuje postać kośćmi z osobnych części
> (`Rig.ts`). Jedna zlepiona ilustracja tego nie obsłuży. Daj mi ten jeden plik
> — ja albo pociąchmy go na 3–4 części z pivotami, albo przełączę renderer na
> statyczny sprite z subtelnym oddechem i migotaniem światła. Powiedz, którą
> wersję wolisz; obie są krótką robotą.

---

## 5. Logo

| Plik | Rozmiar | Format |
|---|---|---|
| `logo.png` | 1024×540 | PNG z alfą |

**Nie proś modelu o napis „MOLTEN CROWN".** Wyjdzie „MOLLTEN CRWON" albo gorzej.
Rozsądniejsze podejście: wygeneruj **samą oprawę**, a napis zostaje mój
(rysowany kodem, `assets/generate_logo.py`) i nakładam go na środek.

```
A decorative emblem for a dark fantasy game logo, isolated on a plain solid
#FF00FF magenta background. A heavy forged crown of molten gold at the top
centre, with liquid metal dripping from it, flanked by two curling iron scroll
ornaments that sweep outwards and downwards to frame an empty space in the
middle. THE MIDDLE MUST BE COMPLETELY EMPTY — a title will be placed there.
Molten orange #ff7a18 and gold #f2c14e, glowing hot metal, painted style, no
text, no letters, no words of any kind. Wide horizontal composition.
```

Jeśli mimo wszystko chcesz napis z modelu: wygeneruj osobno, a potem i tak
wyprostuj literowanie ręcznie w wektorze.

---

## 6. Kafelek do lobby

| Plik | Rozmiar | Format |
|---|---|---|
| `lobby.jpg` | 512×512 | JPEG |

```
A casino game lobby thumbnail, square 1:1. A single dramatic hero object dead
centre: a heavy crown of molten gold, glowing white-hot, with liquid metal
running off it, against a dark basalt cavern with a warm orange glow rising from
below. One strong focal point, high contrast, instantly readable as a thumbnail
at 200x200 pixels. Painted style, rich and premium. No text, no letters, no
numbers, no UI, no frame.
```

---

## 7. Ściąga — co gdzie wrzucić

Wszystko ląduje w `frontend/public/assets/`:

```
sym_O1.png … sym_CINDER.png   →  daj mi je, składam atlas.png + atlas.json
scene_base.jpg   scene_bonus.jpg   scene_super.jpg
scene_base_mid.png    scene_bonus_mid.png    scene_super_mid.png
scene_base_near.png   scene_bonus_near.png   scene_super_near.png
character.png     logo.png     lobby.jpg
```

Symbole i `character.png` wymagają ode mnie kroku składania (atlas / rig), reszta
wchodzi bezpośrednio.

## 8. Kolejność, jeśli nie chcesz robić wszystkiego naraz

1. **13 symboli** — największy zysk, zajmują większość ekranu przez cały czas.
2. **`character.png`** — druga najbardziej widoczna rzecz.
3. **`scene_*_mid.png` + `scene_*_near.png`** — to one wypełniają pusty pokój.
4. **`scene_*.jpg`** — plan daleki, obecny jest znośny.
5. **`logo.png`, `lobby.jpg`** — kosmetyka.

Same symbole zmieniają odbiór gry bardziej niż wszystko pozostałe razem wzięte.
