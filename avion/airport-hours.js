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
