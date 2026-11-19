/* =========================================================
   Sky Empire — 🌬️ vent, secousses, remise de gaz (3D)
   • météo de l'aéroport (towerWx : vent, rafales, orage) près du sol :
     l'avion est secoué en roulis, tangage et altitude — plus fort sur
     les petits avions, plus doux sur les gros-porteurs ;
   • vent de travers : l'avion arrive en crabe (nez dans le vent) et se
     remet dans l'axe juste avant de toucher ; même chose après le décollage ;
   • atterrissage dur : rebond, gros choc de caméra ;
   • remise de gaz (décidée par la météo dans atc.js) : annonce, montée,
     tour de piste et nouvelle approche — visible sur la 3D.
   ========================================================= */
'use strict';
const WND={wx:{}, st:{}};
function wndWx(code){ const now=performance.now(), c=WND.wx[code]; if(c&&now-c.at<8000) return c.w;
  let w=null; try{ w=typeof towerWx==='function'?towerWx(code):null; }catch(e){} WND.wx[code]={w,at:now}; return w; }
function wndHash(id){ let h=0; for(const ch of String(id)) h=(h*31+ch.charCodeAt(0))|0; return Math.abs(h%1000)/1000*50; }
// perturbation de l'avion à l'instant : {dh, dp, db, dz, sh}
function wndPert(ac,st,mi){
  const out={dh:0,dp:0,db:0,dz:0,sh:0}; if(!st||st.phase<2||st.phase>7) return out;
  const low=st.phase<=3, code=low?st.from:st.to, w=wndWx(code); const t=performance.now()/1000, o=wndHash(ac.id), m=modelOf(ac);
  const sz=(m.seats||0)<80?1.5:(m.seats||0)<200?1:0.65, alt=st.alt||0;
  if(w){ const gust=w.gust||0, A=Math.max(0,Math.min(1.5,(w.spd+0.6*gust-6)/22+(w.st?0.5:0)))*sz;
    const env=alt<1?(st.spd>40?0.25:0):alt<1500?Math.min(1,0.35+alt/60)*(1-Math.max(0,alt-900)/600*0.6):0;
    const k=A*env;
    if(k>0){ const n=(f,p)=>Math.sin(t*f+o+p)+0.6*Math.sin(t*f*2.3+o*1.7+p)+0.35*Math.sin(t*f*5.1+o*0.3+p);   // bruit doux, sans à-coup
      out.db=n(0.9,0)*3.4*k; out.dp=n(1.1,2)*1.1*k; out.dz=alt>4?n(0.7,4)*3.2*k*Math.min(1,alt/30):0; out.sh=k; }
    // vent de travers → angle de crabe (nez dans le vent), décrabe à l'arrondi
    const rh=st.hdg, xw=w.spd*Math.sin((w.dir-rh)*Math.PI/180), tas=Math.max(110,(st.spd||250)/1.852);
    if(alt>2&&alt<2000&&!st.holding){ const crab=Math.asin(Math.max(-0.5,Math.min(0.5,xw/tas)))*180/Math.PI, f=Math.min(1,(alt-2)/12)*(alt>1200?Math.max(0,(2000-alt)/800):1); out.dh=crab*f; }
  }
  // atterrissage dur : rebond et choc
  const S_=WND.st[ac.id]||(WND.st[ac.id]={alt:alt,touch:0,leg:null});
  if(S_.leg!==st.leg){ S_.leg=st.leg; S_.touch=0; S_.said=0; S_.rate=null; S_.rated=0; }
  if(st.phase===7&&S_.alt>0.3&&alt<=0.3&&!S_.touch){ S_.touch=performance.now(); S_.rate=wndRate(ac,st,w,sz); }
  S_.alt=alt;
  // en route : turbulences dans les cellules orageuses (plus fortes sur les petits avions)
  if(st.phase>=3&&st.phase<=6&&alt>1500){ const cell=typeof stormAt==='function'?stormAt(st.lat,st.lon):null;
    if(cell){ const k2=0.9*sz*(0.6+0.4*Math.sin(t*0.13+o)), n=(f,p)=>Math.sin(t*f+o+p)+0.6*Math.sin(t*f*2.7+o*1.3+p)+0.4*Math.sin(t*f*6.3+p);
      out.db+=n(0.8,1)*3*k2; out.dp+=n(1.2,3)*1.2*k2; out.dz+=n(0.9,5)*9*k2; out.sh+=k2; }
    if(!!cell!==!!S_.cell){ S_.cell=!!cell; S_.turbNew=cell?1:2; } }
  if(S_.touch){ const tau=(performance.now()-S_.touch)/1000;
    if(st.leg&&st.leg.hard&&tau<2.2){ out.dz+=2.6*Math.abs(Math.sin(Math.PI*tau/0.9))*Math.exp(-tau*1.4); out.dp+=2.5*Math.exp(-tau*2); out.db+=Math.sin(tau*9)*2*Math.exp(-tau*2); out.sh+=3*Math.exp(-tau*1.8); }
    else if(tau<0.8) out.sh+=0.6*(1-tau/0.8); }
  return out;
}
// note d'atterrissage : vitesse verticale au toucher selon vent, rafales, vent de travers, taille de l'avion et atterrissage dur
function wndRate(ac,st,w,sz){
  const xw=w?Math.abs(w.spd*Math.sin((w.dir-st.hdg)*Math.PI/180)):0, gust=w&&w.gust?w.gust-w.spd:0, h=wndHash(ac.id+String(st.leg&&st.leg.dep))/50;
  let fpm=Math.round(70+h*170+xw*7*sz+gust*9*sz+(w&&w.st?120:0)+(st.leg&&st.leg.hard?380+h*200:0));
  const stars=fpm<160?3:fpm<330?2:fpm<600?1:0, lab='';
  return {fpm,stars,lab,xw:Math.round(xw)}; }
function wndRateShow(ac,r){   // simple information de vol, sans note ni récompense
  try{ toast(`🛬 Toucher des roues : −${r.fpm} ft/min (${['dur','ferme','normal','très doux'][r.stars]})${r.xw>=8?' · vent de travers '+r.xw+' kt':''}`,r.stars===0?'warn':'info'); }catch(e){} }
function wndSay(ac,st){
  // bulletin météo de l'aéroport : au roulage (départ) et en début d'approche (arrivée), pour l'avion suivi
  try{ if(typeof G!=='undefined'&&G&&G.follow===ac.id&&(st.phase===1||st.phase===6)&&!st.holding){ const key=ac.id+'|'+st.phase+'|'+(st.leg&&st.leg.dep); if(WND.atis!==key){ WND.atis=key;
        const code=st.phase===1?st.from:st.to, w=wndWx(code), A=AP(code), rw=typeof legPath==='function'?legPath(st.leg,modelOf(ac))[st.phase===1?'dep':'arr']:null;
        if(w&&A){ const xw=rw?Math.round(Math.abs(w.spd*Math.sin((w.dir-rw.hdg)*Math.PI/180))):0, bad=w.st||w.gust||xw>=12||w.vis<5000;
          toast(`${w.st?'⛈️':w.gust?'🌬️':w.vis<5000?'🌫️':'🌤️'} <b>${A.city}</b>${rw?' · piste '+rw.id:''} : vent ${String(w.dir).padStart(3,'0')}°/${w.spd} kt${w.gust?', rafales '+w.gust+' kt':''}${xw>=5?' · travers '+xw+' kt':''} · visibilité ${w.vis>=10000?'10 km+':(w.vis/1000).toFixed(1)+' km'}${w.st?' · orage':''}${bad?(st.phase===6?' — approche agitée':' — départ agité'):''}`,bad?'warn':'info'); } } } }catch(e){}
  { const S0=WND.st[ac.id]; if(S0&&S0.turbNew&&typeof G!=='undefined'&&G&&G.follow===ac.id){ const k=S0.turbNew; S0.turbNew=0; WND.turbSaid=k;
      try{ if(typeof fxBurst==='function') fxBurst('chime'); }catch(e){}
      if(k===1){ try{ toast('💺 <b>Turbulences</b> : zone orageuse, consigne lumineuse « attachez vos ceintures » allumée','warn'); }catch(e){}
        try{ if(typeof fx2Say==='function') fx2Say('Mesdames et messieurs, nous traversons une zone de turbulences. Veuillez regagner vos sièges et attacher vos ceintures.','fr',0.9); }catch(e){} }
      else try{ toast('💺 Sortie de la zone de turbulences, consigne ceintures éteinte','info'); }catch(e){} } }
  if(typeof G==='undefined'||!G||G.follow!==ac.id) return; const S_=WND.st[ac.id]||(WND.st[ac.id]={alt:st.alt||0,touch:0,leg:st.leg});
  if(st.ga&&!S_.said){ S_.said=1; try{ if(typeof toast==='function') toast('🛬↗️ <b>Remise de gaz</b> : vent trop fort en finale, l\'avion refait un tour de piste','warn'); }catch(e){}
    try{ if(typeof fx2Say==='function') fx2Say('Remise de gaz ! Go around, flaps.','fr',1); }catch(e){} }
  if(st.holding==='rto'&&S_.rto!==st.leg){ S_.rto=st.leg; try{ if(typeof toast==='function') toast('🛑 <b>Décollage interrompu</b> : freinage d\'urgence, l\'avion revient au seuil et repartira','warn'); }catch(e){}
    try{ if(typeof fx2Say==='function') fx2Say('Stop ! Stop ! Stop ! Décollage interrompu.','fr',1); }catch(e){} }
  if(S_.touch&&S_.rate&&!S_.rated&&performance.now()-S_.touch>1500){ S_.rated=1; wndRateShow(ac,S_.rate); }
  if(S_.touch&&st.leg&&st.leg.hard&&S_.said!==2&&performance.now()-S_.touch<3000){ S_.said=2; try{ if(typeof toast==='function') toast('💥 Atterrissage dur : rafale au moment du toucher','warn'); }catch(e){} }
}
function wndHook(){ if(wndHook.done||typeof acPose!=='function') return; wndHook.done=true;
  const _p=acPose; acPose=function(ac){ const r=_p.apply(this,arguments); if(!r||!r.st) return r;
    try{ const d=wndPert(ac,r.st,r.mi); WND.last=WND.last||{}; WND.last[ac.id]=d; wndSay(ac,r.st);
      if(d.dh||d.dp||d.db||d.dz){ const C=Cesium, pos=d.dz?C.Cartesian3.fromDegrees(r.st.lon,r.st.lat,Math.max(r.h+d.dz,r.h-0)):r.pos;
        r.pos=pos; r.q=C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(C.Math.toRadians(r.st.hdg+d.dh-90),C.Math.toRadians(r.a.pitch+d.dp),C.Math.toRadians(r.a.bank+d.db))); } }catch(e){ if(!wndHook.w){ wndHook.w=1; console.warn('vent',e); } }
    return r; };
  if(typeof fxShake==='function'){ const _s=fxShake; fxShake=function(p){ _s.apply(this,arguments);
    try{ const d=p&&p.st&&WND.last&&G&&WND.last[G.follow]; if(!d||!d.sh) return; const a=0.0014*Math.min(4,d.sh)*(G.cam.mode==='cabin'||G.cam.mode==='cockpit'?1.8:1), cam=G.viewer.camera;
      cam.lookUp((Math.random()-0.5)*a); cam.lookRight((Math.random()-0.5)*a); }catch(e){} }; }
}
/* ---------- les autres compagnies : secousses et, rarement, remise de gaz ---------- */
function wndRivalHook(){ if(wndRivalHook.done||typeof rivalPos!=='function'||typeof rivalSched!=='function') return; wndRivalHook.done=true;
  const _r=rivalPos;
  rivalPos=function(r,i,t){
    try{ const K=rivalSched(r); if(K&&typeof gaLoop==='function'){ const T=K.P, ii=Math.min(i,K.nP-1); let rel=((t-K.anchors[ii]+K.bA)%T+T)%T, to=r.b, prof=K.pA, dir='AB', turn=K.turn;
        if(rel>=K.pA.total+turn){ rel-=K.pA.total+turn; to=r.a; prof=K.pB; dir='BA'; }
        const s7=prof.segs.find(x=>x.ph===7);
        if(s7&&rel>=s7.t0&&turn>11*MIN){ const cyc=Math.floor((t-K.anchors[ii]+K.bA)/T), w=wndWx(to);
          const p=w?(0.0015+(w.gust?0.02:0)+(w.st?0.06:0)):0, hsh=(typeof hashStr==='function'?hashStr(r.a+r.b+(r.c||'')+ii+dir+cyc):0)%10000/10000;
          if(hsh<p){ const rws=runwaysOf(to), q0=_r.call(this,r,i,t-(rel-s7.t0)), D=10*MIN;
            if(q0&&rws.length){ const rw=rws.slice().sort((a,b)=>angDiff(a.hdg,q0.hdg)-angDiff(b.hdg,q0.hdg))[0];
              if(rel<s7.t0+D){ const g=gaLoop(rw,toRw(rw,q0.p).a,50,(rel-s7.t0)/D); return Object.assign({},q0,{p:{lat:g.lat,lon:g.lon},hdg:g.hdg,alt:g.alt,ph:6,gnd:false,holding:'ga'}); }
              return _r.call(this,r,i,t-D); } } } } }catch(e){}
    const v=_r.apply(this,arguments);
    try{ if(v&&!v.gnd&&v.alt>5&&v.alt<900&&(v.ph===2||v.ph===3||v.ph===6||v.ph===7)){ const w=wndWx(v.ph<=3?v.from.code:v.to.code);
        if(w){ const k=Math.max(0,Math.min(1.5,(w.spd+0.6*(w.gust||0)-6)/22+(w.st?0.5:0))), tt=performance.now()/1000, o=(r.a.charCodeAt(0)+i*7)%50;
          if(k>0) v.alt+=(Math.sin(tt*0.8+o)+0.5*Math.sin(tt*2.1+o*1.3))*3*k*Math.min(1,v.alt/30); } } }catch(e){}
    return v; };
}
function wndSoundHook(){ if(wndSoundHook.done||typeof fxSound!=='function') return; wndSoundHook.done=true;
  const _f=fxSound; fxSound=function(ac,st,inside,raining){ const r=_f.apply(this,arguments);
    try{ const s=FX.sound; if(!s||!FX.soundOn) return r; const t=s.ctx.currentTime, W=typeof WP!=='undefined'&&WP.cur;
      if(raining&&W){ const k=W.storm?1:Math.max(0.3,W.rain); s.rainG.gain.setTargetAtTime((inside?0.04:0.07)+k*(inside?0.05:0.12),t,1.2); s.dropG.gain.setTargetAtTime((inside?0.05:0.03)+k*0.06,t,1.2); }
      const d=WND.last&&WND.last[ac.id], now=performance.now();
      if(d&&d.sh>0.35&&now>(WND.thumpAt||0)){ WND.thumpAt=now+250+Math.random()*(1400/Math.min(3,d.sh));   // chocs sourds dans la carlingue
        const b=s.ctx.createBufferSource(); b.buffer=s.brown; const fl=s.ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=110; const g=s.ctx.createGain(), pk=Math.min(0.9,0.18*d.sh)*(inside?1.4:0.8);
        g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(pk,t+0.03); g.gain.exponentialRampToValueAtTime(0.0001,t+0.35); b.connect(fl); fl.connect(g); g.connect(s.master); b.start(t,Math.random()*2); b.stop(t+0.4); } }catch(e){}
    return r; }; }
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ wndSoundHook(); }catch(e){} try{ wndHook(); wndRivalHook(); }catch(e){ console.warn(e); } },0));
