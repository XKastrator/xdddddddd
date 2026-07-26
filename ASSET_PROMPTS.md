# Prompty do wygenerowania assetów (ChatGPT / GPT Image)

> **Status: zrealizowane.** Grafika z tych promptów została dostarczona
> (22 pliki w `assets/source/`) i wpięta w grę przez `assets/import_art.py`.
> Ten dokument zostaje jako referencja przy **dogenerowywaniu** brakujących
> elementów i przy kolejnych tytułach.

Ten plik zawiera gotowe prompty dla **każdego** pliku graficznego, którego
potrzebuje gra, plus dokładne nazwy plików, rozmiary i formaty.

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
Stylized 2D game art asset for a premium casino slot, in the chunky hand-painted
style of Hearthstone card art and World of Warcraft item icons. A single object,
centered, isolated on a plain solid #FF00FF magenta background.

Exaggerated, chunky, slightly oversized proportions — bold and readable rather
than anatomically correct. Rich saturated colours. Smooth painted gradients with
crisp bright highlights and clean specular hits. A thick dark outline around the
whole silhouette. Key light from the upper left, warm orange rim light from
below as if lit by a forge.

Clean, appealing and game-ready. NOT photorealistic. NOT gritty or grimy. NOT a
3D render. NOT flat vector. NOT cel-shaded anime. No text, no numbers, no logo,
no frame, no border, no ground shadow. Square composition, object fills about
80% of the frame, still reads clearly at 80x80 pixels.
```

**Dlaczego akurat tak:** słowa „concept art", „painterly", „photorealistic",
„weathered", „gritty" pchają model w brudny realizm. „Hearthstone card art",
„WoW item icon", „chunky", „stylized", „saturated" trafiają dokładnie w to, jak
wyglądają symbole u topowych wydawców slotów.

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
| O1 | `sym_O1.png` | `A chunky pentagon-shaped chunk of dark grey rock, cracked open, with big oversized glossy malachite-green crystals bursting out of it. The crystals are the hero — bright, saturated #2fbf6a, glassy, with strong white specular hits. The rock is dull and dark so the crystals pop.` |
| O2 | `sym_O2.png` | `A chunky blocky cube-shaped chunk of dark grey rock, cracked open, with big oversized glossy azurite-blue crystals bursting out of it. The crystals are the hero — bright, saturated #2f7fdf, glassy, with strong white specular hits. The rock is dull and dark so the crystals pop.` |
| O3 | `sym_O3.png` | `A chunky diamond-shaped chunk of dark grey rock, cracked open, with big oversized glossy cinnabar-red crystals bursting out of it. The crystals are the hero — bright, saturated #e0452a, glassy, with strong white specular hits. The rock is dull and dark so the crystals pop.` |
| O4 | `sym_O4.png` | `A chunky hexagonal chunk of dark grey rock, cracked open, with big oversized glossy sulphur-yellow crystals bursting out of it. The crystals are the hero — bright, saturated #c9d423, glassy, with strong white specular hits. The rock is dull and dark so the crystals pop.` |
| O5 | `sym_O5.png` | `A chunky rounded nodule of dark grey rock, cracked open, with big oversized glossy amethyst-violet crystals bursting out of it. The crystals are the hero — bright, saturated #9a4fe0, glassy, with strong white specular hits. The rock is dull and dark so the crystals pop.` |

> **Wskazówka:** wygeneruj całą piątkę jako jeden arkusz 2×3. Prompt:
> *„A contact sheet, 3 columns by 2 rows on a plain magenta background, showing
> five different chunks of raw crystal ore in one consistent painted style: …"*
> i wypunktuj pięć wariantów. Spójność będzie znacznie lepsza.

### 2.2 Relikwie (6 rang — te płacą)

Drabina musi rosnąć **wizualnie**: im wyżej, tym cenniejszy materiał, więcej
zdobienia i mocniejsza własna poświata.

| Ranga | Plik | Zdanie do doklejenia |
|---|---|---|
| I | `sym_BRONZE.png` | `A fat, chunky bronze ingot with softly rounded corners, like a stylized gold bar from a mobile game. Warm brown-gold metal, one broad lit top face, a clean highlight along the top edge. Lowest tier: solid and simple, barely any glow.` |
| II | `sym_IRON.png` | `A chunky blacksmith's hammer with a comically oversized iron head and a short stubby wooden handle — cartoon-heavy proportions. Bright cool steel head with big round rivets and a clean specular streak, warm brown wooden handle with an iron collar.` |
| III | `sym_SILVER.png` | `A bold stylized shield with a thick rounded outline, a wide horizontal gold band across the middle and a big domed round boss in the centre. Bright polished silver with warm gold accents and chunky rivets. Clean and heraldic, not battered.` |
| IV | `sym_GOLD.png` | `A fat ornate golden goblet with a wide round bowl and a flared foot, brimming with glowing molten gold that spills slightly over the rim. Oversized bright gems set into the bowl. Rich saturated gold, strong warm inner glow, glossy highlights.` |
| V | `sym_MYTHRIL.png` | `A stylized magic sword standing point-up, with a broad tapering blade, a chunky straight crossguard, a wrapped grip and an oversized round pommel gem. The blade glows luminous mint-teal #37e0c8 from a bright line down its centre. Clean, heroic, obviously enchanted.` |
| VI | `sym_CROWN.png` | `The Molten Crown: a big chunky five-pointed crown of gold that is still half liquid, with glowing orange molten metal running down between the points and three oversized white-hot gems set into the band. Radiates heat and light. The most spectacular object in the whole set — maximum glow, maximum sparkle.` |

### 2.3 Symbole specjalne

| Rola | Plik | Zdanie do doklejenia |
|---|---|---|
| WILD | `sym_FLUX.png` | `A single big glossy teardrop of magical liquid, floating in mid air, translucent like polished glass, glowing bright cyan-teal #37e0c8 with a white-hot core and a crisp white highlight on its upper left. Clean, jewel-like, clearly magical.` |
| SCATTER | `sym_CINDER.png` | `A blazing four-pointed star of fire with long sharp points and a white-hot core, orange #ff7a18 flame curling off the tips and bright sparks flying. Bold and graphic, the brightest and most eye-catching object in the whole set.` |

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
A stylized 2D game background in the style of a Hearthstone game board or
Diablo Immortal environment art: the inside of a vast underground forge cavern.
Chunky simplified rock forms, bold shapes, saturated colours, clean painted
rendering with crisp highlights — stylized and readable, NOT photorealistic, NOT
gritty. Glowing lava seams cracking across the cavern floor, embers drifting in
the air.

IMPORTANT: no columns, no pillars, no architecture, no props, no characters, no
vignette, no dark corners — this is only the far distance. Keep the centre dark,
empty and low contrast, because the game grid is drawn on top of it. No text.
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
Stylized 2D game architecture in the style of Hearthstone game board framing,
isolated on a plain solid #FF00FF magenta background with nothing else in the
image. Two massive chunky stone columns, one at the far left edge and one at the
far right edge, running the full height of the image, with big carved capitals
and bases and glowing lava seams running down the stone. Between them at the
top, a heavy stone vault arch spanning the width.

Bold simplified forms, saturated colour, clean painted rendering with crisp
highlights and a thick dark outline — stylized, NOT photorealistic, NOT gritty.
Warm orange rim light from below.

THE ENTIRE CENTRE AND LOWER MIDDLE OF THE IMAGE MUST BE COMPLETELY EMPTY
MAGENTA — the game grid goes there. No text, no characters, no props. Square 1:1.
```

Warianty: `_mid` dla `base` chłodny i ciemny, dla `bonus` mocniej podświetlony
od dołu pomarańczem, dla `super` kamień rozgrzany do czerwoności przy podstawie.

### 3.3 Plan bliski — pierwszy plan

```
Stylized 2D game foreground props for a fantasy forge, isolated on a plain solid
#FF00FF magenta background.

Along the BOTTOM EDGE only: a chunky stone floor ledge running the full width
with a glowing molten seam along its top edge, a big cartoon-proportioned anvil
on the left and a fire brazier with glowing coals on the right. In the TOP LEFT
and TOP RIGHT CORNERS only: heavy iron chains hanging down and a hanging iron
lantern.

Everything else in the image must be completely empty magenta. These are dark
foreground shapes, nearly black, lit only by warm orange rim light — bold
simplified silhouettes with thick outlines, stylized, NOT photorealistic. No
text, no characters. Square 1:1.
```

---

## 4. Postać — Kowal (Emberwright)

| Plik | Rozmiar | Format |
|---|---|---|
| `character.png` | 1024×1536 (pion) | PNG z alfą |

```
A full-body stylized game character in the style of Hearthstone hero art or a
Blizzard cinematic character card: a master blacksmith standing at his forge,
seen from the front, isolated on a plain solid #FF00FF magenta background.

An adult man in his fifties with heroic exaggerated proportions — huge broad
shoulders, oversized hands and forearms, a barrel chest tapering to smaller legs.
A big square jaw, a thick grey-streaked beard, heavy brows. A leather apron over
a dark tunic, thick bracers, a wide belt with an oversized buckle. One hand rests
on the handle of a large forge hammer whose head sits on the ground.

Saturated colours, smooth painted shading with crisp bright highlights, a thick
dark outline around the whole figure. Strong warm orange rim light from the forge
on his left side. Confident, imposing, appealing — stylized game art, NOT
photorealistic, NOT gritty realism, NOT chibi, NOT anime. Clearly an adult.

No text, no logo, no ground shadow. Vertical 2:3 composition, the figure fills
the frame from head to feet.
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
A decorative emblem for a stylized fantasy game logo, in the chunky glossy style
of mobile game UI badges, isolated on a plain solid #FF00FF magenta background.

A big chunky forged crown of molten gold at the top centre with liquid metal
dripping from it, flanked by two curling iron scroll ornaments that sweep
outwards and downwards to frame an empty space in the middle.

THE MIDDLE MUST BE COMPLETELY EMPTY — a title will be placed there.

Saturated molten orange #ff7a18 and gold #f2c14e, glowing hot metal, thick dark
outline, crisp specular highlights. Stylized and glossy, NOT photorealistic. No
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
A casino game lobby thumbnail in the chunky stylized style of a mobile game
store icon, square 1:1. A single dramatic hero object dead centre: a big chunky
crown of molten gold, glowing white-hot, with liquid metal running off it,
against a dark cavern with a warm orange glow rising from below.

Bold saturated colours, thick dark outline, crisp highlights, one strong focal
point, very high contrast so it is instantly readable at 200x200 pixels.
Stylized and premium, NOT photorealistic. No text, no letters, no numbers, no
UI, no frame.
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
