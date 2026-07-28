# SPRITESHEET_PROMPTS.md — prompty do generatora obrazów

## 0. Przeczytaj to najpierw — inaczej stracisz godzinę

**Generatory obrazów nie umieją robić spritesheetów.** To nie jest kwestia
lepszego promptu. Trzy rzeczy zawodzą systematycznie:

1. **Nie utrzymają równej siatki klatek.** Poproszony o „pas 12 klatek" model
   narysuje 9 albo 14, o różnych szerokościach, z przypadkowymi odstępami. Mój
   kod dzieli szerokość obrazu przez liczbę klatek — nierówna siatka rozjeżdża
   wszystko.
2. **Nie utrzymają tożsamości obiektu między klatkami.** Ten sam młot w klatce 3
   i 9 będzie miał inny kształt głowicy. W animacji to migocze.
3. **Nie dają prawdziwej przezroczystości.** Nawet proszone o „transparent
   background" oddają biel albo szachownicę wrysowaną w obraz.

**Dlatego robimy inaczej: jedna klatka = jedno zapytanie**, a arkusz składam
ja. To działa, bo każdą klatkę można poprawić osobno, a ja mam już w repo
`assets/import_art.py` — narzędzie, którym wyciąłem tło z poprzednich
obrazków.

**Tło: pełne magenta `#FF00FF`.** Nie białe, nie przezroczyste. Mój skrypt
wycina tło zalewaniem od krawędzi, a magenta nie występuje nigdzie w palecie
tej gry (roztopiona stal, pomarańcz, zimny błękit), więc nic z ilustracji nie
zniknie przez pomyłkę.

---

## 1. Preambuła stylu — WKLEJ JĄ PRZED KAŻDYM PROMPTEM

Bez tego każda klatka będzie w innym stylu. Wklejaj za każdym razem, nawet gdy
prosisz o poprawkę.

> **STYL (nie zmieniaj między obrazami):** stylizowana ilustracja fantasy w
> duchu Hearthstone i World of Warcraft — czytelne, lekko przerysowane bryły,
> grube krawędzie, bogata tekstura malarska. **Nie fotorealizm, nie render 3D,
> nie pixel art.** Malowane cyfrowo, jak karta do gry.
> **Paleta:** roztopiony pomarańcz i bursztyn (#ff8a1e, #ffc46a), gorąca biel
> w najjaśniejszych punktach (#fff0c8), chłodna stal i bazalt w cieniach
> (#3c4a5a, #1d2530).
> **Świat:** podziemna kuźnia krasnoludzka, lawa, kute metale.
> **Kadr:** obiekt pojedynczy, wyśrodkowany, widziany lekko z góry (3/4), w
> całości w kadrze z zapasem ~10 % przy krawędziach.
> **TŁO: jednolita magenta #FF00FF, absolutnie bez cieni, gradientów, winiety
> ani odbić na tle.** Cień obiektu też nie — obiekt ma być wycięty.
> **Format:** kwadrat 1:1.

---

## 2. Relikwie — grupa 1, najważniejsza 🔴

Sześć symboli × 12–16 klatek to dużo. **Nie generuj wszystkich klatek.**
Wygeneruj **4 klatki kluczowe** na symbol, a ja zrobię z nich pętlę — mam
interpolację i tak muszę je i tak przepuścić przez normalizację.

### Sposób pracy (dla każdego z 6 symboli)

**Krok 1 — klatka bazowa.** To ma być *dokładnie ten sam przedmiot*, który już
jest w grze. Jeśli masz pod ręką obecny obrazek symbolu, załącz go i napisz
„odtwórz ten sam przedmiot w powyższym stylu".

> [PREAMBUŁA STYLU]
>
> Przedmiot: **[patrz tabela niżej]**. Stan: **zimny, spoczynkowy** — metal
> ciemny, matowy, tylko delikatny bursztynowy refleks na krawędziach.

**Krok 2 — trzy stany rozgrzania.** Każdy jako osobne zapytanie, w tej samej
rozmowie, z odwołaniem do poprzedniego obrazu:

> [PREAMBUŁA STYLU]
>
> **Ten sam przedmiot, ta sama poza, ten sam kadr, te same proporcje co na
> poprzednim obrazie.** Zmienia się WYŁĄCZNIE temperatura metalu:
> **rozgrzany** — metal świeci głębokim pomarańczem od środka, krawędzie
> jaśniejsze, w powietrzu wokół nikłe iskry.

Potem to samo ze słowem **„rozżarzony do białości"** (najjaśniejszy punkt
pętli: rdzeń biały #fff0c8, wokół korona światła, wyraźne iskry), a na koniec
**„stygnący"** — pośredni między rozżarzonym a zimnym.

**Krok 3 — przyślij mi cztery pliki na symbol**, nazwane
`bronze_1.png … bronze_4.png` (kolejno: zimny, rozgrzany, biały, stygnący).

### Tabela przedmiotów

**NIE OPISUJ przedmiotu słowami — ZAŁĄCZ OBRAZEK.** Symbole leżą w
`assets/reference/` (wycięte z atlasu, już na magentowym tle, więc referencja
wygląda dokładnie tak, jak ma wyglądać wynik).

Pierwsze zapytanie zawsze brzmi: *„to przedmiot z mojej gry — odtwórz go
dokładnie, bez zmian"*. Jeśli już tam wyjdzie inny przedmiot, nie ma sensu
robić trzech kolejnych klatek.

| symbol | plik referencyjny | co to jest |
|---|---|---|
| **Brąz** | `bronze.png` | sztabka metalu |
| **Żelazo** | `iron.png` | młot bojowy z drewnianym trzonkiem |
| **Srebro** | `silver.png` | tarcza ze srebra i złota |
| **Złoto** | `gold.png` | puchar wysadzany klejnotami |
| **Mithril** | `mythril.png` | miecz o zielonkawym ostrzu |
| **Korona** | `crown.png` | korona z roztopionym rdzeniem |

> Pierwsza wersja tego dokumentu opisywała te przedmioty z pamięci i **myliła
> się** — brąz nazwałem pucharem, a puchar to złoto. Opis słowny jest tu
> zbędnym ryzykiem, skoro obrazek istnieje.

> Uwaga: **im wyższa ranga, tym mocniejszy kontrast między klatką 1 a 3.**
> Brąz ledwie się tli, korona ma bić światłem. Napisz to modelowi wprost przy
> koronie: „efekt maksymalnie dramatyczny, przedmiot jest sercem tej gry".

---

## 3. Fuzja 🔴

### `fx_forge_hit` — rozbłysk w miejscu, gdzie powstaje relikwia

Cztery klatki kluczowe, osobne zapytania:

> [PREAMBUŁA STYLU]
>
> Przedmiotu NIE MA — sam efekt. **Uderzenie młota w rozżarzony metal**:
> eksplozja iskier i odprysków rozchodząca się na boki od środka kadru.
> Faza: **[1 zawiązek — mały biały rdzeń / 2 rozkwit — pełna korona iskier,
> najjaśniej / 3 rozrzut — iskry rozlatują się, rdzeń gaśnie / 4 zanik — same
> gasnące punkty]**.
> Efekt ma wypełniać kadr, ale nie dotykać krawędzi.
> Tło magenta #FF00FF.

Pliki: `hit_1.png … hit_4.png`.

### `fx_spark_trail` — iskra biegnąca po cięciwie

**Jedno zapytanie, jedna klatka.** Resztę zrobię obrotem i skalą — to zbyt mały
element, żeby marnować na niego cztery generacje.

> [PREAMBUŁA STYLU]
>
> Pojedyncza **iskra kuźnicza w locie**: rozżarzony biało‑pomarańczowy punkt z
> krótkim, rozmytym ogonem ciągnącym się w lewo. Bardzo mały obiekt na środku
> kadru. Tło magenta #FF00FF.

Plik: `spark.png`.

---

## 4. Cinder — symbol wejścia w bonus 🟡

Cztery klatki, jak przy relikwiach:

> [PREAMBUŁA STYLU]
>
> Załącz `assets/reference/cinder.png`. Przedmiot: **płonąca gwiazda (Cinder)**
> — czteroramienna iskra ognia, dokładnie jak na załączonym obrazku.
> Faza: **[1 przygasły / 2 tlący się / 3 buchający ogniem, najjaśniej /
> 4 opadający]**. Ta sama bryła, ten sam kadr na wszystkich czterech.

Pliki: `cinder_1.png … cinder_4.png`.

---

## 5. Wybuch wejścia w bonus 🟡

> [PREAMBUŁA STYLU]
>
> Sam efekt, bez przedmiotu: **pęknięcie skały, przez które bucha lawa** —
> pionowy słup roztopionego metalu i iskier wystrzeliwujący w górę ze środka
> kadru. Faza: **[1 pierwsze pęknięcie / 2 wyrzut / 3 pełna erupcja,
> najjaśniej / 4 opad]**.
> Kadr kwadratowy, efekt sięga niemal krawędzi. Tło magenta #FF00FF.

Pliki: `burst_1.png … burst_4.png`.

---

## 6. Wild (Flux) 🟢

> [PREAMBUŁA STYLU]
>
> Załącz `assets/reference/flux.png`. Przedmiot: **kropla płynnego mithrilu
> (Flux)** — jak na załączonym obrazku, chłodny turkus z jaśniejszym rdzeniem. Faza: **[1 spokojna / 2 wzburzona / 3 najjaśniejsza, prawie biała /
> 4 uspokajająca się]**.

Pliki: `flux_1.png … flux_4.png`.

---

## 7. Kontrola jakości — sprawdź to, zanim mi przyślesz

Odrzuć klatkę i wygeneruj ponownie, jeśli:

- [ ] **tło nie jest jednolitą magentą** (biel, szachownica, gradient, cień
      pod obiektem) — mój skrypt utnie wtedy albo za dużo, albo za mało
- [ ] **obiekt dotyka krawędzi kadru** — po wycięciu będzie ścięty
- [ ] **przedmiot zmienił kształt** względem klatki 1 tego samego zestawu —
      to migocze w animacji i jest najczęstszy błąd
- [ ] styl zjechał w fotorealizm albo render 3D
- [ ] w kadrze pojawił się drugi obiekt, ramka, podpis albo tekst

**Rozdzielczość:** cokolwiek generator daje natywnie (zwykle 1024×1024) jest
w porządku — skaluję w dół do 256, więc zapas nie szkodzi.

---

## 8. Co robisz z plikami

Wrzuć wszystko do `assets/raw_frames/` w repo (jeden katalog, płasko, nazwy jak
wyżej) i napisz mi, że są. Wtedy ja:

1. przepuszczam je przez `assets/import_art.py` — wycięcie magenty, usunięcie
   otoczki koloru, przycięcie, normalizacja rozmiaru,
2. składam z 4 klatek kluczowych pełną pętlę (12–16 klatek) przez
   interpolację,
3. pakuję w arkusze o równej siatce, dopisuję do `AssetLoader`,
4. podpinam odtwarzanie w `SymbolSprite` i zamieniam efekty proceduralne.

**Zacznij od jednego symbolu — brązu.** Przyślij cztery klatki, ja przepuszczę
je przez pipeline i pokażę, jak wygląda w grze. Jeśli styl gra, robisz resztę;
jeśli nie, poprawiamy prompt na jednym symbolu zamiast na sześciu.
