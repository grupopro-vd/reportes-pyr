/* PRO EHS · acceso al servidor (Apps Script) con la sesión Microsoft o con el PIN del centro.
   - Quien tiene sesión Microsoft en la app envía su token (el servidor lo valida con Microsoft).
   - Quien no tiene cuenta ingresa el PIN de su centro una vez: el servidor lo valida y entrega
     una sesión para ese centro (válida 60 días) que queda guardada en el teléfono.
   Uso: gpApi.read('panel'|'hz') · gpApi.post({action:…}) · gpApi.login(centro, pin) · gpApi.centros() */
(function () {
  if (window.gpApi) return;
  var EP = 'https://script.google.com/macros/s/AKfycbzm9nT8n5zazy7ANUWsryccY5178aI7-Orp1jpUZ33Bgzg2m3h5NH6ka3PDWi1r3YEg9w/exec', KEY = 'GP-PYR-2026';
  var MS = { clientId: '9e6fd77e-8355-4bfa-9a7f-d38b9ee6932f', tenant: '470d4a25-3e3e-49c6-a6f6-ed59ef49a1c3', scopes: ['Sites.ReadWrite.All'],
    lib: 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.39.0/lib/msal-browser.min.js' };
  var CENTROS = ['Walmart Peñón', 'Walmart Pudahuel', 'Walmart Lo Aguirre', 'Walmart La Farfana', 'Líder La Reina'];
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toks() { var t = lsGet('gpToks', {}), now = Date.now(), out = {};
    Object.keys(t || {}).forEach(function (c) { var exp = +String(t[c]).split('.')[1] || 0; if (exp > now) out[c] = t[c]; }); return out; }
  function hayCuentaMs() {
    try { for (var i = 0; i < localStorage.length; i++) { var v = localStorage.getItem(localStorage.key(i)); if (v && v.indexOf('"username"') >= 0 && v.indexOf('"homeAccountId"') >= 0) return true; } } catch (e) {}
    return false;
  }
  function loadScript(src) { return new Promise(function (ok, ko) { if ([].some.call(document.scripts, function (s) { return s.src === src; })) return ok();
    var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('No cargó ' + src)); }; document.head.appendChild(s); }); }
  var PCA = null;
  async function msToken() {
    if (!hayCuentaMs()) return '';
    try {
      if (!window.msal) await loadScript(MS.lib);
      if (!PCA) PCA = new msal.PublicClientApplication({ auth: { clientId: MS.clientId, authority: 'https://login.microsoftonline.com/' + MS.tenant, redirectUri: location.origin + location.pathname.replace(/[^/]*$/, '') + 'panel.html' }, cache: { cacheLocation: 'localStorage' } });
      var a = PCA.getActiveAccount() || PCA.getAllAccounts()[0]; if (!a) return '';
      return (await PCA.acquireTokenSilent({ scopes: MS.scopes, account: a })).accessToken || '';
    } catch (e) { return ''; }
  }
  async function cred() { var o = {}, t = await msToken(), k = toks(), l = Object.keys(k).map(function (c) { return k[c]; });
    if (t) o.ms = t; if (l.length) o.toks = l; return o; }
  async function post(body) {
    var c = await cred();
    var r = await fetch(EP, { method: 'POST', body: JSON.stringify(Object.assign({ key: KEY }, body || {}, c)) });
    var d = null; try { d = await r.json(); } catch (e) { d = { ok: false, error: 'Respuesta no válida del servidor' }; }
    return d;
  }
  async function login(centro, pin) {
    var r = await fetch(EP, { method: 'POST', body: JSON.stringify({ key: KEY, action: 'auth', centro: centro, pin: String(pin || '').trim() }) }).then(function (r) { return r.json(); });
    if (r && r.ok && r.tok) { var t = lsGet('gpToks', {}) || {}; t[centro] = r.tok; lsSet('gpToks', t); return true; }
    throw new Error((r && r.error) || 'PIN incorrecto para ' + centro);
  }
  // Lee datos protegidos. Si falta acceso, pide el PIN del centro (salvo opts.prompt === false) y reintenta.
  async function read(what, opts) {
    opts = opts || {};
    var d = await post({ action: 'read', what: what });
    if (d && d.error === 'SIN_ACCESO' && opts.prompt !== false) {
      var ok = await pinPrompt(d.centros && d.centros.length ? d.centros : CENTROS, opts.motivo);
      if (ok) d = await post({ action: 'read', what: what });
    }
    return d;
  }
  // Ventana para ingresar el PIN del centro (una vez por teléfono)
  function pinPrompt(centros, motivo) {
    return new Promise(function (done) {
      var st = document.getElementById('gpPinCss');
      if (!st) { st = document.createElement('style'); st.id = 'gpPinCss';
        st.textContent = '.gpPin{position:fixed;inset:0;z-index:99999;background:rgba(24,24,27,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Manrope,Arial,sans-serif}' +
          '.gpPin .bx{background:#fff;border-radius:16px;max-width:380px;width:100%;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.25)}' +
          '.gpPin b{display:block;font-size:17px;margin-bottom:4px;color:#18181b}.gpPin small{display:block;color:#52525b;font-size:13px;line-height:1.4;margin-bottom:12px}' +
          '.gpPin select,.gpPin input{width:100%;box-sizing:border-box;font:600 15px Manrope,Arial,sans-serif;padding:10px 12px;border:1px solid #d4d4d8;border-radius:10px;margin-bottom:8px;background:#fff}' +
          '.gpPin .rw{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}.gpPin button{font:700 14px Manrope,Arial,sans-serif;border-radius:10px;padding:10px 14px;border:1px solid #d4d4d8;background:#fff;cursor:pointer}' +
          '.gpPin button.pri{background:#bd0926;border-color:#bd0926;color:#fff}.gpPin .er{color:#b3261e;font-size:13px;min-height:18px}';
        document.head.appendChild(st); }
      var w = document.createElement('div'); w.className = 'gpPin'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
      var pref = (lsGet('gpPerfil', {}) || {}).centro || '';
      w.innerHTML = '<div class="bx"><b>Ingresa el PIN de tu centro</b><small>' + esc(motivo || 'Para ver esta información necesitas el PIN de tu centro. Se pide una sola vez en este teléfono. Si no lo tienes, pídelo a Valentín Díaz.') + '</small>' +
        '<select aria-label="Centro"><option value="">Elige el centro</option>' + centros.map(function (c) { return '<option' + (c === pref ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
        '<input type="password" inputmode="numeric" maxlength="8" placeholder="PIN" aria-label="PIN"><div class="er"></div>' +
        '<div class="rw"><button type="button" data-x>Ahora no</button><button type="button" class="pri" data-ok>Entrar</button></div></div>';
      document.body.appendChild(w);
      var sel = w.querySelector('select'), inp = w.querySelector('input'), er = w.querySelector('.er'), bt = w.querySelector('[data-ok]');
      (sel.value ? inp : sel).focus();
      function fin(v) { w.remove(); done(v); }
      w.querySelector('[data-x]').onclick = function () { fin(false); };
      inp.onkeydown = function (e) { if (e.key === 'Enter') bt.click(); };
      bt.onclick = async function () {
        if (!sel.value || !inp.value.trim()) { er.textContent = 'Elige el centro y escribe el PIN.'; return; }
        bt.disabled = true; er.textContent = '';
        try { await login(sel.value, inp.value); fin(true); } catch (e) { er.textContent = e.message; bt.disabled = false; }
      };
    });
  }
  window.gpApi = { endpoint: EP, key: KEY, read: read, post: post, login: login, cred: cred, msToken: msToken, pinPrompt: pinPrompt,
    centros: function () { return Object.keys(toks()); } };
})();
