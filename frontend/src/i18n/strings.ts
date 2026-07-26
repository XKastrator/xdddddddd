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

  'buy.title': 'Confirm purchase', 'buy.cost': 'Cost', 'buy.rtp': 'RTP', 'buy.maxwin': 'Max win',
  'buy.random': 'Every round is random and independent of previous results.',

  'help.title': 'How to play',
  'help.core': 'Fuse {n}+ connected identical cells to forge one relic a rank higher. A bigger group climbs further — one extra rank per {j} extra cells.',
  'help.pay': 'Raw ore pays nothing — it is fuel. Only forged relics pay, and every payout is multiplied by Heat.',
  'help.heat': 'Heat starts at ×1 and rises by +1 with every fusion. In the base game it resets each spin; in Forge Fury it keeps building for the whole round.',
  'help.ladder': 'Rank ladder', 'help.value': 'Value (× bet, before Heat)',
  'help.symbol': 'Symbol',
  'help.special': 'Special symbols',
  'help.flux': 'Joins one adjacent group to help it reach the fusion threshold. Pays nothing on its own.',
  'help.cinder': '3 / 4 / 5 Cinders award 10 / 12 / 14 Forge Fury spins. 3+ during the bonus adds 4 more.',
  'help.bonus': 'Forge Fury (bonus)',
  'help.bonus.desc': 'Free spins where Heat carries across every spin, so late fusions pay far more than early ones.',
  'help.super': 'Molten Core (super bonus)',
  'help.super.desc': 'Three rules change: the board arrives pre-seeded at Bronze and above, forged relics lock into the Vault instead of paying per spin, and the round ends with a single Pour worth Vault × Heat.',
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

  'buy.title': 'Potwierdź zakup', 'buy.cost': 'Koszt', 'buy.rtp': 'RTP', 'buy.maxwin': 'Maks. wygrana',
  'buy.random': 'Każda runda jest losowa i niezależna od poprzednich wyników.',

  'help.title': 'Jak grać',
  'help.core': 'Połącz {n}+ stykających się identycznych pól, aby wykuć relikwię o rangę wyżej. Większa grupa skacze dalej — o kolejną rangę co {j} dodatkowe pola.',
  'help.pay': 'Surowa ruda nie płaci — jest paliwem. Płacą wyłącznie wykute relikwie, a każda wypłata jest mnożona przez Żar.',
  'help.heat': 'Żar startuje od ×1 i rośnie o +1 z każdą fuzją. W grze podstawowej resetuje się co spin; w Furii Kuźni narasta przez całą rundę.',
  'help.ladder': 'Drabina rang', 'help.value': 'Wartość (× zakład, przed Żarem)',
  'help.symbol': 'Symbol',
  'help.special': 'Symbole specjalne',
  'help.flux': 'Dołącza do jednej sąsiedniej grupy, pomagając osiągnąć próg fuzji. Sam nie płaci.',
  'help.cinder': '3 / 4 / 5 Żagwi daje 10 / 12 / 14 spinów Furii Kuźni. 3+ w bonusie dodaje kolejne 4.',
  'help.bonus': 'Furia Kuźni (bonus)',
  'help.bonus.desc': 'Darmowe spiny, w których Żar przenosi się między spinami, więc późne fuzje płacą znacznie więcej niż wczesne.',
  'help.super': 'Roztopiony Rdzeń (superbonus)',
  'help.super.desc': 'Zmieniają się trzy zasady: plansza startuje od Brązu wzwyż, wykute relikwie trafiają do Skarbca zamiast płacić co spin, a runda kończy się jednym Wylewem o wartości Skarbiec × Żar.',
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

  'buy.title': 'Kauf bestätigen', 'buy.cost': 'Kosten', 'buy.rtp': 'RTP', 'buy.maxwin': 'Maximalgewinn',
  'buy.random': 'Jede Runde ist zufällig und unabhängig von vorherigen Ergebnissen.',

  'help.title': 'Spielanleitung',
  'help.core': 'Verbinde {n}+ zusammenhängende gleiche Felder, um ein Relikt eine Stufe höher zu schmieden. Größere Gruppen steigen weiter — eine zusätzliche Stufe je {j} weitere Felder.',
  'help.pay': 'Roherz zahlt nichts — es ist Brennstoff. Nur geschmiedete Relikte zahlen, und jeder Gewinn wird mit der Hitze multipliziert.',
  'help.heat': 'Die Hitze startet bei ×1 und steigt mit jeder Verschmelzung um +1. Im Basisspiel wird sie pro Spin zurückgesetzt; in Forge Fury wächst sie über die ganze Runde.',
  'help.ladder': 'Rangleiter', 'help.value': 'Wert (× Einsatz, vor Hitze)',
  'help.symbol': 'Symbol',
  'help.special': 'Spezialsymbole',
  'help.flux': 'Schließt sich einer angrenzenden Gruppe an, um die Schwelle zu erreichen. Zahlt selbst nichts.',
  'help.cinder': '3 / 4 / 5 Glut bringen 10 / 12 / 14 Forge-Fury-Spins. 3+ im Bonus geben 4 weitere.',
  'help.bonus': 'Forge Fury (Bonus)',
  'help.bonus.desc': 'Freispiele, bei denen die Hitze über alle Spins hinweg wächst, sodass späte Verschmelzungen weit mehr zahlen.',
  'help.super': 'Molten Core (Superbonus)',
  'help.super.desc': 'Drei Regeln ändern sich: Das Feld startet ab Bronze, geschmiedete Relikte wandern in den Tresor statt pro Spin zu zahlen, und die Runde endet mit einem Guss in Höhe von Tresor × Hitze.',
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
