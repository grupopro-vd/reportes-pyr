/* PRO EHS · Arma el «Reporte diario PYR» (PowerPoint interactivo) a partir del JSON del colector.
   Uso: node build.js datos.json carpeta_salida [carpeta_fotos] [ajustes.json]
   - carpeta_fotos: fotos de hallazgos con nombre <id del hallazgo>.jpg|.png (opcional)
   - ajustes.json: {"titulos":{"cumpl":"…","obs":"…","hz":"…","acc":"…"}} para reemplazar los titulares automáticos (opcional)
   Requiere pptxgenjs y sharp. Después: python3 anim.py <pptx> <pptx_tmp> && mv <pptx_tmp> <pptx> */
const fs = require('fs'), path = require('path');
const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const [, , DATA, OUT, FOTOS, AJ] = process.argv;
const D = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const AJU = AJ && fs.existsSync(AJ) ? JSON.parse(fs.readFileSync(AJ, 'utf8')) : {};
const THEME = { name: 'Grupo Pro PYR', headFontFace: 'Calibri', bodyFontFace: 'Calibri', colors: { dk1: '18181B', lt1: 'FFFFFF', dk2: '52525B', lt2: 'F4F4F5', accent1: 'BD0926', accent2: '16623F', accent3: 'B45309', accent4: 'B3261E', accent5: '71717A', accent6: 'E4E4E7', hlink: 'BD0926', folHlink: '7A0619' } };
const H = { red: 'BD0926', ink: '18181B', green: '16623F', lgreen: '4ADE80', sky: '7DD3FC', amber: 'B45309', yel: 'FBBF24', crit: 'B3261E', lred: 'F87171', grid: 'E4E4E7', muted: '71717A', gray: 'A1A1AA' };
const LOGO = [path.join(__dirname, '..', 'logo-transparente.png'), path.join(__dirname, 'logo_gp.png')].find(p => fs.existsSync(p));
function findTheme() {
  const roots = ['/root/.claude/skills', path.join(process.env.HOME || '/root', '.claude/skills')];
  const walk = (d, n) => { if (n > 6 || !fs.existsSync(d)) return null; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
    if (e.isFile() && e.name === 'apply_theme.js' && /pptx[\\/]scripts$/.test(d)) return p; if (e.isDirectory()) { const r = walk(p, n + 1); if (r) return r; } } return null; };
  for (const r of roots) { const f = walk(r, 0); if (f) return f; } return null;
}

// ---------- Fechas y textos ----------
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dt = s => new Date(s + 'T12:00:00Z');
const dow = s => dt(s).getUTCDay();
const largo = s => DIAS[dow(s)] + ' ' + dt(s).getUTCDate() + ' de ' + MESES[dt(s).getUTCMonth()];
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const ddmm = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '';
const ddmmaa = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
const dias = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);
const sn = s => { const d = dt(s), day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d - y0) / 864e5 + 1) / 7); };
const rango = (a, b) => a.slice(8, 10) + ' al ' + b.slice(8, 10) + ' ' + MESES[dt(b).getUTCMonth()].slice(0, 3);
const pct = (a, b) => b ? Math.round(a / b * 100) : null;
const corta = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).replace(/[\s,.;:—-]+\S*$/, '') + '…' : s; };
const frase = s => { s = String(s || '').trim().replace(/\s+/g, ' '); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
const plural = (n, a, b) => n === 1 ? a : b;

const HOY = D.hoy, DES = D.desde, HAS = D.hasta, LUN = D.lunes, DOM = D.domingo, LA = D.lunAnt, DA = D.domAnt;
const unDia = DES === HAS;
const DIA_LBL = unDia ? cap(largo(HAS)) : cap(largo(DES).replace(/ de \S+$/, '')) + ' al ' + largo(HAS);
const DIA_CORTO = unDia ? (dow(HOY) === 1 ? 'el ' + DIAS[dow(HAS)] : 'ayer') : 'entre el ' + DIAS[dow(DES)] + ' y el ' + DIAS[dow(HAS)];
const DIA_HDR = unDia ? DIAS[dow(HAS)] + ' ' + dt(HAS).getUTCDate() : DIAS[dow(DES)] + ' ' + dt(DES).getUTCDate() + ' al ' + DIAS[dow(HAS)] + ' ' + dt(HAS).getUTCDate();
const KICK = (DIAS[dow(HOY)] + ' ' + dt(HOY).getUTCDate() + ' ' + MESES[dt(HOY).getUTCMonth()].slice(0, 3)).toUpperCase();
const SNA = sn(LA), SNH = sn(LUN);
const CEN = ['Peñón', 'Pudahuel', 'Lo Aguirre', 'La Farfana', 'La Reina'];
const FULL = { 'Peñón': 'Walmart Peñón', 'Pudahuel': 'Walmart Pudahuel', 'Lo Aguirre': 'Walmart Lo Aguirre', 'La Farfana': 'Walmart La Farfana', 'La Reina': 'Líder La Reina' };
const ABR = { 'Peñón': 'Peñ.', 'Pudahuel': 'Pud.', 'Lo Aguirre': 'L.Ag.', 'La Farfana': 'Farf.', 'La Reina': 'Reina' };
const enR = (f, a, b) => f && f >= a && f <= b;
const TIT = Object.assign({}, AJU.titulos || {});
const WARN = (D.warn || []).slice();

// ---------- Cálculos ----------
const P = D.prog || {};
const pg = c => P[c] || { dia: [0, 0], ant: [0, 0], act: [0, 0], late: [], diaPend: [] };
const sum = (k, i) => CEN.reduce((s, c) => s + pg(c)[k][i], 0);
const dia = { ok: sum('dia', 0), n: sum('dia', 1) }, ant = { ok: sum('ant', 0), n: sum('ant', 1) }, act = { ok: sum('act', 0), n: sum('act', 1) };
const OBS = D.obs || [], HZ = D.hz || [], EV = D.ev || [];
const obsA = OBS.filter(o => enR(o.f, LA, DA)), obsD = OBS.filter(o => enR(o.f, DES, HAS));
const hzA = HZ.filter(h => enR(h.f, LA, DA)), hzD = HZ.filter(h => enR(h.f, DES, HAS));
const abierto = h => !/cerrad/i.test(h.est), vencido = h => abierto(h) && h.lim && h.lim < HOY;
const hAb = hzA.filter(abierto), hVe = hzA.filter(vencido), hCe = hzA.filter(h => !abierto(h));
const accD = EV.filter(e => enR(e.f, DES, HAS) && /accidente/i.test(e.tipo)), reD = EV.filter(e => enR(e.f, DES, HAS) && /almacenamiento/i.test(e.fam || ''));

(async () => {
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE'; pres.theme = { headFontFace: 'Calibri', bodyFontFace: 'Calibri' };
pres.title = 'Reporte diario PYR · ' + largo(HOY) + ' de ' + HOY.slice(0, 4); pres.author = 'Prevención de Riesgos Grupo Pro';
const C = pres.SchemeColor;
let STEP = 0, CNT = 0; const tag = () => (STEP ? 'A' + STEP + '_' : 'Z_') + (CNT++);
const _add = pres.addSlide.bind(pres); pres.addSlide = function (o) { STEP = 0; const sl = _add(o); ['addText', 'addShape', 'addImage', 'addChart', 'addTable'].forEach(m => { const f = sl[m].bind(sl); sl[m] = function () { const a = [].slice.call(arguments); const i = m === 'addChart' ? 2 : (m === 'addImage' ? 0 : 1); a[i] = Object.assign({}, a[i] || {}, { objectName: tag() }); return f.apply(null, a); }; }); return sl; };
const APP = 'https://grupopro-vd.github.io/reportes-pyr/';
const SL = { acc: 1, cumpl: 2, obs: 3, hz: 4, c: {} }; CEN.forEach((c, i) => SL.c[c] = 5 + i);
const T = (s, txt, o) => s.addText(txt, Object.assign({ isTextBox: true, margin: 0 }, o));
const chip = (s, txt, x, y, w, link, dark) => { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.3, rectRadius: 0.15, fill: { color: dark ? H.ink : 'FFFFFF' }, line: { color: dark ? H.ink : 'D4D4D8', width: 0.75 } });
  T(s, [{ text: txt, options: { hyperlink: link, color: dark ? 'FFFFFF' : '18181B' } }], { x, y, w, h: 0.3, fontSize: 10, bold: true, align: 'center', valign: 'middle' }); };
const navCentros = s => { const st = STEP; STEP = 0; T(s, 'Detalle:', { x: 6.95, y: 0.27, w: 0.75, h: 0.3, fontSize: 10, bold: true, color: '71717A', valign: 'middle' });
  CEN.forEach((c, i) => chip(s, c, 7.7 + i * 1.03, 0.27, 0.98, { slide: SL.c[c], tooltip: 'Ver detalle de ' + c })); STEP = st; };
const live = (s, x, y, url, txt) => { const st = STEP; T(s, [{ text: (txt || 'Abrir en la app') + ' ↗', options: { hyperlink: { url, tooltip: 'Abre la app con datos en vivo' }, color: H.red } }], { x, y, w: 1.9, h: 0.3, fontSize: 10.5, bold: true, align: 'right' }); STEP = st; };
const objs = [{ placeholder: { options: { name: 'kicker', type: 'body', x: 0.5, y: 0.3, w: 10, h: 0.32, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2 }, text: '' } },
  { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.6, w: 12.3, h: 0.65, fontSize: 28, bold: true, color: C.text1, valign: 'top', align: 'left' }, text: '' } }];
if (LOGO) objs.push({ image: { path: LOGO, x: 0.5, y: 7.04, w: 0.964, h: 0.34, altText: 'Logo Grupo Pro' } });
objs.push({ text: { text: 'Prevención de Riesgos · Reporte diario PYR', options: { x: LOGO ? 1.614 : 0.5, y: 7.08, w: 8, h: 0.28, fontSize: 10, color: C.text2 } } });
pres.defineSlideMaster({ title: 'CONTENIDO', background: { color: C.background2 }, objects: objs, slideNumber: { x: 12.3, y: 7.08, w: 0.5, h: 0.28, fontSize: 10, color: C.text2 } });
const card = (s, x, y, w, h, fill) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill || 'FFFFFF' }, line: { color: fill ? fill : H.grid, width: 0.75 } });
const font = '+mn-lt';
const donut = (s, x, y, w, h, labels, values, colors, o) => { o = o || {}; const L = [], V = [], K = []; values.forEach((v, i) => { if (v > 0) { L.push(labels[i]); V.push(v); K.push(colors[i]); } });
  if (!V.length) { T(s, 'Sin datos', { x, y: y + h / 2 - 0.2, w, h: 0.4, fontSize: 13, color: H.gray, align: 'center' }); return; }
  s.addChart(pres.charts.DOUGHNUT, [{ name: '', labels: L, values: V }], { x, y, w, h, holeSize: 62, chartColors: K, showPercent: false, showValue: true, dataLabelColor: 'FFFFFF', dataLabelFontSize: 12, dataLabelFontBold: true, dataLabelFontFace: font, showLegend: true, legendPos: o.legendPos || 'b', legendFontSize: o.legendFontSize || 11, legendFontFace: font, legendColor: '3F3F46', showTitle: false, dataBorder: { pt: 2, color: 'FFFFFF' } }); };
const bars = (s, x, y, w, h, labels, series, colors, o) => { if (!labels.length) { T(s, 'Sin datos por centro', { x, y: y + h / 2 - 0.2, w, h: 0.4, fontSize: 12, color: H.gray, align: 'center' }); return; }
  s.addChart(pres.charts.BAR, series.map(z => ({ name: z[0], labels, values: z[1] })), Object.assign({ x, y, w, h, barDir: 'col', barGrouping: o && o.stack ? 'stacked' : 'clustered', chartColors: colors, showValue: true, dataLabelPosition: o && o.stack ? 'ctr' : 'outEnd', dataLabelFontSize: 10, dataLabelFontFace: font, dataLabelColor: o && o.stack ? 'FFFFFF' : '18181B', dataLabelFormatCode: '0;;;', catAxisLabelFontSize: 11, catAxisLabelFontFace: font, catAxisLabelColor: '52525B', valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: true, legendPos: 't', legendFontSize: 10.5, legendFontFace: font, legendColor: '3F3F46', barGapWidthPct: 55, showTitle: false }, (o && o.opt) || {})); };
const sello = 'Datos de la app al ' + ddmm(HOY) + ' ' + new Date(D.generado || Date.now()).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }) + '.';

// ================= 1 · Días sin accidentes (primera lámina) =================
pres.addSection({ title: 'Días sin accidentes' });
let s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Días sin accidentes' });
const A = D.acc || { tabla: {} }, COLS = ['Peñón', 'Lo Aguirre', 'Local 95', 'ECMM PS', 'ECMM SB·Pñ', 'Ruta'];
const emp = Object.keys(A.tabla || {}).map(rs => [rs, COLS.map(k => { const x = A.tabla[rs][k]; return x && x.ult ? (!x.ny && x.ult < HOY.slice(0, 4) + '-01-01' ? 'sin' : dias(x.ult, HOY)) : null; }), COLS.map(k => (A.tabla[rs][k] || {}).ny || 0), COLS.map(k => Math.round((A.tabla[rs][k] || {}).dy || 0)), COLS.map(k => (A.tabla[rs][k] || {}).suc || '')]);
let min = null, ruta = null;
emp.forEach(e => e[1].forEach((n, i) => { if (typeof n !== 'number') return; const lab = COLS[i] + (emp.filter(z => z[1][i] != null).length > 1 ? ' (' + e[0].replace(/ (EST )?SpA$/, '').replace(/^Pro /, 'Pro ') + ')' : '');
  if (COLS[i] === 'Ruta') { if (!ruta || n < ruta.n) ruta = { n, suc: e[4][i] }; } else if (!min || n < min.n) min = { n, c: COLS[i], lab }; }));
s.addText('DÍAS SIN ACCIDENTES · TRABAJO CTP CON COBERTURA · ' + HOY.slice(0, 4), { placeholder: 'kicker' });
const cAcc = [...new Set(accD.map(e => e.c))];
s.addText(TIT.acc || (accD.length ? accD.length + plural(accD.length, ' accidente ', ' accidentes ') + DIA_CORTO + ' (' + cAcc.join(', ') + ')' : 'Sin accidentes ' + DIA_CORTO) + (min ? '; ' + min.c + ' sigue con menos días sin accidentes' : ''), { placeholder: 'title' }); navCentros(s);
STEP = 1;
const ka = [[String(accD.length), plural(accD.length, 'accidente', 'accidentes'), accD.length ? cAcc.join(', ') : DIA_LBL.toLowerCase(), accD.length ? H.crit : H.green],
  [String(reD.length), 'report events', 'volcamiento / caída de pallet', reD.length ? H.crit : H.green],
  [min ? String(min.n) : '—', 'días sin accidentes', min ? 'menor: ' + min.c + (ruta ? ' · Ruta ' + ruta.n + (ruta.suc ? ' (' + ruta.suc + ')' : '') : '') : 'sin datos del macro', min && min.n >= 30 ? H.green : min && min.n >= 7 ? H.amber : H.crit],
  [String(hzA.length), 'Hallazgos SN ' + SNA, (hzA.length ? Math.round(hCe.length / hzA.length * 100) + '% cerrado · ' : '') + hAb.length + plural(hAb.length, ' pendiente', ' pendientes') + ' →', hAb.length ? H.crit : H.green]];
ka.forEach((v, i) => { const x = 0.5 + i * 3.12; const L = i === 3 ? { hyperlink: { slide: SL.hz, tooltip: 'Ir a Hallazgos' } } : {}; const R = (t, c) => [{ text: t, options: Object.assign({ color: c }, L) }]; card(s, x, 1.4, 2.92, 1.7); T(s, R(v[0], v[3]), { x: x + 0.25, y: 1.5, w: 2.5, h: 0.75, fontSize: 40, bold: true }); T(s, R(v[1], '18181B'), { x: x + 0.25, y: 2.25, w: 2.6, h: 0.35, fontSize: 14, bold: true }); T(s, R(corta(v[2], 44), '52525B'), { x: x + 0.25, y: 2.6, w: 2.6, h: 0.35, fontSize: 11 }); });
STEP = 2;
if (emp.length) {
  const dcol = n => n === null ? H.muted : n === 'sin' ? H.green : n >= 30 ? H.green : n >= 7 ? H.amber : H.crit;
  const tb = [['Razón social'].concat(COLS).map(t => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: '18181B' } } }))];
  emp.forEach(e => { tb.push([{ text: e[0], options: { bold: true, rowspan: 3, valign: 'middle', align: 'left' } }].concat(e[1].map(n => ({ text: n === null ? '—' : n === 'sin' ? '0' : String(n), options: { bold: true, fontSize: 20, color: dcol(n) } }))));
    tb.push(e[2].map(n => ({ text: n + ' acc.', options: { color: '18181B' } }))); tb.push(e[3].map(n => ({ text: n + ' días perd.', options: { color: '52525B' } }))); });
  const rh = [0.42]; emp.forEach(() => rh.push(0.52, 0.33, 0.33));
  s.addTable(tb, { x: 0.5, y: 3.3, w: 12.3, colW: [2.55, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625], fontSize: 12.5, fontFace: 'Calibri', border: { type: 'solid', pt: 0.5, color: 'E4E4E7' }, fill: { color: 'FFFFFF' }, rowH: rh, align: 'center', valign: 'middle' });
} else { T(s, 'No se pudo leer el macro de accidentes.', { x: 0.5, y: 3.4, w: 12.3, h: 0.4, fontSize: 14, color: H.crit }); WARN.push('sin tabla de accidentes'); }
STEP = 0;
const NOTA_ACC = 'Fila grande: días sin accidentes al ' + ddmm(HOY) + ' · luego accidentes y días perdidos ' + HOY.slice(0, 4) + '. Ruta = sucursales que no son Walmart ni Líder. Fuente: macro de accidentes' + (A.mod ? ' (actualizado ' + ddmmaa(A.mod) + (A.corte ? ', datos hasta ' + ddmmaa(A.corte) : '') + ')' : '') + '. Accidentes y report events del día: reportes flash de la app.';
s.addNotes(NOTA_ACC + ' Accidentes del trabajo con tiempo perdido y estado «Con cobertura». Días contados al ' + largo(HOY) + '.' + (min ? ' Menor: ' + min.lab + ' (' + min.n + ' días).' : '') + (ruta ? ' Ruta: ' + ruta.n + ' días (' + ruta.suc + ').' : '') + (accD.length ? ' Accidentes del día anterior: ' + accD.map(e => e.c + ' · ' + corta(e.txt, 80)).join(' | ') : ''));

// ================= 2 · Cumplimiento =================
pres.addSection({ title: 'Cumplimiento' });
s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Cumplimiento' });
const pD = pct(dia.ok, dia.n), pA = pct(ant.ok, ant.n), pH = pct(act.ok, act.n);
s.addText(KICK + ' · CUMPLIMIENTO DEL PROGRAMA', { placeholder: 'kicker' });
s.addText(TIT.cumpl || ((dia.n ? cap(DIA_CORTO) + ' se cumplió el ' + pD + '%' : 'Sin actividades programadas ' + DIA_CORTO) + (ant.n ? '; la semana pasada cerró en ' + pA + '%' : '')), { placeholder: 'title' }); navCentros(s);
STEP = 1; card(s, 0.5, 1.4, 12.3, 1.95, H.ink);
T(s, DIA_LBL, { x: 0.8, y: 1.52, w: 8, h: 0.3, fontSize: 12, bold: true, color: H.gray });
const late = dia.n - dia.ok;
const kd = [['Avance día', pD == null ? '—' : pD + '%', dia.ok + ' de ' + dia.n + ' realizadas', H.lgreen], ['Programadas', String(dia.n), dia.n ? '100% actividades' : 'sin actividades', H.sky], ['Realizadas', String(dia.ok), (pD == null ? 0 : pD) + '% cerradas', H.lgreen], ['Por hacer', '0', '0% pendientes', H.yel], ['Atrasadas', String(late), (dia.n ? pct(late, dia.n) : 0) + '% fuera de plazo', H.lred]];
kd.forEach((v, i) => { const x = 0.8 + i * 2.42; if (i) s.addShape(pres.shapes.LINE, { x: x - 0.18, y: 1.95, w: 0, h: 1.2, line: { color: '3F3F46', width: 0.75 } });
  T(s, v[0], { x, y: 1.88, w: 2.2, h: 0.3, fontSize: 13, color: H.gray }); T(s, v[1], { x, y: 2.18, w: 2.2, h: 0.7, fontSize: 40, bold: true, color: 'FFFFFF' }); T(s, v[2], { x, y: 2.9, w: 2.25, h: 0.3, fontSize: 12, bold: true, color: v[3] }); });
STEP = 2; card(s, 0.5, 3.55, 6.05, 3.4);
T(s, 'Semana anterior · SN ' + SNA + ' (' + rango(LA, DA) + ')', { x: 0.75, y: 3.68, w: 5.6, h: 0.32, fontSize: 14, bold: true, color: C.text1 });
T(s, [{ text: String(ant.ok), options: { fontSize: 30, bold: true, color: H.green, breakLine: true } }, { text: 'realizadas de ' + ant.n, options: { fontSize: 11, color: '52525B', breakLine: true } }, { text: String(ant.n - ant.ok), options: { fontSize: 30, bold: true, color: ant.n - ant.ok ? H.crit : H.green, breakLine: true } }, { text: 'fuera de plazo', options: { fontSize: 11, color: '52525B' } }], { x: 0.75, y: 4.15, w: 1.5, h: 2.2, valign: 'top' });
donut(s, 2.05, 4.0, 1.95, 2.85, ['Realizadas', 'Fuera de plazo'], [ant.ok, ant.n - ant.ok], [H.green, H.crit]);
if (ant.n) T(s, pA + '%', { x: 2.05, y: 4.95, w: 1.95, h: 0.4, fontSize: 16, bold: true, color: C.text1, align: 'center' });
const cA = CEN.filter(c => pg(c).ant[1]);
bars(s, 4.0, 4.0, 2.45, 2.85, cA.map(c => ABR[c]), [['Realizadas', cA.map(c => pg(c).ant[0])], ['Fuera de plazo', cA.map(c => pg(c).ant[1] - pg(c).ant[0])]], [H.green, H.crit], { stack: true, opt: { catAxisLabelFontSize: 9, legendFontSize: 9 } });
STEP = 3; card(s, 6.75, 3.55, 6.05, 3.4); live(s, 10.65, 3.68, APP, 'Ver avance en la app');
T(s, 'Meta de la semana · SN ' + SNH + ' (' + rango(LUN, DOM) + ')', { x: 7.0, y: 3.68, w: 4.0, h: 0.32, fontSize: 14, bold: true, color: C.text1 });
const hechas = dow(HOY) === 1 ? 'realizadas (la semana parte hoy)' : dow(HOY) === 2 ? 'hechas el lunes (' + (pH || 0) + '%)' : 'realizadas a la fecha (' + (pH || 0) + '%)';
T(s, [{ text: String(act.n), options: { fontSize: 30, bold: true, color: C.text1, breakLine: true } }, { text: 'actividades programadas', options: { fontSize: 11, color: '52525B', breakLine: true } }, { text: String(act.ok), options: { fontSize: 30, bold: true, color: H.green, breakLine: true } }, { text: hechas, options: { fontSize: 11, color: '52525B' } }], { x: 7.0, y: 4.15, w: 1.6, h: 2.2, valign: 'top' });
const cH = CEN.filter(c => pg(c).act[1]);
bars(s, 8.6, 4.0, 4.1, 2.85, cH, [['Programadas', cH.map(c => pg(c).act[1])], ['Realizadas', cH.map(c => pg(c).act[0])]], ['A1A1AA', H.green], { opt: { catAxisLabelFontSize: 10 } });
s.addNotes('Fuente: programa de actividades de la app (lista ProgramaActividades). ' + sello + ' Fuera de plazo = actividades de la SN ' + SNA + ' que quedaron sin realizar.' + (CEN.filter(c => !pg(c).dia[1]).length ? ' Sin actividades el día anterior: ' + CEN.filter(c => !pg(c).dia[1]).join(', ') + '.' : ''));

// ================= 3 · Observaciones =================
pres.addSection({ title: 'Observaciones' });
s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Observaciones' });
const oPos = obsA.filter(o => o.res !== 'Negativa'), oNeg = obsA.filter(o => o.res === 'Negativa');
s.addText('OBSERVACIONES CONDUCTUALES · ' + (D.obsR && D.obsR.k ? 'ÚLTIMAS 4 SEMANAS' : KICK), { placeholder: 'kicker' });
const OR_ = D.obsR && D.obsR.k && D.obsR.k.length >= 8 ? D.obsR : null;
const orPP_ = OR_ && OR_.sem ? ((OR_.sem.d.filter(d => d[0] === '% positivas')[0] || [0, []])[1]) : [];
s.addText(TIT.obs || (OR_ ? parseInt(OR_.k[1][1].split('·')[1], 10) + '% positivas en las últimas 4 semanas' + (orPP_.length >= 2 && orPP_[orPP_.length - 1] != null && orPP_[orPP_.length - 2] != null && orPP_[orPP_.length - 1] !== orPP_[orPP_.length - 2] ? '; esta semana ' + (orPP_[orPP_.length - 1] < orPP_[orPP_.length - 2] ? 'bajó' : 'subió') + ' a ' + orPP_[orPP_.length - 1] + '%' : '') : obsA.length ? pct(oPos.length, obsA.length) + '% de las observaciones de la semana pasada fueron positivas' : 'Sin observaciones de conducta registradas la semana pasada'), { placeholder: 'title' }); navCentros(s);
if (OR_) { // Resumen ejecutivo tal como lo muestra la página de Observaciones (últimas 4 semanas, todos los centros)
  const R = OR_, W = 2.95, G = 0.16, num = t => String(t || '').replace(/\s+%/, '%');
  const COL = [null, H.green, H.crit, '1D4ED8', '0F766E', H.crit, H.amber, C.text1];
  const kp = (i, row, b, l, col, dark) => { const x = 0.5 + i * (W + G), y = row ? 2.45 : 1.4; card(s, x, y, W, 0.92, dark ? '18181B' : null);
    T(s, num(b), { x: x + 0.2, y: y + 0.08, w: W - 0.3, h: 0.5, fontSize: 26, bold: true, color: dark ? 'FFFFFF' : col });
    T(s, l, { x: x + 0.2, y: y + 0.58, w: W - 0.3, h: 0.28, fontSize: 11.5, bold: true, color: dark ? 'D4D4D8' : '52525B' }); };
  STEP = 1; R.k.slice(0, 8).forEach((x, i) => { let col = COL[i]; if (i === 6) { const v = parseInt(x[0], 10); col = isNaN(v) ? H.gray : v >= 90 ? H.green : H.amber; } kp(i % 4, i >= 4 ? 1 : 0, x[0], x[1], col, i === 0); });
  if (R.k.length >= 12) { STEP = 2;
    T(s, (R.tn || 'Tendencia').replace('últimas 1 semanas vs las 1 anteriores', 'última semana vs la anterior'), { x: 0.5, y: 3.47, w: 8, h: 0.28, fontSize: 12, bold: true, color: '3F3F46' });
    R.k.slice(8, 12).forEach((x, i) => { const xx = 0.5 + i * (W + G), y = 3.8, a = x[0].trim().charAt(0); card(s, xx, y, W, 0.8);
      T(s, num(x[0]), { x: xx + 0.2, y: y + 0.08, w: W - 0.3, h: 0.42, fontSize: 22, bold: true, color: a === '↑' ? H.green : a === '↓' ? H.crit : '52525B' });
      T(s, num(x[1]).replace(/ %/g, '%'), { x: xx + 0.2, y: y + 0.5, w: W - 0.3, h: 0.26, fontSize: 10.5, color: '52525B' }); }); }
  STEP = 3; card(s, 0.5, 4.75, 7.6, 2.2); live(s, 6.5, 4.85, APP + 'observaciones.html', 'Ver en la app');
  T(s, 'Observaciones por semana · positivas vs negativas', { x: 0.7, y: 4.85, w: 6, h: 0.3, fontSize: 13, bold: true, color: C.text1 });
  if (R.sem) { const ser = n => (R.sem.d.filter(d => d[0] === n)[0] || [n, []])[1], pp = ser('% positivas');
    bars(s, 0.6, 5.15, 7.4, 1.75, R.sem.l.map((l, i) => 'SN ' + parseInt(String(l).slice(1), 10) + (pp[i] != null ? ' · ' + pp[i] + '% positivas' : '')), [['Positivas', ser('Positivas')], ['Negativas', ser('Negativas')]], [H.green, H.crit], { stack: true, opt: { catAxisLabelFontSize: 10, legendFontSize: 9 } }); }
  card(s, 8.26, 4.75, 4.57, 2.2);
  T(s, 'Por tipo de observación', { x: 8.46, y: 4.85, w: 4, h: 0.3, fontSize: 13, bold: true, color: C.text1 });
  if (R.tipo && R.tipo.d[0]) { const v = R.tipo.d[0][1], ix = R.tipo.l.map((l, i) => i).sort((a, b) => v[b] - v[a]), TC = ['18181B', '0F766E', 'B3261E', 'B45309', '1D4ED8', '7E22CE', '71717A'];
    donut(s, 8.3, 5.15, 4.5, 1.78, ix.map(i => R.tipo.l[i]), ix.map(i => v[i]), TC, { legendPos: 'r', legendFontSize: 10 }); }
  STEP = 0;
} else {
STEP = 1; card(s, 0.5, 1.4, 5.4, 5.55);
T(s, 'Semana anterior · SN ' + SNA, { x: 0.75, y: 1.55, w: 5, h: 0.32, fontSize: 14, bold: true, color: C.text1 });
[[obsA.length, 'observaciones', C.text1], [oPos.length, 'positivas', H.green], [oNeg.length, 'negativas', oNeg.length ? H.crit : H.green]].forEach((v, i) => { const x = 0.75 + i * 1.7; T(s, String(v[0]), { x, y: 1.95, w: 1.6, h: 0.6, fontSize: 34, bold: true, color: v[2] }); T(s, v[1], { x, y: 2.55, w: 1.6, h: 0.28, fontSize: 12, bold: true, color: C.text1 }); });
const negM = oNeg.filter(o => o.esc).length, posSF = oPos.filter(o => o.fb !== 'Sí').length, sub = [];
if (oNeg.length) sub.push(negM === oNeg.length ? (oNeg.length === 1 ? 'La negativa con ' : 'Las ' + oNeg.length + ' negativas con ') + 'proceso de mejora' : negM + ' de ' + oNeg.length + ' negativas con proceso de mejora');
if (posSF) sub.push(posSF + plural(posSF, ' positiva sin feedback', ' positivas sin feedback'));
T(s, sub.join(' · '), { x: 0.75, y: 2.85, w: 5, h: 0.28, fontSize: 10.5, color: '52525B' });
donut(s, 0.6, 3.15, 2.4, 3.7, ['Positivas', 'Negativas'], [oPos.length, oNeg.length], [H.green, H.crit]);
const cO = CEN.filter(c => obsA.some(o => o.c === c));
bars(s, 3.0, 3.15, 2.8, 3.7, cO.length > 3 ? cO.map(c => ABR[c]) : cO, [['Positivas', cO.map(c => oPos.filter(o => o.c === c).length)], ['Negativas', cO.map(c => oNeg.filter(o => o.c === c).length)]], [H.green, H.crit], { stack: true, opt: { catAxisLabelFontSize: 10, legendFontSize: 9 } });
STEP = 2; card(s, 6.1, 1.4, 6.7, 5.55); live(s, 10.7, 1.55, APP + 'observaciones.html', 'Ver en la app');
T(s, 'Día anterior · ' + DIA_HDR + ' · ' + obsD.length + plural(obsD.length, ' observación', ' observaciones'), { x: 6.35, y: 1.55, w: 4.3, h: 0.32, fontSize: 14, bold: true, color: C.text1 });
const obSel = obsD.slice().sort((a, b) => (b.res === 'Negativa') - (a.res === 'Negativa')).slice(0, 2);
if (!obsD.length) T(s, 'No se registraron observaciones de conducta el día anterior.', { x: 6.35, y: 2.1, w: 6.2, h: 0.4, fontSize: 13, color: '52525B' });
obSel.forEach((o, i) => { STEP = 2 + i; const y = 2.05 + i * 2.4, neg = o.res === 'Negativa', cc = neg ? H.crit : H.green;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.35, y, w: 6.2, h: 2.2, rectRadius: 0.1, fill: { color: 'FAFAFA' }, line: { color: H.grid, width: 0.75 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 6.35, y, w: 0.09, h: 2.2, fill: { color: cc }, line: { color: cc } });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.65, y: y + 0.2, w: 1.15, h: 0.32, rectRadius: 0.08, fill: { color: cc }, line: { color: cc } });
  T(s, (neg ? 'Negativa' : 'Positiva').toUpperCase(), { x: 6.65, y: y + 0.2, w: 1.15, h: 0.32, fontSize: 10.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
  T(s, o.per || 'Sin nombre', { x: 7.95, y: y + 0.17, w: 4.4, h: 0.38, fontSize: 16, bold: true, color: C.text1, valign: 'middle' });
  T(s, [o.c, o.area, o.tipo].filter(Boolean).join(' · ') + (unDia ? '' : ' · ' + ddmm(o.f)), { x: 6.65, y: y + 0.65, w: 5.7, h: 0.3, fontSize: 11.5, color: '52525B' });
  let det = frase(o.txt) || 'Conducta observada: ' + (o.tipo || 'general');
  if (!neg && o.seguras) det = det.replace(/\.?$/, '') + ', cumpliendo ' + o.seguras + plural(o.seguras, ' conducta segura.', ' conductas seguras.');
  T(s, corta(det, 175), { x: 6.65, y: y + 0.98, w: 5.7, h: 0.7, fontSize: 13, color: C.text1, valign: 'top' });
  const ges = neg ? [o.fb === 'Sí' ? 'Feedback entregado en el momento' : 'Sin feedback', o.esc] : [o.fb === 'Sí' ? 'Reconocimiento entregado' : 'Sin feedback'];
  if (o.obsv) ges.push('observó ' + o.obsv);
  T(s, ges.filter(Boolean).join(' · '), { x: 6.65, y: y + 1.72, w: 5.7, h: 0.3, fontSize: 11, italic: true, color: '52525B' }); });
if (obsD.length > 2) { STEP = 3; T(s, '+ ' + (obsD.length - 2) + plural(obsD.length - 2, ' observación más', ' observaciones más') + ' en la app (' + obsD.slice(2).map(o => o.per).filter(Boolean).slice(0, 4).join(', ') + ')', { x: 6.35, y: 6.6, w: 6.2, h: 0.28, fontSize: 10.5, color: '52525B' }); }
STEP = 0;
}
if (OR_) s.addNotes('Resumen ejecutivo de observaciones de conducta de las últimas 4 semanas, todos los centros: los mismos números de la página de Observaciones de la app. ' + sello);
else s.addNotes('Observaciones de conducta registradas en la app. Semana anterior: ' + rango(LA, DA) + '. Día anterior: ' + DIA_LBL + (obsD.length > 2 ? ' (se muestran 2 de ' + obsD.length + ', primero las negativas)' : '') + '. ' + sello);

// ================= 4 · Hallazgos =================
pres.addSection({ title: 'Hallazgos' });
s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Hallazgos' });
s.addText('HALLAZGOS · ' + KICK + ' · MES A LA FECHA', { placeholder: 'kicker' });
const hzM0 = D.hz.filter(h => String(h.f || '').slice(0, 7) === String(D.desde).slice(0, 7) && h.f <= D.hasta), hzM0c = hzM0.filter(h => !abierto(h)).length, hzM0v = hzM0.filter(vencido).length;
s.addText(TIT.hz || (!hzM0.length ? 'Sin hallazgos registrados este mes' : hzM0.length + ' hallazgos en el mes: ' + pct(hzM0c, hzM0.length) + '% cerrados' + (hzM0v ? ' y ' + hzM0v + plural(hzM0v, ' vencido', ' vencidos') : ', ninguno vencido')), { placeholder: 'title' }); navCentros(s);
// Resumen del mes (igual que «Hallazgos y eventos» en la app, período Mes): indicadores, estado y tipo
const hzM = D.hz.filter(h => String(h.f || '').slice(0, 7) === String(D.desde).slice(0, 7) && h.f <= D.hasta);
const mAb = hzM.filter(h => abierto(h) && !vencido(h)), mVe = hzM.filter(vencido), mCe = hzM.filter(h => !abierto(h)), mAl = hzM.filter(h => h.crit === 'Alta');
const MES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][+String(D.desde).slice(5, 7) - 1];
STEP = 1; const KW = (12.33 - 4 * 0.16) / 5;
[[hzM.length, 'hallazgos en ' + MES_, '', null, true], [mAb.length, 'abiertos o en proceso', pct(mAb.length, hzM.length) + '%', H.amber], [mVe.length, 'vencidos (pasó el plazo)', pct(mVe.length, hzM.length) + '%', H.crit],
 [mCe.length, 'cerrados', pct(mCe.length, hzM.length) + '%', H.green], [mAl.length, 'de criticidad alta', '', H.crit]].forEach((v, k) => { const x = 0.5 + k * (KW + 0.16), y = 1.4;
  card(s, x, y, KW, 0.95, v[4] ? '18181B' : null);
  T(s, String(v[0]), { x: x + 0.18, y: y + 0.07, w: KW - 0.3, h: 0.48, fontSize: 26, bold: true, color: v[4] ? 'FFFFFF' : v[3] });
  T(s, [{ text: v[1], options: { bold: true, color: v[4] ? 'D4D4D8' : '52525B' } }].concat(v[2] && hzM.length ? [{ text: '  ' + v[2], options: { bold: true, color: v[3] } }] : []), { x: x + 0.18, y: y + 0.57, w: KW - 0.25, h: 0.32, fontSize: 11 }); });
STEP = 2; card(s, 0.5, 2.5, 3.25, 4.45);
T(s, 'Estado', { x: 0.7, y: 2.62, w: 2.8, h: 0.3, fontSize: 13, bold: true, color: C.text1 });
const mEp = mAb.filter(h => /proceso/i.test(h.est)).length;
donut(s, 0.6, 2.95, 3.05, 3.9, ['Cerrado', 'En proceso', 'Vencido', 'Abierto'], [mCe.length, mEp, mVe.length, mAb.length - mEp], [H.green, '1D4ED8', H.crit, H.amber], { legendFontSize: 10 });
card(s, 3.9, 2.5, 3.2, 4.45);
T(s, 'Tipo de hallazgo', { x: 4.1, y: 2.62, w: 2.8, h: 0.3, fontSize: 13, bold: true, color: C.text1 });
const tpz = {}; hzM.forEach(h => { const t = h.tipo || 'Sin tipo'; tpz[t] = (tpz[t] || 0) + 1; });
const tpl = Object.keys(tpz).sort((a, b) => tpz[b] - tpz[a]).slice(0, 6);
bars(s, 4.0, 2.95, 3.0, 3.9, tpl.map(t => t.replace('Infraestructura / instalaciones', 'Infraestructura')).reverse(), [['Hallazgos', tpl.map(t => tpz[t]).reverse()]], ['18181B'], { opt: { barDir: 'bar', showLegend: false, catAxisLabelFontSize: 10, dataLabelPosition: 'outEnd' } });
STEP = 3; card(s, 7.25, 2.5, 5.58, 4.45); live(s, 11.2, 2.62, APP + 'eventos.html#v-hz', 'Ver en la app');
const cDz = [...new Set(hzD.map(h => h.c))];
T(s, 'Día anterior · ' + DIA_HDR + ' · ' + hzD.length + plural(hzD.length, ' hallazgo', ' hallazgos') + (cDz.length === 1 ? ' (' + cDz[0] + ')' : ''), { x: 7.45, y: 2.62, w: 4.0, h: 0.32, fontSize: 13, bold: true, color: C.text1 });
if (!hzD.length) T(s, 'No se registraron hallazgos el día anterior.', { x: 7.45, y: 3.1, w: 5.2, h: 0.4, fontSize: 13, color: '52525B' });
const CRC = { Alta: H.crit, Media: H.amber, Baja: H.green };
// Prioridad: criticidad (Alta, Media, Baja) y, a igual criticidad, primero los abiertos
const hzSel = hzD.slice().sort((a, b) => ['Alta', 'Media', 'Baja'].indexOf(a.crit) - ['Alta', 'Media', 'Baja'].indexOf(b.crit) || (abierto(b) ? 1 : 0) - (abierto(a) ? 1 : 0)).slice(0, 2);
for (let i = 0; i < hzSel.length; i++) { const h = hzSel[i]; STEP = 3 + i; const y = 3.02 + i * 1.83, ph = 1.68;
  let img = null; if (FOTOS) for (const ext of ['.jpg', '.jpeg', '.png']) { const p = path.join(FOTOS, h.id + ext); if (fs.existsSync(p)) { img = p; break; } }
  let pw = 1.3;
  if (img) { const m = await sharp(img).metadata(); pw = Math.min(1.9, ph * m.width / m.height); s.addImage({ path: img, x: 7.45, y, w: pw, h: ph, altText: h.txt }); }
  else { s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.45, y, w: pw, h: ph, rectRadius: 0.08, fill: { color: 'F4F4F5' }, line: { color: H.grid, width: 0.75 } }); T(s, 'Sin foto', { x: 7.45, y: y + ph / 2 - 0.15, w: pw, h: 0.3, fontSize: 11, color: H.gray, align: 'center' }); WARN.push('hallazgo ' + h.id + ' sin foto'); }
  const tx = 7.45 + pw + 0.2, cc = CRC[h.crit] || H.muted;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx, y: y + 0.05, w: 0.95, h: 0.3, rectRadius: 0.08, fill: { color: cc }, line: { color: cc } });
  T(s, (h.crit || '—').toUpperCase(), { x: tx, y: y + 0.05, w: 0.95, h: 0.3, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
  const est = !abierto(h) ? ['Cerrado', H.green] : vencido(h) ? ['Vencido', H.crit] : ['Abierto', H.amber];
  T(s, est[0], { x: tx + 1.05, y: y + 0.05, w: 1.2, h: 0.3, fontSize: 11, bold: true, color: est[1], valign: 'middle' });
  T(s, corta(frase(h.txt), 70), { x: tx, y: y + 0.42, w: 12.65 - tx, h: 0.5, fontSize: 13, bold: true, color: C.text1, valign: 'top' });
  T(s, [h.tipo, [h.area, h.lugar].filter(Boolean).join(', ')].filter(Boolean).join(' · ') + (unDia ? '' : ' · ' + ddmm(h.f)), { x: tx, y: y + 0.95, w: 12.65 - tx, h: 0.32, fontSize: 10.5, color: '52525B' });
  T(s, corta('Acción: ' + (h.acc || 'por definir') + (h.lim ? ' · plazo ' + ddmm(h.lim) : ''), 110), { x: tx, y: y + 1.27, w: 12.65 - tx, h: 0.5, fontSize: 10.5, color: C.text1, valign: 'top' }); }
if (hzD.length > 2) { STEP = 5; T(s, '+ ' + (hzD.length - 2) + plural(hzD.length - 2, ' hallazgo más', ' hallazgos más') + ' en la app', { x: 7.45, y: 6.62, w: 5.2, h: 0.28, fontSize: 10.5, color: '52525B' }); }
STEP = 0; s.addNotes('Hallazgos registrados en la app. Indicadores y gráficos: mes en curso hasta el día anterior, con el estado al ' + ddmm(HOY) + ' (vencido = pasó la fecha límite sin cerrar). Día anterior: ' + DIA_LBL + (hzD.length > 2 ? ' (se muestran 2 de ' + hzD.length + ', primero los de criticidad alta y los abiertos)' : '') + '. ' + sello);

// ================= Láminas ocultas · detalle por centro =================
STEP = 0;
pres.addSection({ title: 'Detalle por centro (oculto)' });
for (const c of CEN) { const d = pg(c); s = pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: 'Detalle por centro (oculto)' }); s.hidden = true;
  s.addText('DETALLE POR CENTRO · SEMANA ANTERIOR SN ' + SNA, { placeholder: 'kicker' });
  const p = pct(d.ant[0], d.ant[1]);
  s.addText(FULL[c] + (p == null ? ' · sin actividades la semana pasada' : ' · ' + p + '% de cumplimiento la semana pasada'), { placeholder: 'title' });
  chip(s, '← Cumplimiento', 6.1, 0.27, 1.6, { slide: SL.cumpl }, 1); chip(s, '← Observaciones', 7.78, 0.27, 1.6, { slide: SL.obs }, 1); chip(s, '← Hallazgos', 9.46, 0.27, 1.6, { slide: SL.hz }, 1); chip(s, '← Accidentes', 11.14, 0.27, 1.6, { slide: SL.acc }, 1);
  card(s, 0.5, 1.4, 4.0, 5.55); T(s, 'Cumplimiento', { x: 0.75, y: 1.55, w: 3.5, h: 0.32, fontSize: 14, bold: true, color: C.text1 });
  donut(s, 0.6, 1.95, 1.9, 2.35, ['Realizadas', 'Fuera de plazo'], [d.ant[0], d.ant[1] - d.ant[0]], [H.green, H.crit]);
  T(s, [{ text: d.ant[0] + ' de ' + d.ant[1], options: { fontSize: 22, bold: true, color: C.text1, breakLine: true } }, { text: 'realizadas SN ' + SNA, options: { fontSize: 11, color: '52525B', breakLine: true } }, { text: String(d.ant[1] - d.ant[0]), options: { fontSize: 22, bold: true, color: d.ant[1] - d.ant[0] ? H.crit : H.green, breakLine: true } }, { text: 'fuera de plazo', options: { fontSize: 11, color: '52525B', breakLine: true } }, { text: d.act[0] + ' de ' + d.act[1], options: { fontSize: 22, bold: true, color: C.text1, breakLine: true } }, { text: 'meta SN ' + SNH + ' a la fecha', options: { fontSize: 11, color: '52525B' } }], { x: 2.6, y: 2.0, w: 1.8, h: 2.6, valign: 'top' });
  T(s, 'Fuera de plazo', { x: 0.75, y: 4.65, w: 3.5, h: 0.3, fontSize: 12, bold: true, color: C.text1 });
  const lt = d.late.slice(0, 7).map(x => corta(x.replace('Hallazgo semanal: inspección de condiciones subestándar (registro y seguimiento)', 'Hallazgo semanal (inspección)').replace(' (tema a elegir)', ''), 48));
  if (d.late.length > 7) lt.push('y ' + (d.late.length - 7) + ' más');
  T(s, lt.length ? lt.map((x, i) => ({ text: x, options: { bullet: true, breakLine: i < lt.length - 1 } })) : (d.ant[1] ? 'Todo realizado ✔' : 'Sin actividades programadas'), { x: 0.75, y: 4.95, w: 3.6, h: 1.9, fontSize: 10.5, color: lt.length ? C.text1 : H.green, valign: 'top', paraSpaceAfter: 2 });
  const hzc = HZ.filter(h => h.c === c && abierto(h)).sort((a, b) => a.f.localeCompare(b.f));
  card(s, 4.7, 1.4, 4.6, 5.55); T(s, 'Hallazgos abiertos · ' + hzc.length, { x: 4.95, y: 1.55, w: 3.0, h: 0.32, fontSize: 14, bold: true, color: C.text1 }); live(s, 7.25, 1.55, APP + 'eventos.html#v-hz', 'Ver en la app');
  if (!hzc.length) T(s, 'Sin hallazgos abiertos.', { x: 4.95, y: 2.05, w: 4.1, h: 0.4, fontSize: 12, color: H.green });
  hzc.slice(0, 4).forEach((h, i) => { const y = 2.0 + i * 1.2, cc = CRC[h.crit] || H.muted, v = vencido(h);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 4.95, y, w: 4.1, h: 1.08, rectRadius: 0.08, fill: { color: 'FAFAFA' }, line: { color: H.grid, width: 0.75 } });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.1, y: y + 0.12, w: 0.75, h: 0.26, rectRadius: 0.06, fill: { color: cc }, line: { color: cc } }); T(s, (h.crit || '—').toUpperCase(), { x: 5.1, y: y + 0.12, w: 0.75, h: 0.26, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
    T(s, 'Reportado ' + ddmm(h.f) + ' · plazo ' + ddmm(h.lim) + (v ? ' · VENCIDO' : ''), { x: 5.95, y: y + 0.12, w: 3.0, h: 0.26, fontSize: 10, bold: v, color: v ? H.crit : '52525B', valign: 'middle' });
    T(s, corta(frase(h.txt), 90), { x: 5.1, y: y + 0.45, w: 3.85, h: 0.55, fontSize: 11.5, color: C.text1, valign: 'top' }); });
  if (hzc.length > 4) T(s, '+ ' + (hzc.length - 4) + ' más en la app', { x: 4.95, y: 6.75, w: 4.1, h: 0.2, fontSize: 10, color: '52525B' });
  const op = obsA.filter(o => o.c === c && o.res !== 'Negativa'), on = obsA.filter(o => o.c === c && o.res === 'Negativa');
  card(s, 9.5, 1.4, 3.3, 5.55); T(s, 'Observaciones SN ' + SNA, { x: 9.75, y: 1.55, w: 2.9, h: 0.32, fontSize: 14, bold: true, color: C.text1 });
  if (op.length + on.length) donut(s, 9.6, 1.95, 3.1, 2.6, ['Positivas', 'Negativas'], [op.length, on.length], [H.green, H.crit]);
  else T(s, '0', { x: 9.75, y: 2.2, w: 2.9, h: 1.0, fontSize: 54, bold: true, color: 'A1A1AA' });
  const nm = a => a.map(o => o.per).filter(Boolean), lista = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a.join('');
  const txt = [];
  if (on.length) txt.push(plural(on.length, 'Negativa: ', 'Negativas: ') + lista(nm(on)) + (on.every(o => o.esc) ? ' (proceso de mejora).' : '.'));
  if (op.length) { const sf = op.filter(o => o.fb !== 'Sí').length; txt.push(plural(op.length, 'Positiva: ', 'Positivas: ') + lista(nm(op).slice(0, 6)) + (op.length > 6 ? ' y ' + (op.length - 6) + ' más' : '') + (sf ? ' (' + sf + ' sin feedback).' : '.')); }
  T(s, txt.length ? txt.join(' ') : 'Sin observaciones de conducta registradas en la SN ' + SNA + '.', { x: 9.75, y: 4.7, w: 2.85, h: 2.0, fontSize: 11.5, color: C.text1, valign: 'top' });
  s.addNotes('Lámina oculta: se abre desde los botones «Detalle» de las láminas principales y no aparece al avanzar la presentación. ' + sello); }

const name = 'Reporte diario PYR ' + HOY + '.pptx', out = path.join(OUT, name);
await pres.writeFile({ fileName: out });
const th = findTheme(); if (th) await require(th).applyTheme(out, THEME); else WARN.push('no se encontró apply_theme.js (colores del tema por defecto)');
console.log(JSON.stringify({ archivo: out, avisos: WARN, resumen: { dia, ant, act, obsSemana: [obsA.length, oPos.length, oNeg.length], obsDia: obsD.length, hzSemana: [hzA.length, hAb.length, hVe.length], hzDia: hzD.map(h => h.id), accDia: accD.length, reDia: reD.length, menor: min, ruta } }, null, 1));
})().catch(e => { console.error('ERROR', e); process.exit(1); });
