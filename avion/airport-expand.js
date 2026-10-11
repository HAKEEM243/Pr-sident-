/* =========================================================
   Sky Empire — agrandir les aéroports de vos pays
   Dans les pays où vous avez un hub, vous pouvez agrandir les
   aéroports en 5 étapes (chantiers réels avec durée et coût) :
   1. extension du terminal, 2. nouvelle jetée, 3. deuxième piste,
   4. terminal 2, 5. ville aéroportuaire.
   Effets : plus de voyageurs, plus de portes, moins de retards
   (piste dédiée aux arrivées), plus grands avions, et l'aéroport
   grandit aussi en 3D.
   ========================================================= */
'use strict';
const XP_STEPS=[
  {k:'xp1', icon:'🏗️', name:'Extension du terminal', days:60, cost:a=>14e6+a.traffic*6e6, traffic:1.12, gates:4, desc:'Terminal agrandi : +12 % de voyageurs dans cet aéroport, 4 portes de plus.'},
  {k:'xp2', icon:'🛬', name:'Nouvelle jetée d’embarquement', days:90, cost:a=>28e6+a.traffic*9e6, traffic:1.15, gates:8, desc:'Une jetée avec passerelles : +15 % de voyageurs, 8 portes de plus, embarquement plus rapide.'},
  {k:'xp3', icon:'🛫', name:'Deuxième piste parallèle', days:150, cost:a=>60e6+a.traffic*12e6, traffic:1.10, gates:0, desc:'Une piste réservée aux arrivées, l’autre aux départs : beaucoup moins d’attente au sol et en l’air (visible en 3D).'},
  {k:'xp4', icon:'🏢', name:'Terminal 2', days:240, cost:a=>120e6+a.traffic*25e6, traffic:1.25, gates:12, desc:'Un second terminal : +25 % de voyageurs, 12 portes, et l’aéroport monte d’une classe (avions plus gros).'},
  {k:'xp5', icon:'🌆', name:'Ville aéroportuaire', days:120, cost:a=>80e6+a.traffic*10e6, traffic:1.15, gates:0, desc:'Hôtels, centre d’affaires, train rapide vers la ville : +15 % de voyageurs, surtout en classe Affaires.'},
];
const xpHubCountries=()=>new Set((S.hubs||[]).map(h=>AP(h)&&AP(h).cc));
// chaque étape devient un chantier du jeu (même système que les autres investissements)
XP_STEPS.forEach((st,i)=>{ UPGRADES[st.k]={name:`${st.name} (étape ${i+1}/5)`, icon:st.icon, days:st.days, cost:a=>Math.round(st.cost(a)/1e5)*1e5,
  can:a=>xpHubCountries().has(a.cc)&&(a.xp||0)===i&&a.cls>=2&&!(S.projects||[]).some(p=>p.code===a.code&&p.type.startsWith('xp')),
  desc:st.desc, apply:a=>{ a.xp=i+1; a.traffic=+(a.traffic*st.traffic).toFixed(3); a.gatesX=XP_STEPS.slice(0,i+1).reduce((t,x)=>t+x.gates,0); if(st.k==='xp3') a.rw2=true; if(st.k==='xp4') a.cls=Math.min(5,a.cls+1); if(st.k==='xp5'){ a.lounge=true; a.terminal=true; } xpRefresh(a.code); }}; });
// les caches qui dépendent de l'aéroport sont recalculés
function xpRefresh(code){ try{ delete _rwCache[code]; delete _apron[code]; _pathCache.clear(); const cc=AP(code).cc; if(typeof _cTraffic!=='undefined') delete _cTraffic[cc]; }catch(e){} }

/* ---------- deuxième piste : parallèle, à 1 050 m, du côté opposé à l'aérogare ---------- */
{ const _rw=runwaysOf; runwaysOf=function(code){ const out=_rw(code); const a=AP(code); if(!a||!a.rw2||out._xp||!out.length) return out;
  out._xp=true;
  const main=out.reduce((x,y)=>y.len>x.len?y:x,out[0]), ap=apronOf(code), side=(ap&&ap.rw===main?-ap.side:-1);
  const p1=fromRw(main,0,side*1050), p2=fromRw(main,main.len,side*1050), id=String(main.id||'').replace(/\D/g,'')||'09';
  const opp=out.find(r=>r.thr===main.end)||null, oid=opp?String(opp.id||'').replace(/\D/g,''):'27';
  out.push({id:id+(side>0?'R':'L'), hdg:main.hdg, thr:p1, end:p2, len:main.len, wid:main.wid||45, hard:true, xp:true},
           {id:oid+(side>0?'L':'R'), hdg:(main.hdg+180)%360, thr:p2, end:p1, len:main.len, wid:main.wid||45, hard:true, xp:true});
  out._xp=true; return out; }; }
// pistes spécialisées : les arrivées se posent sur la nouvelle piste, les départs gardent l'ancienne
let _xpCall=-1;
{ const _lp=legPath; legPath=function(leg,m){ _xpCall=0; try{ return _lp(leg,m); } finally{ _xpCall=-1; } }; }
{ const _br=bestRunway; bestRunway=function(code,course,m){ const role=_xpCall>=0?(_xpCall++===0?'dep':'arr'):null; const a=AP(code);
  if(!a||!a.rw2) return _br(code,course,m);
  const all=runwaysOf(code), real=all.filter(r=>!r.xp), virt=all.filter(r=>r.xp);
  const pickIn=list=>list.slice().sort((x,y)=>angDiff(x.hdg,course)-angDiff(y.hdg,course))[0];
  return role==='arr'&&virt.length? pickIn(virt) : (pickIn(real)||_br(code,course,m)); }; }

/* ---------- interface : où agrandir ---------- */
function xpTabHtml(){
  const ccs=xpHubCountries(); if(!ccs.size) return '';
  const list=AIRPORT_CODES.filter(c=>ccs.has(AP(c).cc)&&AP(c).cls>=2).sort((x,y)=>(S.hubs.includes(y)-S.hubs.includes(x))||(AP(y).traffic-AP(x).traffic)).slice(0,12);
  return `<h3>🏗️ Agrandir les aéroports de vos pays</h3><div class="small mut">Dans les pays où vous avez un hub, vous pouvez agrandir les aéroports en 5 étapes. Touchez un aéroport pour lancer le chantier.</div>
    ${list.map(c=>{ const a=AP(c), lv=a.xp||0, pr=(S.projects||[]).find(p=>p.code===c&&p.type.startsWith('xp')), nx=XP_STEPS[lv];
      return `<div class="card row" data-act="openAp" data-c="${c}" style="cursor:pointer"><div class="grow"><b>${esc(a.city)}</b> <span class="mut">${c}${S.hubs.includes(c)?' · 🏢 hub':''}</span><br>
        <span class="small">${'▰'.repeat(lv)}${'▱'.repeat(5-lv)} étape ${lv}/5 · ${a.traffic>=1?a.traffic.toFixed(1)+' M':Math.round(a.traffic*1000)+' k'} voyageurs/an${a.rw2?' · 2 pistes':''}</span><br>
        <span class="small ${pr?'warnt':'mut'}">${pr?`🏗️ Chantier en cours : ${XP_STEPS[+pr.type.slice(2)-1].name}, fin le ${fmtDate(pr.until)}`:nx?`Prochaine étape : ${nx.icon} ${nx.name} · ${fmtMoney(UPGRADES[nx.k].cost(a))}`:'✅ Aéroport complètement agrandi'}</span></div></div>`; }).join('')}`;
}

function registerXpActions(){
  MODALS.xp=()=>showModal('🏗️ Agrandir mes aéroports', xpTabHtml()||'<p>Achetez d’abord un hub : vous pourrez agrandir les aéroports de ce pays.</p>', true);
  Object.assign(ACTIONS,{ xpOpen:()=>openM('xp') }); }
