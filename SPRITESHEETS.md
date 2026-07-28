# SPRITESHEETS.md — czego dokładnie potrzebuję

> Lista jest **posortowana według wpływu na odbiór**. Jeśli zrobisz tylko punkt
> 1, gra zyska najwięcej; jeśli tylko 1 i 2, będzie wyglądać na skończoną.
> Wszystko poniżej punktu 3 to już dopieszczanie.

---

## Format — te same zasady dla każdego arkusza

| | |
|---|---|
| Plik | **PNG-24 z alfą**, jeden arkusz na animację |
| Układ | **poziomy pas**, klatki od lewej do prawej, **równa szerokość**, bez odstępów, bez marginesu |
| Tło | **w pełni przezroczyste** (alfa 0), nie czarne i nie białe |
| Rozmiar klatki | podany przy każdej pozycji; to rozmiar **kwadratu**, ilustracja może być mniejsza i wyśrodkowana |
| Klatek | podana liczba, **odtwarzane w pętli lub jednorazowo** — zaznaczone przy pozycji |
| Nazewnictwo | dokładnie jak w kolumnie „plik" — kod ładuje po nazwie |
| Gdzie | katalog `assets/` w repo, tak jak poprzednie obrazki |

**Dwie rzeczy, które psują arkusz najczęściej:**
1. **Nierówne klatki.** Kod dzieli szerokość obrazu przez liczbę klatek. Jeśli
   klatki mają różną szerokość albo jest między nimi odstęp, wszystko się
   rozjedzie. Eksportuj z siatki, nie z ręcznego układania.
2. **Ruch poza kwadratem klatki.** Jeśli błysk wychodzi poza obszar klatki,
   zostanie ucięty. Zostaw ~10 % zapasu na krawędziach.

---

## 1. Wygrywające relikwie — **najważniejsze** 🔴

To jest ta rzecz, której brak widać natychmiast obok gier topowych wydawców.
Teraz wygrywający symbol tylko pulsuje skalą — proceduralnie, bez ilustracji.

**6 arkuszy**, po jednym na rangę relikwii:

| plik | symbol | klatek | rozmiar klatki |
|---|---|---|---|
| `sym_bronze_win.png` | Brąz | 12 | 256×256 |
| `sym_iron_win.png` | Żelazo | 12 | 256×256 |
| `sym_silver_win.png` | Srebro | 12 | 256×256 |
| `sym_gold_win.png` | Złoto | 14 | 256×256 |
| `sym_mythril_win.png` | Mithril | 14 | 256×256 |
| `sym_crown_win.png` | Korona | 16 | 256×256 |

**Co ma się dziać w klatkach:** relikwia rozgrzewa się do białości i stygnie —
pętla. Klatka 1 = dokładnie ten sam wygląd co statyczny symbol z atlasu (żeby
przejście było niewidoczne), środek pętli = najjaśniej, ostatnia klatka wraca
do wyglądu klatki 1. **Pętla musi się domykać** — ostatnia klatka sąsiaduje z
pierwszą.

Im wyższa ranga, tym mocniej: brąz ledwie tli, korona bije światłem.

---

## 2. Fuzja — moment połączenia 🔴

Kod rysuje teraz cięciwę światła między komórkami i falę uderzeniową przy
kotwicy — proceduralnie, kołami i liniami. Działa, ale to nadal grafika
wektorowa, nie ilustracja.

| plik | co to | klatek | rozmiar klatki | odtwarzanie |
|---|---|---|---|---|
| `fx_forge_hit.png` | rozbłysk w miejscu kotwicy — iskry, odprysk metalu | 16 | 384×384 | jednorazowo |
| `fx_spark_trail.png` | iskra biegnąca po cięciwie między komórkami | 8 | 96×96 | pętla |

`fx_forge_hit` odpala się w chwili, gdy powstaje nowa relikwia. Ma być
**szerszy niż komórka** (stąd 384) — uderzenie ma wychodzić poza pole.

---

## 3. Scatter (Cinder) i anticipation 🟡

| plik | co to | klatek | rozmiar klatki | odtwarzanie |
|---|---|---|---|---|
| `sym_cinder_idle.png` | Cinder tlący się na planszy | 16 | 256×256 | pętla |
| `sym_cinder_land.png` | Cinder w chwili wylądowania — rozbłysk | 10 | 256×256 | jednorazowo |

Cinder to symbol, który decyduje o wejściu w bonus. Teraz wygląda tak samo, gdy
jest jeden i gdy jest trzeci — a to są dwie zupełnie różne sytuacje dla gracza.

---

## 4. Wejście do bonusu 🟡

| plik | co to | klatek | rozmiar klatki | odtwarzanie |
|---|---|---|---|---|
| `fx_bonus_burst.png` | wybuch wypełniający planszę przy wejściu w bonus | 24 | 512×512 | jednorazowo |

Sekwencja wejścia już jest (plansza wymiata się dołem, pokój się zmienia,
uderza wstrząs) — brakuje jej ilustracji w środku.

---

## 5. Wild (Flux) 🟢

| plik | co to | klatek | rozmiar klatki | odtwarzanie |
|---|---|---|---|---|
| `sym_flux_idle.png` | wild pulsujący na planszy | 16 | 256×256 | pętla |

---

## Czego NIE potrzebuję

- **Ruda (O1–O5)** — ma być martwa. To paliwo, nie nagroda; animowanie jej
  zabrałoby uwagę relikwiom. Statyczne obrazki z atlasu wystarczą.
- **Tła i postać** — są i działają.
- **Ikony paska** — rysowane wektorowo, celowo: mają być ostre w każdej skali.

---

## Jak to trafi do gry

Wrzucasz pliki do `assets/`, mówisz mi, że są, a ja: dopisuję je do
`AssetLoader`, podpinam pod `SymbolSprite` (odtwarzanie klatek + przełączanie
stanu idle/win) i pod `PixiPresenter` w miejscach, gdzie dziś jest efekt
proceduralny. Rozmiar paczki urośnie — przy tych liczbach klatek szacuję
**+1.5–3 MB** po kompresji do WebP, przy obecnych 2.6 MB. To mieści się w
budżecie, ale jeśli okaże się ciasno, pierwsze do cięcia są punkty 4 i 5.

**Jeśli masz zrobić tylko jedną rzecz z tej listy — zrób punkt 1.**
