/* ============================================================
   Sky Empire — desktop.js
   Améliorations de la version ORDINATEUR (souris + écran ≥ 821 px) :
   • Mise en page écran large : panneau latéral redimensionnable
     et repliable, carte recentrée sur la zone visible, éléments
     flottants qui ne passent plus sous le panneau.
   • Lisibilité / finition : barre du haut plus nette, chiffres
     alignés, barres de défilement fines, survols et focus clairs,
     fiche avion en verre dépoli plus compacte.
   • Immersion : ambiance jour/nuit sur la carte selon l'heure du
     jeu, vignettage cinéma, mode immersif plein écran (touche F).
   • Aérogare : plein écran (⛶ ou F), bâtiment cadré pour remplir
     l'écran (🏢 ou B), image HD, double-clic pour voir les gens.
   • Correctif : les avions ne traversent plus le bâtiment de l'aérogare.
   Raccourcis carte : F = mode immersif · P = panneau · Échap = sortir
   Raccourcis aérogare : F = plein écran · B = cadrer · G = voir les gens
                         + / − = zoom · 0 = vue générale
   N'agit pas sur mobile / tablette (aucun changement là-bas).
   ============================================================ */
(function () {
  'use strict';
  if (window.__dskLoaded) return;
  window.__dskLoaded = true;

  var MQ = window.matchMedia('(min-width: 821px) and (hover: hover) and (pointer: fine)');
  var body = document.body;
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('dsk.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('dsk.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var kickT;
  function kick(delay) { // prévient Leaflet / les canvas que la taille a changé
    clearTimeout(kickT);
    kickT = setTimeout(function () { window.dispatchEvent(new Event('resize')); }, delay == null ? 60 : delay);
  }
  function $(id) { return document.getElementById(id); }

  /* Le jeu réécrit parfois la classe de <body> : on mémorise nos classes
     et on les remet aussitôt si elles disparaissent. */
  var OUR = { 'dsk': false, 'dsk-pcol': false, 'dsk-imm': false, 'dsk-drag': false };
  function cls(name, on) { OUR[name] = !!on; body.classList.toggle(name, !!on); }
  function has(name) { return !!OUR[name]; }
  new MutationObserver(function () {
    for (var n in OUR) if (body.classList.contains(n) !== OUR[n]) body.classList.toggle(n, OUR[n]);
  }).observe(body, { attributes: true, attributeFilter: ['class'] });

  /* ---------------- STYLES ---------------- */
  var CSS = [
    'body.dsk{--dsk-pw:440px;--dsk-gold:#f5c542;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}',

    /* Panneau latéral : largeur réglable + repli */
    'body.dsk #panel{width:var(--dsk-pw);max-width:70vw;transition:transform .28s cubic-bezier(.2,.8,.2,1);box-shadow:-10px 0 30px rgba(0,0,0,.35)}',
    'body.dsk.dsk-pcol #panel{transform:translateX(100%);box-shadow:none}',
    'body.dsk.dsk-drag, body.dsk.dsk-drag *{cursor:col-resize!important;user-select:none!important}',
    '#dsk-grip{position:absolute;left:-5px;top:0;bottom:0;width:10px;cursor:col-resize;z-index:6}',
    '#dsk-grip::after{content:"";position:absolute;left:4px;top:0;bottom:0;width:2px;background:transparent;transition:background .15s}',
    '#dsk-grip:hover::after,#dsk-grip.on::after{background:var(--dsk-gold)}',
    '#dsk-ptog{position:absolute;left:-28px;top:50%;width:28px;height:60px;margin-top:-30px;border:1px solid rgba(255,255,255,.14);border-right:0;border-radius:12px 0 0 12px;background:rgba(11,18,32,.94);color:#e6edf7;cursor:pointer;font-size:15px;line-height:1;z-index:7;box-shadow:-4px 0 14px rgba(0,0,0,.3);transition:color .15s,background .15s}',
    '#dsk-ptog:hover{color:var(--dsk-gold);background:rgba(21,34,56,.98)}',

    /* La carte occupe seulement la zone visible (centrage correct) */
    'body.dsk #main > #map{left:0!important;width:auto!important;right:var(--dsk-pw)!important}',
    'body.dsk.dsk-pcol #main > #map{right:0!important}',
    /* Éléments flottants à droite : plus jamais sous le panneau */
    'body.dsk #ticker{right:calc(var(--dsk-pw) + 12px)!important}',
    'body.dsk #geBtn{right:calc(var(--dsk-pw) + 14px)!important}',
    'body.dsk.dsk-pcol #ticker{right:14px!important}',
    'body.dsk.dsk-pcol #geBtn{right:40px!important}',

    /* Barre du haut */
    'body.dsk #topbar{background:linear-gradient(180deg,rgba(8,14,26,.99),rgba(11,18,32,.95));border-bottom:1px solid rgba(245,197,66,.16);box-shadow:0 4px 18px rgba(0,0,0,.35)}',
    'body.dsk #tb-cash,body.dsk #tb-time,body.dsk #tb-week,body.dsk #tb-oil{font-variant-numeric:tabular-nums;letter-spacing:.01em}',
    '@media (min-width:1280px){body.dsk #topbar{flex-wrap:nowrap}}',
    'body.dsk .tb-sp button{transition:background .15s,color .15s,transform .1s}',
    'body.dsk .tb-sp button:hover:not(.on){background:rgba(255,255,255,.08)}',
    'body.dsk .tb-sp button:active{transform:translateY(1px)}',

    /* Lisibilité générale */
    'body.dsk #panelBody{line-height:1.45}',
    'body.dsk button{cursor:pointer}',
    'body.dsk button:focus-visible,body.dsk a:focus-visible,body.dsk [tabindex]:focus-visible{outline:2px solid var(--dsk-gold);outline-offset:2px}',
    'body.dsk #tabs button{transition:background .15s,color .15s}',
    'body.dsk #tabs button:hover{background:rgba(255,255,255,.05)}',
    'body.dsk #mapctl button{transition:filter .15s,transform .1s}',
    'body.dsk #mapctl button:hover{filter:brightness(1.15)}',
    'body.dsk ::-webkit-scrollbar{width:10px;height:10px}',
    'body.dsk ::-webkit-scrollbar-track{background:transparent}',
    'body.dsk ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:10px;border:2px solid transparent;background-clip:padding-box}',
    'body.dsk ::-webkit-scrollbar-thumb:hover{background-color:rgba(245,197,66,.6)}',
    'body.dsk *{scrollbar-color:rgba(255,255,255,.22) transparent}',

    /* Fiche avion : verre dépoli, ne déborde plus de l’écran */
    'body.dsk #flightcard{background:rgba(10,17,31,.86);-webkit-backdrop-filter:blur(12px) saturate(1.25);backdrop-filter:blur(12px) saturate(1.25);border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.45);max-height:calc(100% - 150px)}',
    '@media (max-height:700px){body.dsk #flightcard img{max-height:118px;width:100%;object-fit:cover}}',

    /* Immersion : vignettage + ambiance jour/nuit */
    '#dsk-vig{position:absolute;inset:0;pointer-events:none;z-index:450;background:radial-gradient(ellipse at 50% 50%,transparent 58%,rgba(0,0,0,.34) 100%);transition:opacity .6s}',
    'body.dsk .leaflet-tile-pane{transition:filter 2.5s linear}',

    /* Mode immersif */
    'body.dsk.dsk-imm #topbar{position:absolute;left:0;right:0;top:0;z-index:1300;transform:translateY(-102%);transition:transform .25s ease}',
    'body.dsk.dsk-imm #topbar.dsk-peek{transform:none}',
    '#dsk-hot{position:fixed;left:0;right:0;top:0;height:8px;z-index:1299;display:none}',
    'body.dsk.dsk-imm #dsk-hot{display:block}',
    '#dsk-hud{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:1250;display:none;gap:14px;align-items:center;padding:7px 16px;border-radius:999px;background:rgba(8,14,26,.72);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(245,197,66,.25);color:#f3f6fb;font:600 13px/1 system-ui,sans-serif;font-variant-numeric:tabular-nums;pointer-events:none;box-shadow:0 6px 22px rgba(0,0,0,.4)}',
    'body.dsk.dsk-imm #dsk-hud{display:flex}',
    '#dsk-hud b{color:var(--dsk-gold);font-weight:700}',
    '#dsk-hud .h{opacity:.6;font-weight:500;font-size:11px;transition:opacity 1s}',
    'body.dsk.dsk-imm #dsk-vig{background:radial-gradient(ellipse at 50% 50%,transparent 50%,rgba(0,0,0,.45) 100%)}',

    /* Boutons ajoutés */
    'body:not(.dsk) .dsk-only{display:none!important}',

    /* Toast d’aide */
    '#dsk-tip{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(10px);opacity:0;z-index:4100;padding:9px 16px;border-radius:10px;background:rgba(8,14,26,.92);color:#f3f6fb;border:1px solid rgba(245,197,66,.3);font:500 13px/1.3 system-ui,sans-serif;pointer-events:none;transition:opacity .25s,transform .25s}',
    '#dsk-tip.on{opacity:1;transform:translateX(-50%) translateY(0)}',
    '#dsk-tip kbd{display:inline-block;min-width:18px;padding:1px 6px;margin:0 2px;border-radius:5px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);font:600 12px/1.4 ui-monospace,monospace;text-align:center}'
  ].join('\n');

  var styleEl = document.createElement('style');
  styleEl.id = 'dsk-style';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ---------------- PETITS OUTILS ---------------- */
  var tipEl, tipT;
  function tip(html, ms) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'dsk-tip'; document.body.appendChild(tipEl); }
    tipEl.innerHTML = html;
    tipEl.classList.add('on');
    clearTimeout(tipT);
    tipT = setTimeout(function () { tipEl.classList.remove('on'); }, ms || 2200);
  }

  /* ---------------- PANNEAU : largeur + repli ---------------- */
  var panelW = LS.get('panelW', 440);
  function clampW(w) { return Math.round(Math.max(340, Math.min(w, window.innerWidth * 0.6))); }
  function applyW() { body.style.setProperty('--dsk-pw', clampW(panelW) + 'px'); }

  function setPanel(collapsed, silent) {
    cls('dsk-pcol', !!collapsed);
    var t = $('dsk-ptog');
    if (t) { t.textContent = collapsed ? '‹' : '›'; t.title = (collapsed ? 'Afficher' : 'Masquer') + ' le panneau (P)'; }
    if (!silent) LS.set('pcol', !!collapsed);
    kick(300);
  }

  function setupPanel() {
    var panel = $('panel');
    if (!panel || $('dsk-grip')) return;
    var grip = document.createElement('div');
    grip.id = 'dsk-grip'; grip.className = 'dsk-only';
    grip.title = 'Glisser pour élargir le panneau · double-clic : taille par défaut';
    var tog = document.createElement('button');
    tog.id = 'dsk-ptog'; tog.className = 'dsk-only'; tog.type = 'button';
    panel.appendChild(grip);
    panel.appendChild(tog);

    tog.addEventListener('click', function () { setPanel(!has('dsk-pcol')); });

    grip.addEventListener('dblclick', function () { panelW = 440; applyW(); LS.set('panelW', panelW); kick(); });
    grip.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      grip.classList.add('on'); cls('dsk-drag', true);
      panel.style.transition = 'none';
      function move(ev) { panelW = clampW(window.innerWidth - ev.clientX); applyW(); kick(30); }
      function up() {
        grip.classList.remove('on'); cls('dsk-drag', false);
        panel.style.transition = '';
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        LS.set('panelW', panelW); kick();
      }
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });

    // Cliquer un onglet quand le panneau est replié le rouvre
    var tabs = $('tabs');
    if (tabs) tabs.addEventListener('click', function () { if (has('dsk-pcol')) setPanel(false); });

    applyW();
    setPanel(LS.get('pcol', false), true);
  }

  /* ---------------- AMBIANCE JOUR / NUIT ---------------- */
  var ambOn = LS.get('ambiance', true);
  function gameHour() {
    var el = $('tb-time');
    var m = el && el.textContent.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
    return m ? (+m[1] + (+m[2]) / 60) : null;
  }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function ambiance() {
    var pane = document.querySelector('#map .leaflet-tile-pane');
    if (!pane) return;
    if (!ambOn || !has('dsk')) { pane.style.filter = ''; return; }
    var h = gameHour();
    if (h == null) return;
    // nuit : 0 en plein jour, 1 en pleine nuit (lever ~6 h, coucher ~18 h 15)
    var night = 1 - smooth(5.3, 6.9, h) + smooth(17.6, 19.2, h);
    night = Math.max(0, Math.min(1, night));
    // lumière dorée à l’aube et au crépuscule
    var golden = Math.max(0, 1 - Math.abs(h - 6.4) / 1.1) + Math.max(0, 1 - Math.abs(h - 18.1) / 1.1);
    golden = Math.min(1, golden);
    var f = 'brightness(' + (1 - 0.38 * night).toFixed(3) + ') ' +
            'saturate(' + (1 - 0.32 * night + 0.18 * golden).toFixed(3) + ') ' +
            'contrast(' + (1 + 0.06 * night).toFixed(3) + ') ' +
            'sepia(' + (0.28 * golden).toFixed(3) + ')';
    if (pane.style.filter !== f) pane.style.filter = f;
  }

  function setupVignette() {
    var map = $('map');
    if (!map || $('dsk-vig')) return;
    var v = document.createElement('div');
    v.id = 'dsk-vig'; v.className = 'dsk-only';
    map.appendChild(v);
  }

  /* ---------------- MODE IMMERSIF ---------------- */
  var hud, hudHint, wasCollapsed = false, weFs = false;
  function setupImmersive() {
    if ($('dsk-hud')) return;
    var hot = document.createElement('div'); hot.id = 'dsk-hot';
    hud = document.createElement('div'); hud.id = 'dsk-hud';
    hud.innerHTML = '<span id="dsk-hud-t"></span><b id="dsk-hud-c"></b><span class="h">Haut de l’écran : menu · F : quitter</span>';
    document.body.appendChild(hot); document.body.appendChild(hud);
    hudHint = hud.querySelector('.h');
    var tb = $('topbar');
    hot.addEventListener('mouseenter', function () { if (tb) tb.classList.add('dsk-peek'); });
    if (tb) tb.addEventListener('mouseleave', function () { tb.classList.remove('dsk-peek'); });
  }
  function hudTick() {
    if (!has('dsk-imm')) return;
    var t = $('tb-time'), c = $('tb-cash');
    var ht = $('dsk-hud-t'), hc = $('dsk-hud-c');
    if (t && ht) ht.textContent = t.textContent.trim();
    if (c && hc) hc.textContent = c.textContent.trim();
  }
  function setImmersive(on) {
    if (on === has('dsk-imm')) return;
    if (on) {
      wasCollapsed = has('dsk-pcol');
      cls('dsk-imm', true);
      setPanel(true, true);
      hudTick();
      if (hudHint) { hudHint.style.opacity = '.6'; setTimeout(function () { hudHint.style.opacity = '0'; }, 4000); }
      var de = document.documentElement;
      if (!document.fullscreenElement && de.requestFullscreen) {
        de.requestFullscreen().then(function () { weFs = true; }).catch(function () {});
      }
    } else {
      cls('dsk-imm', false);
      var tb = $('topbar'); if (tb) tb.classList.remove('dsk-peek');
      setPanel(wasCollapsed, true);
      if (weFs && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      weFs = false;
    }
    kick(320);
  }
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && weFs) { weFs = false; setImmersive(false); }
  });

  /* ---------------- BOUTONS DANS LE MENU CARTE ---------------- */
  function setupButtons() {
    var mc = $('mapctl');
    if (!mc || $('dsk-btn-imm')) return;
    function mk(id, label, title, fn, on) {
      var b = document.createElement('button');
      b.id = id; b.type = 'button'; b.className = 'adv dsk-only' + (on ? ' on' : '');
      b.textContent = label; b.title = title;
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(b); });
      return b;
    }
    var opts = null;
    for (var i = 0; i < mc.children.length; i++) if (/Options/.test(mc.children[i].textContent)) opts = mc.children[i];
    var bImm = mk('dsk-btn-imm', '🎬 Immersion', 'Mode immersif plein écran (F)', function () { setImmersive(!has('dsk-imm')); });
    var bAmb = mk('dsk-btn-amb', '🌅 Ambiance', 'Lumière jour/nuit sur la carte selon l’heure du jeu', function (b) {
      ambOn = !ambOn; LS.set('ambiance', ambOn); b.classList.toggle('on', ambOn); ambiance();
      tip(ambOn ? 'Ambiance jour/nuit activée' : 'Ambiance jour/nuit désactivée');
    }, ambOn);
    mc.insertBefore(bAmb, opts);
    mc.insertBefore(bImm, opts);
  }

  /* ---------------- CLAVIER ---------------- */
  document.addEventListener('keydown', function (e) {
    if (!has('dsk')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (body.classList.contains('pilot') || document.querySelector('#cockpit:not([hidden])[style*="block"]')) return; // ne gêne pas le pilotage
    var k = (e.key || '').toLowerCase();
    if (k === 'f') { e.preventDefault(); setImmersive(!has('dsk-imm')); }
    else if (k === 'p') { e.preventDefault(); setPanel(!has('dsk-pcol')); }
    else if (k === 'escape' && has('dsk-imm')) { setImmersive(false); }
  });

  /* ================================================================
     AÉROGARE (vue intérieure du terminal) — version ordinateur
     • Image nette (HD) : la vue n'est plus calculée en basse résolution
       puis étirée, les gens sont bien dessinés.
     • Double-clic = zoom sur l'endroit visé, jusqu'au niveau où l'on voit
       chaque personne en détail. Maj + double-clic = dézoomer.
     • Touches : G = « voir les gens » (zoom là où est la souris),
       + / − = zoom, 0 = vue générale.
     • Bandeau d'annonces plus discret, centré.
     ================================================================ */
  var tmHD = LS.get('tmHD', true);
  var tmMouse = null;            // dernière position de la souris sur le plan
  var tmZoomBusy = false;
  function tmOpenNow() {
    var ov = $('tmOv');
    if (!ov) return false;
    var r = ov.getBoundingClientRect();
    return getComputedStyle(ov).display !== 'none' && getComputedStyle(ov).visibility !== 'hidden' && r.width > 0 && r.height > 0;
  }
  function tmCam() { try { return (typeof TM !== 'undefined' && TM && TM.cam) ? TM.cam : null; } catch (e) { return null; } }
  // Zoom progressif en réutilisant la molette du jeu (même logique que la souris)
  function tmZoomTo(target, cx, cy) {
    var cv = $('tmCv'), cam = tmCam();
    if (!cv || !cam || tmZoomBusy) return;
    var r = cv.getBoundingClientRect();
    if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    var steps = Math.round(Math.log(target / cam.s) / Math.log(1.15));
    if (!steps) return;
    var n = Math.min(Math.abs(steps), 20), dir = steps > 0 ? -300 : 300, i = 0;
    tmZoomBusy = true;
    (function step() {
      cv.dispatchEvent(new WheelEvent('wheel', { deltaY: dir, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      if (++i < n) setTimeout(step, 28); else tmZoomBusy = false;
    })();
  }
  // « Voir les gens » : si on est très loin, on va d'abord dans la zone la
  // plus animée (le contrôle de sûreté), puis on zoome au niveau détaillé.
  function tmSeePeople(cx, cy) {
    var cam = tmCam(); if (!cam) return;
    if (cam.s < 0.5 && cx == null) {
      var zb = [].slice.call(document.querySelectorAll('#tmZones button')).filter(function (b) { return /S[ûu]ret/.test(b.textContent); })[0];
      if (zb) { zb.click(); setTimeout(function () { tmZoomTo(1.6); }, 1600); return; }
    }
    tmZoomTo(Math.max(1.6, cam.s), cx, cy);
  }
  function setupTerminal() {
    var cv = $('tmCv');
    if (!cv || cv.__dsk) return !!cv;
    cv.__dsk = true;
    cv.addEventListener('mousemove', function (e) { tmMouse = [e.clientX, e.clientY]; });
    cv.addEventListener('dblclick', function (e) {
      if (!has('dsk')) return;
      var cam = tmCam(); if (!cam) return;
      e.preventDefault();
      if (e.shiftKey) tmZoomTo(Math.max(0.3, cam.s / 2.3), e.clientX, e.clientY);
      else tmZoomTo(cam.s < 0.8 ? 1.5 : Math.min(2.6, cam.s * 1.8), e.clientX, e.clientY);
    });
    return true;
  }
  // Netteté : le jeu baisse la résolution pour gagner en fluidité ; sur PC on
  // garde au moins la résolution réelle de l'écran (plafonnée à 1,5).
  function setupTerminalHD() {
    if (typeof window.tmAdapt !== 'function' || window.tmAdapt.__dsk) return;
    var orig = window.tmAdapt;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      try {
        if (tmHD && has('dsk') && TM) {
          var floor = Math.min(window.devicePixelRatio || 1, 1.5);
          if (TM.dprMax < floor) TM.dprMax = floor;
          if (TM.dpr < floor) TM.dpr = floor;
        }
      } catch (e) {}
      return r;
    };
    wrapped.__dsk = true;
    window.tmAdapt = wrapped;
  }
  function setupTerminalButtons() {
    var top = $('tmTop');
    if (!top || $('dsk-tm-ppl')) return;
    var host = top.querySelector('button') ? top.querySelector('button').parentElement : top;
    var ref = host.querySelector('button');
    function mk(id, label, title, fn) {
      var b = document.createElement('button');
      b.id = id; b.type = 'button'; b.className = (ref ? ref.className : '') + ' dsk-only dsk-tmb';
      b.textContent = label; b.title = title;
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(b); });
      return b;
    }
    var bP = mk('dsk-tm-ppl', '👥', 'Voir les gens de près (G) · double-clic sur le plan pour zoomer', function () { tmSeePeople(); });
    var bH = mk('dsk-tm-hd', 'HD', 'Image nette (désactive si le jeu rame)', function (b) {
      tmHD = !tmHD; LS.set('tmHD', tmHD); b.classList.toggle('dsk-off', !tmHD);
      tip(tmHD ? 'Aérogare en haute définition' : 'Aérogare en mode fluide (moins net)');
    });
    if (!tmHD) bH.classList.add('dsk-off');
    host.insertBefore(bH, ref);
    host.insertBefore(bP, ref);
  }
  var TM_CSS = [
    'body.dsk #tmAnn{left:50%!important;right:auto!important;transform:translateX(-50%);width:auto!important;max-width:min(640px,calc(100% - 40px));padding:6px 14px!important;font-size:12px!important;line-height:1.35;opacity:.94;border-radius:12px!important;box-shadow:0 8px 24px rgba(0,0,0,.35)}',
    'body.dsk #tmCv{cursor:grab}',
    'body.dsk #tmCv:active{cursor:grabbing}',
    'body.dsk .dsk-tmb{font-weight:700;min-width:36px}',
    'body.dsk .dsk-tmb.dsk-off{opacity:.45;text-decoration:line-through}',
    'body.dsk #tmZones button{transition:filter .15s,transform .1s}',
    'body.dsk #tmZones button:hover{filter:brightness(1.2);transform:translateY(-1px)}'
  ].join('\n');
  styleEl.textContent += '\n' + TM_CSS;
  var tmTipShown = LS.get('tmTip', false);
  function terminalTick() {
    setupTerminalHD();
    if (!tmOpenNow()) return;
    setupTerminal();
    setupTerminalButtons();
    if (!tmTipShown && has('dsk')) {
      tmTipShown = true; LS.set('tmTip', true);
      tip('Aérogare : <kbd>F</kbd> plein écran · <kbd>B</kbd> cadrer le bâtiment · <kbd>double-clic</kbd> voir les gens de près', 6500);
    }
  }
  document.addEventListener('keydown', function (e) {
    if (!has('dsk') || !tmOpenNow()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    var cam = tmCam(); if (!cam) return;
    var k = e.key;
    if (k === 'g' || k === 'G') { e.stopImmediatePropagation(); e.preventDefault(); if (tmMouse) tmSeePeople(tmMouse[0], tmMouse[1]); else tmSeePeople(); }
    else if (k === '+' || k === '=') { e.stopImmediatePropagation(); e.preventDefault(); tmZoomTo(Math.min(3, cam.s * 1.5)); }
    else if (k === '-' || k === '_') { e.stopImmediatePropagation(); e.preventDefault(); tmZoomTo(Math.max(0.3, cam.s / 1.5)); }
    else if (k === '0') {
      var z = $('tmZones'), b = z && z.querySelector('button');
      if (b) { e.stopImmediatePropagation(); e.preventDefault(); b.click(); }
    }
  }, true);

  /* ================================================================
     AÉROGARE EN PLEIN ÉCRAN (comme un vrai jeu)
     Bouton ⛶ dans la barre de l'aérogare (ou touche F quand l'aérogare
     est ouverte) : l'aérogare passe en plein écran et le bâtiment est
     cadré pour remplir tout l'écran. Échap pour sortir.
     ================================================================ */
  var tmFS = false;
  function tmBuildingBox() {
    try {
      var P = TM.L && TM.L.poi; if (!P || !P.length) return null;
      var b = [1e9, 1e9, -1e9, -1e9];
      for (var i = 0; i < P.length; i++) {
        b[0] = Math.min(b[0], P[i].x0); b[1] = Math.min(b[1], P[i].y0);
        b[2] = Math.max(b[2], P[i].x1); b[3] = Math.max(b[3], P[i].y1);
      }
      return b;
    } catch (e) { return null; }
  }
  // Cadre le bâtiment entier pour qu'il remplisse l'écran
  // (dans le jeu : écran = (monde − cam) × s).
  function tmFit() {
    var cam = tmCam(), cv = $('tmCv'), b = tmBuildingBox();
    if (!cam || !cv || !b) return;
    var W = cv.clientWidth, H = cv.clientHeight;
    // Marges : on laisse de la place aux barres du haut (titre, heure) et du bas (zones)
    var cr = cv.getBoundingClientRect(), padT = 0, padB = 0;
    var ov = $('tmOv'), kids = ov ? ov.querySelectorAll('#tmOv > *') : [];
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i]; if (k === cv || k.id === 'tmAnn') continue;
      var r = k.getBoundingClientRect();
      if (!r.width || !r.height || r.width < W * 0.3) continue;
      if (r.top - cr.top < H * 0.2 && r.bottom - cr.top < H * 0.3) padT = Math.max(padT, r.bottom - cr.top + 6);
      else if (cr.bottom - r.bottom < H * 0.2 && cr.bottom - r.top < H * 0.3) padB = Math.max(padB, cr.bottom - r.top + 6);
    }
    var bw = b[2] - b[0], bh = b[3] - b[1];
    var s = Math.min(W / bw, (H - padT - padB) / bh) * 0.985;
    cam.s = s;
    cam.x = (b[0] + b[2]) / 2 - W / (2 * s);
    cam.y = (b[1] + b[3]) / 2 - (padT + (H - padT - padB) / 2) / s;
    try { TM.goal = null; } catch (e) {}
  }
  function tmFullscreen(on) {
    var ov = $('tmOv'); if (!ov) return;
    if (on) {
      var el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().then(function () {
        tmFS = true; setTimeout(tmFit, 250);
      }).catch(function () { tmFit(); });
      else tmFit();
    } else {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      tmFS = false;
    }
  }
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && tmFS) tmFS = false;
    var b = $('dsk-tm-fs'); if (b) b.textContent = document.fullscreenElement ? '🗗' : '⛶';
  });
  window.addEventListener('resize', function () { if (tmFS && tmOpenNow()) setTimeout(tmFit, 120); });
  function setupTerminalFS() {
    var top = $('tmTop');
    if (!top || $('dsk-tm-fs')) return;
    var host = top.querySelector('button') ? top.querySelector('button').parentElement : top;
    var ref = host.querySelector('button');
    var b = document.createElement('button');
    b.id = 'dsk-tm-fs'; b.type = 'button'; b.className = (ref ? ref.className : '') + ' dsk-only dsk-tmb';
    b.textContent = document.fullscreenElement ? '🗗' : '⛶';
    b.title = 'Aérogare en plein écran (F) · Échap pour sortir';
    b.addEventListener('click', function (e) { e.stopPropagation(); tmFullscreen(!document.fullscreenElement); });
    host.insertBefore(b, ref);
    var f = document.createElement('button');
    f.id = 'dsk-tm-fit'; f.type = 'button'; f.className = (ref ? ref.className : '') + ' dsk-only dsk-tmb';
    f.textContent = '🏢'; f.title = 'Cadrer tout le bâtiment à l’écran (B)';
    f.addEventListener('click', function (e) { e.stopPropagation(); tmFit(); });
    host.insertBefore(f, ref);
  }
  document.addEventListener('keydown', function (e) {
    if (!has('dsk') || !tmOpenNow()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (e.key === 'f' || e.key === 'F') { e.stopImmediatePropagation(); e.preventDefault(); tmFullscreen(!document.fullscreenElement); }
    else if (e.key === 'b' || e.key === 'B') { e.stopImmediatePropagation(); e.preventDefault(); tmFit(); }
  }, true);
  var tmWasOpen = false;
  function terminalFSTick() {
    var open = tmOpenNow();
    if (open) setupTerminalFS();
    // À l'ouverture sur PC : le bâtiment est directement cadré plein cadre
    if (open && !tmWasOpen && has('dsk')) setTimeout(tmFit, 400);
    if (!open && tmWasOpen && tmFS) tmFullscreen(false);
    tmWasOpen = open;
  }

  /* ================================================================
     CORRECTIF (tous appareils) : avions qui traversent l'aérogare
     Certains vols au départ (surtout ceux des compagnies rivales)
     continuent leur trajet vers le sud après le décollage et passent
     à travers le bâtiment. Aucun avion ne doit se trouver au sud de la
     façade côté pistes : on ne les dessine plus là.
     ================================================================ */
  function setupPlaneFix() {
    if (typeof window.tmPlane !== 'function' || window.tmPlane.__dsk) return;
    var orig = window.tmPlane, cacheL = null, topY = null;
    var fixed = function (c, x, y, col, h, sc, al, p) {
      try {
        if (TM.L !== cacheL) { cacheL = TM.L; var b = tmBuildingBox(); topY = b ? b[1] : null; }
        if (topY != null && p && (p.riv || p.man || p.soon) && y > topY + 20) return;
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    fixed.__dsk = true;
    window.tmPlane = fixed;
  }

  /* ---------------- ACTIVATION ---------------- */
  function apply() {
    var on = MQ.matches;
    cls('dsk', on);
    if (!on) { setImmersive(false); cls('dsk-pcol', false); }
    else { setPanel(LS.get('pcol', false), true); applyW(); }
    ambiance();
    kick();
  }
  function init() {
    setupPanel();
    setupVignette();
    setupImmersive();
    setupButtons();
    apply();
    if (MQ.addEventListener) MQ.addEventListener('change', apply); else if (MQ.addListener) MQ.addListener(apply);
    window.addEventListener('resize', function () { if (has('dsk')) applyW(); });
    setInterval(ambiance, 2000);
    setInterval(hudTick, 1000);
    setInterval(function () { setupPlaneFix(); terminalTick(); terminalFSTick(); }, 700);
    setupPlaneFix(); terminalTick();
    if (MQ.matches && !LS.get('tipSeen', false)) {
      setTimeout(function () { tip('Nouveau sur ordinateur : <kbd>F</kbd> mode immersif · <kbd>P</kbd> panneau · bord du panneau = glisser pour l’élargir', 6000); }, 2500);
      LS.set('tipSeen', true);
    }
  }
  // Le jeu construit son interface au chargement : on attend qu’elle soit là
  function ready() {
    if ($('panel') && $('map') && $('mapctl')) init();
    else setTimeout(ready, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
