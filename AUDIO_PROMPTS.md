# AUDIO_PROMPTS.md — prompty do Suno / Udio

## Zasady

**Format, którego potrzebuję:** WAV albo MP3 320. Ja konwertuję na OGG i tnę.

**Wszystko w tej samej tonacji: D-moll (D minor), tempo 100 BPM.** To nie jest
ozdobnik — warstwy muszą dać się nakładać i przechodzić jedna w drugą bez
rozjazdu. Wpisz to w każdy prompt.

**Pętle:** jeśli generator ma opcję „loop" albo „seamless", włącz. Jeśli nie —
daj mi 60–90 sekund, wytnę pętlę sam.

---

## 1. Muzyka bazowa (`bed_base`) 🔴 najważniejsze

> Instrumental loop for a fantasy slot game. **D minor, 100 BPM.**
> Underground dwarven forge: deep anvil hits on the downbeat acting as
> percussion, low tribal drums, a slow bowed cello ostinato, distant bellows
> breathing. Dark, heavy, patient — this plays for hours behind gameplay, so
> it must NOT be catchy or demanding. No vocals, no melody in the foreground,
> no build, no drop. Ends where it starts so it can loop.
> Length 90 seconds.

**To ma być nudne.** Poważnie. Podkład, który gracz zauważa, po godzinie męczy.

---

## 2. Muzyka bonusu (`bed_bonus`) 🔴

> Instrumental loop, **same key D minor, same 100 BPM** as the previous track,
> but this is the bonus round: the forge is running hot. Add a driving
> hammer rhythm, faster drums, a rising brass line, choir pads underneath.
> Urgent and triumphant, still no vocals and no drop. Must feel like the same
> world as the calm forge track, only alive. Loops cleanly. 90 seconds.

---

## 3. Muzyka superbonusu (`bed_super`) 🟡

> Instrumental loop, **D minor, 100 BPM**, same world again. This is the
> highest tier: full orchestra with the dwarven percussion, low brass,
> a choir singing wordless sustained notes, molten metal roaring underneath.
> Enormous, ceremonial, almost menacing. No vocals with words. Loops. 90 s.

---

## 4. Efekty — krótkie, pojedyncze

Generatory muzyki radzą sobie z tym słabo. **Spróbuj najpierw ElevenLabs Sound
Effects** — jest robiony pod krótkie dźwięki, nie pod muzykę.

| plik | prompt | długość |
|---|---|---|
| `sfx_spin` | „a heavy iron lever being pulled, mechanism engaging, single short sound" | 0,5 s |
| `sfx_forge` | „blacksmith hammer striking hot metal on an anvil, single clean strike with a metallic ring" | 0,8 s |
| `sfx_forge_big` | „a huge forge hammer strike, deep impact with a long metallic ring and sparks" | 1,5 s |
| `sfx_heat` | „forge bellows, air rushing into flames, a low whoosh rising" | 1,0 s |
| `sfx_cinder` | „a hot ember cracking and flaring, short bright crackle" | 0,6 s |
| `sfx_retrigger` | „a chain of anvil strikes, three quick hits rising in pitch" | 1,2 s |
| `sting_bonus` | „triumphant brass and anvil fanfare, short, D minor, ending on a held note" | 2,5 s |
| `sting_super` | „huge orchestral and choir fanfare, ceremonial, D minor, short" | 3,5 s |
| `sting_pour` | „molten metal pouring into a mould, a long liquid roar settling into a hiss" | 3,0 s |
| `sting_bigwin` | „rising orchestral and metallic build ending in a bright impact, D minor" | 3,0 s |
| `sting_maxwin` | „the biggest possible fanfare, orchestra, choir and hammers, overwhelming, D minor" | 5,0 s |

---

## 5. Kontrola jakości

Odrzuć i generuj ponownie, jeśli:

- [ ] w podkładzie **jest wokal ze słowami** — nie może być, gra idzie na
      wszystkie rynki
- [ ] podkład ma **wyraźną melodię, która wpada w ucho** — po godzinie to męczy
- [ ] podkład ma **build i drop** — to nie jest utwór, to tło
- [ ] pętla **słyszalnie się zacina** na złączeniu
- [ ] bonus brzmi jak **inna gra** niż baza — ma być ten sam świat, tylko
      gorętszy

---

## 6. Co robisz z plikami

Wrzuć do `assets/raw_audio/` pod nazwami z tabeli (np. `bed_base.wav`).
Ja konwertuję na OGG, wyrównuję głośność, wycinam pętle i podpinam do
`AudioManager` — nazwy plików są dokładnie te, których kod już szuka, więc
podpięcie jest natychmiastowe.

**Zacznij od `bed_base` i `sfx_forge`.** To dwa dźwięki, które gracz słyszy
najczęściej; jeśli te dwa zagrają, reszta jest dopełnianiem.
