# Reporte diario PYR en PowerPoint

Genera cada día hábil el «Reporte diario PYR» interactivo y lo envía por correo a vdiaz@grupopro.cl.
Lo ejecuta una tarea programada de Claude (lunes a viernes, 08:30, hora de Chile), que usa el Chrome
del computador de Valentín, con la sesión Microsoft de la app iniciada.

| Archivo | Qué hace |
|---|---|
| `colector.js` | Corre en Chrome sobre la app. Lee el programa (SharePoint), observaciones y eventos (cachés de `observaciones.html` y `eventos.html`), hallazgos (Apps Script) y el macro de accidentes. `run(fecha)` devuelve un JSON; `foto(id)` muestra la foto de un hallazgo en pantalla completa para capturarla. |
| `build.js` | `node build.js datos.json carpeta_salida [carpeta_fotos] [ajustes.json]` arma el .pptx (4 láminas + 5 ocultas por centro). |
| `anim.py` | Agrega las animaciones «al hacer clic» a las piezas marcadas `A<paso>_`. |

Láminas: 1 Cumplimiento (día anterior, semana anterior, meta de la semana) · 2 Observaciones · 3 Hallazgos (con fotos
del día anterior) · 4 Días sin accidentes · 5-9 detalle oculto por centro (se abren con los botones «Detalle»).

Reglas:
- «Día anterior» = ayer; el lunes cubre viernes a domingo.
- «Semana anterior» = lunes a domingo de la semana ISO previa. «Meta de la semana» = semana en curso.
- Días sin accidentes: accidentes del trabajo con tiempo perdido (días > 0) y calificación «Con cobertura», por razón social y grupo
  (Peñón, Lo Aguirre, Local 95, ECMM PS, ECMM SB·Pñ; lo que no es Walmart ni Líder va a Ruta).
- Titulares automáticos; se pueden reemplazar con `ajustes.json` → `{"titulos":{"cumpl":"…","obs":"…","hz":"…","acc":"…"}}`.
