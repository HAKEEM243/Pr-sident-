/* =========================================================
   Sky Empire — 🕒 heures locales et horaires d'ouverture des aéroports
   • Fuseau de chaque aéroport, avec l'heure d'été là où elle existe
     (Europe, États-Unis et Canada, sud-est de l'Australie, Nouvelle-Zélande).
   • Horaires d'ouverture : les petits aéroports et les aéroports congolais
     sans balisage lumineux ne fonctionnent que de jour ; quelques grands
     aéroports ont un couvre-feu de nuit (Francfort, Paris-Orly, Zurich, Sydney…).
     Le « Balisage lumineux & ILS » (fiche de l'aéroport) permet d'ouvrir la nuit.
   • Utilisé partout : vos vols, les vols des autres compagnies (carte, 3D,
     aérogare), l'horloge et les commerces de l'aérogare.
   ========================================================= */
'use strict';
const AH_EU=new Set(['FR','DE','ES','IT','BE','NL','PT','GB','IE','CH','AT','PL','CZ','SK','HU','SI','HR','SE','NO','DK','FI','GR','RO','BG','LT','LV','EE','LU','MT','CY','UA','MD','RS','BA','ME','MK','AL','XK','LI','MC','AD','SM','VA','FO','GI']);
const AH_NA=new Set(['US','CA']), AH_NA_NODST=new Set(['PHX','TUS','HNL','OGG','KOA','LIH','ITO','YXE','YQR']);
const AH_SOUTH=new Set(['SYD','MEL','ADL','HBA','CBR','LST','AKL','WLG','CHC','ZQN','DUD','NSN']);
const ahSun=(y,m,n)=>{ if(n<0){ const d=new Date(Date.UTC(y,m+1,0)); return Date.UTC(y,m,d.getUTCDate()-d.getUTCDay()); } const d=new Date(Date.UTC(y,m,1)); return Date.UTC(y,m,1+(7-d.getUTCDay())%7+7*(n-1)); };
// décalage « hiver » de l'aéroport, en heures (sans heure d'été) — base des horaires des compagnies
function ahStd(code){ const a=AP(code); if(!a) return 0; let u=(a.utc!==undefined&&a.utc!==null&&a.utc!=='')?+a.utc:null;
  if(u===null) u=a.cc==='CD'?(a.lon<21?1:2):Math.round(a.lon/15);
  if(AH_EU.has(a.cc)||(AH_NA.has(a.cc)&&!AH_NA_NODST.has(code))) u-=1;   // la base de données donne l'heure d'été pour ces pays
  return u; }
function ahDst(code,t){ const a=AP(code); if(!a) return false; const y=new Date(t).getUTCFullYear();
  if(AH_EU.has(a.cc)) return t>=ahSun(y,2,-1)+HOUR&&t<ahSun(y,9,-1)+HOUR;
  if(AH_NA.has(a.cc)&&!AH_NA_NODST.has(code)){ const s=-ahStd(code); return t>=ahSun(y,2,2)+(2+s)*HOUR&&t<ahSun(y,10,1)+(1+s)*HOUR; }
  if(AH_SOUTH.has(code)){ const s=ahStd(code); return t<ahSun(y,3,1)+(3-s-1)*HOUR||t>=ahSun(y,9,1)+(2-s)*HOUR; }
  return false; }
// décalage à l'instant t, en heures (avec l'heure d'été)
function tzAt(code,t){ return ahStd(code)+(ahDst(code,t)?1:0); }
const ahLocalHour=(code,t)=>((((t/HOUR+tzAt(code,t))%24)+24)%24);
// horaires d'ouverture en heure locale {o,c} (ouvert de o à c), ou null = 24 h/24
// couvre-feux réels : pistes fermées aux décollages et atterrissages pendant ces heures, mais l'aérogare reste ouverte
const AH_CURFEW={FRA:[5,23],ORY:[6,23.5],ZRH:[6,23.5],GVA:[6,24],BSL:[5,24],SYD:[6,23],ADL:[6,23],OOL:[6,23],DUS:[6,23],MUC:[5,24],BER:[5,24],NRT:[6,24],LCY:[6.5,22.5],SAN:[6.5,23.5],SNA:[7,22],LGB:[7,23]};
function apHours(code){ const a=AP(code); if(!a) return null; if(Object.prototype.hasOwnProperty.call(AH_CURFEW,code)) return {o:AH_CURFEW[code][0],c:AH_CURFEW[code][1],kind:'curfew',why:'couvre-feu de nuit (bruit) : aucun décollage ni atterrissage',term:null};
  if(a.ils) return null;   // balisage lumineux & ILS installé : ouvert la nuit
  const unpaved=a.surface&&a.surface!=='Asphalte';
  if(unpaved||(a.cls||2)<=2||(a.drc&&(a.cls||2)<=3)) return {o:6,c:18.5,kind:'day',why:'pas de balisage lumineux : vols de jour seulement',term:(unpaved||(a.cls||2)<=2)?{o:4.5,c:19.5}:{o:4,c:21}};   /* l'aérogare ouvre avant le premier vol et ferme après le dernier */
  return null; }
const ahSig=code=>{ const h=apHours(code); return h?h.o+'-'+h.c:'24'; };
function apOpenAt(code,t){ const h=apHours(code); if(!h) return true; const x=ahLocalHour(code,t); return x>=h.o&&x<h.c; }
// prochaine ouverture (heure UTC du jeu) à partir de t
function apNextOpen(code,t){ const h=apHours(code); if(!h||apOpenAt(code,t)) return t; const x=ahLocalHour(code,t); let dh=h.o-x; if(dh<=0) dh+=24; return t+Math.ceil(dh*60)*MIN; }
// premier départ possible ≥ dep : ouvert au départ ET à l'arrivée (dur = durée du vol)
function ahFit(from,to,dep,dur){ for(let k=0;k<12;k++){ if(!apOpenAt(from,dep)){ dep=apNextOpen(from,dep); continue; } if(!apOpenAt(to,dep+dur)){ dep=Math.max(dep+MIN,apNextOpen(to,dep+dur)-dur); continue; } return dep; } return dep; }
const ahHM=x=>{ const h=Math.floor(x), m=Math.round((x-h)*60); return String(h%24).padStart(2,'0')+':'+String(m).padStart(2,'0'); };
// l'aérogare (le bâtiment) est-elle ouverte ? Couvre-feu : oui, toujours. Aéroport de jour : seulement autour des heures de vol.
function apTermOpenAt(code,t){ const h=apHours(code); if(!h||!h.term) return true; const x=ahLocalHour(code,t); return x>=h.term.o&&x<h.term.c; }
function apHoursText(code){ const h=apHours(code); if(!h) return 'pistes et aérogare ouvertes 24 h/24';
  if(h.kind==='curfew') return `couvre-feu des pistes de ${ahHM(h.c)} à ${ahHM(h.o)} (heure locale) : aucun décollage ni atterrissage · l’aérogare reste ouverte 24 h/24`;
  return `pistes ouvertes de ${ahHM(h.o)} à ${ahHM(h.c)} (heure locale, pas de balisage lumineux) · aérogare ouverte de ${ahHM(h.term.o)} à ${ahHM(h.term.c)}`; }

/* ---------- 📈 le monde selon le jour, la saison et l'heure (heure locale du départ) ---------- */
const AH_HAJJ={2025:Date.UTC(2025,5,4),2026:Date.UTC(2026,4,25),2027:Date.UTC(2027,4,15),2028:Date.UTC(2028,4,3),2029:Date.UTC(2029,3,23),2030:Date.UTC(2030,3,12)};
function ahDemandParts(from,to,t){ const L=new Date(t+tzAt(from,t)*HOUR), dow=L.getUTCDay(), h=L.getUTCHours()+L.getUTCMinutes()/60, mo=L.getUTCMonth(), d=L.getUTCDate(), out=[];
  const DW=[[1.12,'dimanche chargé'],[1,''],[0.9,'mardi calme'],[0.9,'mercredi calme'],[1,''],[1.15,'vendredi chargé'],[0.95,'']][dow]; out.push(DW);
  if(dow===1&&h>=5&&h<10) out.push([1.08,'lundi matin : hommes d’affaires']);
  if((mo===11&&d>=15)||(mo===0&&d<=6)) out.push([1.3,'vacances de Noël']); else if(mo===6||mo===7) out.push([1.18,'grandes vacances']); else if(mo===3&&d<=20) out.push([1.06,'vacances de Pâques']);
  if(h<4.5) out.push([0.55,'vol de nuit']); else if(h<5.5) out.push([0.8,'très tôt le matin']); else if(h>=22) out.push([0.85,'vol tardif']);
  const hj=AH_HAJJ[L.getUTCFullYear()]; if(hj){ const dd=(t-hj)/DAY; if((to==='JED'||to==='MED')&&dd>-21&&dd<1) out.push([1.8,'pèlerinage à La Mecque']); if((from==='JED'||from==='MED')&&dd>4&&dd<25) out.push([1.8,'retour du pèlerinage']); }
  return out; }
function ahDemand(from,to,t){ let f=1; for(const [k] of ahDemandParts(from,to,t)) f*=k; return Math.max(0.45,Math.min(1.9,f)); }
function ahDemandWhy(from,to,t){ return ahDemandParts(from,to,t).filter(x=>x[1]&&x[0]!==1).map(x=>x[1]).join(' · '); }

/* ---------- 🇨🇩 réalités des aéroports congolais (événements déterministes : les mêmes partout) ---------- */
// hachage bien mélangé (FNV-1a + finaliseur) : des événements vraiment irréguliers, mais les mêmes pour tous les écrans
function ahH(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } h^=h>>>16; h=Math.imul(h,2246822507)>>>0; h^=h>>>13; h=Math.imul(h,3266489909)>>>0; h^=h>>>16; return h>>>0; }
const _ahEv=new Map(); const ahMemo=(k,f)=>{ let v=_ahEv.get(k); if(v===undefined){ v=f(); _ahEv.set(k,v); if(_ahEv.size>4000) _ahEv.clear(); } return v; };
// mouvement présidentiel / VIP : pistes fermées 30 à 50 min (Kinshasa souvent, Lubumbashi parfois) ; renvoie la fenêtre proche de t
function ahVip(code,t){ if(code!=='FIH'&&code!=='FBM') return null; const tz=tzAt(code,t)*HOUR;
  for(const dd of [0,-1,1]){ const day=Math.floor((t+tz)/DAY)+dd, w=ahMemo('v'+code+day,()=>{ const h=ahH('vip'+code+day); if((h%1000)/1000>=(code==='FIH'?0.22:0.08)) return null; const s=day*DAY+(9+((h>>>10)%80)/10)*HOUR-tz; return {s,e:s+(30+((h>>>17)%21))*MIN}; });
    if(w&&t>=w.s-90*MIN&&t<w.e+45*MIN) return w; } return null; }
const ahVipBlock=(code,t)=>{ const w=ahVip(code,t); return w&&t>=w.s&&t<w.e?w.e:0; };
// la piste est-elle utilisée pendant un mouvement présidentiel entre a et b ? → fin de la fermeture, sinon 0
function ahVipHit(code,a,b){ if(code!=='FIH'&&code!=='FBM') return 0; for(const t of [a,b]){ const w=ahVip(code,t); if(w&&a<w.e&&b>w.s) return w.e; } return 0; }
// coupure de courant (aéroports de province) : l'aérogare passe au groupe électrogène
function ahPower(code,t){ const a=AP(code); if(!a||!a.drc||code==='FIH') return null; const tz=tzAt(code,t)*HOUR, day=Math.floor((t+tz)/DAY);
  for(let k=0;k<2;k++){ const w=ahMemo('p'+code+day+'_'+k,()=>{ const h=ahH('pw'+code+day+k); if((h%100)>=((a.cls||2)>=4?30:55)) return null; const s=day*DAY+(7+((h>>>7)%150)/10)*HOUR-tz; return {s,e:s+(20+((h>>>14)%70))*MIN}; }); if(w&&t>=w.s&&t<w.e) return w; } return null; }
// pénurie de kérosène (province) : vols retardés, parfois annulés (sev 2)
function ahFuel(code,t){ const a=AP(code); if(!a||!a.drc||code==='FIH') return null; const wk=Math.floor(t/(7*DAY));
  for(const w0 of [wk,wk-1]){ const w=ahMemo('f'+code+w0,()=>{ const h=ahH('fu'+code+w0); if((h%100)>=14) return null; const s=w0*7*DAY+((h>>>7)%(6*24))*HOUR; return {s,e:s+(6+((h>>>15)%30))*HOUR,sev:((h>>>21)%100)<35?2:1}; }); if(w&&t>=w.s&&t<w.e) return w; } return null; }
