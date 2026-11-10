/* PRO EHS · estilo común de los gráficos (Chart.js): animación de entrada, hover y tooltips con detalle */
(function () {
  if (!window.Chart || window.__gpCharts) return; window.__gpCharts = 1;
  var C = window.Chart, D = C.defaults;
  function hex2rgb(h) { h = String(h || '').trim(); if (h.indexOf('rgb') === 0) { var m = h.match(/\d+(\.\d+)?/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]]; }
    h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h.slice(0, 6), 16); return isNaN(n) ? null : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function shade(col, f) { var r = hex2rgb(col); if (!r) return col; return 'rgb(' + r.map(function (v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }).join(',') + ')'; }
  function colorDe(ctx, key) { var ds = ctx.dataset || {}, c = ds[key]; return Array.isArray(c) ? c[ctx.dataIndex % c.length] : (typeof c === 'function' ? c(ctx) : c); }
  var fmt = function (n) { return Number(n || 0).toLocaleString('es-CL'); };
  var pct = function (a, b) { return b ? Math.round(a / b * 1000) / 10 + '%' : '—'; };

  // Tipografía y colores base
  D.font.family = 'Manrope, Arial, sans-serif'; D.color = '#52525b';
  // Animación de entrada: barras crecen desde la base, anillos giran, líneas se dibujan
  D.animation.duration = 750; D.animation.easing = 'easeOutQuart';
  if (D.transitions && D.transitions.active && D.transitions.active.animation) D.transitions.active.animation.duration = 160;
  // Hover: el elemento se oscurece levemente y el cursor cambia a mano
  D.datasets.bar.hoverBackgroundColor = function (ctx) { return shade(colorDe(ctx, 'backgroundColor'), -0.18); };
  D.datasets.doughnut.hoverBackgroundColor = function (ctx) { return shade(colorDe(ctx, 'backgroundColor'), -0.15); };
  D.datasets.doughnut.hoverOffset = 10; D.datasets.doughnut.hoverBorderColor = '#fff';
  D.datasets.pie && (D.datasets.pie.hoverOffset = 10);
  D.datasets.line.pointHoverRadius = 6; D.datasets.line.pointHoverBorderWidth = 2;
  D.interaction.mode = 'nearest'; D.interaction.intersect = true;
  D.onHover = function (e, els) { var t = e.native && e.native.target; if (t) t.style.cursor = els && els.length ? 'pointer' : 'default'; };
  D.elements.bar.borderRadius = 5;

  // Tooltip con detalle: valor, % del total y total de la columna en barras apiladas
  var T = D.plugins.tooltip;
  T.backgroundColor = 'rgba(24,24,27,.94)'; T.titleColor = '#fff'; T.bodyColor = '#e4e4e7'; T.footerColor = '#a1a1aa';
  T.padding = 12; T.cornerRadius = 10; T.boxPadding = 5; T.caretSize = 6; T.displayColors = true; T.usePointStyle = true;
  T.titleFont = { family: 'Manrope', weight: '800', size: 13 }; T.bodyFont = { family: 'Manrope', weight: '600', size: 12.5 }; T.footerFont = { family: 'Manrope', weight: '700', size: 11.5 };
  T.callbacks = T.callbacks || {};
  T.callbacks.label = function (ctx) {
    var type = ctx.chart.config.type, ds = ctx.dataset, v = ctx.parsed;
    var val = (type === 'doughnut' || type === 'pie') ? v : (ctx.chart.options.indexAxis === 'y' ? v.x : v.y);
    if (val == null) return null;
    var lab = ds.label && ctx.chart.data.datasets.length > 1 ? ds.label + ': ' : '';
    var unit = /%/.test(ds.label || '') ? '%' : '';
    if (unit) return ' ' + lab + fmt(val) + unit;
    var tot = (ds.data || []).reduce(function (a, b) { return a + (+b || 0); }, 0);
    var stacked = ctx.chart.options.scales && ctx.chart.options.scales.x && ctx.chart.options.scales.x.stacked;
    if (stacked) { var col = ctx.chart.data.datasets.reduce(function (a, d) { return a + (d.type === 'line' ? 0 : (+d.data[ctx.dataIndex] || 0)); }, 0); return ' ' + lab + fmt(val) + (col ? '  ·  ' + pct(val, col) + ' de la columna' : ''); }
    return ' ' + lab + fmt(val) + (tot && ctx.chart.data.datasets.length === 1 ? '  ·  ' + pct(val, tot) + ' del total' : '');
  };
  T.callbacks.footer = function (items) {
    if (!items.length) return '';
    var ch = items[0].chart, st = ch.options.scales && ch.options.scales.x && ch.options.scales.x.stacked;
    if (!st || ch.data.datasets.length < 2) return '';
    var i = items[0].dataIndex, tot = ch.data.datasets.reduce(function (a, d) { return a + (d.type === 'line' ? 0 : (+d.data[i] || 0)); }, 0);
    return 'Total: ' + fmt(tot);
  };
  // Leyenda con puntos redondeados y clic para ocultar series (comportamiento por defecto de Chart.js)
  D.plugins.legend.labels.usePointStyle = true; D.plugins.legend.labels.pointStyle = 'rectRounded'; D.plugins.legend.labels.padding = 14;

  // Tarjetas con leve elevación al pasar el mouse
  var st = document.createElement('style');
  st.textContent = '.card{transition:box-shadow .2s,transform .2s}.card:hover{box-shadow:0 6px 22px rgba(0,0,0,.08)}.cv canvas{animation:gpfade .45s ease-out}@keyframes gpfade{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(st);
  window.gpChartShade = shade;
})();
