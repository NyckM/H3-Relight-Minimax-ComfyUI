import { localize, translate } from './i18n.js';
import { languageUI } from './language_ui.js';
// Compass for the Sol H3 node: north up, clockwise. The purple wedge is where the camera points (drag it);
// the sun is drawn as on a sky map, the centre is straight overhead and the rim is the horizon.
// No ComfyUI imports, so it runs in preview pages and in the harness.
import { DIRECTIONS_PT } from './relight_render.js';

/** Pointer position to a compass bearing: 0 up (north), 90 right (east). Null at the dead centre. */
export function pointerToHeading(cx, cy, x, y) {
  const dx = x - cx, dy = y - cy;
  if (Math.hypot(dx, dy) < 4) return null;
  return ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
}

const CARDINAL = [['N', 0], ['L', 90], ['S', 180], ['O', 270]];
const CSS = `.h3sun{box-sizing:border-box;width:100%;display:flex;gap:12px;align-items:center;padding:10px;background:#17171c;border:1px solid #303039;border-radius:12px;color:#e9e5f2;font:12px system-ui,sans-serif;user-select:none}
.h3sun canvas{width:140px;height:140px;flex:none;touch-action:none;cursor:grab}.h3sun canvas:focus-visible{outline:2px solid #b992ff;outline-offset:2px;border-radius:50%}
.h3sun .st{line-height:1.5;min-width:0}.h3sun .st b{font-weight:600}.h3sun .st span{color:#8c899b}.h3sun .st .warn{color:#ffd48a}.h3sun .st .err{color:#ffb4a6}`;

export function createSunCompass({ getHeading, setHeading, getLanguage, setLanguage }) {
  let localLanguage = 'pt';
  getLanguage ||= () => localLanguage;
  setLanguage ||= v => { localLanguage = v; };
  const root = document.createElement('div'); root.className = 'h3sun';
  root.innerHTML = `<style>${CSS}</style><canvas tabindex="0" role="slider" aria-label="Direção da câmera na bússola" aria-valuemin="0" aria-valuemax="360"></canvas><div class="st" aria-live="polite">Calculando o sol…</div>`;
  const locale = localize(root, getLanguage);
  const language = languageUI(root, 'H3SunPosition', getLanguage, v => { setLanguage(v); draw(); paintStatus(); locale.apply(); });
  root.style.flexWrap = 'wrap';
  const canvas = root.querySelector('canvas'), status = root.querySelector('.st');
  let sun = null, error = '';
  function draw() {
    const dpr = devicePixelRatio || 1, S = 140; canvas.width = S * dpr; canvas.height = S * dpr;
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = S / 2, R = 58, heading = getHeading(), rad = a => a * Math.PI / 180;
    const at = (bearing, r) => [c + Math.sin(rad(bearing)) * r, c - Math.cos(rad(bearing)) * r];
    g.fillStyle = '#1d1c24'; g.strokeStyle = '#3b3846'; g.lineWidth = 1; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = '#2c2a34'; for (const r of [R / 3, 2 * R / 3]) { g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke(); }
    for (let i = 0; i < 24; i++) { const [x0, y0] = at(i * 15, R - (i % 6 ? 3 : 7)), [x1, y1] = at(i * 15, R); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    g.font = '600 10px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [t, b] of CARDINAL) { const [x, y] = at(b, R + 8); g.fillStyle = t === 'N' ? '#ff9a7a' : '#8c899b'; g.fillText(getLanguage() === 'en' ? ({L:'E',O:'W'}[t] || t) : t, x, y); }
    // camera field of view (~40 degrees) and the camera itself
    g.fillStyle = '#8c4cff2e'; g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, rad(heading - 20 - 90), rad(heading + 20 - 90)); g.closePath(); g.fill();
    g.strokeStyle = '#a878ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(c, c); g.lineTo(...at(heading, R - 4)); g.stroke();
    g.fillStyle = '#8c4cff'; g.beginPath(); g.arc(c, c, 5, 0, 7); g.fill();
    if (sun) {
      const r = sun.below_horizon ? R : R * (1 - Math.max(0, sun.altitude) / 90), [x, y] = at(sun.sun_azimuth, r);
      if (sun.below_horizon) { g.strokeStyle = '#8a8497'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 6, 0, 7); g.stroke(); }
      else {
        const glow = g.createRadialGradient(x, y, 0, x, y, 16); glow.addColorStop(0, '#ffd76acc'); glow.addColorStop(1, '#ffd76a00');
        g.fillStyle = glow; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      }
    }
    canvas.setAttribute('aria-valuenow', String(Math.round(heading)));
  }
  function paintStatus() {
    status.replaceChildren();
    const line = (cls, ...parts) => { const d = document.createElement('div'); if (cls) d.className = cls; d.append(...parts); status.append(d); };
    const span = t => { const s = document.createElement('span'); s.textContent = t; return s; };
    const bold = t => { const b = document.createElement('b'); b.textContent = t; return b; };
    if (error) { line('err', '⚠ ' + error); return; }
    if (!sun) { line('', 'Calculando o sol…'); return; }
    line('', '☀ ', bold(sun.where));
    line('', span(`${sun.tz} · ${sun.utc}`));
    line('', span('sol: '), `${sun.altitude.toFixed(1)}° de altura, bússola ${sun.sun_azimuth.toFixed(0)}°`);
    const idx = Math.floor((((sun.azimuth % 360) + 360) % 360 + 22.5) / 45) % 8;
    line('', span('no Relight: '), `${DIRECTIONS_PT[idx]} · ${sun.azimuth.toFixed(0)}° / ${sun.elevation.toFixed(0)}° · ${sun.kelvin}K`);
    if (sun.below_horizon) line('warn', 'Sol abaixo do horizonte: a luz vai no horizonte (0°).');
  }
  const setFrom = e => {
    const r = canvas.getBoundingClientRect(), h = pointerToHeading(r.width / 2, r.height / 2, e.clientX - r.left, e.clientY - r.top);
    if (h != null) { setHeading(Math.round(h)); draw(); }
  };
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); canvas.dataset.drag = '1'; setFrom(e); });
  canvas.addEventListener('pointermove', e => { if (canvas.dataset.drag) setFrom(e); });
  canvas.addEventListener('pointerup', () => { delete canvas.dataset.drag; });
  canvas.addEventListener('keydown', e => {
    const step = { ArrowLeft: -5, ArrowRight: 5 }[e.key]; if (!step) return;
    e.preventDefault(); setHeading(((Math.round(getHeading()) + step) % 360 + 360) % 360); draw();
  });
  draw(); paintStatus();
  return {
    element: root,
    show(data) { if (data && data.error) { error = data.error; } else { error = ''; sun = data; } draw(); paintStatus(); },
    redraw() { draw(); language.sync(); locale.apply(); },
    destroy() { locale.destroy(); },
  };
}
