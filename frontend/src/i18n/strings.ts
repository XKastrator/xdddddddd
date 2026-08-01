/**
 * Localization. The RGS passes `lang` (ISO 639-1) in the launch URL; supported
 * codes are listed in the RGS docs. Every player-facing string lives here — no
 * text is baked into artwork. `en` is the fallback for any missing key.
 *
 * Three locales ship as a working demonstration (en/pl/de); the remaining RGS
 * languages drop in as further dictionaries with no code changes.
 */
export type Dict = Record<string, string>;

const en: Dict = {
  'ui.spin': 'SPIN', 'ui.skip': 'SKIP', 'ui.turbo': 'TURBO', 'ui.help': 'HELP',
  'ui.close': 'Close', 'ui.cancel': 'Cancel', 'ui.confirm': 'Confirm',
  'ui.balance': 'BALANCE', 'ui.betcost': 'BET COST', 'ui.bet': 'Bet',
  'ui.reduced': 'Reduced motion', 'ui.loading': 'Heating the forge…',
  'ui.total': 'TOTAL', 'ui.win': 'WIN', 'ui.heat': 'HEAT', 'ui.vault': 'VAULT',
  'ui.mode': 'MODE', 'ui.auto': 'AUTO',

  'err.balance': 'Insufficient balance for this bet mode.',
  'err.round': 'Round failed. Please try again.',
  'err.resume': 'Finishing your previous round…',

  'auto.title': 'Autoplay',
  'auto.intro': 'Autoplay places the same bet repeatedly. Every round stays independent and random — the limits below only decide when the sequence stops.',
  'auto.rounds': 'Number of rounds',
  'auto.loss': 'Stop after losing',
  'auto.singlewin': 'Stop on a single win of',
  'auto.nolimit': 'No limit',
  'auto.stopbonus': 'Stop when a feature is triggered',
  'auto.note': 'You can stop autoplay at any time with the stop button. Stopping takes effect after the current round finishes.',
  'auto.start': 'Start autoplay',
  'auto.stop.completed': 'Autoplay finished.',
  'auto.stop.user': 'Autoplay stopped.',
  'auto.stop.bonus': 'Autoplay stopped: feature triggered.',
  'auto.stop.loss-limit': 'Autoplay stopped: loss limit reached.',
  'auto.stop.single-win': 'Autoplay stopped: single win limit reached.',
  'auto.stop.error': 'Autoplay stopped: the round could not be played.',

  'mode.base': 'Base Game', 'mode.base.desc': 'Fuse ore into relics. 3+ Cinders trigger Forge Fury.',
  'mode.ante': 'Stoked', 'mode.ante.desc': 'More Cinders and a hotter start — roughly double the trigger rate.',
  'mode.bonus': 'Buy Forge Fury', 'mode.bonus.desc': 'Guaranteed free spins where Heat never resets between spins.',
  'mode.super': 'Buy Molten Core', 'mode.super.desc': 'Board starts pre-seeded, relics lock into the Vault, and the round ends in one Pour.',

  'sym.ore': 'Raw Ore', 'sym.bronze': 'Bronze', 'sym.iron': 'Iron', 'sym.silver': 'Silver',
  'sym.gold': 'Gold', 'sym.mythril': 'Mythril', 'sym.crown': 'Molten Crown',
  'sym.flux': 'Flux (Wild)', 'sym.cinder': 'Cinder (Scatter)',

  'buy.short.bonus': '10 free spins · Heat never resets',
  'buy.short.super': 'Pre-seeded board · one big Pour',
  'buy.pick': 'Choose a feature',
  'buy.title': 'Confirm purchase', 'buy.cost': 'Cost', 'buy.rtp': 'RTP', 'buy.maxwin': 'Max win',
  'buy.random': 'Every round is random and independent of previous results.',

  'help.title': 'How to play',
  'help.core': 'Ore forms VEINS. A vein pays only when it connects the SEAM (the top row) to the CRUCIBLE (the bottom row) — nothing else pays. The more COLUMNS a vein crosses on the way down, the more it is worth.',
  'help.pay': 'A vein\'s value is set by the columns it crosses, plus a bonus for every cell beyond the shortest possible run, and the whole thing is multiplied by Heat. A spin with no connecting vein pays nothing.',
  'help.heat': 'Heat starts at ×1. In the base game it rises by +1 per vein and resets each spin. In Forge Fury it rises by the vein\'s COLUMN COUNT and carries across every spin of the round, so late veins pay far more than early ones.',
  'help.ladder': 'Columns crossed', 'help.value': 'Value (× bet, before Heat)',
  'help.symbol': 'Symbol',
  'help.special': 'Special symbols',
  'help.flux': 'Substitutes for any ore, so it can bridge a gap in a vein. One Flux may be shared by several veins at once. Pays nothing on its own.',
  'help.cinder': '3 / 4 / 5 Cinders award 10 / 12 / 14 Forge Fury spins. 3+ during the bonus adds 4 more.',
  'help.bonus': 'Forge Fury (bonus)',
  'help.bonus.desc': 'Free spins on a denser board, where Heat rises by each vein\'s column count and never resets — this is where the biggest wins live.',
  'help.super': 'Molten Core (super bonus)',
  'help.super.desc': 'Veins do not pay per spin: each one is banked into the Vault at its base value. The round ends with a single Pour worth Vault × Heat.',
  'help.modes': 'Bet modes', 'help.mode': 'Mode', 'help.cost': 'Cost',
  'help.rg': 'Responsible gaming',
  'help.rg.desc': 'Every spin is independent and random. There is no progression between bets and no jackpot. Set limits and play responsibly. 18+.',
};

const pl: Dict = {
  'ui.spin': 'ZAKRĘĆ', 'ui.skip': 'POMIŃ', 'ui.turbo': 'TURBO', 'ui.help': 'POMOC',
  'ui.close': 'Zamknij', 'ui.cancel': 'Anuluj', 'ui.confirm': 'Potwierdź',
  'ui.balance': 'SALDO', 'ui.betcost': 'KOSZT', 'ui.bet': 'Zakład',
  'ui.reduced': 'Ogranicz animacje', 'ui.loading': 'Rozgrzewanie kuźni…',
  'ui.total': 'ŁĄCZNIE', 'ui.win': 'WYGRANA', 'ui.heat': 'ŻAR', 'ui.vault': 'SKARBIEC',
  'ui.mode': 'TRYB', 'ui.auto': 'AUTO',

  'err.balance': 'Niewystarczające saldo dla tego trybu.',
  'err.round': 'Runda nie powiodła się. Spróbuj ponownie.',
  'err.resume': 'Kończę poprzednią rundę…',

  'auto.title': 'Autogra',
  'auto.intro': 'Autogra stawia ten sam zakład wielokrotnie. Każda runda pozostaje niezależna i losowa — poniższe limity decydują wyłącznie o tym, kiedy sekwencja się zatrzyma.',
  'auto.rounds': 'Liczba rund',
  'auto.loss': 'Zatrzymaj po stracie',
  'auto.singlewin': 'Zatrzymaj przy pojedynczej wygranej',
  'auto.nolimit': 'Bez limitu',
  'auto.stopbonus': 'Zatrzymaj po uruchomieniu funkcji',
  'auto.note': 'Autogrę możesz zatrzymać w dowolnym momencie przyciskiem stop. Zatrzymanie działa po zakończeniu bieżącej rundy.',
  'auto.start': 'Uruchom autogrę',
  'auto.stop.completed': 'Autogra zakończona.',
  'auto.stop.user': 'Autogra zatrzymana.',
  'auto.stop.bonus': 'Autogra zatrzymana: uruchomiono funkcję.',
  'auto.stop.loss-limit': 'Autogra zatrzymana: osiągnięto limit straty.',
  'auto.stop.single-win': 'Autogra zatrzymana: osiągnięto limit pojedynczej wygranej.',
  'auto.stop.error': 'Autogra zatrzymana: nie udało się rozegrać rundy.',

  'mode.base': 'Gra podstawowa', 'mode.base.desc': 'Łącz rudę w relikwie. 3+ Żagwie uruchamiają Furię Kuźni.',
  'mode.ante': 'Rozżarzony', 'mode.ante.desc': 'Więcej Żagwi i gorętszy start — około dwukrotnie częstszy bonus.',
  'mode.bonus': 'Kup Furię Kuźni', 'mode.bonus.desc': 'Gwarantowane darmowe spiny, w których Żar nie resetuje się między spinami.',
  'mode.super': 'Kup Roztopiony Rdzeń', 'mode.super.desc': 'Plansza startuje wyżej, relikwie trafiają do Skarbca, a runda kończy się jednym Wylewem.',

  'sym.ore': 'Surowa ruda', 'sym.bronze': 'Brąz', 'sym.iron': 'Żelazo', 'sym.silver': 'Srebro',
  'sym.gold': 'Złoto', 'sym.mythril': 'Mithril', 'sym.crown': 'Roztopiona Korona',
  'sym.flux': 'Topnik (Wild)', 'sym.cinder': 'Żagiew (Scatter)',

  'buy.short.bonus': '10 darmowych spinów · Żar się nie resetuje',
  'buy.short.super': 'Wyższy start planszy · jeden duży Wylew',
  'buy.pick': 'Wybierz funkcję',
  'buy.title': 'Potwierdź zakup', 'buy.cost': 'Koszt', 'buy.rtp': 'RTP', 'buy.maxwin': 'Maks. wygrana',
  'buy.random': 'Każda runda jest losowa i niezależna od poprzednich wyników.',

  'help.title': 'Jak grać',
  'help.core': 'Ruda tworzy ŻYŁY. Żyła płaci wyłącznie wtedy, gdy łączy PRZODEK (górny rząd) z TYGLEM (dolny rząd) — nic innego nie płaci. Im więcej KOLUMN przetnie po drodze, tym więcej jest warta.',
  'help.pay': 'Wartość żyły wyznacza liczba przeciętych kolumn plus dodatek za każde pole ponad najkrótszą możliwą żyłę, a całość mnoży Żar. Spin bez połączonej żyły nie płaci nic.',
  'help.heat': 'Żar startuje od ×1. W grze podstawowej rośnie o +1 za żyłę i resetuje się co spin. W Furii Kuźni rośnie o LICZBĘ KOLUMN żyły i przechodzi przez całą rundę, więc późne żyły płacą znacznie więcej niż wczesne.',
  'help.ladder': 'Przecięte kolumny', 'help.value': 'Wartość (× zakład, przed Żarem)',
  'help.symbol': 'Symbol',
  'help.special': 'Symbole specjalne',
  'help.flux': 'Zastępuje dowolną rudę, więc potrafi przerzucić mostek przez dziurę w żyle. Jeden Flux może obsłużyć kilka żył naraz. Sam nie płaci.',
  'help.cinder': '3 / 4 / 5 Żagwi daje 10 / 12 / 14 spinów Furii Kuźni. 3+ w bonusie dodaje kolejne 4.',
  'help.bonus': 'Furia Kuźni (bonus)',
  'help.bonus.desc': 'Darmowe spiny na gęstszej planszy, gdzie Żar rośnie o liczbę kolumn każdej żyły i nigdy się nie resetuje — tu mieszkają największe wygrane.',
  'help.super': 'Roztopiony Rdzeń (superbonus)',
  'help.super.desc': 'Żyły nie płacą co spin: każda trafia do Skarbca po wartości bazowej. Runda kończy się jednym Wylewem wartym Skarbiec × Żar.',
  'help.modes': 'Tryby zakładu', 'help.mode': 'Tryb', 'help.cost': 'Koszt',
  'help.rg': 'Odpowiedzialna gra',
  'help.rg.desc': 'Każdy spin jest niezależny i losowy. Nie ma progresji między zakładami ani jackpota. Ustaw limity i graj odpowiedzialnie. 18+.',
};

const de: Dict = {
  'ui.spin': 'DREHEN', 'ui.skip': 'ÜBERSPRINGEN', 'ui.turbo': 'TURBO', 'ui.help': 'HILFE',
  'ui.close': 'Schließen', 'ui.cancel': 'Abbrechen', 'ui.confirm': 'Bestätigen',
  'ui.balance': 'GUTHABEN', 'ui.betcost': 'EINSATZ', 'ui.bet': 'Einsatz',
  'ui.reduced': 'Weniger Animation', 'ui.loading': 'Die Schmiede heizt auf…',
  'ui.total': 'GESAMT', 'ui.win': 'GEWINN', 'ui.heat': 'HITZE', 'ui.vault': 'TRESOR',
  'ui.mode': 'MODUS', 'ui.auto': 'AUTO',

  'err.balance': 'Nicht genügend Guthaben für diesen Modus.',
  'err.round': 'Runde fehlgeschlagen. Bitte erneut versuchen.',
  'err.resume': 'Vorherige Runde wird beendet…',

  'auto.title': 'Autospiel',
  'auto.intro': 'Das Autospiel setzt denselben Einsatz wiederholt. Jede Runde bleibt unabhängig und zufällig — die Limits unten legen nur fest, wann die Serie endet.',
  'auto.rounds': 'Anzahl der Runden',
  'auto.loss': 'Stoppen nach Verlust von',
  'auto.singlewin': 'Stoppen bei Einzelgewinn von',
  'auto.nolimit': 'Kein Limit',
  'auto.stopbonus': 'Stoppen, wenn ein Feature ausgelöst wird',
  'auto.note': 'Du kannst das Autospiel jederzeit mit der Stopp-Taste beenden. Der Stopp greift nach Ende der laufenden Runde.',
  'auto.start': 'Autospiel starten',
  'auto.stop.completed': 'Autospiel beendet.',
  'auto.stop.user': 'Autospiel gestoppt.',
  'auto.stop.bonus': 'Autospiel gestoppt: Feature ausgelöst.',
  'auto.stop.loss-limit': 'Autospiel gestoppt: Verlustlimit erreicht.',
  'auto.stop.single-win': 'Autospiel gestoppt: Einzelgewinnlimit erreicht.',
  'auto.stop.error': 'Autospiel gestoppt: Die Runde konnte nicht gespielt werden.',

  'mode.base': 'Basisspiel', 'mode.base.desc': 'Verschmilz Erz zu Relikten. 3+ Glut löst Forge Fury aus.',
  'mode.ante': 'Angefacht', 'mode.ante.desc': 'Mehr Glut und heißerer Start — etwa doppelte Auslöserate.',
  'mode.bonus': 'Forge Fury kaufen', 'mode.bonus.desc': 'Garantierte Freispiele, bei denen die Hitze zwischen den Spins nicht zurückgesetzt wird.',
  'mode.super': 'Molten Core kaufen', 'mode.super.desc': 'Das Feld startet höher, Relikte wandern in den Tresor, und die Runde endet mit einem Guss.',

  'sym.ore': 'Roherz', 'sym.bronze': 'Bronze', 'sym.iron': 'Eisen', 'sym.silver': 'Silber',
  'sym.gold': 'Gold', 'sym.mythril': 'Mithril', 'sym.crown': 'Geschmolzene Krone',
  'sym.flux': 'Flussmittel (Wild)', 'sym.cinder': 'Glut (Scatter)',

  'buy.short.bonus': '10 Freispiele · Hitze bleibt erhalten',
  'buy.short.super': 'Vorbelegtes Feld · ein großer Guss',
  'buy.pick': 'Feature wählen',
  'buy.title': 'Kauf bestätigen', 'buy.cost': 'Kosten', 'buy.rtp': 'RTP', 'buy.maxwin': 'Maximalgewinn',
  'buy.random': 'Jede Runde ist zufällig und unabhängig von vorherigen Ergebnissen.',

  'help.title': 'Spielanleitung',
  'help.core': 'Erz bildet ADERN. Eine Ader zahlt nur, wenn sie den STOSS (obere Reihe) mit dem TIEGEL (untere Reihe) verbindet — sonst zahlt nichts. Je mehr SPALTEN eine Ader auf dem Weg nach unten quert, desto mehr ist sie wert.',
  'help.pay': 'Der Wert einer Ader ergibt sich aus den gequerten Spalten plus einem Zuschlag für jedes Feld über die kürzestmögliche Ader hinaus, und alles wird mit der Hitze multipliziert. Ein Spin ohne durchgehende Ader zahlt nichts.',
  'help.heat': 'Die Hitze startet bei ×1. Im Basisspiel steigt sie um +1 je Ader und setzt sich jeden Spin zurück. In Forge Fury steigt sie um die SPALTENZAHL der Ader und bleibt über die ganze Runde erhalten.',
  'help.ladder': 'Gequerte Spalten', 'help.value': 'Wert (× Einsatz, vor Hitze)',
  'help.symbol': 'Symbol',
  'help.special': 'Spezialsymbole',
  'help.flux': 'Ersetzt jedes Erz und kann so eine Lücke in einer Ader überbrücken. Ein Flux kann mehreren Adern zugleich dienen. Zahlt selbst nichts.',
  'help.cinder': '3 / 4 / 5 Glut bringen 10 / 12 / 14 Forge-Fury-Spins. 3+ im Bonus geben 4 weitere.',
  'help.bonus': 'Forge Fury (Bonus)',
  'help.bonus.desc': 'Freispiele auf einem dichteren Feld, bei denen die Hitze um die Spaltenzahl jeder Ader steigt und nie zurückgesetzt wird — hier liegen die größten Gewinne.',
  'help.super': 'Molten Core (Superbonus)',
  'help.super.desc': 'Adern zahlen nicht pro Spin: jede wird zum Basiswert in den Tresor gebucht. Die Runde endet mit einem einzigen Guss in Höhe von Tresor × Hitze.',
  'help.modes': 'Einsatzmodi', 'help.mode': 'Modus', 'help.cost': 'Kosten',
  'help.rg': 'Verantwortungsvolles Spielen',
  'help.rg.desc': 'Jeder Spin ist unabhängig und zufällig. Es gibt keine Progression zwischen Einsätzen und keinen Jackpot. Setze Limits und spiele verantwortungsvoll. 18+.',
};

const DICTS: Record<string, Dict> = { en, pl, de };
const RTL = new Set(['ar', 'he', 'fa', 'ur']);

let active: Dict = en;
let activeLang = 'en';

export function setLang(lang: string): void {
  activeLang = DICTS[lang] ? lang : 'en';
  active = DICTS[activeLang];
  document.documentElement.lang = activeLang;
  document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr';
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = active[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export function currentLang(): string { return activeLang; }
