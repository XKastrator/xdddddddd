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
| Limity autogry (deterministyczne) | `frontend/tests/autoplay_limits.mjs` | 18 |
| Renderer (mobile + desktop + pl) | `frontend/tests/smoke.mjs` | 36 |
| Autogra E2E | `frontend/tests/autoplay.mjs` | 12 |
| Scenariusze serwowania z CDN | `frontend/tests/deploy.mjs` | 12 |
| **Build wydaniowy przeciw atrapie RGS** | `frontend/tests/rgs_e2e.mjs` | 11 |
| Pliki publikacyjne | `math/tools/verify_publish.py` | 4 tryby |

```bash
cd frontend && npm run test:all      # buduje oba warianty i uruchamia wszystko
python3 math/tools/verify_publish.py
```

**89 checków, wszystkie uruchomione.**

`rgs_e2e.mjs` stawia serwer implementujący kontrakt portfela Stake Engine
(`/wallet/authenticate`, `/wallet/play`, `/wallet/end-round`), serwuje
`dist-release/` ze ścieżki w stylu CDN i rozgrywa realne rundy po HTTP.
Książki pochodzą z **opublikowanej biblioteki**, więc klient odtwarza dokładnie
to, co wyśle prawdziwy RGS.

---

## 4. Trzy rzeczy, które psuły wdrożenie (naprawione i objęte testem)

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

## 5. Czego świadomie brakuje

- **Audio nie ma rytmu ani melodii** — drony i akordy z syntezy numpy. To
  najsłabsze ogniwo oprawy i słychać to od razu.
- **Skala symulacji** ~70 tys. sim/tryb. Do certyfikacji zalecane 1M/tryb
  (`python3 math/game/run.py --pub 100000 --val 1000000`).
- **Funkcje produktowe**: historia gry, menu ustawień, suwaki głośności,
  siatka zakładów, quick spin, podsumowanie rundy.
- Atrapa RGS pokrywa `authenticate` / `play` / `end-round` / `ERR_IPB`.
  **Nie** pokrywa wznowienia przerwanej rundy ani błędów sieci.
