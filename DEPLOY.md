# Wgranie na Stake Engine

Dwa osobne wgrania: **klient gry** (frontend) i **pliki matematyczne** (math).

```bash
cd frontend
npm ci
npm run assets          # (raz) atlas, sceny, postać, krój, logo, audio
npm run release         # build wydaniowy + spakowanie obu paczek
```

Wynik w `release/`:

| Plik | Zawartość | Rozmiar |
|---|---|---|
| `molten-crown-frontend.zip` | 35 plików — `index.html` + `assets/` | 2.63 MB spakowane |
| `molten-crown-math.zip` | `index.json`, 4× `lookUpTable_*.csv`, 4× `books_*.jsonl.zst` | 28.66 MB spakowane |

---

## 1. Frontend

Wgraj **zawartość** archiwum, zachowując strukturę katalogów. `index.html` musi
wylądować w katalogu głównym wersji, a nie w podfolderze:

```
index.html
assets/index-*.js        assets/pixi-*.js
assets/atlas.webp        assets/atlas.json
assets/font.png          assets/font.json
assets/character.webp    assets/logo.png       assets/lobby.jpg
assets/scene_{base,bonus,super}.jpg
assets/scene_{base,bonus,super}_{mid,near}.webp
assets/audio/*.ogg       (14 plików)
```

### Build wydaniowy ≠ build deweloperski

`npm run build` produkuje `dist/` z **wbudowanym mockiem RGS** — do testów
lokalnych i do przeglądania gry bez serwera. **Nie wgrywaj `dist/`.**

`npm run build:release` produkuje `dist-release/`, gdzie mock i jego biblioteka
książek (1.3 MB) są usunięte przez martwy kod, a brak `rgs_url` w URL‑u kończy
się jawnym błędem na ekranie zamiast cichej gry na fikcyjnych zakładach.
`tools/package.mjs` **odmawia spakowania** buildu, w którym mock nadal siedzi.

### Parametry uruchomienia

Gra czyta z URL‑a: `sessionID`, `rgs_url`, `lang`, `device`. Żaden z nich nie
jest zaszyty w kodzie. Bez `rgs_url` build wydaniowy nie wystartuje — celowo.

### Diagnostyka

Dopisz `&debug=1` do adresu uruchomienia. W lewym dolnym rogu pojawi się panel
z adresem RGS, `sessionID`, trybem, kwotą zakładu, konfiguracją z
`/wallet/authenticate` i **ostatnim odrzuceniem** (kod, status HTTP, wysłany
tryb i kwota). To pierwsza rzecz, o którą warto poprosić przy zgłoszeniu.

---

## 2. Math

Wgraj cztery tryby z `molten-crown-math.zip`. `index.json` deklaruje koszty:

| Tryb | Koszt | RTP | Hit | P(max win) |
|---|---|---|---|---|
| `base` | 1.00× | 96.50000% | 73.08% | 1 / 500 000 |
| `ante` | 1.25× | 96.50000% | 75.16% | 1 / 333 333 |
| `bonus` | 100× | 96.50000% | 100% | 1 / 33 333 |
| `super` | 500× | 96.49999% | 100% | 1 / 2 000 |

Max win **15 000×**.

Liczby są policzone **z plików wsadowych**, nie z logu symulacji:

```bash
python3 math/tools/verify_publish.py
```

Skrypt czyta `index.json`, każdy `lookUpTable_*.csv` i każdy `books_*.jsonl.zst`
i sprawdza: format wierszy, pokrycie (każdy `simId` ma książkę i odwrotnie),
zgodność `payoutMultiplier` między tabelą a książką, cap 15 000×, obecność
`finalWin` + `roundEnd` w każdej książce oraz RTP na arytmetyce ułamkowej.

> **O tolerancji RTP.** Wagi całkowite nie trafiają w 0.965 dokładnie —
> największe odchylenie to 1.0e‑7 (tryb `super`). Próg akceptacji to 1e‑6,
> czyli 0.0001 punktu procentowego.

---

## 3. Co zostało uruchomione przed wydaniem

| Zestaw | Plik | Checków |
|---|---|---|
| Parametry uruchomienia + drabina zakładów | `frontend/tests/params.mjs` | 20 |
| **Prawdziwe kliknięcia w kontrolki w canvasie** | `frontend/tests/click.mjs` | 12 |
| Limity autogry (deterministyczne) | `frontend/tests/autoplay_limits.mjs` | 18 |
| Strażnik wydajności (deterministyczny) | `frontend/tests/perfguard.mjs` | 25 |
| Renderer (mobile + desktop + pl) | `frontend/tests/smoke.mjs` | 36 |
| Autogra E2E | `frontend/tests/autoplay.mjs` | 12 |
| Scenariusze serwowania z CDN | `frontend/tests/deploy.mjs` | 12 |
| **Build wydaniowy przeciw atrapie RGS** | `frontend/tests/rgs_e2e.mjs` | 50 |
| Pliki publikacyjne | `math/tools/verify_publish.py` | 4 tryby |

```bash
cd frontend && npm run test:all      # buduje oba warianty i uruchamia wszystko
python3 math/tools/verify_publish.py
```

**184 checki, wszystkie uruchomione** (`EXIT=0`, zero linii `FAIL`).

`rgs_e2e.mjs` stawia serwer implementujący kontrakt portfela Stake Engine
(`/wallet/authenticate`, `/wallet/play`, `/wallet/end-round`), serwuje
`dist-release/` ze ścieżki w stylu CDN i rozgrywa realne rundy po HTTP.
Książki pochodzą z **opublikowanej biblioteki**, więc klient odtwarza dokładnie
to, co wyśle prawdziwy RGS.

---

## 4. Dziesięć rzeczy, które psuły wdrożenie (naprawione i objęte testem)

-6. **Zablokowana runda — gra odmawiała KAŻDEGO zakładu.** Serwer odpowiadał na
   każde `/wallet/play`: `{"error":"ERR_VAL","message":"player has active
   round"}`. Wznowienie rundy na starcie było, ale zapięte na
   `auth.round.active === true` — a żywy RGS tego klucza nie wysyła, więc
   wznowienie nie odpalało nigdy i runda zostawała otwarta na zawsze: dla tego
   gracza, po każdym przeładowaniu, bez wyjścia od strony gry.

   Dwie naprawy, bo jedna zgaduje kształt ładunku, a już raz to zawiodło:
   (a) otwartą rundę rozpoznajemy **po kształcie** — `active`, `completed:
   false`, `status: "ACTIVE"` i pokrewne, zamiast jednej pisowni;
   (b) niezależnie od tego, gdy `/wallet/play` odmawia z powodu otwartej rundy,
   klient **zamyka ją i ponawia zakład raz** — to działa bez względu na to, jak
   serwer opisuje rundę w `authenticate`.

   Bezpieczne pieniężnie tą samą regułą co drabina trybów: odmowa walidacyjna
   następuje przed pobraniem, więc ponowienie jest pierwszym zakładem, nie
   drugim obciążeniem.

   Przy okazji: drabina trybów przepalała wszystkie trzy szczeble na tym błędzie
   (`base`, `BASE`, brak pola → mylące `"invalid amount"`), choć z pisownią
   trybu nie miał on nic wspólnego. Teraz oddaje go od razu wywołującemu.

   **Atrapa RGS też była winna** — zwracała `round: {active: true, book}`, czyli
   dokładnie to, czego kod szukał, więc test przechodził, nie testując niczego.
   Ma teraz trzy dialekty (`active` / `status` / `silent`) i odmowę słowo w słowo
   jak żywy serwer. Bez poprawki nowe scenariusze są **czerwone**: `modes=base,
   BASE,<none>`, `$1000.00 -> $1000.00`, zero `end-round` — czyli konsola gracza
   co do znaku.

-5. **Książka rundy leży nie tam, gdzie zakładałem.** Dokumentacja opisuje
   endpointy portfela precyzyjnie, ale ładunek rundy podaje jako
   `"round": { ... }` — z pominięciem środka. `round.book` było zgadywaniem i
   dawało `cannot read properties of undefined (reading 'events')` **już po
   pobraniu zakładu**. Klient szuka teraz książki **po kształcie**: to obiekt z
   tablicą `events`, a nic innego w odpowiedzi portfela tak nie wygląda.
   Działa dla `round.book`, `round.state`, samego `round` i głębszych
   zagnieżdżeń — cztery scenariusze w `rgs_e2e.mjs`. Gdy książki nie ma wcale,
   komunikat podaje **faktyczny kształt odpowiedzi**.

-4. **Kwoty przycinane do 32 bitów.** Granice zakładu czytałem przez
   `cfg.minBet | 0`. To obcięcie do 32-bitowego inta, a pieniądze w RGS to
   liczby całkowite z **sześcioma** miejscami po przecinku — `maxBet` = 10 000 $
   to `10_000_000_000` i się zawija. Zakład lądował poza `minBet..maxBet` albo
   poza siatką `stepBet`, a `/wallet/play` odpowiadał `ERR_VAL`. Atrapa używała
   `maxBet` = 100 $, co mieści się w 32 bitach — czyli potwierdzała przypadek,
   który i tak działał.

-3. **Nazwa trybu: `base` czy `BASE`?** Math SDK nazywa tryby małymi literami
   (`name="base"`), a przykład żądania `/wallet/play` w dokumentacji RGS wysyła
   `"mode": "BASE"`. Zamiast zgadywać, klient wysyła nazwę tak, jak jest w
   konfiguracji, a **jeśli RGS odrzuci ją błędem walidacji — ponawia raz
   wielkimi literami** i zapamiętuje działający wariant na całą sesję.
   To nie może obciążyć dwa razy: odrzucenie walidacyjne oznacza, że zakład nie
   został przyjęty, więc nie było obciążenia. Każdy inny błąd (saldo, sesja,
   sieć) jest przepuszczany dalej bez ponawiania — tamte mogły ruszyć pieniądze.

-2. **Nieukończona runda blokowała grę na stałe.** Specyfikacja RGS mówi wprost:
   *„Frontends should continue the round if it remains active"*. `app.ts` tego
   nie robił. Dopóki runda jest otwarta, RGS **odrzuca nowe zakłady** — więc
   jedna przerwana runda sprawiała, że SPIN nie robi nic, na zawsze, także po
   przeładowaniu, bez żadnego wyjścia z poziomu gry. Gra odtwarza teraz otwartą
   książkę przy starcie i domyka rundę. Sprawdzone, że bez tej poprawki test
   pokazuje dokładnie ten objaw: `$1000.00 -> $1000.00`.

-1. **`betLevels` jest opcjonalne.** Specyfikacja: *„bet levels are not
   mandatory"* — obowiązkowe jest tylko, żeby zakład mieścił się w
   `minBet..maxBet` i dzielił przez `stepBet`. Kod czytał tablicę wprost i
   przesuwał zakład po indeksach, co przy legalnym RGS bez `betLevels` wywracało
   start, a przy krokach mogło zejść z siatki `stepBet` → `/wallet/play`
   odrzuca zakład. `rgs/betLevels.ts` wyprowadza drabinę z `min/max/step`,
   gdy jej nie ma, i przycina każdy zakład do siatki.

0. **`rgs_url` bez schematu → HTTP 405 na starcie.** Parametr przychodzi jako
   sam host (`rgs.example.com`), bez `https://`. Użyty wprost sprawiał, że
   `fetch('rgs.example.com/wallet/authenticate')` był adresem **względnym** —
   przeglądarka rozwiązywała go względem strony, POST trafiał w **statyczny
   host, z którego serwowana jest gra**, a ten na POST odpowiada
   `405 Method Not Allowed`. Komunikat brzmiał `RGS ERR_GEN (405)`, więc
   wyglądało to na zepsute API, a nie na zepsutą ścieżkę.
   `normalizeRgsUrl()` doklejaja protokół strony, obsługuje `//host`, ucina
   końcowe ukośniki i waliduje przez `new URL`. `RgsClient` **odrzuca**
   nieabsolutną bazę w konstruktorze, a każdy błąd RGS niesie teraz URL
   żądania — przy 405 wprost z podpowiedzią, że to statyczny host.
   Pokryte: `tests/params.mjs` (14 checków) + scenariusz `schemeless rgs_url`
   w `tests/rgs_e2e.mjs`. Sprawdzone, że bez poprawki test **jest czerwony**.

1. **Ścieżka bez ukośnika na końcu.** Stake Engine serwuje z
   `.../{gameID}/{version}/`, ale URL bywa żądany bez `/`. Przeglądarka
   rozwiązywała wtedy `./assets/index.js` względem katalogu **nadrzędnego** —
   sam bundle dawał 404, JS nigdy się nie uruchamiał i zostawał czarny ekran
   **bez żadnego błędu**, bo nie było czego zgłosić. `index.html` ustawia teraz
   `<base>`. Test „czy to plik" sprawdza wyłącznie `.html`: ogólne „czy jest
   kropka" błędnie klasyfikuje folder wersji `1.0.0` jako plik.
2. **Brakujące assety przerywały start.** Atlas jest teraz opcjonalny —
   `SymbolSprite` ma fallback proceduralny, więc gra startuje i jest grywalna
   nawet przy 404 na całej grafice. Objęte scenariuszem `all artwork 404s`.
3. **Build zawsze używał mocka.** Rozdzielone na `build` i `build:release`,
   z blokadą w pakowaniu.
4. **Błędy były niewidoczne.** Status szedł do paska DOM pod canvasem, którego
   w ramce operatora praktycznie nie widać — nieudana runda wyglądała
   identycznie jak martwy przycisk. Komunikaty rysują się teraz **na canvasie**
   (`render/Toast.ts`), a wersja DOM zostaje dla czytników ekranu.
5. **„Round failed" nic nie mówiło.** Ogólne zdanie było bezużyteczne dla obu
   stron: gracz ponawia w nieskończoność, a wsparcie nie ma się czego chwycić.
   Komunikat zawiera teraz **kod RGS i status HTTP** (np. `ERR_VAL (400)`), a
   `?debug=1` pokazuje panel z adresem RGS, trybem, kwotą, konfiguracją zakładów
   i ostatnim odrzuceniem — do sfotografowania, bez devtools.
6. **Kliknięcia nie były testowane.** Wszystkie testy klikały przez
   `window.__ui`, czyli wołały te same callbacki co przyciski — co nie
   sprawdzało *w ogóle*, czy da się w nie kliknąć. Kontrolki są rysowane w
   canvasie, więc zależą wyłącznie od hit-testingu PixiJS. `tests/click.mjs`
   klika teraz w realnych współrzędnych ekranowych (desktop + mobile).

## 5. Czego świadomie brakuje

- **Audio nie ma rytmu ani melodii** — drony i akordy z syntezy numpy. To
  najsłabsze ogniwo oprawy i słychać to od razu.
- **Skala symulacji** ~70 tys. sim/tryb. Do certyfikacji zalecane 1M/tryb
  (`python3 math/game/run.py --pub 100000 --val 1000000`).
- **Funkcje produktowe**: historia gry, menu ustawień, suwaki głośności,
  siatka zakładów, quick spin, podsumowanie rundy.
- Atrapa RGS pokrywa `authenticate` / `play` / `end-round` / `ERR_IPB`,
  wznowienie przerwanej rundy, brak `betLevels` oraz `rgs_url` bez schematu.
  **Nie** pokrywa błędów sieci ani wygaśnięcia sesji w trakcie rundy.
