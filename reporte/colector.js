/* PRO EHS · Colector de datos para el «Reporte diario PYR» en PowerPoint.
   Se ejecuta en Chrome sobre una página de la app con la sesión Microsoft iniciada (idealmente eventos.html,
   después de abrir observaciones.html y eventos.html para que sus cachés queden al día).
   Uso:  await (await import('./reporte/colector.js?'+Date.now())).run('2026-11-10')   // fecha del reporte (hoy)
   Devuelve un texto JSON sin los caracteres ? = & (el puente del navegador los bloquea). */
const CFG = {
  clientId: '9e6fd77e-8355-4bfa-9a7f-d38b9ee6932f', tenant: '470d4a25-3e3e-49c6-a6f6-ed59ef49a1c3',
  site: 'grupoprocl.sharepoint.com,32881a9e-1d10-427d-8d81-a8e638a346f4,8c2de84d-d5d6-4c85-8258-7ffb421c081f',
  list: '2589a108-a0a3-417e-b464-b5d178775d79',
  rep: 'b!nhqIMhAdfUKNgajmOKNG9E3oLYzW1YVMglh_-0IcCB81BD09HLDUQrrDRjbKN60n',
  docs: 'b!nhqIMhAdfUKNgajmOKNG9E3oLYzW1YVMglh_-0IcCB8TjWn42sJPSZnl6HYe8Wv8',
  macro: '/General/Gestión SSO Grupo Pro/Carpeta B.6 - Estadistica/B. Data Reporte Informes PPRR',
  seg: 'PRO_EHS/Config/obs_seguimiento.json',
  endpoint: 'https://script.google.com/macros/s/AKfycbzm9nT8n5zazy7ANUWsryccY5178aI7-Orp1jpUZ33Bgzg2m3h5NH6ka3PDWi1r3YEg9w/exec', key: 'GP-PYR-2026',
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  msal: 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.39.0/lib/msal-browser.min.js'
};
const CENTROS = [['Walmart Peñón', 'Peñón'], ['Walmart Pudahuel', 'Pudahuel'], ['Walmart Lo Aguirre', 'Lo Aguirre'], ['Walmart La Farfana', 'La Farfana'], ['Líder La Reina', 'La Reina']];
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const corto = c => { const n = norm(c); const m = CENTROS.find(x => norm(x[0]) === n || norm(x[1]) === n || n.indexOf(norm(x[1])) >= 0); return m ? m[1] : String(c || '').replace(/^(Walmart|Líder|Lider)\s+/, ''); };
const limpia = s => String(s == null ? '' : s).replace(/&/g, ' y ').replace(/[?=]/g, '').replace(/\s+/g, ' ').trim();
const add = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const loadScript = src => new Promise((ok, ko) => { if ([...document.scripts].some(s => s.src === src)) return ok(); const s = document.createElement('script'); s.src = src; s.crossOrigin = 'anonymous'; s.onload = ok; s.onerror = () => ko(new Error('No cargó ' + src)); document.head.appendChild(s); });

let PCA = null;
async function token() {
  if (!window.msal) await loadScript(CFG.msal);
  if (!PCA) PCA = new msal.PublicClientApplication({ auth: { clientId: CFG.clientId, authority: 'https://login.microsoftonline.com/' + CFG.tenant, redirectUri: location.origin + location.pathname.replace(/[^/]*$/, '') + 'panel.html' }, cache: { cacheLocation: 'localStorage' } });
  const acc = PCA.getActiveAccount() || PCA.getAllAccounts()[0];
  if (!acc) throw new Error('SIN_SESION: no hay sesión Microsoft iniciada en la app');
  return (await PCA.acquireTokenSilent({ scopes: ['Sites.ReadWrite.All'], account: acc })).accessToken;
}
async function g(path, raw) {
  const r = await fetch(path.indexOf('http') === 0 ? path : 'https://graph.microsoft.com/v1.0' + path, { headers: { Authorization: 'Bearer ' + await token() } });
  if (raw) return r;
  const d = await r.json().catch(() => null); if (!r.ok) throw new Error((d && d.error && d.error.message) || ('Graph ' + r.status)); return d;
}
const enc = p => p.split('/').map(encodeURIComponent).join('/');
const ls = k => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return {}; } };

// ---------- Programa de actividades ----------
async function programa(desde, hasta) {
  let items = [], url = '/sites/' + CFG.site + '/lists/' + CFG.list + '/items?$expand=fields&$top=999';
  while (url) { const d = await g(url); items = items.concat(d.value || []); url = d['@odata.nextLink'] || null; }
  const relay = await fetch(CFG.endpoint + '?panel=1&key=' + encodeURIComponent(CFG.key) + '&t=' + Date.now()).then(r => r.json()).catch(() => ({}));
  const pv = {}; ((relay && relay.pending) || []).forEach(p => { if (p.estado === 'Realizada') pv[String(p.id)] = 1; });
  const mv = (relay && relay.moves) || {};
  return items.map(it => { const f = it.fields || {}; const m = mv[it.id]; const fe = (m && m.fecha) || String(f.FechaProgramada || '').slice(0, 10);
    return { id: String(it.id), c: corto(f.Centro), f: fe, t: limpia(f.Title), p: limpia(f.Programa), ok: f.Estado === 'Realizada' || !!pv[String(it.id)] ? 1 : 0, fr: String(f.FechaRealizada || '').slice(0, 10) }; })
    .filter(x => x.f && x.f >= desde && x.f <= hasta && x.c);
}

// ---------- Observaciones (caché de observaciones.html + correcciones) ----------
async function observaciones(desde, hasta) {
  const cache = ls('gpObsCache1'); let seg = {};
  try { const r = await g('/drives/' + CFG.rep + '/root:/' + enc(CFG.seg) + ':/content', true); if (r.ok) seg = await r.json() || {}; } catch (e) {}
  return Object.keys(cache).map(k => cache[k].d).filter(o => o && o.fecha && o.fecha >= desde && o.fecha <= hasta).map(o => {
    const s = seg[o.id] || {}, falta = o.resultado === 'Negativa' || (o.mejora && o.mejora.length) || (o.graves && o.graves.length) || (o.no_cumple && o.no_cumple.length) || !!o.tipo_falta || !!o.escalamiento;
    const det = [].concat(o.graves || [], o.mejora || [], (o.no_cumple || []).map(x => 'No cumple: ' + x)).join(' · ');
    return { id: o.id, f: o.fecha, h: o.hora || '', c: corto(o.centro), res: o.resultado || (falta ? 'Negativa' : 'Positiva'), per: limpia(o.persona), area: limpia(o.area), tipo: limpia(o.tipo_obs),
      txt: limpia(s.observacion_edit || [o.descripcion, det].filter(Boolean).join(' — ')), seguras: (o.seguras || []).length, fb: o.feedback || '', esc: limpia(s.escalamiento || o.escalamiento || ''),
      obsv: limpia(o.observador || o.reporter || ''), cierre: s.fecha_cierre || '', estSeg: s.estado || '' };
  }).sort((a, b) => (a.f + a.h).localeCompare(b.f + b.h));
}

// ---------- Hallazgos (Apps Script) ----------
async function hallazgos(hoy) {
  const d = await fetch(CFG.endpoint + '?hz=1&key=' + encodeURIComponent(CFG.key) + '&t=' + Date.now(), { cache: 'no-store' }).then(r => r.json());
  return (d.items || []).map(h => ({ id: String(h.id), f: String(h.fecha || '').slice(0, 10), c: corto(h.centro), crit: limpia(h.criticidad), tipo: limpia(h.tipo), area: limpia(h.area), lugar: limpia(h.lugar),
    txt: limpia(h.descripcion), acc: limpia(h.accion), lim: String(h.limite || '').slice(0, 10), est: limpia(h.estado || 'Abierto'), folder: h.folder ? 1 : 0 }));
}

// ---------- Report events y accidentes del día (caché de eventos.html) ----------
function eventos(desde, hasta) {
  const cache = ls('gpEvCache2');
  return Object.keys(cache).map(k => cache[k].d).filter(e => e && e.fecha >= desde && e.fecha <= hasta)
    .map(e => ({ f: e.fecha, h: e.hora || '', c: corto(e.centro), tipo: e.tipo, fam: e.fam, txt: limpia(e.desc).slice(0, 220), lesion: e.lesion ? 1 : 0, code: e.code }));
}

// ---------- Días sin accidentes (macro de accidentes) ----------
const GRUPOS = [['Peñón', /^walmart pe.on$/], ['Lo Aguirre', /lo aguirre/], ['Local 95', /local 95/], ['ECMM PS', /ecmm ps/], ['ECMM SB·Pñ', /ecmm (sb|pn|pñ)/]];
async function accidentes(hoy) {
  await loadScript(CFG.xlsx);
  const ch = await g('/drives/' + CFG.docs + '/root:' + enc(CFG.macro) + ':/children?$select=id,name,file,lastModifiedDateTime&$top=200');
  const files = (ch.value || []).filter(x => x.file && /\.xlsx$/i.test(x.name) && !/^~\$/.test(x.name) && !/respaldo|backup|copia|cambios carga|lista empleados/i.test(x.name));
  const toD = v => { if (v instanceof Date && !isNaN(v)) { const d = new Date(v.getTime() + 12 * 3600e3); return d.toISOString().slice(0, 10); } if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5) + 12 * 3600e3).toISOString().slice(0, 10);
    const s = String(v || '').trim(); let m; if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'); if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); return ''; };
  const num = v => typeof v === 'number' ? v : (parseFloat(String(v || '').replace(',', '.')) || 0);
  const rows = [], seen = {}; let mod = '';
  for (const f of files) {
    if (f.lastModifiedDateTime > mod) mod = f.lastModifiedDateTime;
    const r = await g('/drives/' + CFG.docs + '/items/' + f.id + '/content', true); if (!r.ok) continue;
    const wb = XLSX.read(await r.arrayBuffer(), { type: 'array', cellDates: true });
    wb.SheetNames.forEach(n => {
      const a = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
      const hi = a.findIndex(r => { const h = r.map(norm); return h.some(x => x.indexOf('rut') === 0) && h.some(x => x.indexOf('tipo accidente') === 0 || x.indexOf('tipo de accidente') === 0); });
      if (hi < 0) return; const H = a[hi].map(norm), ix = ps => H.findIndex(h => h && ps.some(p => h.indexOf(p) === 0));
      const I = { rs: ix(['razon social']), suc: ix(['sucursal']), rut: ix(['rut']), nom: ix(['nombre']), tipo: ix(['tipo accidente', 'tipo de accidente']), est: ix(['estado calif']), fe: ix(['dia, mes, ano', 'dia mes ano', 'fecha']), dias: ix(['dias licencia', 'dias perdidos']) };
      a.slice(hi + 1).forEach(r => { const v = k => I[k] >= 0 ? r[I[k]] : ''; const fe = toD(v('fe')); if (!fe) return; const key = norm(v('rut')).replace(/[^0-9k]/g, '') + '|' + fe + '|' + norm(v('tipo')); if (seen[key]) return; seen[key] = 1;
        rows.push({ rs: String(v('rs')).trim(), suc: String(v('suc')).trim().replace(/\s+/g, ' '), tipo: norm(v('tipo')), est: norm(v('est')), fe, dias: num(v('dias')) }); });
    });
  }
  const anio = hoy.slice(0, 4), corte = rows.reduce((m, r) => r.fe > m ? r.fe : m, '');
  const ok = rows.filter(r => /trabajo/.test(r.tipo) && !/trayecto/.test(r.tipo) && /^con cob/.test(r.est) && !/parcial/.test(r.est) && r.dias > 0);
  const rsK = r => /evolution/i.test(r.rs) ? 'Pro Evolution SpA' : /connection/i.test(r.rs) ? 'Pro Connection EST SpA' : null;
  const out = {};
  ['Pro Connection EST SpA', 'Pro Evolution SpA'].forEach(rs => { out[rs] = {}; GRUPOS.map(x => x[0]).concat('Ruta').forEach(gk => out[rs][gk] = { ult: '', suc: '', ny: 0, dy: 0 }); });
  ok.forEach(r => { const rs = rsK(r); if (!rs) return; const n = norm(r.suc); let gk = 'Ruta';
    if (/walmart|lider/.test(n)) { gk = (GRUPOS.find(x => x[1].test(n)) || [])[0]; if (!gk) return; }
    const x = out[rs][gk]; if (r.fe > x.ult) { x.ult = r.fe; x.suc = r.suc; } if (r.fe.slice(0, 4) === anio) { x.ny++; x.dy += r.dias; } });
  const total = { ny: 0, dy: 0 }; Object.values(out).forEach(o => Object.values(o).forEach(x => { total.ny += x.ny; total.dy += x.dy; }));
  return { corte, mod: mod.slice(0, 10), archivos: files.length, tabla: out, total };
}

// ---------- Foto de un hallazgo (para capturarla con una captura de pantalla) ----------
export async function foto(id) {
  const d = await fetch(CFG.endpoint + '?hz=1&key=' + encodeURIComponent(CFG.key) + '&t=' + Date.now(), { cache: 'no-store' }).then(r => r.json());
  const h = (d.items || []).find(x => String(x.id) === String(id)); if (!h || !h.folder) return 'SIN_CARPETA';
  const ls2 = await g('/drives/' + CFG.rep + '/root:/' + enc(String(h.folder).replace(/^\/+/, '')) + ':/children?$select=id,name,file&$top=200');
  const imgs = (ls2.value || []).filter(x => /\.(jpe?g|png|webp)$/i.test(x.name));
  let canvas = document.createElement('canvas');
  if (imgs.length) {
    const r = await g('/drives/' + CFG.rep + '/items/' + imgs[0].id + '/content', true); const bmp = await createImageBitmap(await r.blob());
    canvas.width = bmp.width; canvas.height = bmp.height; canvas.getContext('2d').drawImage(bmp, 0, 0);
  } else {
    const pdf = (ls2.value || []).find(x => /\.pdf$/i.test(x.name)); if (!pdf) return 'SIN_FOTO';
    await loadScript(CFG.pdfjs); pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.pdfjs.replace('pdf.min.js', 'pdf.worker.min.js');
    const buf = await (await g('/drives/' + CFG.rep + '/items/' + pdf.id + '/content', true)).arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise; let best = null;
    for (let p = 1; p <= doc.numPages; p++) { const page = await doc.getPage(p); const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) { const nm = ops.argsArray[i][0];
        const o = page.objs.has(nm) ? page.objs.get(nm) : (page.commonObjs.has(nm) ? page.commonObjs.get(nm) : null);
        if (o && o.width * o.height > 40000 && (!best || o.width * o.height > best.width * best.height)) best = o; } }
    if (!best) return 'SIN_FOTO';
    canvas.width = best.width; canvas.height = best.height; const ctx = canvas.getContext('2d');
    if (best.bitmap) ctx.drawImage(best.bitmap, 0, 0);
    else { const id2 = ctx.createImageData(best.width, best.height); const src = best.data, n = best.width * best.height; if (src.length === n * 4) id2.data.set(src); else for (let i = 0; i < n; i++) { id2.data[i * 4] = src[i * 3]; id2.data[i * 4 + 1] = src[i * 3 + 1]; id2.data[i * 4 + 2] = src[i * 3 + 2]; id2.data[i * 4 + 3] = 255; } ctx.putImageData(id2, 0, 0); }
  }
  let ov = document.getElementById('gprdFoto'); if (!ov) { ov = document.createElement('div'); ov.id = 'gprdFoto'; document.body.appendChild(ov); }
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center';
  canvas.style.cssText = 'max-width:100vw;max-height:100vh;display:block'; ov.innerHTML = ''; ov.appendChild(canvas);
  const rc = canvas.getBoundingClientRect();
  return 'FOTO ' + Math.round(rc.left) + ',' + Math.round(rc.top) + ',' + Math.round(rc.right) + ',' + Math.round(rc.bottom) + ' px ' + canvas.width + 'x' + canvas.height;
}
export function cerrarFoto() { const o = document.getElementById('gprdFoto'); if (o) o.remove(); return 'ok'; }

// ---------- Todo junto ----------
export async function run(hoy) {
  hoy = hoy || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const dow = new Date(hoy + 'T12:00:00Z').getUTCDay() || 7;          // 1 = lunes
  const lunes = add(hoy, -(dow - 1)), lunAnt = add(lunes, -7), domAnt = add(lunes, -1), domingo = add(lunes, 6);
  const hasta = add(hoy, -1), desde = dow === 1 ? add(hoy, -3) : hasta; // día anterior (el lunes cubre viernes a domingo)
  const ini = lunAnt < desde ? lunAnt : desde;
  const warn = [];
  const safe = async (n, f) => { try { return await f(); } catch (e) { warn.push(n + ': ' + limpia(e.message)); return null; } };
  const [prog, obs, hz, acc] = await Promise.all([safe('programa', () => programa(ini, domingo)), safe('observaciones', () => observaciones(ini, hoy)), safe('hallazgos', () => hallazgos(hoy)), safe('accidentes', () => accidentes(hoy))]);
  const ev = eventos(ini, hoy);
  // Resumen del programa por centro (para que el JSON sea corto)
  const P = {}; const dd = f => f.slice(8, 10) + '/' + f.slice(5, 7);
  (prog || []).slice().sort((a, b) => a.f.localeCompare(b.f)).forEach(x => { const c = P[x.c] = P[x.c] || { dia: [0, 0], ant: [0, 0], act: [0, 0], late: [], diaPend: [] };
    if (x.f >= desde && x.f <= hasta) { c.dia[1]++; c.dia[0] += x.ok; if (!x.ok) c.diaPend.push(dd(x.f) + ' · ' + x.t); }
    if (x.f >= lunAnt && x.f <= domAnt) { c.ant[1]++; c.ant[0] += x.ok; if (!x.ok) c.late.push(dd(x.f) + ' · ' + x.t); }
    if (x.f >= lunes && x.f <= domingo) { c.act[1]++; c.act[0] += x.ok; } });
  if (!Object.keys(ls('gpObsCache1')).length) warn.push('observaciones: caché vacía, abre observaciones.html antes');
  if (!Object.keys(ls('gpEvCache2')).length) warn.push('eventos: caché vacía, abre eventos.html antes');
  const out = { hoy, desde, hasta, lunes, domingo, lunAnt, domAnt, generado: new Date().toISOString(), warn, prog: prog ? P : null, obs, hz, ev, acc };
  return JSON.stringify(out).replace(/[?=&]/g, '');
}
