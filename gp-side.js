/* PRO EHS · menú lateral de administrador en las herramientas (escritorio) */
(function () {
  var ADMINS = ['vdiaz@grupopro.cl'];
  if (window.__gpSide) return; window.__gpSide = 1;
  function cuenta() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var v = localStorage.getItem(localStorage.key(i));
        if (v && v.indexOf('"username"') >= 0 && v.indexOf('"homeAccountId"') >= 0) { var o = JSON.parse(v); if (o && o.username) return String(o.username).toLowerCase(); }
      }
    } catch (e) {}
    return '';
  }
  var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
             set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  var vistaEquipo = LS.get('gpHomeVista', '') === 'equipo';
  if (ADMINS.indexOf(cuenta()) < 0 || vistaEquipo) return;

  var IC = {
    home: 'M3 11l9-8 9 8M5 10v10h14V10',
    cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
    panel: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    est: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-7',
    obs: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    charla: 'M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z',
    up: 'M12 19V5M5 12l7-7 7 7',
    forms: 'M4 6h16M4 12h16M4 18h10',
    warn: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'
  };
  var svg = function (k) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + IC[k] + '"/></svg>'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var CENTROS = ['Walmart Peñón', 'Walmart Pudahuel', 'Líder La Reina', 'Walmart Lo Aguirre', 'Walmart La Farfana'];
  var pag = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var TOOLS = [
    { h: './', l: 'Inicio', i: 'home', p: /^(index\.html)?$/ },
    { h: 'calendario.html', l: 'Calendario', i: 'cal', p: /^calendario/ },
    { h: 'panel.html', l: 'Panel de control', i: 'panel', p: /^panel/ },
    { h: 'estadisticas.html', l: 'Estadísticas', i: 'est', p: /^estadisticas/ },
    { h: 'observaciones.html', l: 'Observaciones', i: 'obs', p: /^observaciones/, sub: 1 },
    { h: 'eventos.html', l: 'Hallazgos y eventos', i: 'warn', p: /^eventos/, sub: 1 },
    { h: 'sugerencias.html#bandeja', l: 'Sugerencias del equipo', i: 'charla', p: /^sugerencias/ },
    { h: 'panel.html', l: 'Cargar programa', i: 'up', p: /^$^/ },
    { h: './#formularios', l: 'Formularios', i: 'forms', p: /^$^/ }
  ];

  var css = '' +
    '.gs{display:none}' +
    '@media(min-width:1024px){' +
    'body.gs-on{padding-left:236px!important;transition:padding-left .2s}body.gs-on.gs-min{padding-left:68px!important}' +
    '.gs{display:flex;flex-direction:column;gap:2px;position:fixed;inset:0 auto 0 0;width:236px;background:#18181b;color:#e4e4e7;padding:18px 12px;overflow-y:auto;z-index:900;font-family:Manrope,Arial,sans-serif;transition:width .2s;box-sizing:border-box}' +
    '.gs *{box-sizing:border-box}' +
    '.gs .sl{display:flex;align-items:center;gap:10px;color:#fff;font-size:17px;padding:0 6px 14px;text-decoration:none}' +
    '.gs .sl b{white-space:nowrap}.gs .lgo{background:#fff;border-radius:9px;padding:4px 8px;display:inline-flex}.gs .lgo img{height:22px;display:block}' +
    '.gs .sh{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#71717a;padding:14px 8px 6px}' +
    '.gs a,.gs button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:transparent;color:#d4d4d8;font:600 13.5px Manrope,Arial,sans-serif;padding:8px 10px;border-radius:9px;cursor:pointer;text-decoration:none}' +
    '.gs a:hover,.gs button:hover{background:#27272a}.gs a.on{background:#fff;color:#18181b;font-weight:800}' +
    '.gs .smin{margin-left:auto;width:32px;height:32px;padding:0;justify-content:center;color:#a1a1aa}.gs .smin svg{transition:transform .2s}' +
    '.gs .sub{display:flex;flex-direction:column;gap:1px;margin:2px 0 6px 18px;padding-left:8px;border-left:1px solid #3f3f46}' +
    '.gs .sub a{font-size:12.5px;padding:6px 9px;font-weight:600;background:transparent;color:#a1a1aa}.gs .sub a.on{background:#27272a;color:#fff;font-weight:800}' +
    'body.gs-min .gs{width:68px;padding:18px 10px}' +
    'body.gs-min .gs .sl{flex-direction:column;padding:0 0 10px;gap:12px}body.gs-min .gs .lgo{padding:6px 9px}' +
    'body.gs-min .gs .lgo img{height:30px;width:23px;object-fit:cover;object-position:left center}' +
    'body.gs-min .gs .sl b,body.gs-min .gs .sh,body.gs-min .gs .ctr,body.gs-min .gs a span,body.gs-min .gs .sub{display:none}' +
    'body.gs-min .gs .smin{margin:0}body.gs-min .gs .smin svg{transform:rotate(180deg)}body.gs-min .gs a{justify-content:center;padding:10px 0}' +
    'body.gs-on nav.side{display:none!important}body.gs-on .main{margin-left:0!important}' +
    '}';

  function montar() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var centro = LS.get('gpHomeCentro', '');
    var aside = document.createElement('aside'); aside.className = 'gs'; aside.setAttribute('aria-label', 'Menú');
    aside.innerHTML = '<div class="sl"><span class="lgo"><img src="logo.png" alt="Grupo Pro"></span><b>PRO EHS</b>' +
      '<button type="button" class="smin" title="Minimizar o expandir el menú" aria-label="Minimizar o expandir el menú"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button></div>' +
      '<div class="sh">Herramientas</div>' + TOOLS.map(function (t) {
        var on = t.p.test(pag);
        return '<a href="' + t.h + '" title="' + t.l + '" class="' + (on ? 'on' : '') + '"' + (t.l === 'Inicio' ? ' data-gsc=""' : '') + '>' + svg(t.i) + '<span>' + t.l + '</span></a>' + (t.sub && on ? '<div class="sub" id="gsSub"></div>' : '');
      }).join('');
    document.body.insertBefore(aside, document.body.firstChild);
    document.body.classList.add('gs-on');
    if (LS.get('gpSideMin', '') === '1') document.body.classList.add('gs-min');
    // Secciones propias de la página (Observaciones)
    var sub = aside.querySelector('#gsSub'), old = document.querySelector('nav.side');
    if (sub && old) [].slice.call(old.querySelectorAll('a[data-v]')).forEach(function (a) { sub.appendChild(a); });
    aside.addEventListener('click', function (e) {
      if (e.target.closest('.smin')) { var mn = !document.body.classList.contains('gs-min'); document.body.classList.toggle('gs-min', mn); LS.set('gpSideMin', mn ? '1' : ''); return; }
      var b = e.target.closest('[data-gsc]'); if (b) { e.preventDefault(); LS.set('gpHomeCentro', b.getAttribute('data-gsc')); location.href = './'; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
