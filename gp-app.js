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
  window.gpQueue = function (payload, recordId, sig, endpoint) {
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
      values: controls().map(function (el) {
        var o = { t: el.tagName + ':' + (el.type || '') + ':' + (el.name || '') };
        if (el.type === 'checkbox' || el.type === 'radio') o.c = el.checked; else o.v = el.value;
        return o;
      }),
      photos: $$('#photoGrid .photo-card').map(function (card) {
        var img = card.querySelector('img'), inp = card.querySelector('input');
        return { src: img ? img.getAttribute('src') : '', desc: inp ? inp.value : '' };
      }),
      signatures: sigCanvases().map(function (c) { return canvasBlank(c) ? '' : c.toDataURL('image/png'); })
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
  window.gpOnSent = function (recordId, queued) {
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
    ['[name="reportante"]', 'name'],
    ['[name="nombre_prevencionista"]', 'prev'], ['[name="nombre_entrevistador"]', 'prev'],
    ['input[list="empresasList"]', 'empresa'], ['input[list="areasList"]', 'area']
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

  function initForm() {
    addAppBar(); setNet();
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

  window.addEventListener('load', function () {
    setTimeout(function () {
      if (isForm()) initForm();
      flushOutbox();
    }, 60);
  });
})();
