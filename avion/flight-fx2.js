/* =========================================================
   Sky Empire — 🎙️ annonces du cockpit, roues, traînées, gerbes d'eau
   • Voix du cockpit (comme dans un vrai avion) : « One hundred knots »,
     « V1 », « Rotate », « Positive rate » au décollage ; à l'atterrissage
     « Minimums », le compte de la sonde « 50, 40, 30, 20, 10 », « Retard »,
     puis « Spoilers », « Reverse green », « Seventy knots ».
   • Annonces de l'équipage en français : portes armées au repoussage,
     croisière, bienvenue à l'arrivée.
   • Grondement des roues sur la piste et « tac-tac » des feux d'axe.
   • En croisière (au-dessus de 7 600 m) : traînées blanches des réacteurs.
   • Sous la pluie : gerbes d'eau derrière les roues au décollage et à l'atterrissage.
   Tout suit le bouton 🔊 (et celui des voix radio), et les effets se coupent si la 3D rame.
   ========================================================= */
'use strict';
const FX2={id:null, said:{}, ctr:null, trail:[], sp:[], lastPuff:0, lastSpray:0, dist:0, lastT:0, roll:null, voices:null};
function fx2Voice(lang){ try{ const vs=speechSynthesis.getVoices(); return vs.find(v=>v.lang&&v.lang.replace('_','-').toLowerCase().startsWith(lang))||null; }catch(e){ return null; } }
function fx2Say(txt,lang,vol,urgent){
  if(!FX.soundOn||typeof speechSynthesis==='undefined'||(typeof RADIO!=='undefined'&&RADIO.voice===false)) return;   // suit aussi le bouton des voix radio
  try{ const u=new SpeechSynthesisUtterance(txt), v=fx2Voice(lang==='fr'?'fr':'en'); if(v) u.voice=v; u.lang=lang==='fr'?'fr-FR':'en-US'; u.rate=lang==='fr'?1.02:1.08; u.pitch=lang==='fr'?1.05:0.9; u.volume=vol==null?0.8:vol;
    if(urgent&&speechSynthesis.speaking) return;   // compte de la sonde : jamais en retard (sautée si la radio parle)
    speechSynthesis.speak(u); }catch(e){}
}
function fx2Once(k,txt,lang,vol){ if(FX2.said[k]) return; FX2.said[k]=1; fx2Say(txt,lang,vol,/^(ra|ret|min|1000|500|100|v1|vr)/.test(k)); }
// vitesse de rotation du modèle (km/h), d'après son profil de décollage
function fx2Vr(ac,st){ try{ const s=legProf(st.leg,modelOf(ac)).segs.find(x=>x.ph===2); return s?s.s1*0.95:240; }catch(e){ return 240; } }
function fx2Callouts(ac,st,inside){
  const ph=st.phase, spd=st.spd||0, alt=st.alt||0, gnd=alt<0.6, vol=inside?0.9:0.6, f=st.leg&&st.leg.dep;
  if(FX2.id!==ac.id+'|'+f){ FX2.id=ac.id+'|'+f; FX2.said={}; }
  if(st.pushback) fx2Once('pb','PNC aux portes, armement des toboggans, vérification de la porte opposée.','fr',inside?0.9:0.5);
  if(ph===2&&gnd){ const vr=fx2Vr(ac,st); if(spd>Math.min(185,vr*0.72)) fx2Once('100','One hundred knots','en',vol); if(spd>vr-30) fx2Once('v1','V one','en',vol); if(spd>vr-22) fx2Once('vr','Rotate','en',vol); }
  if((ph===2||ph===3)&&alt>12) fx2Once('pr','Positive rate. Gear up','en',vol);
  if(ph===4) fx2Once('cr',`Mesdames et messieurs, nous volons à notre altitude de croisière. Arrivée prévue à ${typeof keyCity==='function'?keyCity(st.to):st.to}.`,'fr',inside?0.9:0.45);
  if(ph===6||ph===7){
    if(alt<330&&alt>250) fx2Once('1000','One thousand','en',vol);
    if(alt<160&&alt>120) fx2Once('500','Five hundred','en',vol);
    if(alt<64&&alt>40) fx2Once('min','Minimums','en',vol);
    for(const [ft,w] of [[50,'Fifty'],[40,'Forty'],[30,'Thirty'],[10,'Ten']]) if(alt<ft*0.3048&&alt>ft*0.3048-4) fx2Once('ra'+ft,w,'en',vol);
    if(alt<6.5&&alt>0.6) fx2Once('ret','Retard. Retard','en',vol);
    if(ph===7&&gnd){ fx2Once('sp','Spoilers. Reverse green','en',vol); if(spd<130) fx2Once('70','Seventy knots','en',vol); }
  }
  if(ph===8&&!FX2.said.wel) fx2Once('wel',`Mesdames et messieurs, bienvenue à ${typeof keyCity==='function'?keyCity(st.to):st.to}. Merci de rester assis, ceinture attachée, jusqu'à l'arrêt complet de l'appareil.`,'fr',inside?0.9:0.45);
}
// roues : grondement sur le sol et feux d'axe
function fx2Wheels(st){
  const s=FX.sound; if(!s) return; const ctx=s.ctx, t=ctx.currentTime;
  if(!FX2.roll){ const b=ctx.createBufferSource(); b.buffer=s.brown; b.loop=true; b.playbackRate.value=0.8; const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=90; f.Q.value=0.9; const g=ctx.createGain(); g.gain.value=0; b.connect(f); f.connect(g); g.connect(s.cabinLP); b.start(); FX2.roll={g,f}; }
  const gnd=(st.alt||0)<0.6&&st.phase>=1, spd=gnd?Math.max(0,st.spd||0):0;
  FX2.roll.g.gain.setTargetAtTime(FX.soundOn&&spd>3?Math.min(0.55,0.04+spd/420):0,t,0.25); FX2.roll.f.frequency.setTargetAtTime(60+spd*0.35,t,0.4);
  // « tac » à chaque feu d'axe (tous les 15 m) pendant la course au décollage et à l'atterrissage
  const now=performance.now(), dt=FX2.lastT?Math.min(0.2,(now-FX2.lastT)/1000):0; FX2.lastT=now;
  if(FX.soundOn&&gnd&&(st.phase===2||st.phase===7)&&spd>40){ FX2.dist+=spd/3.6*dt; if(FX2.dist>15){ FX2.dist=0;
    const b=ctx.createBufferSource(); b.buffer=s.brown; const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=160; const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.22,t+0.006); g.gain.exponentialRampToValueAtTime(0.0005,t+0.09); b.connect(f); f.connect(g); g.connect(s.cabinLP); b.start(t,Math.random()*2); b.stop(t+0.12); } }
}
// traînées de condensation et gerbes d'eau (petites images, toujours la même → pas de fuite mémoire)
function fx2Trails(ac,p,inside,raining){
  const C=Cesium, V=G.viewer, now=performance.now(), st=p.st, mi=p.mi, lite=typeof P3!=='undefined'&&P3.lvl>=2;
  if(!FX2.ctr||FX2.ctrV!==V){ FX2.ctr=V.scene.primitives.add(new C.BillboardCollection()); FX2.ctrV=V; FX2.trail=[]; FX2.sp=[]; }
  const col=FX2.ctr, img=puffImage(), span=mi.span||30, eng=Math.max(4,span*0.17);
  // traînées
  const cruise=!inside&&!lite&&st.alt>7600&&st.phase>=3&&st.phase<=5;
  if(cruise&&now-FX2.lastPuff>180){ FX2.lastPuff=now;
    for(const sx of [-1,1]) FX2.trail.push({b:col.add({image:img,position:fxLocal(p,sx*eng,-mi.R*0.6,-mi.L*0.35),width:6,height:6,sizeInMeters:true,color:C.Color.WHITE.withAlpha(0.8)}),t0:now}); }
  FX2.trail=FX2.trail.filter(u=>{ const a=(now-u.t0)/1000; if(a>7||(!cruise&&a>1.5)){ col.remove(u.b); return false; } const w=6+a*9; u.b.width=w; u.b.height=w; u.b.color=C.Color.WHITE.withAlpha(Math.max(0,0.8-a*0.11)); return true; });
  // gerbes d'eau
  const wet=raining&&!lite&&st.alt<0.6&&(st.phase===2||st.phase===7)&&(st.spd||0)>90;
  if(wet&&now-FX2.lastSpray>110){ FX2.lastSpray=now;
    for(const sx of [-1,1]) FX2.sp.push({b:col.add({image:img,position:fxLocal(p,sx*mi.R*1.1,-(mi.R+(mi.gH||2))+0.6,-mi.L*0.08),width:3,height:2,sizeInMeters:true,color:C.Color.fromCssColorString('#cfd6de').withAlpha(0.7)}),t0:now}); }
  FX2.sp=FX2.sp.filter(u=>{ const a=(now-u.t0)/1000; if(a>1.6){ col.remove(u.b); return false; } u.b.width=3+a*14; u.b.height=2+a*6; u.b.color=C.Color.fromCssColorString('#cfd6de').withAlpha(Math.max(0,0.7-a*0.44)); return true; });
}
function fx2Hook(){ if(fx2Hook.done||typeof fxTick!=='function') return; fx2Hook.done=true;
  { const _t=fxTick; fxTick=function(ac,p){ const r=_t.apply(this,arguments);
      try{ const inside=G.cam&&(G.cam.mode==='cabin'||G.cam.mode==='cockpit'), st=p.st, raining=!!(FX.forceRain||FX.rain||(typeof wxStorm==='function'&&wxStorm())||(typeof stormAt==='function'&&stormAt(st.lat,st.lon)));
        fx2Callouts(ac,st,inside); fx2Wheels(st); fx2Trails(ac,p,inside,raining); }catch(e){ if(!fx2Hook.w){ fx2Hook.w=1; console.warn('fx2',e); } }
      return r; }; }
  // iPhone : la voix doit être « débloquée » pendant un toucher de l'écran
  if(typeof fxAudioUnlock==='function'){ const _u=fxAudioUnlock; fxAudioUnlock=function(){ const r=_u.apply(this,arguments); try{ if(!FX2.unl&&typeof speechSynthesis!=='undefined'){ FX2.unl=1; const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); } }catch(e){} return r; }; }
  // quitter la 3D : on coupe la voix et le grondement
  if(typeof fxClear==='function'){ const _c=fxClear; fxClear=function(){ try{ if(typeof speechSynthesis!=='undefined') speechSynthesis.cancel(); if(FX2.roll&&FX.sound) FX2.roll.g.gain.setTargetAtTime(0,FX.sound.ctx.currentTime,0.1); if(FX2.ctr){ FX2.ctr.removeAll(); FX2.trail=[]; FX2.sp=[]; } }catch(e){} return _c.apply(this,arguments); }; }
}
if(typeof window!=='undefined') window.addEventListener('load',()=>setTimeout(()=>{ try{ fx2Hook(); }catch(e){ console.warn(e); } },0));
