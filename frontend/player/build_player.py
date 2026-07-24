"""Build a self-contained MOLTEN CROWN replay harness (index.html).

Embeds real books produced by the math engine (from math/forced/catalog.json)
so the event contract can be seen replaying end-to-end with no build step and no
external resources (CSP-safe: publishable as an Artifact). This is a functional
vertical slice / placeholder presentation — NOT final art (see ART_BIBLE.md).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "math" / "forced" / "catalog.json"
OUT = Path(__file__).resolve().parent / "index.html"

# scenarios to embed (keep the file lean but representative)
KEEP = [
    "dead_spin_0x", "base_medium_win", "base_strong_win", "base_natural_bonus",
    "base_bonus_retrigger", "bonus_good", "bonus_extreme", "bonus_retrigger",
    "super_typical", "super_big", "maxwin_bonus", "maxwin_super",
]

cat = json.loads(CATALOG.read_text())
by_label = {s["label"]: s for s in cat["scenarios"]}
scenarios = [{
    "label": by_label[k]["label"],
    "mode": by_label[k]["mode"],
    "win_x": by_label[k]["win_x"],
    "book": by_label[k]["book"],
} for k in KEEP if k in by_label]

DATA = json.dumps(scenarios, separators=(",", ":"))

HTML = r"""<meta charset="utf-8">
<title>Molten Crown — Replay Harness</title>
<style>
:root{--bg:#0a0806;--panel:#14100c;--line:#2a2018;--amber:#ff7a18;--amber2:#ffb347;
  --teal:#37e0c8;--gold:#f2c14e;--txt:#f4ece0;--dim:#9a8c78}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  background:radial-gradient(120% 90% at 50% -10%,#1c130b 0%,var(--bg) 60%);
  color:var(--txt);min-height:100vh}
.wrap{max-width:760px;margin:0 auto;padding:16px}
h1{font-size:20px;letter-spacing:3px;margin:8px 0 2px;text-transform:uppercase;
  background:linear-gradient(#ffe9c2,var(--amber));-webkit-background-clip:text;
  background-clip:text;color:transparent;font-weight:800}
.sub{color:var(--dim);font-size:12px;margin-bottom:12px}
.hud{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.chip{background:var(--panel);border:1px solid var(--line);border-radius:10px;
  padding:8px 12px;font-size:12px;min-width:78px}
.chip b{display:block;font-size:16px;color:var(--amber2);margin-top:2px}
.heatbar{height:10px;background:#20180f;border-radius:6px;overflow:hidden;margin-top:6px}
.heatfill{height:100%;width:0;background:linear-gradient(90deg,#7a2d00,var(--amber),#fff2cc);
  transition:width .25s}
.board{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;
  background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:8px;
  aspect-ratio:6/5}
.cell{border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;position:relative;background:#0f0b07;
  transition:transform .18s,box-shadow .18s,background .18s;text-shadow:0 1px 2px #000}
.cell.o{background:#171009;color:#5c4a35;border:1px solid #241a10}
.cell.relic{color:#0a0806}
.cell.flux{background:radial-gradient(circle,#0c2b28,#062018);color:var(--teal);
  box-shadow:0 0 10px #1fae9a inset}
.cell.cinder{background:radial-gradient(circle,#3a1e05,#180d02);color:var(--amber2);
  box-shadow:0 0 12px #ff8a2a}
.cell.fuse{animation:fuse .35s}
@keyframes fuse{0%{transform:scale(1)}45%{transform:scale(1.18);box-shadow:0 0 22px var(--amber)}100%{transform:scale(1)}}
.cell.spawn{animation:drop .22s}
@keyframes drop{0%{transform:translateY(-16px);opacity:.3}100%{transform:none;opacity:1}}
.controls{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
select,button{background:#1b140d;color:var(--txt);border:1px solid var(--line);
  border-radius:10px;padding:10px 14px;font-size:13px;cursor:pointer}
button.primary{background:linear-gradient(#ff8a2a,#d95b00);border:none;font-weight:700}
button:disabled{opacity:.4;cursor:default}
.banner{position:fixed;inset:0;display:none;align-items:center;justify-content:center;
  flex-direction:column;background:rgba(6,4,2,.72);z-index:9;text-align:center}
.banner.show{display:flex}
.banner .big{font-size:44px;font-weight:900;letter-spacing:2px;
  background:linear-gradient(#fff2cc,var(--amber));-webkit-background-clip:text;
  background-clip:text;color:transparent}
.banner .tag{color:var(--amber2);letter-spacing:4px;text-transform:uppercase;font-size:13px}
.log{margin-top:12px;font-size:11px;color:var(--dim);max-height:120px;overflow:auto;
  background:#0d0a07;border:1px solid var(--line);border-radius:10px;padding:8px;
  font-family:ui-monospace,Menlo,monospace;line-height:1.5}
.win{color:var(--gold)!important}
label.toggle{font-size:12px;color:var(--dim);display:flex;align-items:center;gap:6px}
@media (prefers-reduced-motion:reduce){.cell{transition:none}.cell.fuse,.cell.spawn{animation:none}}
</style>
<div class="wrap">
  <h1>Molten Crown</h1>
  <div class="sub">Event-contract replay harness · books produced by the Python math engine · placeholder art</div>
  <div class="hud">
    <div class="chip">MODE<b id="m">—</b></div>
    <div class="chip">HEAT<b id="h">×1</b><div class="heatbar"><div class="heatfill" id="hf"></div></div></div>
    <div class="chip" id="spinsChip" style="display:none">SPINS<b id="sp">—</b></div>
    <div class="chip" id="vaultChip" style="display:none">VAULT<b id="v">0.00×</b></div>
    <div class="chip">SPIN WIN<b id="sw">0.00×</b></div>
    <div class="chip">TOTAL<b id="tw">0.00×</b></div>
  </div>
  <div class="board" id="board"></div>
  <div class="controls">
    <select id="scenario"></select>
    <button class="primary" id="play">▶ Play</button>
    <button id="skip">⏭ Skip</button>
    <label class="toggle"><input type="checkbox" id="turbo"> Turbo</label>
    <label class="toggle"><input type="checkbox" id="rm"> Reduced motion</label>
  </div>
  <div class="log" id="log"></div>
</div>
<div class="banner" id="banner"><div class="tag" id="btag"></div><div class="big" id="bbig"></div></div>
<script>
const SCEN = __DATA__;
const NAME={0:'',1:'o',2:'o',3:'o',4:'o',5:'o',6:'Br',7:'Fe',8:'Ag',9:'Au',10:'My',11:'♛',12:'≈',13:'✦'};
const RELCOL={6:'#b08d57',7:'#9fa7ad',8:'#d6dde3',9:'#f2c14e',10:'#6fe3c8',
  11:'linear-gradient(135deg,#ffd76b,#ff7a18)'};
const CAP={base:25,ante:25,free:100,super:10};
let turbo=false, rm=false, skipFlag=false, playing=false;
const $=id=>document.getElementById(id);
const board=$('board'); let cells=[];
for(let i=0;i<30;i++){const d=document.createElement('div');d.className='cell';board.appendChild(d);cells.push(d);}
function wait(ms){ if(rm) ms=Math.min(ms,60); if(turbo) ms=Math.round(ms*0.28);
  return new Promise(r=>{const t=Math.max(0,ms);const id=setInterval(()=>{if(skipFlag){clearInterval(id);r();}},16);
  setTimeout(()=>{clearInterval(id);r();},t);});}
function log(s,cls){const d=document.createElement('div');if(cls)d.className=cls;d.textContent=s;$('log').prepend(d);}
function drawCell(el,sym){el.className='cell';el.style.background='';el.textContent=NAME[sym]||'';
  if(sym>=1&&sym<=5)el.classList.add('o');
  else if(sym>=6&&sym<=11){el.classList.add('relic');el.style.background=RELCOL[sym];}
  else if(sym===12)el.classList.add('flux');
  else if(sym===13)el.classList.add('cinder');}
function drawBoard(b){for(let r=0;r<b.length;r++)for(let c=0;c<b[0].length;c++)drawCell(cells[r*6+c],b[r][c]);}
function setHeat(h,kind){$('h').textContent='×'+h;const cap=CAP[kind]||25;$('hf').style.width=Math.min(100,100*h/cap)+'%';}
async function banner(tag,big,ms){$('btag').textContent=tag;$('bbig').textContent=big;$('banner').classList.add('show');await wait(ms);$('banner').classList.remove('show');}
let totalWin=0;
async function handle(ev,kind){switch(ev.type){
  case 'revealBoard': case 'superSeed':
    drawBoard(ev.board); if('heat'in ev)setHeat(ev.heat,kind); $('sw').textContent='0.00×';
    if(ev.scatters>=2)log('reveal · cinders='+ev.scatters); await wait(260); break;
  case 'anticipation': log('⟡ anticipation — '+ev.scatters+'/'+ev.needed+' cinders'); await wait(320); break;
  case 'forge':{ for(const f of ev.fusions){ for(const [r,c] of f.cells) cells[r*6+c].classList.add('fuse');
      for(const [r,c] of (f.wildCells||[])) cells[r*6+c].classList.add('fuse'); }
    setHeat(ev.heat,kind); await wait(360);
    for(const f of ev.fusions){ const [ar,ac]=f.anchor; drawCell(cells[ar*6+ac],f.to); cells[ar*6+ac].classList.add('spawn'); }
    log('⚒ forge ×'+ev.fusions.length+'  heat ×'+ev.heat); await wait(120); break; }
  case 'gravity': drawBoard(ev.board); for(const s of ev.spawned)cells[s.r*6+s.c].classList.add('spawn'); await wait(180); break;
  case 'heatUpdate': setHeat(ev.heat,kind); break;
  case 'settleWin': if(ev.win>0){$('sw').textContent=ev.win.toFixed(2)+'×';log('＄ spin win '+ev.win.toFixed(2)+'×  (heat ×'+ev.heat+')','win');await wait(260);} break;
  case 'bonusStart': kind=ev.kind; $('m').textContent=ev.mode==='molten_core'?'MOLTEN CORE':'FORGE FURY';
    if(ev.mode==='molten_core'){$('vaultChip').style.display='';}
    $('spinsChip').style.display=''; await banner(ev.mode==='molten_core'?'Superbonus':'Bonus',
      ev.mode==='molten_core'?'MOLTEN CORE':'FORGE FURY',700); return kind;
  case 'spinCounter': $('sp').textContent=(ev.total-ev.remaining)+' / '+ev.total; break;
  case 'retrigger': log('✦ RETRIGGER +'+ev.added+' spins'); await banner('Retrigger','+'+ev.added+' SPINS',500); break;
  case 'lockUpdate': $('v').textContent=ev.vault.toFixed(2)+'×'; await wait(140); break;
  case 'pour': $('v').textContent=ev.vault.toFixed(2)+'×'; log('🌋 POUR  vault '+ev.vault.toFixed(2)+'× × heat '+ev.heat+' = '+ev.win.toFixed(2)+'×','win');
    await banner('The Pour', ev.win.toFixed(0)+'×', 900); break;
  case 'totalWinUpdate': totalWin=ev.totalWin; $('tw').textContent=totalWin.toFixed(2)+'×'; break;
  case 'maxWin': await banner('★ MAX WIN ★','MOLTEN CROWN',1400); break;
  case 'finalWin': $('tw').textContent=ev.amount.toFixed(2)+'×';
    if(ev.amount>=20) await banner(tierName(ev.amount), ev.amount.toFixed(2)+'×', 900);
    log('round win '+ev.amount.toFixed(2)+'×','win'); break;
  case 'roundEnd': log('— round end —'); break;
} return kind;}
function tierName(x){return x>=1500?'Molten Win':x>=300?'Epic Win':x>=75?'Mega Win':x>=20?'Big Win':'Nice';}
async function playBook(book){ playing=true;$('play').disabled=true; totalWin=0;$('tw').textContent='0.00×';
  $('log').innerHTML=''; let kind = SCEN[$('scenario').value].mode==='ante'?'base':SCEN[$('scenario').value].mode;
  if(kind==='bonus')kind='free'; if(kind==='super')kind='super';
  $('m').textContent=SCEN[$('scenario').value].mode.toUpperCase();
  for(const ev of book.events){ if(!playing)break; const k=await handle(ev,kind); if(k)kind=k; skipFlag=false; }
  $('play').disabled=false; playing=false; }
SCEN.forEach((s,i)=>{const o=document.createElement('option');o.value=i;
  o.textContent=s.label+'  ('+s.mode+', '+s.win_x+'×)';$('scenario').appendChild(o);});
function firstBoard(book){const e=book.events.find(e=>e.board);return e?e.board:Array.from({length:5},()=>Array(6).fill(0));}
$('scenario').onchange=()=>{const s=SCEN[$('scenario').value];drawBoard(firstBoard(s.book));
  $('vaultChip').style.display=s.mode==='super'?'':'none';$('spinsChip').style.display='none';};
$('play').onclick=()=>{if(!playing)playBook(SCEN[$('scenario').value].book);};
$('skip').onclick=()=>{skipFlag=true;};
$('turbo').onchange=e=>turbo=e.target.checked;
$('rm').onchange=e=>{rm=e.target.checked;};
// init
drawBoard(firstBoard(SCEN[0].book));
</script>
"""

OUT.write_text(HTML.replace("__DATA__", DATA))
print(f"Wrote {OUT} ({OUT.stat().st_size} bytes) with {len(scenarios)} scenarios")
