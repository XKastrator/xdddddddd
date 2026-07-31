# AUDIT.md — surowa ocena, bez owijania

> Prosiłeś o surową. Jest surowa. **[FAKT]** = zweryfikowane źródłem, które
> podaję · **[WNIOSEK]** = moja ocena.

---

## 1. Odpowiedź w jednym zdaniu

**Nie przegrywamy na „dopieszczeniu animacji". Przegrywamy o dwie generacje
technologii, i żadna liczba poprawek w moim kodzie tego nie nadrobi.**

---

## 2. Co robią topowi — zweryfikowane, nie z pamięci

**[FAKT] Hacksaw Gaming ma publiczne repozytoria na GitHubie
([HacksawStudios](https://github.com/HacksawStudios)) i widać w nich cały stos
produkcyjny:**

| repo | co to znaczy |
|---|---|
| `spine-runtimes` (fork), `spine-hx` | **animacja szkieletowa Spine** |
| `heaps` / `heaps2` | własny framework gry (Haxe), nie gotowa biblioteka |
| `basisu` | **kompresja tekstur GPU** (Basis Universal) |
| `msdf-bmfont-xml` | **fonty MSDF** — ostre w każdej skali |
| `GASM` | architektura ECS |
| `mozjpeg`, `optipng`, `imagemin` | własny pipeline optymalizacji obrazów |

**[FAKT] Spine jest standardem branżowym w iGamingu.** Zamiast animacji
klatka-po-klatce używa szkieletu, co daje „bogate, elastyczne animacje symboli
daleko wykraczające poza układy sprite'owe — deformacje, dynamiczne podmiany
części, warstwy", przy lżejszych plikach.
([PaintPool](https://paintpoolstudio.com/blog/spine-animation-slot-games/),
[Gamix Labs](https://gamixlabs.com/blog/creating-symbol-animations-in-spine-for-slot-games/))

**[FAKT] Stake Engine hostuje studia bardzo różnej wielkości** — Twist Gaming,
Titan Gaming, Massive Studios, Paperclip Gaming (Scroll Keeper: ponad milion
zakładów w tygodniu premiery), 18 Gaming, Mirror Image, MadLab, Rubber Duck —
**oraz gry generowane przez AI (SlotGPT)**.
([Stake Engine](https://stake.com/casino/group/stake-engine),
[Area 51 Central](https://area51central.com/best-stake-engine-studios-ranked-for-distinctive-slot-mechanics/))

---

## 3. Porównanie, bez litości

| | topowe studio | **my** |
|---|---|---|
| Animacja symbolu | **szkielet Spine** — kości, deformacja siatki, warstwy ruszające się niezależnie, ruch wtórny (fizyka) | **flipbook 12 klatek** złożony z 4 obrazków z generatora |
| Kto to robi | zatrudniony animator, ręcznie wyczasowane klatki | ja, interpolacją liniową między czterema pozycjami |
| Symbol w spoczynku | oddycha, drga, ma życie własne | skala × alfa, sinus |
| Tekstury | kompresja GPU (Basis) — mniej RAM, szybsze ładowanie | PNG/WebP dekodowane do pamięci |
| Typografia | MSDF, ostra w każdej skali | bitmapowy atlas glifów |
| Silnik | własny framework + ECS | PixiJS + tweeny |
| Audio | kompozytor, warstwy, stemy | **synteza numpy: drony i akordy** |

**[WNIOSEK]** Ta tabela to nie lista rzeczy do poprawienia. To lista rzeczy,
których **nie da się zrobić kodem**. Możesz mi kazać poprawiać tweeny jeszcze
dziesięć razy i symbol dalej będzie płaskim obrazkiem, który się skaluje —
bo to jest płaski obrazek, który się skaluje.

---

## 4. Gdzie konkretnie to widać w naszej grze

Uczciwie, po kolei:

1. **🔴 Symbole nie mają animacji, mają efekty.** Brąz dostał 12-klatkową pętlę
   rozgrzewania — i to jest górna granica tej metody. Cztery obrazki z
   generatora zinterpolowane liniowo dają płynne przejście koloru, ale **nic
   się nie porusza**: sztabka nie drga, nie odkształca się, nie ma części,
   które żyją osobno. Animator w Spine zrobiłby z tej samej sztabki bicie
   metalu, drganie krawędzi i iskry wylatujące po torze.

2. **🔴 Audio to najsłabsze ogniwo i nie jest problemem graficznym.** Drony i
   akordy z numpy. Żadnego rytmu, żadnego tematu, żadnego narastania. **To
   słychać w pierwszej sekundzie** i psuje wszystko, co widać. Jednocześnie
   jest to jedyna pozycja z tej listy, gdzie da się skoczyć o klasę bez
   animatora — potrzebny kompozytor albo licencjonowana biblioteka.

3. **🟡 Brak kamery.** Topowe sloty ruszają całą sceną: dojazd na wielkiej
   wygranej, odjazd przy wejściu w bonus, przechył przy uderzeniu. U nas scena
   stoi, rusza się tylko zawartość planszy.

4. **🟡 Prezentacja wygranej nie eskaluje.** Mamy tiery i baner, ale każda
   wygrana wygląda w zasadzie tak samo — brakuje narastania: dłuższe zliczanie,
   zmiana muzyki, zatrzymanie kadru, dopiero potem liczba.

5. **🟡 Postać jest dekoracją.** Krasnolud stoi z boku i macha młotem przy
   fuzji. W dobrych grach postać reaguje na to, co się dzieje — na przegraną,
   na wielką wygraną, na wejście w bonus.

6. **🟢 Plansza i kaskada są OK.** Wejście symboli kolumnami, wstrzymanie
   przy dwóch scatterach, kaskada zza ramy, łańcuch fuzji — to zrobione i to
   działa. **Tu już nie ma dużo do ugrania.**

---

## 5. Co z tym zrobić — trzy uczciwe opcje

### A. Zatrudnić animatora i przejść na Spine
Jedyna droga do „konkurujemy z Hacksaw". Koszt realny, nie kodowy. Ja mogę
podpiąć runtime Spine do PixiJS (jest oficjalny) i przygotować kontrakt, ale
**assetów nie wyprodukuję** — Spine to program, w którym człowiek riguje i
klatkuje ręcznie.

### B. Zmienić kierunek artystyczny na taki, który nie wymaga animatora
Sloty o czystej, minimalistycznej oprawie (geometria, mocny kolor, typografia)
wyglądają na skończone bez armii animatorów, bo **nie obiecują** ilustracji,
która ma ożyć. Obecny kierunek — malowane relikwie w stylu Hearthstone —
obiecuje dokładnie to i dlatego przegrywa porównanie.

### C. Zostawić grafikę i wydać budżet na audio + kamerę
Najlepszy stosunek efektu do kosztu. Muzyka z rytmem i tematem plus ruch kamery
podniosą odbiór bardziej niż kolejne dziesięć poprawek w tweenach — a obie
rzeczy są w zasięgu bez animatora.

**[WNIOSEK] Moja rekomendacja: C, a potem A jeśli gra ma realnie iść na rynek.**
B tylko jeśli chcesz szybko mieć coś spójnego i skończonego.

---

## 6. Czego NIE powiem

Nie powiem, że „jeszcze kilka poprawek i będzie jak u topowych". Nie będzie.
Poprawiałem te animacje przez ostatnie kilka rund i za każdym razem mówiłeś, że
to nadal żenada — **i miałeś rację**, bo poprawiałem rzecz, która nie jest
wąskim gardłem. Wąskim gardłem jest to, że nie mamy animatora, kompozytora ani
silnika napisanego pod ten jeden cel, a oni mają wszystkie trzy.

To, co mamy, jest solidne jako **fundament**: matematyka z dokładnym RTP,
działająca integracja z RGS, strażnik wydajności, 190 przechodzących testów.
To jest ta część, której studio nie kupi za pieniądze w tydzień. Oprawa to ta
część, którą kupi.
