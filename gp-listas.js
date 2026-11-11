/* PRO EHS · listas desplegables de los formularios (nómina de personas, áreas, sectores y cargos por centro).
   - Origen: listas de SharePoint NominaPYR y ListasPYR, copiadas al servidor por el administrador.
   - Cada equipo recibe solo su centro (sesión con PIN); el administrador recibe todos.
   - Al elegir un nombre se completan RUT, cargo, empresa, supervisor o correo; al elegir un RUT, el nombre.
   - Se puede escribir a mano: esas personas se envían como «nuevas» y el panel las suma a la nómina para revisarlas. */
(function () {
  if (window.gpListas) return;
  var CK = 'gpListas', SKIP = 'gpPinSkipListas';
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function nk(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function rk(s) { return String(s || '').replace(/[^0-9kK]/g, '').toUpperCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var DATA = lsGet(CK, null);

  // Campos de nombre: lista que usan y qué completan (primero en la misma fila; si no, estos nombres en la hoja)
  var KIND = {
    nombre_completo: ['per', { rut: 'rut', cargo: 'cargo', empresa: 'empresa', supervisor: 'supervisor' }],
    asist_nombre: ['per', {}], fp_nombre: ['per', {}], cp_nombre: ['per', {}], nombre_declarante_firma: ['per', {}],
    observador: ['prev', { rut: 'rut_observador', cargo: 'cargo_observador' }],
    nombre_prevencionista: ['prev', { cargo: 'cargo_prevencionista' }], nombre_entrevistador: ['prev', {}], prevencionista: ['prev', {}],
    firma_auditor_nombre: ['prev', { cargo: 'cargo_auditor' }], firma_relator: ['all', { cargo: 'cargo_relator' }],
    supervisor: ['sup', { cargo: 'cargo_supervisor' }], firma_supervisor: ['sup', {}], responsable: ['sup', { correo: 'correo_responsable', cargo: 'cargo_responsable' }],
    responsable_centro: ['sup', {}], firma_responsable_nombre: ['sup', {}]
  };
  var RUTS = ['rut', 'asist_rut', 'fp_rut', 'rut_observador'];
  function sheet() { return document; } // todas las hojas del formulario
  function centro() {
    var el = document.querySelector('.document-sheet [name="centro"]'), v = el ? String(el.value || '').trim() : '';
    return v;
  }
  function people(kind) {
    if (!DATA || !DATA.nom) return [];
    var c = centro(), list = DATA.nom.filter(function (p) { return !c || p.c === c || p.c === 'Todos los centros' || !p.c; });
    if (kind === 'prev') list = list.filter(function (p) { return p.t === 'Prevencionista'; });
    else if (kind === 'sup') list = list.filter(function (p) { return p.t === 'Supervisor' || p.t === 'Jefatura'; });
    return list.sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); });
  }
  function vals(lista) {
    if (!DATA || !DATA.lis) return [];
    var c = centro(), seen = {}, out = [];
    DATA.lis.filter(function (x) { return x.l === lista && (!c || x.c === c || x.c === 'Todos los centros'); })
      .sort(function (a, b) { return (a.c === 'Todos los centros') - (b.c === 'Todos los centros') || a.v.localeCompare(b.v, 'es'); })
      .forEach(function (x) { var k = nk(x.v); if (!seen[k]) { seen[k] = 1; out.push(x.v); } });
    return out;
  }
  function dl(id, opts) {
    var d = document.getElementById(id); if (!d) { d = document.createElement('datalist'); d.id = id; document.body.appendChild(d); }
    d.innerHTML = opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[1] ? ' label="' + esc(o[1]) + '"' : '') + '>' + (o[1] ? esc(o[1]) : '') + '</option>'; }).join('');
  }
  function build() {
    if (!DATA || !DATA.nom) return;
    var lab = function (p) { return [p.cg, p.t === 'Trabajador' ? '' : p.t].filter(Boolean).join(' · '); };
    dl('gpNomAll', people('all').map(function (p) { return [p.n, lab(p)]; }));
    dl('gpNomPrev', people('prev').map(function (p) { return [p.n, lab(p)]; }));
    dl('gpNomSup', people('sup').map(function (p) { return [p.n, lab(p)]; }));
    dl('gpNomRut', people('all').filter(function (p) { return p.r; }).map(function (p) { return [p.r, p.n]; }));
    var c = vals('Cargo'); if (c.length) dl('gpCargos', c.map(function (v) { return [v]; }));
    // Las listas que ya traen los formularios se reemplazan por las del centro (si hay)
    var a = vals('Área'), s = vals('Sector'), sp = people('sup');
    if (a.length) dl('areasList', a.map(function (v) { return [v]; }));
    if (s.length) dl('sectoresList', s.map(function (v) { return [v]; }));
    if (sp.length) dl('supervisoresList', sp.map(function (p) { return [p.n, p.cg]; }).concat([['Otro']]));
    bind();
  }
  function listFor(name) { var k = KIND[name]; if (!k) return ''; return k[0] === 'prev' ? 'gpNomPrev' : k[0] === 'sup' ? 'gpNomSup' : 'gpNomAll'; }
  function bind() {
    [].slice.call(document.querySelectorAll('.document-sheet input[name]')).forEach(function (el) {
      if (el.type && !/^(text|search|)$/.test(el.type)) return;
      var n = el.name;
      if (KIND[n] && (!el.getAttribute('list') || el.getAttribute('list') === 'supervisoresList')) el.setAttribute('list', n === 'supervisor' && el.getAttribute('list') === 'supervisoresList' ? 'supervisoresList' : listFor(n));
      else if (RUTS.indexOf(n) >= 0 && !el.getAttribute('list')) el.setAttribute('list', 'gpNomRut');
      else if (/^cargo/.test(n) && !el.getAttribute('list') && document.getElementById('gpCargos')) el.setAttribute('list', 'gpCargos');
      if (KIND[n] || RUTS.indexOf(n) >= 0) el.setAttribute('autocomplete', 'off');
    });
  }
  function find(name) { var q = nk(name); if (!q || !DATA || !DATA.nom) return null; var c = centro();
    var m = DATA.nom.filter(function (p) { return nk(p.n) === q; }); return m.filter(function (p) { return p.c === c; })[0] || m[0] || null; }
  function findRut(r) { var q = rk(r); if (q.length < 7 || !DATA || !DATA.nom) return null; return DATA.nom.filter(function (p) { return rk(p.r) === q; })[0] || null; }
  function target(from, names) {
    var row = from.closest('tr, .dyn-row, .row, .grid-row');
    for (var i = 0; i < names.length; i++) {
      var el = row && row.querySelector('[name="' + names[i] + '"]'); if (el) return el;
    }
    return names[0] ? document.querySelector('.document-sheet [name="' + names[0] + '"]') : null;
  }
  function put(el, v) {
    if (!el || !v) return;
    if (el.value && !el.hasAttribute('data-gp-auto') && el.value !== el.defaultValue) return; // no pisa lo que escribió la persona
    if (el.tagName === 'SELECT') { if (![].some.call(el.options, function (o) { return o.value === v; })) return; }
    el.value = v; el.setAttribute('data-gp-auto', '1');
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function rowNames(from, re) { var row = from.closest('tr, .dyn-row'); if (!row) return []; return [].slice.call(row.querySelectorAll('input[name]')).map(function (e) { return e.name; }).filter(function (n) { return re.test(n); }); }
  function onPick(el) {
    var n = el.name;
    if (KIND[n]) {
      var p = find(el.value); if (!p) return;
      var map = KIND[n][1];
      put(target(el, rowNames(el, /rut/).concat(map.rut ? [map.rut] : [])), p.r);
      put(target(el, rowNames(el, /cargo/).concat(map.cargo ? [map.cargo] : [])), p.cg);
      if (map.empresa) put(target(el, [map.empresa]), p.e);
      if (map.supervisor) put(target(el, [map.supervisor]), p.s);
      if (map.correo) put(target(el, [map.correo]), p.m);
    } else if (RUTS.indexOf(n) >= 0) {
      var q = findRut(el.value); if (!q) return;
      var nameField = n === 'rut_observador' ? 'observador' : n === 'asist_rut' ? 'asist_nombre' : n === 'fp_rut' ? 'fp_nombre' : 'nombre_completo';
      put(target(el, [nameField]), q.n);
      if (n === 'rut') { put(target(el, ['cargo']), q.cg); put(target(el, ['empresa']), q.e); put(target(el, ['supervisor']), q.s); }
      if (n === 'rut_observador') put(target(el, ['cargo_observador']), q.cg);
    }
  }
  document.addEventListener('change', function (e) { var el = e.target; if (!el || !el.name) return; if (el.name === 'centro') { build(); return; } if (KIND[el.name] || RUTS.indexOf(el.name) >= 0) onPick(el); }, true);
  // Si se cambia el nombre por alguien que no está en la lista, se limpian los datos que se completaron solos
  function clearAuto(el) {
    var k = KIND[el.name]; if (!k) return; var map = k[1];
    [target(el, rowNames(el, /rut/).concat(map.rut ? [map.rut] : [])), target(el, rowNames(el, /cargo/).concat(map.cargo ? [map.cargo] : [])),
      map.supervisor && target(el, [map.supervisor]), map.correo && target(el, [map.correo])].forEach(function (t) {
      if (t && t.hasAttribute('data-gp-auto')) { t.value = ''; t.removeAttribute('data-gp-auto'); t.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }
  document.addEventListener('input', function (e) {
    var el = e.target; if (!el || !el.name || !e.isTrusted) return;
    if (el.hasAttribute('data-gp-auto')) el.removeAttribute('data-gp-auto');
    if (!(KIND[el.name] || RUTS.indexOf(el.name) >= 0)) return;
    if (el.value && (find(el.value) || findRut(el.value))) onPick(el); else if (KIND[el.name]) clearAuto(el);
  }, true);
  // Filas nuevas (asistentes, firmas): se enlazan al tocarlas
  document.addEventListener('focusin', function (e) { var el = e.target; if (el && el.name && (KIND[el.name] || RUTS.indexOf(el.name) >= 0) && !el.getAttribute('list')) bind(); if (el && el.name && KIND[el.name]) askPin(); }, true);

  // Personas escritas a mano que no están en la nómina (se envían con el formulario)
  window.gpNuevos = function () {
    if (!DATA || !DATA.nom) return [];
    var c = centro(), out = [], seen = {};
    [].slice.call(document.querySelectorAll('.document-sheet input[name]')).forEach(function (el) {
      var k = KIND[el.name]; if (!k) return; var v = String(el.value || '').trim(); if (v.length < 4 || /^otro$/i.test(v) || find(v) || seen[nk(v)]) return;
      if (el.closest('[hidden], .hide-on-print') || el.offsetParent === null) return;
      seen[nk(v)] = 1; var map = k[1], g = function (names) { var t = target(el, names); return t ? String(t.value || '').trim() : ''; };
      out.push({ n: v, r: g(rowNames(el, /rut/).concat(map.rut ? [map.rut] : [])), cg: g(rowNames(el, /cargo/).concat(map.cargo ? [map.cargo] : [])), e: map.empresa ? g([map.empresa]) : '',
        s: map.supervisor ? g([map.supervisor]) : '', m: map.correo ? g([map.correo]) : '', t: k[0] === 'prev' ? 'Prevencionista' : k[0] === 'sup' ? 'Jefatura' : 'Trabajador', c: c });
    });
    return out.slice(0, 30);
  };

  // Carga: copia guardada al tiro; luego se actualiza desde el servidor
  var asked = false;
  function askPin() {
    if (asked || (DATA && DATA.nom && DATA.nom.length) || !window.gpApi) return; asked = true;
    var sk = +(lsGet(SKIP, 0) || 0); if (Date.now() - sk < 7 * 864e5) return;
    gpApi.pinPrompt(gpApi.centrosLista || ['Walmart Peñón', 'Walmart Pudahuel', 'Walmart Lo Aguirre', 'Walmart La Farfana', 'Líder La Reina'],
      'Para ver la lista de personas de tu centro (nombre, RUT y cargo) ingresa el PIN de tu centro. Se pide una sola vez en este teléfono.')
      .then(function (ok) { if (ok) load(); else lsSet(SKIP, Date.now()); });
  }
  function load() {
    if (!window.gpApi || navigator.onLine === false) return;
    gpApi.read('listas', { prompt: false }).then(function (d) {
      if (!d || !d.ok) return;
      DATA = { nom: d.nom || [], lis: d.lis || [], at: d.at || '', centros: d.centros || [] }; lsSet(CK, DATA); build();
      // Equipo con un solo centro: se propone ese centro en el formulario
      var el = document.querySelector('.document-sheet [name="centro"]');
      if (el && !el.value && DATA.centros && DATA.centros.length === 1) put(el, DATA.centros[0]);
    }).catch(function () {});
  }
  function start() {
    // Filas que el formulario agrega o redibuja (asistentes, firmas): se vuelven a enlazar
    try { var tm = 0; new MutationObserver(function () { clearTimeout(tm); tm = setTimeout(function () { if (DATA && DATA.nom) bind(); }, 150); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    if (DATA) build();
    if (window.gpApi) load();
    else { var sc = document.createElement('script'); sc.src = new URL('gp-auth.js', document.baseURI).href; sc.onload = load; document.head.appendChild(sc); }
  }
  window.gpListas = { reload: load, data: function () { return DATA; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
