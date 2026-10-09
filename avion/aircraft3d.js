/* ============================================================
   AVIONS 3D DÉTAILLÉS (glTF généré à la volée, à l'échelle réelle)
   Chaque famille a sa silhouette : A320/737, gros-porteurs biréacteurs,
   747 (bosse), A380 (deux ponts), MD-11 (3 moteurs), CRJ/717 (moteurs
   arrière, empennage en T), ATR/Dash 8 (aile haute, hélices),
   Caravan (monomoteur), Concorde (aile delta).
   Repère glTF : +Z vers l'avant, +Y vers le haut, X le long des ailes.
   ============================================================ */
const AC3D=(function(){
  const norm=v=>{ const l=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/l,v[1]/l,v[2]/l]; };
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const lerp=(a,b,t)=>a+(b-a)*t;
  // surface « lissée » à partir de sections ; normale = du centre de la section vers le point
  function loft(sections, o={}){
    const n=sections[0].length, pos=[], nor=[], idx=[];
    sections.forEach((ring,s)=>{
      const c=o.centers? o.centers[s] : ring.reduce((a,p)=>[a[0]+p[0]/n,a[1]+p[1]/n,a[2]+p[2]/n],[0,0,0]);
      for(const p of ring){ pos.push(...p); let d=sub(p,c); if(Math.hypot(...d)<1e-6) d=o.axis||[0,0,1]; nor.push(...norm(d)); }
    });
    const seg=o.open? n-1 : n;
    for(let s=0;s<sections.length-1;s++) for(let i=0;i<seg;i++){ const a=s*n+i, b=s*n+(i+1)%n, c=(s+1)*n+(i+1)%n, d=(s+1)*n+i; idx.push(a,b,c,a,c,d); }
    const cap=(ring,dir)=>{ const b=pos.length/3, c=ring.reduce((a,p)=>[a[0]+p[0]/n,a[1]+p[1]/n,a[2]+p[2]/n],[0,0,0]); pos.push(...c); nor.push(...dir); ring.forEach(p=>{ pos.push(...p); nor.push(...dir); }); for(let i=0;i<n;i++) idx.push(b,b+1+i,b+1+(i+1)%n); };
    if(o.capStart) cap(sections[0], o.capStart);
    if(o.capEnd) cap(sections[sections.length-1], o.capEnd);
    return {pos,nor,idx};
  }
  const merge=(...parts)=>{ const r={pos:[],nor:[],idx:[]}; for(const p of parts){ if(!p) continue; const b=r.pos.length/3; r.pos.push(...p.pos); r.nor.push(...p.nor); r.idx.push(...p.idx.map(i=>i+b)); } return r; };
  const mirrorX=p=>({pos:p.pos.map((v,i)=>i%3===0?-v:v), nor:p.nor.map((v,i)=>i%3===0?-v:v), idx:p.idx.slice()});
  // profil d'aile (NACA symétrique) : u de 0 (bord d'attaque) à 1 (bord de fuite)
  const AF_U=[1,.82,.6,.38,.2,.08,.02,0,.02,.08,.2,.38,.6,.82];
  const AF_S=[ 1, 1, 1, 1, 1, 1, 1, 0,-1,-1,-1,-1,-1,-1];
  const naca=u=>5*(0.2969*Math.sqrt(u)-0.126*u-0.3516*u*u+0.2843*u*u*u-0.1036*u*u*u*u);
  // section horizontale (aile, plan horizontal) à l'envergure x
  const wingSec=(x,y,zLE,c,t)=>AF_U.map((u,i)=>[x, y+AF_S[i]*naca(u)*t*c, zLE-u*c]);
  // section verticale (dérive) à la hauteur y
  const finSec=(y,zLE,c,t,x0=0)=>AF_U.map((u,i)=>[x0+AF_S[i]*naca(u)*t*c, y, zLE-u*c]);
  // tube le long de Z (fuselage, nacelles) : profil [t, rayon, décalage vertical, facteur haut]
  function tube(z0,z1,prof,R,o={}){
    const n=o.n||20, x0=o.x||0, y0=o.y||0, secs=[], cs=[];
    for(const [t,rf,yo,top] of prof){ const z=lerp(z0,z1,t), r=R*rf, yc=y0+(yo||0)*R, ring=[];
      for(let k=0;k<n;k++){ const a=k/n*Math.PI*2, s=Math.sin(a); ring.push([x0+Math.cos(a)*r*(o.wide||1), yc+s*r*(s>0?(top||1):1)*(o.tall||1), z]); }
      secs.push(ring); cs.push([x0,yc,z]); }
    return loft(secs,{centers:cs,capStart:o.capStart,capEnd:o.capEnd});
  }
  // bande sur le fuselage (fenêtres, liseré, verrière) entre deux angles et deux z
  function strip(fz, z0,z1,a0,a1,R,scale=1.012,steps=10){
    const secs=[], cs=[];
    for(let i=0;i<=steps;i++){ const z=lerp(z0,z1,i/steps), f=fz(z), ring=[];
      for(let k=0;k<=4;k++){ const a=lerp(a0,a1,k/4), s=Math.sin(a); ring.push([Math.cos(a)*f.r*scale*(f.wide||1), f.yc+s*f.r*scale*(s>0?f.top:1), z]); }
      secs.push(ring); cs.push([0,f.yc,z]); }
    return loft(secs,{centers:cs,open:true});
  }
  const box=(x0,x1,y0,y1,z0,z1)=>{ const secs=[[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]];
    return loft(secs,{capStart:[0,0,-1],capEnd:[0,0,1]}); };
  // roue : cylindre selon X
  function wheel(x,y,z,r,w){ const n=12, secs=[]; for(const dx of [-w/2,w/2]){ const ring=[]; for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; ring.push([x+dx, y+Math.sin(a)*r, z+Math.cos(a)*r]); } secs.push(ring); }
    return loft(secs,{centers:[[x-w/2,y,z],[x+w/2,y,z]],capStart:[-1,0,0],capEnd:[1,0,0]}); }
  function disc(x,y,z,r){ const n=18, ring=[]; for(let k=0;k<n;k++){ const a=k/n*Math.PI*2; ring.push([x+Math.cos(a)*r, y+Math.sin(a)*r, z]); }
    return loft([ring.map(p=>[p[0],p[1],p[2]-0.02]),ring],{capStart:[0,0,1],capEnd:[0,0,1]}); }

  /* ---------- variantes par modèle ---------- */
  function variantOf(m){
    const id=m.id||'';
    if(id==='CONC') return 'conc';
    if(id==='A388') return 'a380';
    if(/^B74/.test(id)) return '747';
    if(id==='MD11') return 'md11';
    if(/^CRJ/.test(id)||['B712','E145','MD83','F100'].includes(id)) return 'rear';
    if(id==='DC10') return 'md11';
    if(id==='IL96') return 'quadwb';
    if(id==='PC12') return 'single';
    if(id==='C208') return 'single';
    if(id==='DHC6') return 'otter';
    if(['AT46','AT76','AT7F','DH8C','Q400','SF34'].includes(id)||m.fam==='TURBO') return 'prop';
    if(['A343','A346','A345'].includes(id)) return 'quadwb';
    const s=Math.max(m.seats,m.cargo*3);
    if(s>=240||/^(A31|A33|A35|B77|B78|B76|A34)/.test(id)) return 'wb';
    return 'nb';
  }
  // couleur d'une livrée : extrémité de dérive, liseré, moteurs
  function build(m, livery){
    const sp=(typeof acSpec==='function'?acSpec(m):{span:35,len:38}), v=variantOf(m), L=sp.len, span=sp.span, cargo=typeof isCargo==='function'&&isCargo(m);
    const R = v==='a380'?3.55 : v==='747'?3.25 : v==='wb'||v==='quadwb'||v==='md11'?2.95 : v==='conc'?1.45 : v==='prop'?1.35 : v==='single'?0.85 : v==='otter'?0.95 : v==='rear'?1.35 : 1.98;
    const z0=-L/2, z1=L/2;
    // profil du fuselage (t=0 nez → t=1 queue)
    const top747=t=>v==='747'? (t>0.06&&t<0.36? 1.32 : t>=0.36&&t<0.46? lerp(1.32,1,(t-0.36)/0.1) : t<=0.06? lerp(1,1.32,t/0.06):1) : v==='a380'? 1.18 : 1;
    const conc=v==='conc';
    const prof=(conc?[[0,.03,-.1],[.03,.35,-.06],[.1,.8,0],[.2,1,0],[.75,1,0],[.9,.8,.1],[1,.25,.25]]:
      [[0,.04,-.12],[.015,.42,-.1],[.04,.72,-.05],[.08,.92,-.01],[.13,1,0],[.66,1,0],[.76,.88,.12],[.86,.62,.3],[.94,.36,.46],[1,.08,.55]])
      .map(([t,r,y])=>[1-t,r,y,top747(t)]);  // tube() va de z0 (queue) à z1 (nez)
    prof.sort((a,b)=>a[0]-b[0]);
    const fz=z=>{ const t=1-(z-z0)/L; let i=0; const P=prof.map(p=>[1-p[0],p[1],p[2],p[3]]).sort((a,b)=>a[0]-b[0]);
      while(i<P.length-2&&P[i+1][0]<t) i++; const a=P[i], b=P[i+1], u=Math.max(0,Math.min(1,(t-a[0])/((b[0]-a[0])||1)));
      return {r:R*lerp(a[1],b[1],u), yc:R*lerp(a[2],b[2],u), top:lerp(a[3],b[3],u)}; };
    const body=tube(z0,z1,prof,R,{n:22,tall:v==='a380'?1.12:1});
    const P={white:[body], grey:[], tail:[], dark:[], glass:[], stripe:[], eng:[], fan:[], prop:[], gear:[], tire:[]};
    // pièces mobiles (nœuds glTF animés) : volets, aérofreins, inverseurs de poussée, hublots éclairés
    const anim=[], revs=[], wins=[];
    const relT=(g,T)=>({pos:g.pos.map((v,i)=>v-T[i%3]), nor:g.nor, idx:g.idx});
    const pair=(name,kind,g,T,axis,extra={})=>{ const gr=relT(g,T);
      anim.push({name:name+'R',kind,T,axis,sg:1,P:{grey:[gr]},...extra});
      anim.push({name:name+'L',kind,T:[-T[0],T[1],T[2]],axis:[-axis[0],axis[1],axis[2]],sg:-1,P:{grey:[mirrorX(gr)]},...extra}); };
    // verrière, fenêtres, liseré
    P.glass.push(strip(fz, z1-L*0.085, z1-L*0.045, 0.35, Math.PI-0.35, R, 1.01, 6));
    if(!cargo&&!conc){
      const W=(za,zb,a0,a1,st)=>{ const w=strip(fz,za,zb,a0,a1,R,1.006,st); P.dark.push(w,mirrorX(w)); const l=strip(fz,za+0.3,zb-0.3,a0+0.015,a1-0.015,R,1.0095,st); wins.push(l,mirrorX(l)); };
      W(z0+L*0.18, z1-L*0.13, -0.02, 0.10, 14);
      if(v==='a380') W(z0+L*0.2, z1-L*0.16, 0.62, 0.74, 14);
      if(v==='747') W(z1-L*0.34, z1-L*0.12, 0.85, 0.95, 6);
    }
    const sty=(livery&&livery.style)||'classique';
    // bande en arc (ventre) : plusieurs subdivisions angulaires
    const arc=(za,zb,a0,a1,sc)=>{ const secs=[], cs=[]; for(let i=0;i<=14;i++){ const z=lerp(za,zb,i/14), f=fz(z), ring=[]; for(let k=0;k<=12;k++){ const a=lerp(a0,a1,k/12), s2=Math.sin(a); ring.push([Math.cos(a)*f.r*sc*(f.wide||1), f.yc+s2*f.r*sc*(s2>0?f.top:1), z]); } secs.push(ring); cs.push([0,f.yc,z]); } return loft(secs,{centers:cs,open:true}); };
    if(!conc&&(sty==='classique'||sty==='double')) P.stripe.push(strip(fz, z0+L*0.12, z1-L*0.06, -0.32, -0.2, R, 1.008, 14), mirrorX(strip(fz, z0+L*0.12, z1-L*0.06, -0.32, -0.2, R, 1.008, 14)));
    if(!conc&&sty==='double') P.stripe.push(strip(fz, z0+L*0.14, z1-L*0.08, -0.12, -0.07, R, 1.008, 14), mirrorX(strip(fz, z0+L*0.14, z1-L*0.08, -0.12, -0.07, R, 1.008, 14)));
    if(!conc&&sty==='ventre') P.stripe.push(arc(z0+L*0.1, z1-L*0.04, -Math.PI+0.28, -0.28, 1.008));
    if(!conc&&sty==='queue') P.stripe.push(arc(z0+L*0.03, z0+L*0.3, -0.2, Math.PI+0.2, 1.01));
    // ailes
    const high=v==='prop'||v==='single'||v==='otter';
    const wingYr = high? R*0.86 : -R*0.55;
    const half=span/2, xr=R*0.75;
    if(conc){
      const zr=z1-L*0.18, secs=[wingSec(xr,-R*0.3,zr,L*0.62,0.035), wingSec(half*0.55,-R*0.32,zr-L*0.38,L*0.27,0.03), wingSec(half,-R*0.34,z0+L*0.16,L*0.07,0.03)];
      const w=loft(secs,{capEnd:[1,0,0]}); P.grey.push(w,mirrorX(w));
    } else {
      const sweep = high? 0.02 : v==='rear'?0.42 : v==='nb'?0.47 : 0.56;   // tan de la flèche
      const dihed = high? -0.01 : 0.09;
      const cr = high? L*0.11 : v==='rear'?L*0.15 : v==='nb'? L*0.17 : L*0.155, ct=cr*(high?0.6:0.27);
      const zr = high? z1-L*0.4 : z1-L*0.36;
      const kink=half*0.35, zk=zr-(kink-xr)*sweep, ck=lerp(cr,ct,0.25)*(high?1:0.82);
      const secs=[wingSec(xr,wingYr,zr,cr,0.14), wingSec(kink,wingYr+(kink-xr)*dihed,zk,ck,0.12), wingSec(half,wingYr+(half-xr)*dihed,zr-(half-xr)*sweep-cr*0.05,ct,0.1)];
      const w=loft(secs,{capEnd:[1,0,0]}); P.grey.push(w,mirrorX(w));
      // géométrie de l'aile à l'envergure x (bord d'attaque, corde, hauteur, épaisseur relative)
      const zt=zr-(half-xr)*sweep-cr*0.05;
      const wAt=x=>{ const y=wingYr+(x-xr)*dihed; if(x<=kink){ const k=(x-xr)/(kink-xr); return {zl:lerp(zr,zk,k),c:lerp(cr,ck,k),y,t:lerp(0.14,0.12,k)}; } const k=(x-kink)/(half-kink); return {zl:lerp(zk,zt,k),c:lerp(ck,ct,k),y,t:lerp(0.12,0.1,k)}; };
      // volets Fowler : rangés dans l'aile, ils sortent vers l'arrière et s'abaissent
      const flapSeg=(name,xa,xb)=>{ const sec=x=>{ const a=wAt(x), fc=a.c*0.28, zh=a.zl-a.c*0.7; return AF_U.map((u,i)=>[x, a.y+AF_S[i]*naca(u)*a.t*0.8*fc, zh-u*fc]); };
        const ha=wAt(xa), hb=wAt(xb), T=[xa,ha.y,ha.zl-ha.c*0.7], Tb=[xb,hb.y,hb.zl-hb.c*0.7], cm=(ha.c+hb.c)/2;
        pair(name,'flap',loft([sec(xa),sec(xb)],{capStart:[-1,0,0],capEnd:[1,0,0]}),T,norm(sub(Tb,T)),{fw:[0,-0.035*cm,-0.2*cm]}); };
      const fx0=high?R*1.05:xr+0.25, fx1=half*(high?0.7:0.72);
      flapSeg('flapI',fx0,Math.max(fx0+0.5,kink)); flapSeg('flapO',Math.max(fx0+0.5,kink),fx1);
      // aérofreins / spoilers sur l'extrados (sortent au toucher)
      if(!high){ const splSeg=(name,xa,xb)=>{ const U=[0.56,0.6,0.64,0.68,0.72];
          const sec=x=>{ const a=wAt(x), top=U.map(u=>[x, a.y+naca(u)*a.t*a.c+0.035, a.zl-u*a.c]), bot=U.slice().reverse().map(u=>[x, a.y+naca(u)*a.t*a.c+0.004, a.zl-u*a.c]); return [...top,...bot]; };
          const H=x=>{ const a=wAt(x); return [x, a.y+naca(0.56)*a.t*a.c+0.02, a.zl-0.56*a.c]; }, T=H(xa);
          pair(name,'spl',loft([sec(xa),sec(xb)],{capStart:[-1,0,0],capEnd:[1,0,0]}),T,norm(sub(H(xb),T))); };
        const sx0=xr+0.5, sx1=half*0.66; if(kink>sx0+0.5){ splSeg('splI',sx0,kink); splSeg('splO',kink,sx1); } else splSeg('splO',sx0,sx1); }
      // ailettes (winglets / sharklets)
      if(!high&&v!=='rear'){ const yt=wingYr+(half-xr)*dihed, zt=zr-(half-xr)*sweep-cr*0.05; const wl=loft([finSec(yt,zt,ct*0.9,0.08,half), finSec(yt+span*0.045,zt-ct*0.55,ct*0.35,0.08,half)],{capEnd:[0,1,0]}); P.tail.push(wl,mirrorX(wl)); }
      // moteurs sous l'aile
      const nac=(x,y,z,len,r)=>{ const t=tube(z-len,z,[[0,.55,0],[.12,.82,0],[.55,1,0],[.9,1,0],[1,.94,0]],r,{x,y,n:16}); const f=disc(x,y,z-0.05,r*0.82); const py=box(x-r*0.12,x+r*0.12,y+r*0.7,wingYr+(Math.abs(x)-xr)*dihed,z-len*0.75,z-len*0.15); return [t,f,py]; };
      const engAt=(fx)=>{ const x=half*fx, z=zr-(x-xr)*sweep+L*0.05, r= v==='nb'?R*0.52 : v==='rear'?R*0.5 : R*0.62, len=L*(v==='nb'?0.11:0.1);
        const y=wingYr+(x-xr)*dihed-r*1.05; const [t,f,py]=nac(x,y,z,len,r); P.eng.push(t,mirrorX(t)); P.fan.push(f,mirrorX(f)); P.grey.push(py,mirrorX(py));
        const rv=tube(z-len*0.62,z-len*0.4,[[0,1.05,0],[1,1.05,0]],r,{x,y,n:16}); revs.push(rv,mirrorX(rv)); };
      if(v==='nb'||v==='wb'||v==='md11') engAt(v==='nb'?0.33:0.31);
      if(v==='747'||v==='a380'||v==='quadwb'){ engAt(0.27); engAt(0.53); }
      if(v==='md11'){ const r=R*0.5, t=tube(z0+L*0.06,z0+L*0.19,[[0,.8,0],[.2,1,0],[1,.9,0]],r,{y:R*1.25,n:16}); P.eng.push(t); P.fan.push(disc(0,R*1.25,z0+L*0.19,r*0.8)); revs.push(tube(z0+L*0.09,z0+L*0.12,[[0,1.05,0],[1,1.05,0]],r,{y:R*1.25,n:16})); }
      if(v==='rear'){ const r=R*0.48, len=L*0.13; for(const s of [1,-1]){ const x=s*(R+r*1.15), z=z0+L*0.33; P.eng.push(tube(z-len,z,[[0,.6,0],[.15,.95,0],[.6,1,0],[1,.9,0]],r,{x,y:R*0.35,n:14})); revs.push(tube(z-len*0.62,z-len*0.4,[[0,1.04,0],[1,1.04,0]],r,{x,y:R*0.35,n:14})); P.fan.push(disc(x,R*0.35,z-0.05,r*0.8)); P.grey.push(box(Math.min(x,s*R*0.6),Math.max(x,s*R*0.6),R*0.25,R*0.45,z-len*0.7,z-len*0.25)); } }
      if(high){ // hélices
        const pr=v==='single'?R*1.15:span*0.075, nx=[];
        if(v==='single') nx.push(0); else { nx.push(half*0.28, -half*0.28); }
        for(const x of nx){ const zf=v==='single'? z1+0.1 : zr+cr*0.45, y=v==='single'?0:wingYr-R*0.2, rn=v==='single'?R*0.5:R*0.36;
          if(v!=='single'){ P.eng.push(tube(zf-L*0.2,zf,[[0,.7,0],[.3,1,0],[.85,1,0],[1,.55,0]],rn,{x,y,n:14})); }
          P.prop.push(disc(x,y,zf+0.35,pr)); P.dark.push(tube(zf,zf+0.8,[[0,.5,0],[1,.05,0]],rn,{x,y,n:12})); }
      }
    }
    // empennage
    const tTail = v==='rear'||v==='prop'&&m.id!=='SF34';
    const finH = conc? L*0.16 : L*(high?0.17:v==='a380'?0.15:0.16), finC=L*(conc?0.2:0.15), finSweep=conc?0.9:0.75;
    const zf0=z0+L*0.16, yf0=R*0.55;
    const fin=loft([finSec(yf0,zf0+finC,finC,0.11), finSec(yf0+finH,zf0+finC-finH*finSweep*0.65,finC*0.42,0.1)],{capEnd:[0,1,0]});
    P.tail.push(fin);
    if(!conc){
      const hy = tTail? yf0+finH*0.96 : R*0.15, hz = tTail? zf0+finC-finH*finSweep*0.6 : z0+L*0.13, hc=L*0.075, hs=span*(high?0.3:0.21);
      const hs1=loft([wingSec(tTail?0:R*0.4,hy,hz,hc,0.1), wingSec(hs,hy+hs*0.05,hz-hs*0.55,hc*0.4,0.09)],{capEnd:[1,0,0]});
      P.grey.push(hs1,mirrorX(hs1));
    }
    // train d'atterrissage (nœud séparé : rentré en vol)
    const gH = R*(high?0.85:1.05);
    const legs=[];
    if(!conc&&v!=='otter'&&v!=='single'){ for(const s of [1,-1]){ const x=s*(high?R*1.1:span*0.12), z=high?z1-L*0.45:z1-L*0.43;
      legs.push(box(x-0.12,x+0.12,-R-gH*0.9,high?-R*0.3:wingYr,z-0.15,z+0.15)); P.tire.push(wheel(x-0.25,-R-gH,z,gH*0.32,0.35),wheel(x+0.25,-R-gH,z,gH*0.32,0.35)); if(v!=='nb'&&!high) P.tire.push(wheel(x-0.25,-R-gH,z-1.6,gH*0.32,0.35),wheel(x+0.25,-R-gH,z-1.6,gH*0.32,0.35)); } }
    const nz=z1-L*0.12; legs.push(box(-0.1,0.1,-R-gH*0.9,-R*0.6,nz-0.12,nz+0.12)); P.tire.push(wheel(-0.18,-R-gH,nz,gH*0.25,0.25),wheel(0.18,-R-gH,nz,gH*0.25,0.25));
    if(v==='otter'||v==='single'){ for(const s of [1,-1]) { legs.push(box(s*R*0.4,s*R*1.6,-R-gH*0.9,-R*0.5,z1-L*0.42,z1-L*0.4)); P.tire.push(wheel(s*R*1.6,-R-gH,z1-L*0.41,gH*0.35,0.3)); } }
    P.gear.push(...legs);
    if(revs.length) anim.push({name:'rev',kind:'rev',T:[0,0,0],P:{rev:revs}});
    if(wins.length) anim.push({name:'win',kind:'win',T:[0,0,0],P:{lit:wins}});
    return {P, R, gH, L, span, v, anim};
  }

  /* ---------- assemblage glTF ---------- */
  const _cache={};
  function hexc(c){ if(!c) return [0.9,0.9,0.92,1]; if(c.startsWith('hsl')){ const m=c.match(/[\d.]+/g).map(Number); const h=m[0]/360,s=m[1]/100,l=m[2]/100; const q=l<.5?l*(1+s):l+s-l*s, p=2*l-q; const f=t=>{ t=(t+1)%1; return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p; }; return [f(h+1/3),f(h),f(h-1/3),1]; }
    const n=parseInt(c.replace('#',''),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,1]; }
  function uri(m, color){
    const lv=(color&&typeof color==='object')? color : {tail:color, stripe:color};
    const key=(m.id||'X')+'|'+JSON.stringify(lv); if(_cache[key]) return _cache[key];
    const B=build(m,lv), lc=hexc(lv.tail||'#1e5ba8'), sc=hexc(lv.stripe||lv.tail||'#1e5ba8');
    const mats={white:lv.body?hexc(lv.body):[0.95,0.96,0.97,1], grey:[0.74,0.77,0.82,1], tail:lc, stripe:sc, dark:[0.1,0.12,0.18,1], glass:[0.04,0.07,0.13,1], eng:lv.engine?hexc(lv.engine):[0.86,0.88,0.9,1], fan:[0.12,0.13,0.16,1], prop:[0.15,0.15,0.17,0.32], gear:[0.55,0.57,0.6,1], tire:[0.06,0.06,0.07,1], rev:[0.16,0.17,0.19,1], lit:[0.32,0.27,0.17,1]};
    const gltf={asset:{version:'2.0',generator:'Sky Empire 3D'}, scene:0, scenes:[{nodes:[]}], nodes:[], meshes:[], materials:[], accessors:[], bufferViews:[], buffers:[]};
    const chunks=[]; let off=0; const matIx={};
    const addView=(arr,target)=>{ const bytes=new Uint8Array(arr.buffer); const pad=(4-bytes.length%4)%4; chunks.push(bytes); if(pad) chunks.push(new Uint8Array(pad));
      gltf.bufferViews.push({buffer:0,byteOffset:off,byteLength:bytes.length,target}); off+=bytes.length+pad; return gltf.bufferViews.length-1; };
    const material=k=>{ if(matIx[k]!==undefined) return matIx[k]; const c=mats[k];
      gltf.materials.push({pbrMetallicRoughness:{baseColorFactor:c,metallicFactor:k==='glass'?0.7:k==='grey'||k==='eng'?0.35:0.1,roughnessFactor:k==='glass'?0.15:k==='white'?0.35:0.5},doubleSided:true, ...(k==='lit'?{emissiveFactor:[1,0.78,0.42]}:{}), ...(c[3]<1?{alphaMode:'BLEND'}:{})});
      return matIx[k]=gltf.materials.length-1; };
    // un maillage par nœud (corps, train, chaque pièce mobile)
    const mesh=parts=>{ const prims=[];
      for(const [k,list] of Object.entries(parts)){
        if(!list||!list.length) continue; const p=merge(...list); if(!p.idx.length) continue;
        const Pz=new Float32Array(p.pos), N=new Float32Array(p.nor), I=(p.pos.length/3>65000)? new Uint32Array(p.idx) : new Uint16Array(p.idx);
        const mn=[Infinity,Infinity,Infinity], mx=[-Infinity,-Infinity,-Infinity];
        for(let i=0;i<Pz.length;i++){ mn[i%3]=Math.min(mn[i%3],Pz[i]); mx[i%3]=Math.max(mx[i%3],Pz[i]); }
        const vp=addView(Pz,34962), vn=addView(N,34962), vi=addView(I,34963);
        gltf.accessors.push({bufferView:vp,componentType:5126,count:Pz.length/3,type:'VEC3',min:mn,max:mx},{bufferView:vn,componentType:5126,count:N.length/3,type:'VEC3'},{bufferView:vi,componentType:I instanceof Uint32Array?5125:5123,count:I.length,type:'SCALAR'});
        const a=gltf.accessors.length; prims.push({attributes:{POSITION:a-3,NORMAL:a-2},indices:a-1,material:material(k)});
      }
      if(!prims.length) return -1; gltf.meshes.push({primitives:prims}); return gltf.meshes.length-1; };
    // hide = pièce masquée au repos (inverseurs, hublots éclairés) : un avion garé ou sans animation reste correct
    const node=(name,parts,T,hide)=>{ const m=mesh(parts); if(m<0) return; gltf.nodes.push({mesh:m,name,...(T&&(T[0]||T[1]||T[2])?{translation:T}:{}),...(hide?{scale:[0.001,0.001,0.001]}:{})}); gltf.scene=0; gltf.scenes[0].nodes.push(gltf.nodes.length-1); };
    const body={}, gearP={gear:B.P.gear, tire:B.P.tire}; for(const [k,l] of Object.entries(B.P)) if(k!=='gear'&&k!=='tire') body[k]=l;
    node('body',body); node('gear',gearP);
    for(const an of B.anim) node(an.name,an.P,an.T,an.kind==='rev'||an.kind==='win');
    const all=new Uint8Array(off); let o=0; for(const c of chunks){ all.set(c,o); o+=c.length; }
    let bin=''; for(let i=0;i<all.length;i+=0x8000) bin+=String.fromCharCode.apply(null,all.subarray(i,i+0x8000));
    gltf.buffers.push({byteLength:off, uri:'data:application/octet-stream;base64,'+btoa(bin)});
    return _cache[key]={uri:'data:model/gltf+json;base64,'+btoa(unescape(encodeURIComponent(JSON.stringify(gltf)))), R:B.R, gH:B.gH, L:B.L, span:B.span, v:B.v,
      anim:B.anim.map(a=>({name:a.name,kind:a.kind,sg:a.sg,axis:a.axis,fw:a.fw}))};
  }
  /* ---------- configuration de vol : volets, train, aérofreins, inverseurs ---------- */
  // ph = phase (0 embarquement … 8 roulage), alt en m au-dessus de l'aéroport, spd en km/h
  function cfg(ph,alt,gnd,spd,hold,push,v){
    const jet=!(v==='prop'||v==='single'||v==='otter'), r={flap:0,gear:1,spl:0,rev:0};
    if(ph===1) r.flap=push?0:15;
    else if(ph===2){ r.flap=15; r.gear=alt>12?0:1; }
    else if(ph===3){ r.flap=alt<900?10:alt<1500?5:0; r.gear=0; }
    else if(ph===4){ r.gear=0; }
    else if(ph===5){ r.gear=0; r.flap=alt<2000?5:0; }
    else if(ph===6){ if(hold){ r.gear=0; r.flap=5; } else { r.flap=alt>700?15:alt>400?25:35; r.gear=alt<700?1:0; } }
    else if(ph===7){ r.flap=35; if(gnd){ r.spl=jet?50:0; r.rev=jet&&(spd===undefined||spd>75)?1:0; } }
    return r;
  }
  // mouvement réaliste (vitesses de sortie en temps réel)
  function step(an,tg,dt){
    const mv=(k,rate)=>{ const d=tg[k]-an[k], m=rate*dt; an[k]+=Math.abs(d)<=m?d:Math.sign(d)*m; };
    mv('flap',6); mv('spl',70); mv('gear',0.16); mv('rev',1.5); return an;
  }
  // transformations des nœuds glTF pour Cesium (objets réutilisés d'une image à l'autre)
  function pose(mi,an,out){
    const C=Cesium; out=out||{}; const trs=k=>out[k]||(out[k]=new C.TranslationRotationScale());
    const g=an.gear, tg=trs('gear');
    if(g<0.04) C.Cartesian3.fromElements(0.001,0.001,0.001,tg.scale); else C.Cartesian3.fromElements(0.55+0.45*g,0.2+0.8*g,1,tg.scale);
    for(const a of mi.anim||[]){ const t=trs(a.name);
      if(a.kind==='flap'||a.kind==='spl'){ if(!a.ax) a.ax=new C.Cartesian3(a.axis[0],a.axis[1],a.axis[2]);
        if(a.kind==='flap'){ const k=an.flap/35; C.Quaternion.fromAxisAngle(a.ax,-a.sg*an.flap*Math.PI/180,t.rotation); C.Cartesian3.fromElements(a.fw[0]*k,a.fw[1]*k,a.fw[2]*k,t.translation); }
        else C.Quaternion.fromAxisAngle(a.ax,a.sg*an.spl*Math.PI/180,t.rotation); }
      else { const s=(a.kind==='rev'?an.rev>0.3:an.lit)?1000:1; C.Cartesian3.fromElements(s,s,s,t.scale); }   // masqué au repos (échelle 0,001 dans le glTF)
    }
    return out;
  }
  return {uri, variantOf, build, cfg, step, pose};
})();
