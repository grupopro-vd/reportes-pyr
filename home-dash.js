/* PRO EHS · inicio con avance del programa (E2 administrador, E1 encargado, W1 escritorio) */
(function () {
  'use strict';
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzm9nT8n5zazy7ANUWsryccY5178aI7-Orp1jpUZ33Bgzg2m3h5NH6ka3PDWi1r3YEg9w/exec', KEY = 'GP-PYR-2026';
  var ADMINS = ['vdiaz@grupopro.cl'];
  var ORDEN = ['Walmart Peñón', 'Walmart Pudahuel', 'Líder La Reina', 'Walmart Lo Aguirre', 'Walmart La Farfana', 'Líder Lo Barnechea', 'Oficina Grupo Pro', 'ICB', 'Transporte TransPRO', 'Lippi', '4 Ruedas'];
  var PROG = [
    { n: 'Charlas', m: /subcontrat/, c: '#1d4ed8' },
    { n: 'Check list', m: /check ?list/, c: '#b45309' },
    { n: 'Inspecciones', m: /inspecc|observac/, c: '#0f766e' },
    { n: 'Comité', m: /comit/, c: '#7e22ce' },
    { n: 'Charla ACHS', m: /achs|mutual/, c: '#15803d' }
  ];
  var FORM = { 'Charla': 'charlas.html', 'Capacitación': 'charlas.html', 'Inducción': 'charlas.html', 'Comité Paritario': 'comite.html', 'Auditoría Mensual': 'auditoria_mensual.html', 'Pre Auditoría': 'pre_auditoria.html',
    'Check list de equipos': 'check_list_equipos.html', 'Check list de arnés': 'check_list_arnes.html', 'Check list de EPP': 'check_list_epp.html', 'Inspección': 'hallazgos.html', 'Inspección / Hallazgos': 'hallazgos.html',
    'Entrega de EPP': 'entrega_epp.html', 'Observación de conducta': 'observacion_conducta.html' };
  var CTA = { 'charlas.html': 'Registrar', 'comite.html': 'Acta', 'hallazgos.html': 'Hacer', 'observacion_conducta.html': 'Observar', 'check_list_equipos.html': 'Hacer', 'check_list_arnes.html': 'Hacer', 'check_list_epp.html': 'Hacer' };
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var IC = {
    hallazgo: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
    obs: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    check: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
    charla: 'M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z',
    ast: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    comite: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    panel: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
    est: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-7',
    cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
    warn: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    up: 'M12 19V5M5 12l7-7 7 7',
    forms: 'M4 6h16M4 12h16M4 18h10'
  };
  var QUICK = [
    { l: 'Hallazgo', h: 'hallazgos.html', i: 'hallazgo' },
    { l: 'Observación', h: 'observacion_conducta.html', i: 'obs' },
    { l: 'Check list', h: '#checklist', i: 'check' },
    { l: 'Charla', h: 'charlas.html', i: 'charla' },
    { l: 'AST', h: 'permiso_trabajo.html', i: 'ast' },
    { l: 'Comité', h: 'comite.html', i: 'comite' },
    { l: 'Panel', h: 'panel.html', i: 'panel' },
    { l: 'Estadísticas', h: 'estadisticas.html', i: 'est' }
  ];

  var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
             set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var col = function (p) { return p >= 90 ? '#16623f' : p >= 70 ? '#b45309' : '#b3261e'; };
  var short = function (c) { return String(c).replace(/^(Walmart|Líder|Lider)\s+/, ''); };
  var svg = function (k, w, s) { return '<svg width="' + (w || 21) + '" height="' + (w || 21) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (s || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + IC[k] + '"/></svg>'; };
  var fcorta = function (s) { var d = new Date(s + 'T12:00:00'); return d.getDate() + ' ' + MES[d.getMonth()].slice(0, 3); };

  // ---- Quién soy
  function cuenta() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var v = localStorage.getItem(localStorage.key(i));
        if (v && v.indexOf('"username"') >= 0 && v.indexOf('"homeAccountId"') >= 0) {
          var o = JSON.parse(v); if (o && o.username) return { user: String(o.username).toLowerCase(), name: o.name || '' };
        }
      }
    } catch (e) {}
    return null;
  }
  var ACC = cuenta();
  var ES_ADMIN = !!ACC && ADMINS.indexOf(ACC.user) >= 0;
  function perfil() { return LS.get('gpPerfil', {}) || {}; }
  function miCentro() { var p = perfil(); return p.panelCentro != null && p.panelCentro !== '' ? p.panelCentro : (p.centro || ''); }
  function vista() { return ES_ADMIN && LS.get('gpHomeVista', '') !== 'equipo' ? 'admin' : 'equipo'; }

  // ---- Datos
  var DATA = null, ERR = '';
  function slim(d) {
    var mv = d.moves || {};
    return { updatedAt: d.updatedAt || '', at: Date.now(), pending: (d.pending || []).map(function (p) { return { id: String(p.id), centro: p.centro, title: p.title, nombre: p.nombre, estado: p.estado, at: p.at }; }),
      items: (d.items || []).map(function (x) { var m = mv[x.id]; var f = m && m.fecha ? m.fecha : (x.Fecha || ''); return { id: String(x.id), Title: x.Title, Centro: x.Centro, Programa: x.Programa, Tipo: x.Tipo, DirigidoA: x.DirigidoA, Fecha: f, Mes: f ? f.slice(0, 7) : (x.Mes || ''), Estado: x.Estado }; }) };
  }
  function cargarCache() {
    var c = LS.get('gpHomeData', null);
    if (c && c.items) return c;
    var p = LS.get('gpPanelData2', null);
    if (p && p.items) return slim(p);
    return null;
  }

  // ---- Cálculos
  var HOY, MESHOY, LUN, DOM;
  function fechas() {
    var d = new Date(); HOY = iso(d); MESHOY = HOY.slice(0, 7);
    var l = new Date(d); l.setDate(d.getDate() - (d.getDay() + 6) % 7); LUN = iso(l);
    var s = new Date(l); s.setDate(l.getDate() + 6); DOM = iso(s);
  }
  var PENDSET = {};
  function estado(it) {
    if (it.Estado === 'Realizada') return 'ok';
    if (PENDSET[it.id]) return 'val';
    if ((it.Fecha && it.Fecha < HOY) || (!it.Fecha && it.Mes && it.Mes < MESHOY)) return 'late';
    return 'todo';
  }
  function enPeriodo(it, per) {
    if (per === 'semana') return !!it.Fecha && it.Fecha >= LUN && it.Fecha <= DOM;
    return (it.Fecha ? it.Fecha.slice(0, 7) : it.Mes) === MESHOY;
  }
  function progIdx(it) { var p = norm(it.Programa); for (var i = 0; i < PROG.length; i++) if (PROG[i].m.test(p)) return i; return -1; }
  function resumen(list) { var r = { t: list.length, ok: 0, todo: 0, late: 0, val: 0 }; list.forEach(function (it) { r[estado(it)]++; }); r.p = r.t ? Math.round(r.ok / r.t * 100) : null; return r; }

  // ---- Render
  var root = document.getElementById('dash'), side = document.getElementById('dside');
  var st = { centro: LS.get('gpHomeCentro', ''), per: LS.get('gpHomePer', 'semana') };

  function ring(p, size, label) {
    var C = 2 * Math.PI * 44, v = p == null ? 0 : p;
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px"><svg width="' + size + '" height="' + size + '" viewBox="0 0 104 104" role="img" aria-label="Avance ' + v + ' por ciento">' +
      '<circle cx="52" cy="52" r="44" fill="none" stroke="#3f3f46" stroke-width="11"/>' +
      '<circle cx="52" cy="52" r="44" fill="none" stroke="#bd0926" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + (C * v / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 52 52)"/></svg>' +
      '<div class="rv"><div><b>' + (p == null ? '—' : p + '%') + '</b><small>' + esc(label) + '</small></div></div></div>';
  }
  function bar(name, r, sub, href) {
    var p = r.p, c = p == null ? '#a1a1aa' : col(p);
    return '<' + (href ? 'a href="' + href + '"' : 'div') + ' class="bar"><span class="bn">' + esc(name) + '</span><span class="bt"><span style="width:' + (p || 0) + '%;background:' + c + '"></span></span>' +
      '<span class="bp"><b style="color:' + c + '">' + (p == null ? '—' : p + '%') + '</b><small>' + (r.t ? r.ok + ' de ' + r.t : 'no programado') + '</small></span></' + (href ? 'a' : 'div') + '>';
  }
  function formHref(it) {
    var f = FORM[it.Tipo]; if (it.Tipo === 'Check list de equipos' && /emergencia|anden/i.test(it.Title || '')) f = null;
    if (!f) return null;
    return f + '?act=' + encodeURIComponent(it.id) + '&c=' + encodeURIComponent(it.Centro) + '&t=' + encodeURIComponent(it.Title) + '&tipo=' + encodeURIComponent(it.Tipo) +
      (it.Tipo === 'Observación de conducta' ? (/pare/i.test(it.Title) ? '&modo=pare' : /apilador/i.test(it.Title) ? '&modo=almac' : '&modo=conducta') : '');
  }
  function dotColor(it) { var i = progIdx(it); return i >= 0 ? PROG[i].c : '#71717a'; }

  function hoyHTML(items, agrupar) {
    var hoy = items.filter(function (it) { return it.Fecha === HOY; });
    var late = items.filter(function (it) { return estado(it) === 'late' && it.Fecha; }).sort(function (a, b) { return a.Fecha < b.Fecha ? 1 : -1; });
    var rows = [];
    if (agrupar) {
      var g = {}, ord = [];
      hoy.forEach(function (it) { var k = it.Title + '|' + it.Programa; if (!g[k]) { g[k] = { it: it, cs: [], ok: 0 }; ord.push(k); } g[k].cs.push(short(it.Centro)); if (estado(it) === 'ok') g[k].ok++; });
      ord.forEach(function (k) { var x = g[k], done = x.ok === x.cs.length;
        rows.push('<div class="hrow' + (done ? ' done' : '') + '"><span class="dot" style="background:' + dotColor(x.it) + '"></span><div class="ht"><b>' + (done ? '✓ ' : '') + esc(x.it.Title) + '</b><small>' + esc(x.cs.join(' · ')) + (x.ok && !done ? ' · ' + x.ok + ' hecha' + (x.ok > 1 ? 's' : '') : '') + '</small></div><a class="hcta" href="calendario.html">Ver</a></div>'); });
    } else {
      hoy.forEach(function (it) { var s = estado(it), f = formHref(it);
        rows.push('<div class="hrow' + (s === 'ok' ? ' done' : '') + '"><span class="dot" style="background:' + dotColor(it) + '"></span><div class="ht"><b>' + (s === 'ok' ? '✓ ' : '') + esc(it.Title) + '</b><small>' + esc(it.Programa || it.Tipo || '') + (s === 'val' ? ' · por validar' : '') + '</small></div>' +
          (s === 'ok' || s === 'val' ? '' : '<a class="hcta dark" href="' + (f || 'calendario.html') + '">' + (f ? (CTA[f.split('?')[0]] || 'Registrar') : 'Ver') + '</a>') + '</div>'); });
    }
    late.slice(0, 3).forEach(function (it) { var f = formHref(it);
      rows.push('<div class="hrow"><span class="dot" style="background:#b3261e"></span><div class="ht"><b>' + esc(it.Title) + '</b><small class="lt">' + (agrupar ? esc(short(it.Centro)) + ' · ' : '') + 'atrasada · ' + fcorta(it.Fecha) + '</small></div><a class="hcta" href="' + (f || 'calendario.html') + '">' + (f ? 'Hacer' : 'Ver') + '</a></div>'); });
    if (late.length > 3) rows.push('<a class="more" href="calendario.html">+' + (late.length - 3) + ' atrasadas más</a>');
    if (!hoy.length) {
      var prox = items.filter(function (it) { return it.Fecha > HOY && estado(it) !== 'ok'; }).sort(function (a, b) { return a.Fecha < b.Fecha ? -1 : 1; })[0];
      rows.unshift('<div class="hempty">Sin actividades programadas para hoy.' + (prox ? '<br>Próxima: <b>' + esc(prox.Title) + '</b> · ' + DIA[new Date(prox.Fecha + 'T12:00:00').getDay()] + ' ' + fcorta(prox.Fecha) : '') + '</div>');
    }
    var d = new Date(HOY + 'T12:00:00');
    return '<section class="dcard dhoy"><div class="dh"><h2>Hoy · ' + DIA[d.getDay()] + ' ' + d.getDate() + '</h2><span class="muted">' + (hoy.length ? hoy.length + ' actividad' + (hoy.length > 1 ? 'es' : '') : '') + '</span></div>' + rows.join('') +
      '<a class="lnk" href="calendario.html">Ver calendario completo →</a></section>';
  }

  function render() {
    fechas();
    var admin = vista() === 'admin';
    root.className = 'dash ' + (admin ? 'admin' : 'team');
    document.body.classList.toggle('has-side', admin);
    PENDSET = {}; ((DATA && DATA.pending) || []).forEach(function (p) { PENDSET[p.id] = 1; });
    var all = (DATA && DATA.items) || [];
    var centros = ORDEN.filter(function (c) { return all.some(function (it) { return it.Centro === c; }); });
    all.forEach(function (it) { if (it.Centro && centros.indexOf(it.Centro) < 0) centros.push(it.Centro); });

    var centro = admin ? (centros.indexOf(st.centro) >= 0 ? st.centro : '') : miCentro();
    var items = centro ? all.filter(function (it) { return it.Centro === centro; }) : (admin ? all : []);
    var per = st.per === 'mes' ? 'mes' : 'semana';
    var perItems = items.filter(function (it) { return enPeriodo(it, per); });
    var R = resumen(perItems);
    var lateAll = items.filter(function (it) { return estado(it) === 'late'; }).length;
    var valAll = items.filter(function (it) { return estado(it) === 'val'; }).length;
    var nombre = (perfil().name || (ACC && ACC.name) || '').split(' ')[0];
    var lun = new Date(LUN + 'T12:00:00'), dom = new Date(DOM + 'T12:00:00');
    var rango = per === 'semana' ? 'Semana del ' + lun.getDate() + (lun.getMonth() !== dom.getMonth() ? ' de ' + MES[lun.getMonth()] : '') + ' al ' + dom.getDate() + ' de ' + MES[dom.getMonth()]
      : MES[new Date(HOY + 'T12:00:00').getMonth()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + HOY.slice(0, 4);
    var h = '';

    // Cabecera + panel negro
    var stats = '<div class="kp"><b>' + R.ok + '</b><small>realizadas</small></div><div class="kp"><b>' + R.todo + '</b><small>por hacer</small></div>' +
      '<div class="kp"><b style="color:#fbbf24">' + lateAll + '</b><small>atrasadas</small></div><div class="kp"><b style="color:#93c5fd">' + valAll + '</b><small>por validar</small></div>';
    var sync = '<div class="sync">' + (ERR ? '<span class="off">● Sin conexión</span> · datos guardados' : DATA && DATA.at ? 'Actualizado ' + hace(DATA.at) : 'Cargando programa…') + '</div>';
    if (admin) {
      var tabs = [''].concat(centros).map(function (c) { return '<button type="button" role="tab" data-c="' + esc(c) + '" aria-selected="' + (c === centro) + '">' + (c ? esc(short(c)) : 'Todo el programa') + '</button>'; }).join('');
      h += '<section class="hero">' +
        '<div class="htop"><span class="lg"><img src="logo.png" alt="Grupo Pro"></span><span class="who">' + esc(nombre || 'Administrador') + ' · administrador <button type="button" class="sw" data-vista="equipo">Vista equipo</button></span></div>' +
        '<div class="tabs" role="tablist" aria-label="Centro">' + tabs + '</div>' +
        '<div class="kpis">' + ring(R.p, 76, per === 'semana' ? 'semana' : 'mes') + stats + '</div>' + sync + '</section>';
    } else {
      var opts = '<option value="">Elige tu centro</option>' + centros.concat(centros.length ? [] : ORDEN).map(function (c) { return '<option' + (c === centro ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
      h += '<header class="thead"><span class="lg"><img src="logo.png" alt="Grupo Pro"></span><label class="csel"><span class="sr">Mi centro</span><select id="dCentro">' + opts + '</select></label>' +
        (ES_ADMIN ? '<button type="button" class="sw lt" data-vista="admin">Vista admin</button>' : '') + '</header>';
      if (!centro) {
        h += '<section class="hero card"><div class="pick"><b>¿Cuál es tu centro?</b><span>Elígelo arriba para ver el avance de tus actividades y lo que te toca hoy.</span></div></section>';
      } else {
        h += '<section class="hero card"><div class="kpis">' + ring(R.p, 92, per === 'semana' ? 'esta semana' : 'este mes') + stats + '</div>' + sync + '</section>';
      }
    }

    if (admin || centro) {
      // Avance por programa
      var seg = '<div class="seg" role="tablist" aria-label="Periodo"><button type="button" role="tab" data-per="semana" aria-selected="' + (per === 'semana') + '">Semanal</button><button type="button" role="tab" data-per="mes" aria-selected="' + (per === 'mes') + '">Mensual</button></div>';
      var progs = PROG.map(function (p, i) { return bar(p.n, resumen(perItems.filter(function (it) { return progIdx(it) === i; }))); }).join('');
      var otros = perItems.filter(function (it) { return progIdx(it) < 0; });
      if (otros.length) progs += bar('Otros', resumen(otros));
      var progCard = '<section class="dcard dprog"><div class="dh"><h2>Avance por programa</h2>' + seg + '</div><div class="rango">' + esc(rango) + ' · ' + esc(centro || 'todos los centros') + '</div>' + progs + '</section>';

      var centCard = '';
      if (admin && !centro) {
        var rs = centros.map(function (c) { return { c: c, r: resumen(perItems.filter(function (it) { return it.Centro === c; })) }; });
        centCard = '<section class="dcent">' + rs.map(function (x) { var p = x.r.p; return '<button type="button" data-c="' + esc(x.c) + '"><b style="color:' + (p == null ? '#a1a1aa' : col(p)) + '">' + (p == null ? '—' : p + '%') + '</b><span>' + esc(short(x.c)) + '</span></button>'; }).join('') + '</section>' +
          '<section class="dcard dcentw"><div class="dh"><h2>Avance por centro</h2><a class="lnk0" href="panel.html">Ver panel</a></div>' + rs.map(function (x) { return bar(x.c, x.r, null, '#'); }).join('') + '</section>';
      }

      var acc = '<div class="dacts"><a class="dacc" href="rapido.html">' + svg('warn', 20, 2.2) + 'Reportar accidente</a>' + (admin ? '' : '<a class="dcal" href="calendario.html">' + svg('cal', 20, 2) + 'Calendario</a>') + '</div>';
      var quick = '<nav class="dcard dquick" aria-label="Accesos rápidos">' + QUICK.map(function (q) { return '<a href="' + q.h + '">' + svg(q.i) + '<span>' + q.l + '</span></a>'; }).join('') + '</nav>';

      // Escritorio: tabla y por validar
      var tabla = '', val = '';
      if (admin) {
        var prox = items.filter(function (it) { var s = estado(it); return it.Fecha && (s === 'late' || (s !== 'ok' && it.Fecha >= HOY && it.Fecha <= addDays(HOY, 7))); })
          .sort(function (a, b) { var la = estado(a) === 'late', lb = estado(b) === 'late'; if (la !== lb) return la ? -1 : 1; return a.Fecha < b.Fecha ? -1 : a.Fecha > b.Fecha ? 1 : 0; });
        tabla = '<section class="dcard dtabla"><div class="dh"><h2>Atrasadas y próximos 7 días</h2><a class="lnk0" href="calendario.html">Ver calendario</a></div>' +
          (prox.length ? '<div class="tw"><table><thead><tr><th>Fecha</th><th>Centro</th><th>Actividad</th><th>Programa</th><th>Estado</th></tr></thead><tbody>' +
          prox.slice(0, 14).map(function (it) { var s = estado(it); return '<tr><td>' + fcorta(it.Fecha) + '</td><td>' + esc(short(it.Centro)) + '</td><td><a href="panel.html?id=' + encodeURIComponent(it.id) + '">' + esc(it.Title) + '</a></td><td>' + esc(it.Programa || '') + '</td><td><span class="pill ' + s + '">' + ({ late: 'Atrasada', val: 'Por validar', todo: 'Pendiente' }[s]) + '</span></td></tr>'; }).join('') +
          '</tbody></table></div>' + (prox.length > 14 ? '<div class="muted sm">y ' + (prox.length - 14) + ' más en el calendario</div>' : '') : '<div class="hempty">Nada atrasado ni pendiente para los próximos 7 días.</div>') + '</section>';
        var pend = ((DATA && DATA.pending) || []).filter(function (p) { return !centro || p.centro === centro; });
        val = '<section class="dcard dval"><div class="dh"><h2>Por validar <span class="cnt">' + pend.length + '</span></h2><a class="lnk0" href="panel.html">Abrir panel</a></div>' +
          (pend.length ? pend.slice(-8).reverse().map(function (p) { return '<a class="vrow" href="panel.html?id=' + encodeURIComponent(p.id) + '"><b>' + esc(p.title || 'Actividad') + '</b><small>' + esc(short(p.centro || '')) + (p.nombre ? ' · ' + esc(p.nombre) : '') + '</small><span>Revisar</span></a>'; }).join('')
            : '<div class="hempty">No hay avances esperando tu validación.</div>') + '</section>';
      }
      h += '<div class="dgrid">' + progCard + centCard + hoyHTML(items, admin && !centro) + acc + quick + tabla + val + '</div>';
    }
    h += '<a class="dforms" href="#formularios">' + svg('forms', 18, 2) + 'Todos los formularios</a>';
    root.innerHTML = h;

    // Menú lateral (escritorio, administrador)
    if (side) {
      side.innerHTML = admin ? '<div class="sl"><span class="lg"><img src="logo.png" alt="Grupo Pro"></span><b>PRO EHS</b></div>' +
        '<div class="sh">Centro</div>' + [''].concat(centros).map(function (c) { return '<button type="button" data-c="' + esc(c) + '" class="' + (c === centro ? 'on' : '') + '">' + (c ? esc(c) : 'Todo el programa') + '</button>'; }).join('') +
        '<div class="sh">Herramientas</div><a href="calendario.html">' + svg('cal', 18) + 'Calendario</a><a href="panel.html">' + svg('panel', 18) + 'Panel de control</a><a href="estadisticas.html">' + svg('est', 18) + 'Estadísticas</a><a href="panel.html">' + svg('up', 18) + 'Cargar programa</a><a href="#formularios">' + svg('forms', 18) + 'Formularios</a>' : '';
    }
  }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function hace(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'recién' : m < 60 ? 'hace ' + m + ' min' : m < 1440 ? 'hace ' + Math.round(m / 60) + ' h' : 'hace ' + Math.round(m / 1440) + ' d'; }

  // Eventos
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]');
    if (b && (root.contains(b) || (side && side.contains(b)))) { e.preventDefault(); st.centro = b.getAttribute('data-c'); LS.set('gpHomeCentro', st.centro); render(); return; }
    var p = e.target.closest('[data-per]');
    if (p && root.contains(p)) { st.per = p.getAttribute('data-per'); LS.set('gpHomePer', st.per); render(); return; }
    var v = e.target.closest('[data-vista]');
    if (v) { LS.set('gpHomeVista', v.getAttribute('data-vista') === 'equipo' ? 'equipo' : ''); render(); return; }
    var a = e.target.closest('a.bar[href="#"]');
    if (a) { e.preventDefault(); st.centro = a.querySelector('.bn').textContent; LS.set('gpHomeCentro', st.centro); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var q = e.target.closest('a[href="#checklist"],a[href="#formularios"]');
    if (q) { e.preventDefault(); var t = q.getAttribute('href').slice(1); var m = t === 'checklist' ? document.querySelector('.mod.checklist') : document.getElementById('formularios');
      if (m) { if (t === 'checklist' && !m.classList.contains('open')) m.querySelector('.mh').click(); setTimeout(function () { m.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); } }
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'dCentro') { var p = perfil(); p.panelCentro = e.target.value; LS.set('gpPerfil', p); render(); }
  });

  DATA = cargarCache();
  render();
  fetch(ENDPOINT + '?panel=1&key=' + encodeURIComponent(KEY) + '&t=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (!d || !d.ok || !d.items) throw new Error('sin datos'); DATA = slim(d); ERR = ''; LS.set('gpHomeData', DATA); render(); })
    .catch(function (e) { ERR = String(e && e.message || e); render(); });
  // Al volver a la app (otro día, otra pestaña) recalcula "hoy"
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
})();
