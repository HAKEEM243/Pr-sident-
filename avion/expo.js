/* =========================================================
   Sky Empire — ✈️ Vol libre / vol d'exhibition
   Un vol qui ne compte pas dans votre compagnie : n'importe quel départ,
   n'importe quelle arrivée, n'importe quelle compagnie (la vôtre, une
   autre du jeu ou un nom libre) et n'importe quel avion.
   • « En temps réel » : l'avion suit l'heure de votre téléphone. Exemple :
     Paris-CDG → Kinshasa demain à 10:50 : il est à la porte avant,
     repousse à 10:50, et arrive à l'heure prévue si vous la donnez
     (la durée du vol est alors ajustée). Ouvrez la 3D pendant votre
     vrai voyage : il vole en même temps que vous.
   • « Dans le temps du jeu » : départ tout de suite, au rythme du jeu.
   Aucun passager, aucun coût, aucune recette : c'est pour le plaisir.
   ========================================================= */
'use strict';
const EXPO={n:0};
const expoList=()=>(S&&S.expo)||[];
// les vols libres se retrouvent comme les vôtres (suivi 3D, caméra…), sans être dans la flotte
function expoInstall(){
  if(!S||!S.fleet) return; const F=S.fleet; if(F._expo) return;
  Object.defineProperty(F,'find',{value:function(fn,th){ return Array.prototype.find.call(this,fn,th)||expoList().find(fn,th); },configurable:true,writable:true});
  Object.defineProperty(F,'_expo',{value:true,configurable:true});
}
// position dans le temps : en temps réel, on recale les départs sur l'horloge du téléphone
function expoSync(ac,t){
  const X=ac.expo, fl=ac.flight; if(!X||!fl) return; const m=modelOf(ac); if(t==null) t=S.time;
  if(X.real){ const p0=legProf(fl.legs[0],m), b0=(p0.segs.find(s=>s.ph===1)||{t0:0}).t0, e=Math.max(0,b0+(Date.now()-X.off)*X.k);
    let cum=0; fl.li=fl.legs.length-1;
    for(let i=0;i<fl.legs.length;i++){ const L=fl.legs[i], tot=legProf(L,m).total; L.dep=t-e+cum; if(e<cum+tot&&i<fl.li) fl.li=i; cum+=tot; } }   // tronçon en cours : le premier pas encore fini
  else { let i=0; while(i<fl.legs.length-1&&t>=legEnd(fl.legs[i],m)) i++; fl.li=i; }
}
function expoEnd(ac){ const fl=ac.flight, m=modelOf(ac), last=fl.legs[fl.legs.length-1]; return ac.expo.real? Date.now()>ac.expo.off+(ac.expo.dur||0)+30*MIN : S.time>legEnd(last,m)+30*MIN; }
function expoStops(from,to,m){
  if(dist(from,to)<=m.range) return [from,to];
  const mid=AIRPORT_CODES.filter(c=>AP(c).cls>=Math.min(m.cls||1,4)&&dist(from,c)<=m.range&&dist(c,to)<=m.range).sort((x,y)=>(dist(from,x)+dist(x,to))-(dist(from,y)+dist(y,to)))[0];
  return mid?[from,mid,to]:null; }
function expoCreate(o){
  const m=getModel(o.model); if(!m) return 'Avion inconnu'; if(!AP(o.from)||!AP(o.to)) return 'Aéroport inconnu'; if(o.from===o.to) return 'Départ et arrivée identiques';
  const stops=expoStops(o.from,o.to,m); if(!stops) return `Trop loin pour un ${m.name}, même avec une escale : choisissez un plus gros avion`;
  const code=o.code||S.company.code, legs=legsFor(stops,code); for(const l of legs){ l.hOut=0; l.hIn=0; l.dep=S.time; }
  const ac={id:'expo'+Date.now().toString(36)+(EXPO.n++), model:m.id, reg:'EXPO', name:o.name||'', owned:false, status:'flight', loc:o.from, hub:o.from, condition:100, cfg:{f:0,j:0}, plan:[],
    ownerCode:code, livery:o.color||airlineColor(code), flight:{kind:'expo', legs, li:0, dir:1}, expo:{real:!!o.real, off:o.off||Date.now(), k:1, code, cname:o.cname||code, fno:o.fno||'', dur:0}};
  // durée réelle donnée : on étire ou on raccourcit le vol pour arriver à l'heure
  let tot=0; for(const l of legs) tot+=legProf(l,m).total; const b0=(legProf(legs[0],m).segs.find(s=>s.ph===1)||{t0:0}).t0;
  if(o.real&&o.arr&&o.arr>ac.expo.off+20*MIN){ ac.expo.dur=o.arr-ac.expo.off; ac.expo.k=(tot-b0)/ac.expo.dur; } else ac.expo.dur=(tot-b0);
  if(!o.real){ let d=S.time; for(const l of legs){ l.dep=d; d+=legProf(l,m).total; } }
  S.expo=S.expo||[]; S.expo.push(ac); expoInstall(); expoSync(ac,S.time); return ac;
}
function expoRemove(id){ if(!S.expo) return; const ac=S.expo.find(a=>a.id===id); S.expo=S.expo.filter(a=>a.id!==id);
  if(typeof G!=='undefined'&&G&&G.follow===id&&typeof globeFollow==='function') try{ globeFollow(null); }catch(e){}
  if(ac&&typeof toast==='function') toast(`🏁 Vol libre ${ac.expo.fno||''} terminé (${keyCity(ac.flight.legs[0].from)} → ${keyCity(ac.flight.legs[ac.flight.legs.length-1].to)}).`,'ok'); }
const expoLabel=ac=>`${ac.expo.fno||(ac.expo.code+flightNumber(ac))} · ${ac.expo.cname} · ${modelOf(ac).name}`;
// --- fenêtre de création ---
// heure locale d'un aéroport (« 2026-10-23T17:40 » à Kinshasa) → instant exact ; sans fuseau connu : heure du téléphone
function expoLocalTs(v,code){ const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(v||''); if(!m) return NaN; const u=AP(code)&&AP(code).utc;
  if(typeof u!=='number') return new Date(v).getTime(); return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])-u*3600000; }
const expoTz=code=>{ const a=AP(code); return a?`heure de ${a.city}`:'heure locale'; };
function expoForm(){
  const pad=n=>String(n).padStart(2,'0'), d=new Date(Date.now()+86400000); d.setHours(10,50,0,0);
  const v=x=>`${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
  const airl=[[S.company.code,S.company.name+' (vous)'],...((S.ai&&S.ai.list)||[]).filter(e=>e.status!=='dead').map(e=>[e.code,e.name])];
  const models=MODELS.filter(m=>!m.cargoOnly).slice().sort((a,b)=>a.name.localeCompare(b.name));
  const mine=expoList();
  showModal('✈️ Vol libre / vol d’exhibition', `
    <div class="small mut">Un vol pour le plaisir, en dehors de votre compagnie : aucun passager, aucun coût. Il apparaît en 3D comme vos avions.</div>
    <datalist id="expoAp">${AIRPORT_CODES.map(c=>`<option value="${c} — ${esc(AP(c).city)}">`).join('')}</datalist>
    <datalist id="expoAl">${airl.map(([c,n])=>`<option value="${esc(c)} — ${esc(n)}">`).join('')}</datalist>
    <label>Départ<input list="expoAp" id="exFrom" placeholder="ex. CDG ou Paris" value="CDG — ${esc(AP('CDG')?AP('CDG').city:'')}"></label>
    <label>Arrivée<input list="expoAp" id="exTo" placeholder="ex. FIH ou Kinshasa" value="${esc(S.company.hub)} — ${esc(AP(S.company.hub).city)}"></label>
    <label>Compagnie<input list="expoAl" id="exAl" placeholder="code ou nom (ex. AF, Air France)" value="AF — Air France"></label>
    <label>N° de vol (facultatif)<input id="exFno" placeholder="ex. AF898"></label>
    <label>Avion<select id="exModel">${models.map(m=>`<option value="${m.id}" ${m.id==='A359'?'selected':''}>${esc(m.name)} · ${m.range} km</option>`).join('')}</select></label>
    <label><input type="radio" name="exMode" value="real" checked> ⏱️ En temps réel (heure de votre téléphone)</label>
    <label><input type="radio" name="exMode" value="game"> 🎮 Dans le temps du jeu, départ tout de suite</label>
    <label>Départ (repoussage, heure locale du départ, comme sur la carte d’embarquement)<input type="datetime-local" id="exDep" value="${v(d)}"></label>
    <label>Arrivée prévue (facultatif, heure locale de l’arrivée, comme sur la carte d’embarquement)<input type="datetime-local" id="exArr"></label>
    <div class="btns"><button class="btn" data-act="expoGo">🛫 Créer le vol</button></div>
    ${mine.length?`<h3>Vos vols libres</h3>${mine.map(a=>`<div class="row" style="display:flex;gap:6px;align-items:center;margin:4px 0"><span style="flex:1">${esc(expoLabel(a))}<br><small class="mut">${esc(keyCity(a.flight.legs[0].from))} → ${esc(keyCity(a.flight.legs[a.flight.legs.length-1].to))} · ${a.expo.real?'départ '+new Date(a.expo.off).toLocaleString('fr-FR',{weekday:'short',hour:'2-digit',minute:'2-digit'}):'temps du jeu'}</small></span><button class="btn sm" data-act="expoView" data-id="${a.id}">🌍 3D</button><button class="btn sm" data-act="expoDel" data-id="${a.id}">✖</button></div>`).join('')}`:''}`);
}
function expoAirline(v){ v=String(v||'').trim(); const c=v.split(' — ')[0].trim(), up=c.toUpperCase();
  if(up===S.company.code) return {code:up,cname:S.company.name,color:S.livery||S.company.color};
  const e=(S.ai&&S.ai.list||[]).find(x=>x.code===up||x.name.toLowerCase()===v.toLowerCase()||x.name.toLowerCase()===c.toLowerCase());
  if(e) return {code:e.code,cname:e.name}; const nm=v.split(' — ')[1]||v;
  return {code:(up.length<=3?up:up.replace(/[^A-Z]/g,'').slice(0,2))||'XX', cname:nm}; }
Object.assign(ACTIONS,{
  expoOpen:()=>expoForm(),
  expoGo:()=>{ const from=parseAp($('#exFrom').value), to=parseAp($('#exTo').value); if(!from||!to) return toast('Aéroport inconnu','bad');
    const real=(document.querySelector('input[name="exMode"]:checked')||{}).value!=='game', al=expoAirline($('#exAl').value);
    const off=real&&$('#exDep').value?expoLocalTs($('#exDep').value,from):Date.now(), arr=real&&$('#exArr').value?expoLocalTs($('#exArr').value,to):0;
    if(real&&!(off>0)) return toast('Heure de départ invalide','bad');
    const r=expoCreate({from,to,model:$('#exModel').value,real,off,arr,code:al.code,cname:al.cname,color:al.color,fno:$('#exFno').value.trim().toUpperCase()});
    if(typeof r==='string') return toast(r,'bad');
    closeModal(); const wait=real?off-Date.now():0;
    toast(wait>60000?`✈️ Vol libre créé : l’avion attend à la porte de ${keyCity(from)}, repoussage ${new Date(off).toLocaleString('fr-FR',{weekday:'long',hour:'2-digit',minute:'2-digit'})}. Ouvrez la 3D à ce moment-là (Plus → ✈️ Vol libre → 🌍 3D).`:`✈️ Vol libre ${keyCity(from)} → ${keyCity(to)} : c’est parti !`,'ok');
    ACTIONS.view3D({id:r.id}); },
  expoView:d=>{ closeModal(); ACTIONS.view3D({id:d.id}); },
  expoDel:d=>{ expoRemove(d.id); expoForm(); },
});
function expoFromUrl(){
  let q; try{ q=new URLSearchParams(location.search); }catch(e){ return; } if(!q.get('vol')||!q.get('de')||!q.get('a')) return;
  const go=()=>{ if(!S||!S.company||!S.fleet){ return setTimeout(go,1500); }
    const fno=q.get('vol').toUpperCase(), from=q.get('de').toUpperCase(), to=q.get('a').toUpperCase(), off=q.get('dep')?expoLocalTs(q.get('dep'),from):Date.now(), arr=q.get('arr')?expoLocalTs(q.get('arr'),to):0;
    if(!expoList().some(a=>a.expo.fno===fno&&Math.abs(a.expo.off-off)<60000)){ const cc=(q.get('cie')||fno.slice(0,2)).toUpperCase(), al=expoAirline(cc);
      const r=expoCreate({from,to,model:q.get('avion')||'A359',real:true,off,arr,code:al.code,cname:q.get('nom')||(al.cname!==cc?al.cname:cc==='AF'?'Air France':cc),color:al.color,fno});
      if(typeof r==='string'){ toast('✈️ '+r,'bad'); return; } }
    try{ history.replaceState(null,'',location.pathname); }catch(e){}
    const a=expoList().find(x=>x.expo.fno===fno), w=a?a.expo.off-Date.now():0;
    toast(w>60000?`✈️ ${fno} prêt : l’avion attend à la porte, repoussage à ${new Date(off).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} (heure du téléphone). Plus → ✈️ Vol libre → 🌍 3D.`:`✈️ ${fno} en route !`,'ok');
    try{ expoForm(); }catch(e){} };
  setTimeout(go,2500);
}
function expoHook(){ if(expoHook.done) return; expoHook.done=true; expoFromUrl();
  { const _fs=flightState; flightState=function(ac,t){ if(ac&&ac.expo) try{ expoSync(ac,t); }catch(e){} return _fs.apply(this,arguments); }; }
  // la 3D dessine aussi les vols libres (étiquette à leur compagnie)
  if(typeof globeSync==='function'){ const _gs=globeSync; globeSync=function(){ expoInstall(); const ex=expoList(); if(!ex.length) return _gs.apply(this,arguments);
      const real=S.fleet; S.fleet=real.concat(ex); let r; try{ r=_gs.apply(this,arguments); } finally{ S.fleet=real; expoInstall(); }
      try{ for(const a of ex){ const e=G.planes.get(a.id); if(e&&e.label&&!e._expoL){ e._expoL=1; e.label.text=expoLabel(a); } } }catch(e){} return r; }; }
  if(typeof renderGlobeHud==='function'){ const _rh=renderGlobeHud; renderGlobeHud=function(){ const r=_rh.apply(this,arguments); try{ const b=document.getElementById('globeHud'); if(b&&!b.querySelector('[data-act="expoOpen"]')) b.insertAdjacentHTML('beforeend','<button class="gh" data-act="expoOpen" title="Vol libre : n’importe quelle ligne, compagnie et avion">✈️ Vol libre</button>'); }catch(e){} return r; }; }
  setInterval(()=>{ try{ expoInstall(); for(const a of expoList().slice()) if(expoEnd(a)) expoRemove(a.id); }catch(e){} },1000);
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ expoHook(); }catch(e){ console.warn(e); } },0));
