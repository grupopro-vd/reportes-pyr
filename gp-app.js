/* =====================================================================
   Reportes EHS · Grupo Pro — funciones de la app (versión GitHub)
   - Borrador automático en el teléfono (se recupera al volver a abrir)
   - Cola de envío sin señal (se envía sola cuando vuelve la conexión)
   - Recuerda los datos de quien reporta
   - Barra «← Inicio» dentro de cada formulario
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var fmt = function (t) { var d = new Date(t); return pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var LS = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------------- Almacenamiento (IndexedDB) ---------------- */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('sin IndexedDB'));
      var rq = indexedDB.open('gpReportesEHS', 1);
      rq.onupgradeneeded = function () {
        var d = rq.result;
        if (!d.objectStoreNames.contains('drafts')) d.createObjectStore('drafts');
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'qid', autoIncrement: true });
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), out;
        var r = fn(s);
        if (r) r.onsuccess = function () { out = r.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  var idb = {
    get: function (st, k) { return tx(st, 'readonly', function (s) { return s.get(k); }); },
    put: function (st, v, k) { return tx(st, 'readwrite', function (s) { return k === undefined ? s.put(v) : s.put(v, k); }); },
    del: function (st, k) { return tx(st, 'readwrite', function (s) { return s.delete(k); }); },
    all: function (st) { return tx(st, 'readonly', function (s) { return s.getAll(); }); }
  };
  window.gpDB = idb;

  /* ---------------- Aviso flotante ---------------- */
  var pill, pillTimer;
  function toast(msg, kind, ms) {
    if (!document.body) return;
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'gp-pill hide-on-print hide-on-word';
      pill.setAttribute('role', 'status');
      document.body.appendChild(pill);
    }
    pill.textContent = msg;
    pill.className = 'gp-pill hide-on-print hide-on-word show' + (kind ? ' ' + kind : '');
    clearTimeout(pillTimer);
    if (ms !== 0) pillTimer = setTimeout(function () { pill.classList.remove('show'); }, ms || 2600);
  }
  window.gpToast = toast;

  var css = document.createElement('style');
  css.textContent =
    '.gp-pill{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translate(-50%,20px);opacity:0;pointer-events:none;' +
    'background:#1d1d1b;color:#fff;font:600 13px/1.35 Arial,Helvetica,sans-serif;padding:9px 14px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.25);' +
    'transition:opacity .2s,transform .2s;z-index:100000;max-width:calc(100% - 32px);text-align:center}' +
    '.gp-pill.show{opacity:1;transform:translate(-50%,0)}.gp-pill.ok{background:#16623f}.gp-pill.warn{background:#7a5a00}.gp-pill.error{background:#8d2119}' +
    '.gp-appbar{display:flex;align-items:center;gap:10px;background:#1d1d1b;color:#fff;padding:10px 12px;font:600 14px Arial,Helvetica,sans-serif}' +
    '.gp-appbar a{color:#fff;text-decoration:none;background:rgba(255,255,255,.13);border-radius:8px;padding:8px 12px;white-space:nowrap}' +
    '.gp-appbar span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.9}' +
    '.gp-net{font-size:12px;font-weight:700;padding:4px 9px;border-radius:999px;background:#8d2119;display:none}.gp-net.on{display:inline-block}' +
    '.gp-draft-banner{max-width:980px;margin:12px auto 0;background:#fff8e4;border:1px solid #ecd9a4;color:#5b4b1c;border-radius:12px;padding:10px 14px;' +
    'font:13.5px/1.45 Arial,Helvetica,sans-serif;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}' +
    '.gp-draft-banner b{color:#3d3210}.gp-draft-banner button{border:0;border-radius:8px;padding:8px 12px;font:700 13px Arial,Helvetica,sans-serif;cursor:pointer;background:#fff;color:#8e0719;border:1px solid #e0c98a}' +
    '@media print{.gp-pill,.gp-appbar,.gp-draft-banner{display:none!important}}';
  (document.head || document.documentElement).appendChild(css);

  /* ---------------- Cola de envío sin conexión ---------------- */
  /* ---- Datos extra para el panel (actividad del programa) y el seguimiento de hallazgos ---- */
  var actKey = function () { return 'gpAct:' + ((location.pathname.split('/').pop() || '').replace(/\.html?$/, '')); };
  function getAct() { try { return JSON.parse(sessionStorage.getItem(actKey()) || 'null'); } catch (e) { return null; } }
  var normC = function (x) { return String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^(walmart|lider)\s+/, '').replace(/\s+/g, ' ').trim(); };
  function actMismoCentro(act, centro) { return !act || !act.centro || !centro || normC(act.centro) === normC(centro); }
  function augment(d) {
    if (!d || typeof d !== 'object' || d.action || d.extra || !d.form) return d;
    var rid = document.querySelector('.document-sheet [name="registro_id"]'); if (!rid || !rid.value || rid.value !== d.recordId) return d;
    var v = function (n) { var el = document.querySelector('.document-sheet [name="' + n + '"]'); return el ? String(el.value || '').trim() : ''; };
    var r = function (n) { var el = document.querySelector('.document-sheet [name="' + n + '"]:checked'); return el ? el.value : ''; };
    d.extra = { descripcion: v('descripcion').slice(0, 400), criticidad: r('criticidad'), accion_correctiva: v('accion_correctiva').slice(0, 300), tipo_hallazgo: r('tipo_hallazgo') || v('tipo_otro'),
      correo_responsable: v('correo_responsable'), tema: v('tema'), tipo_actividad: v('tipo_actividad'), area: v('area'), lugar: v('lugar'), categoria_evento: v('categoria_evento') };
    // Solo se marca la actividad del programa si es del mismo centro elegido en el registro; si no, el servidor busca la del centro elegido
    var act = getAct(); if (act && act.id && actMismoCentro(act, v('centro'))) { d.programaId = String(act.id); d.programaTitle = act.title || ''; }
    try { if (typeof window.gpNuevos === 'function') { var nv = window.gpNuevos(); if (nv.length) d.nuevos = nv; } } catch (e) {}
    return d;
  }
  var _fetch = window.fetch;
  window.fetch = function (url, opts) {
    try {
      if (typeof url === 'string' && url.indexOf('script.google.com/macros') >= 0 && opts && opts.method === 'POST' && typeof opts.body === 'string') {
        var d = JSON.parse(opts.body); if (d && d.form && !d.action && !d.extra) { augment(d); if (d.extra) opts = Object.assign({}, opts, { body: JSON.stringify(d) }); }
      }
    } catch (e) {}
    return _fetch.apply(this, [url, opts]);
  };
  window.gpQueue = function (payload, recordId, sig, endpoint) {
    try { augment(payload); } catch (e) {}
    return idb.put('outbox', { payload: payload, recordId: recordId, sig: sig, endpoint: endpoint, subject: payload.subject || '', queuedAt: Date.now() })
      .then(function () { if (typeof window.gpOnSent === 'function') window.gpOnSent(recordId, true); updateOutboxUI(); });
  };
  var flushing = false;
  function flushOutbox() {
    if (flushing || !navigator.onLine) return Promise.resolve();
    flushing = true;
    return idb.all('outbox').then(function (items) {
      var chain = Promise.resolve(), sent = 0;
      (items || []).forEach(function (it) {
        chain = chain.then(function () {
          return fetch(it.endpoint, { method: 'POST', body: JSON.stringify(it.payload) })
            .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
            .then(function (d) {
              if (d && d.ok) { sent++; LS.set('gpSent:' + it.recordId, it.sig); return idb.del('outbox', it.qid); }
              it.lastError = (d && d.error) || 'respuesta inválida'; return idb.put('outbox', it);
            })
            .catch(function () { /* sigue sin señal: se reintenta después */ });
        });
      });
      return chain.then(function () {
        if (sent) toast('✔ ' + (sent === 1 ? 'Se envió el reporte que estaba en cola' : 'Se enviaron ' + sent + ' reportes que estaban en cola'), 'ok', 5000);
      });
    }).catch(function () {}).then(function () { flushing = false; updateOutboxUI(); });
  }
  window.gpFlushOutbox = flushOutbox;
  function updateOutboxUI() {
    idb.all('outbox').then(function (items) {
      var n = (items || []).length;
      document.dispatchEvent(new CustomEvent('gp-outbox', { detail: { count: n, items: items || [] } }));
    }).catch(function () {});
  }
  window.gpUpdateOutboxUI = updateOutboxUI;
  window.addEventListener('online', function () { setNet(); flushOutbox(); });
  window.addEventListener('offline', setNet);
  setInterval(function () { if (navigator.onLine) flushOutbox(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) flushOutbox(); });

  function setNet() {
    $$('.gp-net').forEach(function (el) { el.classList.toggle('on', !navigator.onLine); });
    if (!navigator.onLine) toast('Sin conexión: puedes seguir llenando, se guarda en tu teléfono', 'warn', 3500);
  }

  /* ---------------- Formularios: barra, borrador y datos guardados ---------------- */
  var isForm = function () { return !!document.querySelector('.document-sheet'); };
  var formKey = (location.pathname.split('/').pop() || 'index').replace(/\.html?$/, '') || 'index';
  var draftKey = 'draft:' + formKey;
  var dirty = false, saving = null, stopDrafts = false, restored = false;

  function controls() {
    return $$('input,textarea,select').filter(function (el) {
      if (el.type === 'file' || el.type === 'button' || el.type === 'submit' || el.type === 'hidden') return false;
      if (el.closest('.photo-card,#signatureModalV4,.gp-appbar,.gp-draft-banner')) return false;
      return true;
    });
  }
  function sigCanvases() { return $$('canvas.signature-canvas').filter(function (c) { return !c.closest('#signatureModalV4'); }); }
  function canvasBlank(c) {
    try {
      var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (var i = 3; i < d.length; i += 4) if (d[i]) return false;
      return true;
    } catch (e) { return true; }
  }

  function snapshot() {
    return {
      savedAt: Date.now(),
      title: document.title,
      actions: $$('#actionsTable tbody tr').length,
      witnesses: $$('#witnessList .witness-row').length,
      dyn: $$('[data-dyn]').reduce(function (o, tb) { o[tb.id] = tb.rows.length; return o; }, {}),
      values: controls().map(function (el) {
        var o = { t: el.tagName + ':' + (el.type || '') + ':' + (el.name || '') };
        if (el.type === 'checkbox' || el.type === 'radio') o.c = el.checked; else o.v = el.value;
        return o;
      }),
      photos: $$('#photoGrid .photo-card').map(function (card) {
        var img = card.querySelector('img'), inp = card.querySelector('input');
        return { src: img ? img.getAttribute('src') : '', desc: inp ? inp.value : '' };
      }),
      signatures: sigCanvases().map(function (c) { return canvasBlank(c) ? '' : c.toDataURL('image/png'); }),
      extra: typeof window.gpDraftGet === 'function' ? window.gpDraftGet() : null
    };
  }
  function saveDraft() {
    if (stopDrafts || !dirty) return;
    clearTimeout(saving);
    saving = setTimeout(function () {
      idb.put('drafts', snapshot(), draftKey).then(function () {
        var t = new Date();
        toast('💾 Borrador guardado en este teléfono · ' + pad(t.getHours()) + ':' + pad(t.getMinutes()), '', 1600);
      }).catch(function () {});
    }, 900);
  }
  // Para formularios con contenido propio (p. ej. fotos por ítem en auditorías)
  window.gpSaveDraftNow = function () { dirty = true; saveDraft(); };
  window.gpOnSent = function (recordId, queued) {
    try { sessionStorage.removeItem(actKey()); } catch (e) {}
    stopDrafts = true; clearTimeout(saving);
    idb.del('drafts', draftKey).catch(function () {});
    saveProfile();
    var b = $('.gp-draft-banner'); if (b) b.remove();
  };

  function fire(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function reconcileRows(saved) {
    var tb = $('#actionsTable tbody');
    if (tb && typeof window.addActionRow === 'function') {
      while (tb.rows.length < saved.actions) window.addActionRow('actionsTable');
      while (tb.rows.length > saved.actions) tb.rows[tb.rows.length - 1].remove();
    }
    var wl = $('#witnessList');
    if (wl && typeof window.addWitnessRow === 'function') {
      while ($$('.witness-row', wl).length < saved.witnesses) window.addWitnessRow();
      var rows = $$('.witness-row', wl);
      while (rows.length > saved.witnesses) rows.pop().remove();
    }
    // Filas que se agregan con un botón (asistentes, acuerdos…)
    Object.keys(saved.dyn || {}).forEach(function (id) {
      var t = document.getElementById(id), n = saved.dyn[id];
      if (!t || typeof window.gpAddDynRow !== 'function') return;
      while (t.rows.length < n) window.gpAddDynRow(id);
      while (t.rows.length > n) t.rows[t.rows.length - 1].remove();
    });
  }

  /* ---- Formulario abierto desde el panel: actividad del programa ---- */
  function applyAct() {
    var q = new URLSearchParams(location.search);
    if (q.get('act')) { try { sessionStorage.setItem(actKey(), JSON.stringify({ id: q.get('act'), title: q.get('t') || '', centro: q.get('c') || '', tipo: q.get('tipo') || '' })); } catch (e) {} }
    var act = getAct(); if (!act || !document.querySelector('.document-sheet')) return;
    // Una observación de conducta del programa no se registra como hallazgo: se abre su formulario
    if (/^hallazgos$/i.test((location.pathname.split('/').pop() || '').replace(/\.html?$/, '')) && /^Observaci[oó]n de (conducta|almacenamiento|seguridad en anden|carga)/i.test(act.title || '')) {
      try { sessionStorage.removeItem(actKey()); } catch (e) {}
      var modo = /pare/i.test(act.title) ? 'pare' : /almacenamiento|rack/i.test(act.title) ? 'almac' : /anden/i.test(act.title) ? 'anden' : /carga/i.test(act.title) ? 'carga' : 'conducta';
      location.replace('observacion_conducta.html?act=' + encodeURIComponent(act.id) + '&t=' + encodeURIComponent(act.title || '') + '&c=' + encodeURIComponent(act.centro || '') + '&tipo=' + encodeURIComponent(act.tipo || '') + '&modo=' + modo);
      return;
    }
    var set = function (sel, val) { var el = document.querySelector(sel); if (el && val && !el.value) { el.value = val; fire(el); } };
    set('.document-sheet [name="centro"]', act.centro);
    set('.document-sheet [name="tema"]', act.title);
    var ta = document.querySelector('.document-sheet select[name="tipo_actividad"]');
    if (ta && !ta.value && act.tipo) { var op = [].filter.call(ta.options, function (o) { return o.value && (act.tipo === 'Charla' ? /charla/i.test(o.value) : o.value.toLowerCase().indexOf(act.tipo.toLowerCase().slice(0, 6)) === 0); })[0]; if (op) { ta.value = op.value; fire(ta); } }
    var b = document.createElement('div'); b.className = 'gp-draft-banner hide-on-print hide-on-word';
    b.innerHTML = '<span>📋 <b>Actividad del programa:</b> ' + String(act.title || '').replace(/</g, '&lt;') + (act.centro ? ' · ' + String(act.centro).replace(/</g, '&lt;') : '') + '. Al enviar, queda marcada en el panel.</span>';
    var bar = $('.gp-appbar'); if (bar && bar.nextSibling) bar.parentNode.insertBefore(b, bar.nextSibling); else document.body.prepend(b);
    var esc = function (x) { return String(x || '').replace(/</g, '&lt;'); }, okHtml = b.innerHTML;
    var revisa = function () { var el = document.querySelector('.document-sheet [name="centro"]'), c = el ? String(el.value || '').trim() : '';
      if (actMismoCentro(act, c)) { b.innerHTML = okHtml; b.style.background = ''; b.style.borderColor = ''; return; }
      b.style.background = '#fdecec'; b.style.borderColor = '#f0b4b4';
      b.innerHTML = '<span>⚠️ <b>Elegiste ' + esc(c) + ', pero esta actividad es de ' + esc(act.centro) + '.</b> El registro quedará en ' + esc(c) + ' y se asignará a la actividad pendiente de ese centro, no a «' + esc(act.title) + '». Si te equivocaste de centro, vuelve a elegir ' + esc(act.centro) + '.</span>'; };
    document.addEventListener('change', function (e) { if (e.target && e.target.name === 'centro') revisa(); }, true);
    document.addEventListener('input', function (e) { if (e.target && e.target.name === 'centro') revisa(); }, true);
    revisa();
  }
  /* ---- Centro de trabajo: se agrega a los formularios que aún no lo tienen ---- */
  var CENTROS = ['Walmart Pudahuel', 'Walmart Peñón', 'Walmart Lo Aguirre', 'Líder La Reina', 'Oficina Grupo Pro', 'ICB', 'Transporte TransPRO', 'Lippi', '4 Ruedas'];
  function ensureCentrosList() {
    var ex = document.getElementById('centrosList');
    if (ex) { var have = [].map.call(ex.options, function (o) { return o.value; }); CENTROS.forEach(function (c) { if (have.indexOf(c) < 0) { var o = document.createElement('option'); o.value = c; ex.appendChild(o); } }); return; }
    var dl = document.createElement('datalist'); dl.id = 'centrosList';
    dl.innerHTML = CENTROS.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    document.body.appendChild(dl);
  }
  function addCentroField() {
    ensureCentrosList();
    if ($('[name="centro"]')) return;
    var idIn = $('.document-sheet [data-auto-id]'); if (!idIn) return;
    var tr = idIn.closest('tr'); if (!tr) return;
    var cols = 0; [].slice.call(tr.cells).forEach(function (c) { cols += +(c.getAttribute('colspan') || 1); });
    var lab = Math.max(1, Math.round(cols / 3));
    var row = document.createElement('tr');
    row.innerHTML = '<td class="label" colspan="' + lab + '">Centro de trabajo</td><td colspan="' + Math.max(1, cols - lab) + '"><input name="centro" list="centrosList" required placeholder="Toca para seleccionar o escribe el centro"></td>';
    tr.parentNode.insertBefore(row, tr.nextSibling);
  }
  function restore(saved) {
    reconcileRows(saved);
    var els = controls(), radios = [];
    saved.values.forEach(function (o, i) {
      var el = els[i];
      if (!el || (el.tagName + ':' + (el.type || '') + ':' + (el.name || '')) !== o.t) return;
      if ('c' in o) { el.checked = o.c; if (o.c) radios.push(el); }
      else if (el.value !== o.v) { el.value = o.v; fire(el); }
    });
    radios.forEach(fire);
    var grid = $('#photoGrid');
    if (grid && saved.photos && saved.photos.length) {
      grid.innerHTML = '';
      saved.photos.forEach(function (p) {
        var card = document.createElement('div');
        card.className = 'photo-card';
        card.innerHTML = '<img alt="Evidencia fotográfica"><input placeholder="Descripción de la fotografía"><button type="button" class="btn btn-small btn-danger hide-on-print hide-on-word" onclick="this.parentElement.remove()">Eliminar</button>';
        card.querySelector('img').src = p.src;
        card.querySelector('input').value = p.desc || '';
        grid.appendChild(card);
      });
    }
    var cs = sigCanvases();
    (saved.signatures || []).forEach(function (src, i) {
      var c = cs[i]; if (!c || !src) return;
      var img = new Image();
      img.onload = function () { var ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height); };
      img.src = src;
    });
    if (saved.extra && typeof window.gpDraftSet === 'function') try { window.gpDraftSet(saved.extra); } catch (e) {}
    if (typeof window.updateProgress === 'function') try { window.updateProgress(); } catch (e) {}
  }
  function showBanner(saved) {
    var b = document.createElement('div');
    b.className = 'gp-draft-banner hide-on-print hide-on-word';
    b.innerHTML = '<span><b>Recuperamos tu borrador</b> del ' + fmt(saved.savedAt) + '. Sigue donde quedaste.</span><button type="button">Empezar un reporte nuevo</button>';
    b.querySelector('button').onclick = function () {
      if (!confirm('¿Descartar el borrador y empezar un reporte nuevo?')) return;
      stopDrafts = true;
      idb.del('drafts', draftKey).then(function () { location.reload(); }, function () { location.reload(); });
    };
    var bar = $('.gp-appbar');
    if (bar && bar.nextSibling) bar.parentNode.insertBefore(b, bar.nextSibling); else document.body.prepend(b);
  }

  /* ---- Datos de quien reporta (se recuerdan en este teléfono) ---- */
  var PROFILE = [
    ['#gpReporterName', 'name'], ['#gpReporterEmail', 'email'], ['#gpExtraCc', 'cc'],
    ['[name="reportante"]', 'name'], ['[name="centro"]', 'centro'],
    ['[name="nombre_prevencionista"]', 'prev'], ['[name="nombre_entrevistador"]', 'prev'],
    ['input[list="empresasList"][name="empresa"], input[list="empresasList"]:not([name])', 'empresa'], ['input[list="areasList"]', 'area']
  ];
  function getProfile() { try { return JSON.parse(LS.get('gpPerfil') || '{}'); } catch (e) { return {}; } }
  function saveProfile() {
    var p = getProfile();
    PROFILE.forEach(function (m) { var el = $(m[0]); if (el && String(el.value || '').trim()) p[m[1]] = String(el.value).trim(); });
    LS.set('gpPerfil', JSON.stringify(p));
    if (p.email) LS.set('gpReporterEmail', p.email);
    if (p.name) LS.set('gpReporterName', p.name);
  }
  function applyProfile() {
    var p = getProfile(), used = false;
    PROFILE.forEach(function (m) {
      var el = $(m[0]), v = p[m[1]];
      if (!el || !v) return;
      var def = el.getAttribute('data-default-value') || el.defaultValue || '';
      if (!el.value || (m[1] === 'empresa' && el.value === def)) { if (el.value !== v) { el.value = v; fire(el); used = true; } }
    });
    return used;
  }

  function addAppBar() {
    if (/googleusercontent|script\.google/.test(location.hostname)) return;
    var bar = document.createElement('div');
    bar.className = 'gp-appbar hide-on-print hide-on-word';
    bar.innerHTML = '<a href="./">← Inicio</a><span></span><em class="gp-net">Sin conexión</em>';
    bar.querySelector('span').textContent = document.title.replace(/\s*[·|–-]\s*Grupo Pro.*$/i, '');
    bar.querySelector('em').style.fontStyle = 'normal';
    document.body.prepend(bar);
  }

  /* «Enviar» nunca queda mudo: si el envío se corta sin mensaje (campos obligatorios con el aviso del
     navegador bloqueado, un error, etc.) se explica qué falta y se ofrece enviar igual. */
  function guardSend() {
    var orig = window.gpSendReport; if (typeof orig !== 'function' || orig.gpGuard) return;
    var st = function () { return document.getElementById('gpSendStatus'); };
    var show = function (msg, kind, extra) { var el = st(); if (!el) { alert(msg); return; } el.className = 'gp-send-status' + (kind ? ' ' + kind : ''); el.innerHTML = msg + (extra || ''); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    var esc2 = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    function faltan() {
      var seen = {}, out = [];
      [].slice.call(document.querySelectorAll('.document-sheet input[required],.document-sheet textarea[required],.document-sheet select[required]')).forEach(function (el) {
        if (el.type === 'hidden' || el.closest('[hidden]') || el.offsetParent === null) return;
        var ok = el.type === 'radio' ? !!document.querySelector('.document-sheet [name="' + el.name + '"]:checked') : el.type === 'checkbox' ? el.checked : !!String(el.value || '').trim();
        if (ok || seen[el.name || Math.random()]) return; seen[el.name] = 1;
        var row = el.closest('tr'), lab = row && row.querySelector('.label, th');
        out.push({ el: el, t: String((lab && lab.textContent) || el.getAttribute('aria-label') || el.placeholder || el.name || 'campo').replace(/\s+/g, ' ').replace(/\*/g, '').trim().slice(0, 50) });
      });
      return out;
    }
    var wrapped = async function () {
      var el = st(), before = el ? el.innerHTML : '', args = arguments, auto = args[0] && args[0].auto;
      try { await orig.apply(this, args); }
      catch (e) { show('No se pudo enviar: ' + esc2(e && e.message || e) + '. Vuelve a presionar «Enviar»; si se repite, cierra y abre la app.', 'error'); return; }
      el = st(); if (auto || !el || el.innerHTML !== before) return; // el formulario ya mostró su mensaje
      var f = faltan();
      if (f.length) {
        f.forEach(function (x) { x.el.classList.add('gp-invalid'); x.el.addEventListener('input', function () { x.el.classList.remove('gp-invalid'); }, { once: true }); });
        show('No se envió: faltan ' + f.length + ' campo(s) obligatorio(s): <b>' + f.map(function (x) { return esc2(x.t); }).join(', ') + '</b>. Complétalos y vuelve a presionar «Enviar».', 'warn',
          '<div style="margin-top:8px"><button type="button" class="btn btn-small" id="gpSendAnyway">Enviar igual</button></div>');
        var b = document.getElementById('gpSendAnyway');
        if (b) b.onclick = async function () { var oc = window.confirm; window.confirm = function () { return true; }; try { await orig.call(window); } finally { window.confirm = oc; } };
        try { f[0].el.focus({ preventScroll: true }); } catch (e) {}
      } else show('No se envió. Vuelve a presionar «Enviar reporte por correo»; si se repite, cierra la app por completo y ábrela otra vez.', 'warn');
    };
    wrapped.gpGuard = true; window.gpSendReport = wrapped;
  }
  function initForm() {
    addCentroField(); addAppBar(); setNet();
    try { var gl = document.createElement('script'); gl.src = new URL('gp-listas.js', document.baseURI).href; document.head.appendChild(gl); } catch (e) {}
    guardSend();
    try { applyAct(); } catch (e) {}
    idb.get('drafts', draftKey).then(function (saved) {
      if (saved && saved.values) { restore(saved); restored = true; showBanner(saved); }
      else if (applyProfile()) toast('Cargamos tus datos de la última vez', '', 2600);
    }).catch(function () { applyProfile(); }).then(function () {
      var mark = function (e) { if (e.isTrusted && !e.target.closest('.gp-draft-banner')) { dirty = true; saveDraft(); } };
      document.addEventListener('input', mark, true);
      document.addEventListener('change', mark, true);
      document.addEventListener('click', function (e) {
        if (e.isTrusted && e.target.closest('.save-signature,[data-clear-signature],.btn-danger,.btn')) { dirty = true; setTimeout(saveDraft, 300); }
      }, true);
      var signing = false;
      ['mousedown', 'touchstart', 'pointerdown'].forEach(function (ev) {
        document.addEventListener(ev, function (e) { if (e.target && e.target.matches && e.target.matches('canvas.signature-canvas')) signing = true; }, true);
      });
      ['mouseup', 'touchend', 'pointerup', 'touchcancel'].forEach(function (ev) {
        window.addEventListener(ev, function () { if (signing) { signing = false; dirty = true; saveDraft(); } }, true);
      });
      var grid = $('#photoGrid');
      if (grid && window.MutationObserver) new MutationObserver(function () { if (dirty || grid.children.length) { dirty = true; saveDraft(); } }).observe(grid, { childList: true });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden && dirty && !stopDrafts) { clearTimeout(saving); idb.put('drafts', snapshot(), draftKey).catch(function () {}); }
      });
      ['#gpReporterName', '#gpReporterEmail', '#gpExtraCc', '[name="reportante"]', '[name="nombre_prevencionista"]', '[name="nombre_entrevistador"]']
        .forEach(function (s) { var el = $(s); if (el) el.addEventListener('change', saveProfile); });
    });
    // «Limpiar formulario» también borra el borrador
    if (typeof window.clearForm === 'function') {
      var orig = window.clearForm;
      window.clearForm = function () {
        var ok = confirm('¿Deseas limpiar todos los datos ingresados en este formulario?');
        if (!ok) return;
        var oc = window.confirm; window.confirm = function () { return true; };
        try { orig.apply(this, arguments); } finally { window.confirm = oc; }
        $$('#photoGrid .photo-card').forEach(function (c) { c.remove(); });
        dirty = false; stopDrafts = false; clearTimeout(saving);
        idb.del('drafts', draftKey).catch(function () {});
        var b = $('.gp-draft-banner'); if (b) b.remove();
        applyProfile();
      };
    }
  }

  /* ---------------- PDF del registro (reemplaza al Word) ---------------- */
  var PDF_LIBS = ['vendor/html2canvas.min.js', 'vendor/jspdf.umd.min.js'].map(function (u) { return new URL(u, document.baseURI).href; });
  var PDF_SIGLA = { 'CHECKLIST-EQ': 'CL Equipo', 'CHECKLIST-ARNES': 'CL Arnes', 'CHECKLIST-EPP': 'CL EPP', 'CAMINATA': 'Acta Caminata', 'CHECKLIST-ANDEN': 'CL Andenes', 'CHECKLIST-ARMADO': 'CHL Armado', 'CHECKLIST-PBYL': 'CHL PBYL', 'CHECKLIST-CARGA': 'CHL Carga', 'CHECKLIST-EMERG': 'CHL Emergencias', 'CHECKLIST-VH': 'CL Vehiculo', 'CHARLA': 'Charla', 'COMITE': 'Acta Comite',
    'HALLAZGO': 'Hallazgo', 'OBS-CONDUCTA': 'Obs Conducta', 'PERMISO-AR': 'Permiso AR', 'ENTREGA-EPP': 'Entrega EPP', 'FIRMA-PTS': 'Firma PTS', 'AUDITORIA-MENSUAL': 'Auditoria',
    'AUDITORIA': 'Auditoria', 'PRE-AUDITORIA': 'Pre Auditoria', 'FR-RAPIDO': 'FR Rapido', 'FR-DETALLADO': 'FR Detallado', 'DECLARACION': 'Declaracion' };
  var MESC = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  // Nombre: «CL Equipo N1911 - 19Nov2026» (N = número de máquina). Resto: «Charla - 19Nov2026 - ABC» (ABC = parte del ID, evita sobrescribir).
  window.gpPdfName = function (formCode, fechaISO, id) {
    var sig = PDF_SIGLA[formCode] || 'Registro', v = function (n) { var e = $('.document-sheet [name="' + n + '"]'); return e ? String(e.value || '').trim() : ''; };
    if (formCode === 'CHARLA' && /capacitaci/i.test(v('tipo_actividad'))) sig = 'Capacitacion';
    var m = String(fechaISO || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) { var n = new Date(); m = [0, String(n.getFullYear()), ('0' + (n.getMonth() + 1)).slice(-2), ('0' + n.getDate()).slice(-2)]; }
    var fecha = m[3] + MESC[+m[2] - 1] + m[1], suf = String(id || '').split('-')[1] || '';
    var nombre;
    if (formCode === 'CHECKLIST-EQ') { var eq = v('lugar').replace(/[^0-9A-Za-z-]/g, ''); nombre = sig + (eq ? ' N' + eq : '') + ' - ' + fecha + (eq ? '' : (suf ? ' - ' + suf : '')); }
    else nombre = sig + ' - ' + fecha + (suf ? ' - ' + suf : '');
    return nombre.replace(/[\\\/:*?"<>|#%]+/g, ' ') + '.pdf';
  };
  function loadIn(win, src) {
    return new Promise(function (ok, ko) { var sc = win.document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = function () { ko(new Error('No se pudo cargar el generador de PDF. Revisa la conexión.')); }; win.document.head.appendChild(sc); });
  }
  /* ---- PDF con texto real: HTML limpio (sin estilos de pantalla) convertido en el servidor ---- */
  var PDF_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzm9nT8n5zazy7ANUWsryccY5178aI7-Orp1jpUZ33Bgzg2m3h5NH6ka3PDWi1r3YEg9w/exec', PDF_KEY = 'GP-PYR-2026';
  function pdfEsc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  async function blankImg(src) {
    return new Promise(function (ok) {
      var im = new Image(); im.onload = function () {
        try { var w = Math.min(160, im.naturalWidth || 1), h = Math.max(1, Math.round(w * (im.naturalHeight || 1) / (im.naturalWidth || 1))), c = document.createElement('canvas'); c.width = w; c.height = h;
          var x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h); var d = x.getImageData(0, 0, w, h).data, n = 0;
          for (var i = 0; i < d.length; i += 4) { if (d[i + 3] > 30 && (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200)) n++; } ok(n < 6); } catch (e) { ok(false); } };
      im.onerror = function () { ok(true); }; im.src = src;
    });
  }
  async function cleanPdfHtml(src) {
    var doc = new DOMParser().parseFromString(src, 'text/html');
    [].slice.call(doc.querySelectorAll('script,style,template,[hidden],.hide-on-print,.hide-on-word,.error-text,.screen-only-note,.conditional-note,.list-help,.smart-tip,.signature-tools,button,datalist')).forEach(function (x) { x.remove(); });
    var F = 'font-family:Arial,Helvetica,sans-serif;';
    var sigs = [].slice.call(doc.querySelectorAll('img[alt="Firma"]'));
    for (var i = 0; i < sigs.length; i++) { if (await blankImg(sigs[i].getAttribute('src'))) sigs[i].setAttribute('data-blank', '1'); }
    function txt(n) { return String(n.textContent || '').replace(/ /g, ' ').trim(); }
    function cell(node) {
      var vals = [].slice.call(node.querySelectorAll(':scope .materialized-value'));
      if (vals.length === 2 && !node.querySelector('img,label,.materialized-check') && /^\d{1,2}:\d{2}$/.test(txt(vals[0]))) {
        var b = txt(vals[1]); return pdfEsc(txt(vals[0]) + (/^\d{1,2}:\d{2}$/.test(b) ? ' – ' + b : ''));
      }
      var out = '';
      node.childNodes.forEach(function (n) {
        if (n.nodeType === 3) { out += pdfEsc(n.nodeValue.replace(/\s+/g, ' ')); return; }
        if (n.nodeType !== 1) return;
        var t = n.tagName;
        if (t === 'BR') { out += '<br>'; return; }
        if (t === 'IMG') { if (n.getAttribute('alt') === 'Firma') { if (!n.getAttribute('data-blank')) out += '<img src="' + n.getAttribute('src') + '" height="48" style="height:48px">'; } return; }
        if (n.classList.contains('materialized-check')) { out += /☒|✔|X/.test(n.textContent) ? '<b>■</b>' : '□'; return; }
        if (n.classList.contains('materialized-value')) { var v = String(n.textContent || '').replace(/ /g, ' ').trim(); out += pdfEsc(v).replace(/\n/g, '<br>'); if (t === 'DIV' && v) out += '<br>'; return; }
        if (t === 'LABEL') { var inner = cell(n).trim(); if (inner) out += '<span style="margin-right:10px">' + inner + '</span> '; return; }
        if (n.classList.contains('warning-box') || n.classList.contains('hint-box')) { var w = txt(n); if (w && !/^Total asistentes:\s*0$/i.test(w)) out += '<div style="font-weight:bold">' + pdfEsc(w) + '</div>'; return; }
        var inner2 = cell(n); out += inner2 + (/^(DIV|P|LI)$/.test(t) && inner2.trim() ? '<br>' : '');
      });
      return out.replace(/(<br>\s*)+$/, '').trim();
    }
    function photos(grid) {
      var h = '';
      [].slice.call(grid.querySelectorAll('.photo-card')).forEach(function (c) {
        var im = c.querySelector('img'); if (!im) return; var cap = txt(c).replace(/Eliminar/g, '').trim();
        h += '<div style="page-break-inside:avoid;margin:6px 0 10px;text-align:center"><img src="' + im.getAttribute('src') + '" width="600" style="width:600px;max-width:100%">' + (cap ? '<div style="' + F + 'font-size:9pt;color:#555;margin-top:3px">' + pdfEsc(cap) + '</div>' : '') + '</div>';
      });
      return h;
    }
    var BD = 'border:1px solid #c8c8c8;', html = '';
    function table(tb) {
      var rows = [].slice.call(tb.querySelectorAll('tr')).filter(function (tr) { return tr.closest('table') === tb; }), out = '', photoHtml = '', removed = 0, kept = 0, cols = 6;
      rows.forEach(function (tr) {
        if (tr.classList.contains('dyn-row')) {
          var hasVal = [].slice.call(tr.querySelectorAll('.materialized-value')).some(function (v) { return txt(v); }) || !!tr.querySelector('img[alt="Firma"]:not([data-blank])');
          if (!hasVal) { removed++; return; }
          kept++;
        }
        var grid = tr.querySelector('.photo-grid');
        if (grid) {
          var ph = photos(grid); photoHtml += ph;
          if (!txt(tr).replace(grid.textContent, '').trim()) {
            // Sin fotos: se quita el título «Evidencia fotográfica» que quedaría vacío. Con fotos: se indica dónde están.
            if (ph) { var nf = (ph.match(/<img /g) || []).length, gc = (grid.closest('td,th') || {}).getAttribute ? grid.closest('td,th').getAttribute('colspan') || cols : cols;
              out += '<tr><td colspan="' + gc + '" style="' + F + BD + 'padding:4px 6px;font-size:9.5pt;font-style:italic;color:#444444">' + nf + (nf === 1 ? ' fotografía' : ' fotografías') + ' en el respaldo fotográfico, al final del documento.</td></tr>'; }
            else out = out.replace(/<!--S--><tr>(?:(?!<\/tr>)[\s\S])*<\/tr>$/, '');
            return;
          }
        }
        if (tr.classList.contains('dyn-head')) { out += '<!--DYNHEAD-->'; }
        var sec = tr.classList.contains('section-row'), sub = tr.classList.contains('subsection-row');
        var cells = [].slice.call(tr.children); if (!cells.length) return;
        var r = '<tr>';
        cells.forEach(function (c) {
          var span = c.getAttribute('colspan') || '1', st = F + BD + 'padding:4px 6px;font-size:9.5pt;vertical-align:top;';
          if (sec) st += 'color:#bd0926;font-weight:bold;font-size:10.5pt;border-left:4px solid #bd0926;border-bottom:2px solid #bd0926;padding-top:7px;';
          else if (sub) st += 'color:#7a0619;font-weight:bold;';
          else if (c.classList.contains('label') || c.tagName === 'TH') st += 'color:#333333;font-weight:bold;';
          if (/text-align:\s*center/.test(c.getAttribute('style') || '') || c.classList.contains('check-cell')) st += 'text-align:center;';
          r += '<td colspan="' + span + '" style="' + st + '">' + (cell(c) || '&nbsp;') + '</td>';
        });
        if (!sec && !sub && !/<td[^>]*>(?!&nbsp;<\/td>)/.test(r.replace(/<td[^>]*>&nbsp;<\/td>/g, ''))) return;
        out += (sec ? '<!--S-->' : '') + r + '</tr>';
      });
      out = kept ? out.replace(/<!--DYNHEAD-->/g, '') : out.replace(/<!--DYNHEAD--><tr>[\s\S]*?<\/tr>/g, '');
      for (var z = 0; z < 4; z++) out = out.replace(/<!--S--><tr>(?:(?!<\/tr>)[\s\S])*<\/tr>(?=<!--S-->|$)/g, '');
      out = out.replace(/<!--S-->/g, '');
      if (removed && !kept) out += '<tr><td colspan="' + cols + '" style="' + F + BD + 'padding:6px;font-size:9pt;font-style:italic;color:#444">Sin registros digitales en esta tabla' + (tb.ownerDocument.querySelector('.photo-card') ? ': ver la hoja física en el respaldo fotográfico.' : '.') + '</td></tr>';
      if (photoHtml && !/<tr><td[^>]*>(?!&nbsp;)[^<]/.test(out.replace(/<tr><td colspan="\d+" style="[^"]*border-left:4px solid #bd0926[^"]*">[^<]*<\/td><\/tr>/g, ''))) out = '';
      var hasRows = out.indexOf('<tr>') >= 0;
      var t = hasRows ? '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:0 0 8px">' + out + '</table>' : '';
      return { t: t, photos: photoHtml, removed: removed };
    }
    var meta = doc.querySelector('[data-header-meta]'), logo = doc.querySelector('.header-white img'), foot = doc.querySelector('.doc-footer');
    var pages = [].slice.call(doc.querySelectorAll('.print-page')); if (!pages.length) pages = [doc.body];
    var allPhotos = '';
    pages.forEach(function (pg, pi) {
      var body = pg.querySelector('.fit-body') || pg, part = '';
      [].slice.call(body.children).forEach(function (el) {
        if (el.classList.contains('doc-title')) { part += '<div style="' + F + 'text-align:center;font-weight:bold;font-size:13pt;text-decoration:underline;margin:10px 0 8px">' + pdfEsc(txt(el)) + '</div>'; return; }
        if (el.tagName === 'TABLE') {
          var r = table(el); allPhotos += r.photos;
          part += r.t;
          return;
        }
        if (el.classList.contains('photo-grid')) { allPhotos += photos(el); return; }
        if (el.classList.contains('aud-sum')) { var sm = [].slice.call(el.querySelectorAll('b,small,.as-cnt')).map(txt).filter(Boolean).join(' · '); if (sm) part += '<div style="' + F + 'font-size:10.5pt;font-weight:bold;margin:4px 0 8px">Resultado: ' + pdfEsc(sm) + '</div>'; return; }
        if (el.classList.contains('aud-list')) {
          var at = '';
          [].slice.call(el.querySelectorAll('.aa')).forEach(function (aa) {
            var hh = aa.querySelector('.aa-h'); at += '<tr><td colspan="4" style="' + F + BD + 'padding:6px;font-size:10.5pt;color:#bd0926;font-weight:bold;border-left:4px solid #bd0926;border-bottom:2px solid #bd0926">' + pdfEsc(hh ? [].slice.call(hh.children).map(txt).join(' · ') : '') + '</td></tr>';
            [].slice.call(aa.querySelectorAll('.ai')).forEach(function (ai) {
              var n = txt(ai.querySelector('.ai-n') || ai), ttx = txt(ai.querySelector('.ai-t') || ai), res = [].slice.call(ai.querySelectorAll('label')).filter(function (l) { var m = l.querySelector('.materialized-check'); return m && /☒|✔|X/.test(m.textContent); }).map(txt).join(', ');
              var obs = [].slice.call(ai.querySelectorAll(':scope > .materialized-value, .ai-plan .materialized-value')).map(txt).filter(Boolean).join(' · ');
              var col = /^No cumple/.test(res) ? '#b3261e' : /^Parcial/.test(res) ? '#b45309' : /^Cumple/.test(res) ? '#16623f' : '#333333';
              at += '<tr><td style="' + F + BD + 'padding:4px 6px;font-size:9.5pt;width:7%;font-weight:bold">' + pdfEsc(n) + '</td><td style="' + F + BD + 'padding:4px 6px;font-size:9.5pt;width:55%">' + pdfEsc(ttx) + '</td><td style="' + F + BD + 'padding:4px 6px;font-size:9.5pt;width:14%;font-weight:bold;color:' + col + '">' + pdfEsc(res || '—') + '</td><td style="' + F + BD + 'padding:4px 6px;font-size:9pt;width:24%">' + pdfEsc(obs) + '</td></tr>';
              [].slice.call(ai.querySelectorAll('.ai-ph img')).forEach(function (im) { allPhotos += '<div style="page-break-inside:avoid;margin:6px 0 10px;text-align:center"><img src="' + im.getAttribute('src') + '" width="600" style="width:600px;max-width:100%"><div style="' + F + 'font-size:9pt;color:#555555;margin-top:3px">Ítem ' + pdfEsc(n) + '</div></div>'; });
            });
          });
          if (at) part += '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin:0 0 8px">' + at + '</table>';
          return;
        }
        if (el.classList.contains('warning-box') || el.classList.contains('legal-note')) { var w = txt(el); if (w) part += '<div style="' + F + 'font-size:8.5pt;color:#444444;border:1px solid #dddddd;padding:5px 7px;margin:0 0 8px">' + pdfEsc(w) + '</div>'; return; }
      });
      if (!part) return;
      html += '<div' + (html ? ' style="margin-top:14px"' : '') + '>' + part + '</div>';
    });
    if (allPhotos) html += '<div style="page-break-before:always"><div style="' + F + 'color:#bd0926;font-weight:bold;font-size:10pt;padding:4px 6px;border-left:4px solid #bd0926;border-bottom:2px solid #bd0926;margin-bottom:8px">RESPALDO FOTOGRÁFICO</div>' + allPhotos + '</div>';
    var head = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin-bottom:6px"><tr>' +
      '<td style="' + F + 'color:#1d1d1b;font-weight:bold;font-size:10pt;padding:6px 8px;width:38%;border-bottom:3px solid #bd0926">DEPARTAMENTO DE<br>PREVENCIÓN DE RIESGOS (PYR)</td>' +
      '<td style="' + F + 'color:#555555;font-size:7pt;padding:6px 8px;width:26%;border-bottom:3px solid #bd0926">' + pdfEsc(meta ? meta.textContent.trim() : '').replace(/\n/g, '<br>') + '</td>' +
      '<td style="text-align:right;padding:4px 8px;width:36%;border-bottom:3px solid #bd0926">' + (logo ? '<img src="' + logo.getAttribute('src') + '" height="44" style="height:44px">' : '') + '</td></tr></table>';
    var ft = foot ? '<div style="' + F + 'font-size:7pt;color:#666;border-top:1px solid #ccc;margin-top:12px;padding-top:4px">' + pdfEsc(txt(foot).replace(/\s{2,}/g, ' · ')) + '</div>' : '';
    return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm 12mm 12mm 12mm}body{margin:0;' + F + 'color:#111}</style></head><body>' + head + html + ft + '</body></html>';
  }
  window.gpCleanPdfHtml = cleanPdfHtml;
  async function serverPdf(name) {
    var html = await cleanPdfHtml(window.buildPrintDocumentHtml());
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, 60000) : 0;
    try {
      var r = await fetch(PDF_ENDPOINT, { method: 'POST', body: JSON.stringify({ key: PDF_KEY, action: 'pdf', name: name, html: html }), signal: ctl ? ctl.signal : undefined });
      var j = await r.json(); if (!j || !j.ok || !j.b64) throw new Error((j && j.error) || 'Sin PDF');
      var bin = atob(j.b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return { blob: new Blob([u], { type: 'application/pdf' }), name: name || 'Registro.pdf' };
    } finally { if (tm) clearTimeout(tm); }
  }
  window.gpMakePdf = async function (name) {
    if (typeof window.buildPrintDocumentHtml !== 'function') throw new Error('Este formulario no puede generar PDF.');
    if (navigator.onLine !== false) {
      for (var t = 0; t < 2; t++) { // un reintento si la falla fue rápida (corte breve de señal)
        var t0 = Date.now();
        try { return await serverPdf(name); } catch (e) { console.warn('PDF servidor no disponible' + (t ? ', se usa el de respaldo' : ''), e); if (Date.now() - t0 > 15000) break; await new Promise(function (ok) { setTimeout(ok, 1500); }); }
      }
    }
    return rasterPdf(name);
  };
  /* PDF de respaldo (sin conexión o si el servidor falla): mismo diseño que el PDF del servidor,
     dibujado en el teléfono y cortado en páginas A4 sin partir filas ni fotos. */
  var rasterPdf = async function (name) {
    if (typeof window.buildPrintDocumentHtml !== 'function') throw new Error('Este formulario no puede generar PDF.');
    var clean = null; try { clean = await cleanPdfHtml(window.buildPrintDocumentHtml()); } catch (e) { console.warn('PDF de respaldo: diseño simple', e); }
    if (!clean) return rasterPagePdf(name);
    var M = 45, PW = 794, PH = 1123; // márgenes ≈12 mm, A4 a 96 dpi
    clean = clean.replace('</head>', '<style>html,body{width:' + PW + 'px;background:#fff}body{padding:0 ' + M + 'px!important;box-sizing:border-box}</style></head>');
    var ifr = document.createElement('iframe'); ifr.setAttribute('aria-hidden', 'true');
    ifr.style.cssText = 'position:fixed;left:-12000px;top:0;width:' + PW + 'px;height:' + PH + 'px;border:0;background:#fff';
    document.body.appendChild(ifr);
    try {
      await new Promise(function (ok) { ifr.onload = ok; ifr.srcdoc = clean; });
      var w = ifr.contentWindow, d = w.document;
      for (var i = 0; i < PDF_LIBS.length; i++) await loadIn(w, PDF_LIBS[i]);
      await Promise.all([].slice.call(d.images).filter(function (im) { return !im.complete; }).map(function (im) { return new Promise(function (ok) { im.onload = im.onerror = ok; }); }));
      var total = Math.ceil(d.body.scrollHeight), H = PH - 2 * M;
      var cuts = [], forced = [];
      [].slice.call(d.querySelectorAll('tr, body > div, body > div > div, body > table, img')).forEach(function (el) {
        var r = el.getBoundingClientRect(); cuts.push(Math.ceil(r.bottom));
        if (/page-break-before:\s*always/.test(el.getAttribute('style') || '')) forced.push(Math.floor(r.top));
      });
      var sl = [], y = 0;
      while (y < total - 2) {
        var lim = y + H, f = forced.filter(function (t) { return t > y + 5 && t <= lim; })[0], end;
        if (f) end = f; else if (lim >= total) end = total;
        else { var ok = cuts.filter(function (c) { return c > y + 60 && c <= lim; }); end = ok.length ? Math.max.apply(null, ok) : lim; }
        sl.push([y, end]); y = end;
      }
      var cv = await w.html2canvas(d.body, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: PW, width: PW, height: total });
      var pdf = new w.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      sl.forEach(function (s, k) {
        var pg = d.createElement('canvas'); pg.width = PW * 2; pg.height = PH * 2;
        var x = pg.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, pg.width, pg.height);
        x.drawImage(cv, 0, s[0] * 2, PW * 2, (s[1] - s[0]) * 2, 0, M * 2, PW * 2, (s[1] - s[0]) * 2);
        if (k) pdf.addPage();
        pdf.addImage(pg.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      });
      return { blob: new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' }), name: name || 'Registro.pdf' };
    } finally { setTimeout(function () { ifr.remove(); }, 300); }
  };
  // Diseño anterior (hoja del formulario reducida a una página): solo si falla el anterior
  var rasterPagePdf = async function (name) {
    var html = window.buildPrintDocumentHtml();
    var ifr = document.createElement('iframe'); ifr.setAttribute('aria-hidden', 'true');
    ifr.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;height:1123px;border:0;background:#fff';
    document.body.appendChild(ifr);
    try {
      await new Promise(function (ok) { ifr.onload = ok; ifr.srcdoc = html; });
      var w = ifr.contentWindow;
      await new Promise(function (ok) { setTimeout(ok, 450); });
      try { if (typeof w.fitPages === 'function') w.fitPages(); } catch (e) {}
      for (var i = 0; i < PDF_LIBS.length; i++) await loadIn(w, PDF_LIBS[i]);
      var imgs = [].slice.call(w.document.images).filter(function (im) { return !im.complete; });
      await Promise.all(imgs.map(function (im) { return new Promise(function (ok) { im.onload = im.onerror = ok; }); }));
      var pages = [].slice.call(w.document.querySelectorAll('.print-page'));
      if (!pages.length) pages = [w.document.body];
      var pdf = new w.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      for (var k = 0; k < pages.length; k++) {
        var cv = await w.html2canvas(pages[k], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 794 });
        if (k) pdf.addPage();
        var ratio = cv.height / cv.width, hmm = Math.min(297, 210 * ratio);
        pdf.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, hmm, undefined, 'FAST');
      }
      return { blob: new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' }), name: name || 'Registro.pdf' };
    } finally { setTimeout(function () { ifr.remove(); }, 300); }
  };
  window.gpDownloadPdf = async function (formCode, btn) {
    var old = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = 'Generando PDF…'; }
    try {
      var f = $('.document-sheet [name="fecha_evento"]') || $('.document-sheet input[type="date"]'), id = $('.document-sheet [name="registro_id"]');
      var r = await window.gpMakePdf(window.gpPdfName(formCode, f ? f.value : '', id ? id.value : ''));
      var a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = r.name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    } catch (e) { toast(String(e.message || e), 'error'); }
    if (btn) { btn.disabled = false; btn.textContent = old; }
  };

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (isForm()) initForm();
      flushOutbox();
    }, 60);
  });
})();
