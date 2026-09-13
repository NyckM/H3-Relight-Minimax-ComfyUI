import { localize, translate } from './i18n.js';
import { languageUI } from './language_ui.js';
// Relight H3 panel. Same studio family as Camera H3: all drawing is local, no external assets or requests.
// The ball on the right is rendered by relight_render.js, the same arithmetic relight.py uses for <Picture 2>.
import { DATA, LIGHT_TYPES, BACKGROUNDS, DIRECTIONS_PT, ALTITUDE_PT, ROLES_PT, kelvinRgb, lightRgb, rgbHex,
  paintBall, directionIndex, altitudeBand, lightRoles, ventiRay } from './relight_render.js';

const EFFECTS = Object.fromEntries(DATA.effects.map(e => [e.id, e]));
const PRESETS = Object.fromEntries(DATA.presets.map(p => [p.id, p]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rad = v => v * Math.PI / 180, deg = v => v * 180 / Math.PI;
const wrapAz = a => { a = ((Math.round(a) + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };

export function normalizeLighting(data) {
  if (typeof data === 'string') data = JSON.parse(data);
  if (Array.isArray(data)) {
    const map = {};
    for (const e of data) if (e && e.id) map[e.id] = typeof e.data === 'string' && e.data ? JSON.parse(e.data) : e.data;
    const setting = map.setting || {}; delete map.setting; data = { ...setting, ...map };
  }
  if (!data || typeof data !== 'object') throw Error('A iluminação precisa ser um objeto JSON.');
  let lights = data.lights;
  if (!lights) {
    lights = [];
    for (const k of ['light1', 'light2', 'light3']) {
      let v = data[k]; if (typeof v === 'string') v = v.trim() ? JSON.parse(v) : null; if (v) lights.push(v);
    }
  }
  if (!Array.isArray(lights) || lights.length < 1 || lights.length > 3) throw Error('Use de 1 a 3 luzes.');
  const num = (v, d) => {
    if (v == null) return d;
    const n = parseFloat(String(v).replace(/[°kK]/g, ''));
    if (!Number.isFinite(n)) throw Error(`Valor inválido: ${v}`);
    return n;
  };
  const out = lights.map((l, i) => {
    const type = l.type || l.lightType || 'spotlight';
    if (!LIGHT_TYPES[type]) throw Error(`Luz ${i + 1}: tipo desconhecido.`);
    const intensity = l.intensity != null ? num(l.intensity) : l.lightness != null ? num(l.lightness) * 10 : 50;
    const el = num(l.elevation ?? l.verticalAngle, 0);
    if (intensity < 10 || intensity > 100) throw Error(`Luz ${i + 1}: intensidade vai de 10 a 100.`);
    if (el < -90 || el > 90) throw Error(`Luz ${i + 1}: elevação vai de -90 a 90.`);
    const hasK = l.kelvin != null || l.colorTemp != null;
    const colorMode = l.colorMode || (hasK && l.color == null ? 'kelvin' : 'hex');
    let color = String(l.color || '#ffffff').toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(color)) color = '#' + [...color.slice(1)].map(c => c + c).join('');
    if (!/^#[0-9a-f]{6}$/.test(color)) throw Error(`Luz ${i + 1}: cor deve ser #RRGGBB.`);
    return { type, intensity: Math.round(intensity), azimuth: wrapAz(num(l.azimuth ?? l.horizontalAngle, 0)),
      elevation: Math.round(el), colorMode, color, kelvin: Math.round(clamp(num(l.kelvin ?? l.colorTemp, 6500), 1000, 10000)) };
  });
  const background = data.background || data.studioMode || 'default';
  if (!BACKGROUNDS[background]) throw Error('Fundo desconhecido.');
  const effect = String(data.effect || data.effectType || 'default').trim();
  if (effect !== 'default' && !EFFECTS[effect]) throw Error(`Atmosfera desconhecida: ${effect}`);
  return { version: 1, preset: PRESETS[data.preset] ? data.preset : null, lights: out, background, effect };
}

const CSS = `
.h3rl{--purple:#8c4cff;--teal:#19c7a7;--muted:#8c899b;--line:#34313f;box-sizing:border-box;width:100%;height:880px;overflow:auto;padding:20px;background:#17171c;border:1px solid #303039;border-radius:18px;color:#f4f4f5;font:14px system-ui,sans-serif;user-select:none}
.h3rl *{box-sizing:border-box}.h3rl button,.h3rl input{font:inherit;color:inherit}.h3rl button{cursor:pointer}.h3rl button:disabled{opacity:.3;cursor:default}
.h3rl button:focus-visible,.h3rl input:focus-visible,.h3rl canvas:focus-visible{outline:2px solid #b992ff;outline-offset:2px}
.h3rl header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.h3rl .brand{display:flex;align-items:center;gap:11px}.h3rl .brandmark{width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 0 10px #8c4cff35)}
.h3rl .brand b{font-size:18px;letter-spacing:3px;display:block}.h3rl .brand em{display:block;font-style:normal;color:var(--muted);font-size:11px;letter-spacing:1px;margin-top:2px}
.h3rl .reference{border:1px solid #315e55;color:#8cdfcd;background:#19302a;padding:9px 12px;border-radius:8px;font-size:11px}
.h3rl .bar{display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;margin-bottom:10px;background:#201e28}
.h3rl .tab{border:0;background:none;color:#a59bb8;padding:7px 11px;border-radius:6px;font-size:12px}.h3rl .tab[aria-selected=true]{background:#2e2340;color:#efe7ff;box-shadow:inset 0 -2px 0 var(--purple)}
.h3rl .ghost{margin-left:auto;font-size:12px;color:#b8afcb;border:1px solid #464052;background:none;border-radius:6px;padding:7px 10px}
.h3rl .switches{display:flex;gap:8px;flex-wrap:wrap;padding:8px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:12px;background:#1c1a24;align-items:center}
.h3rl .switches b{font-size:11px;color:#7d7590;font-weight:600;margin-right:2px}.h3rl .sw{border:1px solid #464052;background:#221f2b;color:#8d85a0;border-radius:6px;padding:6px 10px;font-size:12px}
.h3rl .sw[data-on='1']{border-color:var(--purple);background:#2e2340;color:#e6dcff}.h3rl .ltx{color:#7d7590;font-size:10px;margin-top:2px}
.h3rl .stage{border:1px solid var(--line);border-radius:12px;background:#1d1d23;overflow:hidden}
.h3rl .viewport{display:grid;grid-template-columns:1fr 212px;grid-template-rows:340px;height:340px;background:radial-gradient(ellipse at 38% 50%,#26252e 0%,#1d1d23 70%)}
.h3rl .dome{position:relative;min-width:0;overflow:hidden}.h3rl .scene{position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none;cursor:move}
.h3rl .hint{position:absolute;left:12px;bottom:10px;right:12px;color:#827e90;font-size:10px;pointer-events:none;line-height:1.35}
.h3rl .ballpane{overflow:hidden;border-left:1px solid #2c2936;padding:12px;display:flex;flex-direction:column;gap:8px;background:#1a1920}
.h3rl .ballpane .cap{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;color:#b9b2c9}.h3rl .ballpane .cap small{color:#6f6a7e;font-size:10px}
.h3rl .ball{width:188px;height:188px;border-radius:8px;display:block;touch-action:none;cursor:crosshair;background:#6c6c6c}
.h3rl .ballpane[data-off='1'] .ball{opacity:.35;filter:grayscale(.6)}.h3rl .readout{font-size:11px;color:#cfc8dc;line-height:1.45}.h3rl .readout span{color:var(--muted)}
.h3rl .strip{display:flex;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid #2c2936;background:#19181f;flex-wrap:wrap}
.h3rl .chip{display:flex;align-items:center;gap:7px;border:1px solid #3a3444;background:#211e29;border-radius:20px;padding:5px 11px 5px 7px;font-size:12px;color:#c9c1d9}
.h3rl .chip i{width:13px;height:13px;border-radius:50%;display:block;box-shadow:0 0 8px currentColor}.h3rl .chip small{color:var(--muted);font-size:11px}
.h3rl .chip[aria-pressed=true]{border-color:var(--purple);background:#2e2340;color:#fff}.h3rl .add{font-size:12px;color:#8cdfcd;border:1px dashed #315e55;background:none;border-radius:20px;padding:5px 11px}
.h3rl .drop{margin-left:auto;font-size:11px;color:#a59bab;border:1px solid #3a3340;background:none;border-radius:5px;padding:5px 8px}
.h3rl .panel{margin-top:12px;height:236px;overflow:auto;padding-right:2px}
.h3rl .cards{display:grid;grid-template-columns:1.05fr 1fr 1fr;gap:10px}.h3rl .drivenbar{grid-column:1/-1;font-size:11px;color:#8cdfcd;border:1px solid #315e55;background:#19302a;border-radius:8px;padding:6px 10px}.h3rl .chip b{font-size:9px;color:#8cdfcd;border:1px solid #315e55;border-radius:8px;padding:0 5px;font-weight:600}.h3rl .card{padding:12px;background:#211e29;border:1px solid #393142;border-radius:10px;min-width:0}
.h3rl .cards .card:nth-child(1){border-top:2px solid var(--teal)}.h3rl .cards .card:nth-child(2){border-top:2px solid #6b66db}.h3rl .cards .card:nth-child(3){border-top:2px solid #9958ff}
.h3rl .heading{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:12px;gap:6px}
.h3rl .number{width:46px;background:transparent;border:0;color:#fff;text-align:right;padding:0;appearance:textfield;-moz-appearance:textfield}.h3rl .number::-webkit-inner-spin-button{display:none}
.h3rl .dirrow{display:flex;align-items:center;gap:10px;margin:8px 0 4px}.h3rl .dial{width:74px;height:74px;touch-action:none;cursor:grab;flex:none}
.h3rl .dirname{font-size:12px;color:#d8d0e8;line-height:1.35}.h3rl .dirname span{display:block;color:var(--muted);font-size:10px}
.h3rl input[type=range]{width:100%;accent-color:var(--purple);margin:9px 0 6px}.h3rl .card:nth-child(1) input[type=range]{accent-color:var(--teal)}
.h3rl .seg{display:flex;border:1px solid #463e52;border-radius:7px;overflow:hidden;margin:8px 0 6px}.h3rl .seg button{flex:1;border:0;background:#1b1922;color:#9e96b0;padding:6px 4px;font-size:12px}
.h3rl .seg button[aria-pressed=true]{background:#3a2a55;color:#fff}.h3rl .typehint{font-size:10px;color:#7f7a8e;line-height:1.35;min-height:28px}
.h3rl .kelvin{height:8px;border-radius:4px;margin-top:10px}.h3rl .kelvin+input{margin-top:4px}
.h3rl .colorrow{display:flex;align-items:center;gap:8px;margin-top:12px}.h3rl .colorrow input[type=color]{width:34px;height:28px;border:1px solid #463e52;border-radius:6px;background:none;padding:0}
.h3rl .hex{width:84px;background:#18171e;border:1px solid #463e52;border-radius:6px;padding:5px 7px;font-size:12px}.h3rl .swatch{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:11px;color:#b9b2c9}.h3rl .swatch i{width:28px;height:10px;border-radius:3px;border:1px solid #0008;flex:none}
.h3rl .filters{display:flex;gap:6px;margin-bottom:10px}.h3rl .filters button{border:1px solid #3a3444;background:none;color:#a59bb8;border-radius:14px;padding:4px 10px;font-size:11px}.h3rl .filters button[aria-pressed=true]{border-color:var(--purple);color:#fff}
.h3rl .presets{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.h3rl .preset{border:1px solid #34303d;background:#1e1c25;border-radius:9px;padding:6px 4px 5px;display:flex;flex-direction:column;align-items:center;gap:3px}
.h3rl .preset canvas{width:44px;height:44px;border-radius:50%}.h3rl .preset span{font-size:10px;color:#b4acc4;text-align:center;line-height:1.2}.h3rl .preset[aria-pressed=true]{border-color:var(--purple);background:#2a2138}
.h3rl .bgs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.h3rl .bgcard{border:1px solid #393142;background:#211e29;border-radius:10px;padding:10px;text-align:left}
.h3rl .bgcard i{display:block;height:64px;border-radius:7px;margin-bottom:8px;border:1px solid #0005}.h3rl .bgcard b{display:block;font-size:12px;font-weight:600}.h3rl .bgcard span{font-size:10px;color:var(--muted);line-height:1.35}
.h3rl .bgcard[aria-pressed=true]{border-color:var(--purple);background:#2a2138}
.h3rl .effects{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.h3rl .effect{border:1px solid #34303d;background:#1e1c25;border-radius:7px;padding:7px 6px;font-size:11px;color:#b4acc4;text-align:left}
.h3rl .effect[aria-pressed=true]{border-color:var(--purple);background:#2e2340;color:#fff}.h3rl .effectnote{margin-top:10px;font-size:11px;color:#9e97ad;line-height:1.4;min-height:30px}
.h3rl footer{display:flex;justify-content:space-between;gap:10px;margin-top:10px;color:#96949e;font-size:10px}.h3rl .clearref{background:none;border:0;color:#8cdfcd;text-decoration:underline;padding:0 0 0 6px;font-size:10px}
.h3rl .error{color:#ffb4a6;font-size:12px;padding-top:6px}.h3rl .note{color:#ffd48a;font-size:11px;padding-top:4px;min-height:14px}
@media (prefers-reduced-motion:reduce){.h3rl *{transition:none!important}}
`;

const FIELD_PT = { azimuth: 'azimute', elevation: 'elevação', intensity: 'intensidade', kelvin: 'cor (Kelvin)' };
const DRIVE_FIELDS = { light1_azimuth: 'azimuth', light1_elevation: 'elevation', light1_intensity: 'intensity', light1_kelvin: 'kelvin' };

export function createRelightEditor({ read, write, linkedImage, switches, looks, drivenInputs, getLanguage, setLanguage }) {
  let localLanguage = 'pt';
  getLanguage ||= () => localLanguage;
  setLanguage ||= v => { localLanguage = v; };
  const root = document.createElement('section'); root.className = 'h3rl';
  root.innerHTML = `<style>${CSS}</style>
  <header><div class="brand"><img class="brandmark" alt="" decoding="async"><span><b>RELIGHT H3</b><em>BruxosDoVFX</em></span></div>
    <button class="reference" data-action="image">Imagem de referência</button><input type="file" accept="image/*" hidden></header>
  <div class="bar" role="tablist" aria-label="Seções">
    <button class="tab" role="tab" data-tab="lights">Luzes</button><button class="tab" role="tab" data-tab="presets">Presets</button>
    <button class="tab" role="tab" data-tab="background">Fundo</button><button class="tab" role="tab" data-tab="effects">Atmosfera</button>
    <button class="ghost" data-action="reset" title="Volta para uma luz suave de frente-direita">↺ Reiniciar</button></div>
  <div class="switches"></div>
  <div class="stage"><div class="viewport">
    <div class="dome"><canvas class="scene" tabindex="0" aria-label="Cúpula de luz: arraste um marcador para mover a luz, arraste o fundo para girar a vista"></canvas>
      <div class="hint">Arraste um marcador para mover a luz · arraste o fundo para girar a vista · a prévia na foto é aproximada</div></div>
    <div class="ballpane"><div class="cap">Picture 2<small data-role="ballstyle"></small></div>
      <canvas class="ball" tabindex="0" aria-label="Esfera de referência: clique ou arraste para apontar a luz selecionada; fora da esfera leva a luz para trás"></canvas>
      <div class="readout" aria-live="polite"></div></div></div>
    <div class="strip"></div></div>
  <div class="panel"></div>
  <footer><span data-role="refsrc"></span><span data-role="preset"></span></footer><div class="error" role="status"></div><div class="note" role="status"></div>`;
  const locale = localize(root, getLanguage);
  const language = languageUI(root, 'H3RelightEditor', getLanguage, v => { setLanguage(v); locale.apply(); schedule(); });
  const $ = s => root.querySelector(s);
  $('.brandmark').src = new URL('./logo.png', import.meta.url).href;
  const canvas = $('.scene'), ctx = canvas.getContext('2d'), ballCanvas = $('.ball'), bctx = ballCanvas.getContext('2d');

  const defaults = () => ({ version: 1, preset: null, lights: [{ ...DATA.default_light }], background: 'default', effect: 'default' });
  let model = defaults(), active = 0, tab = 'lights', filter = 'all', lastRaw = '', disposed = false;
  let yaw = -0.62, pitch = 0.38, drag = null, markerScreens = [], poll = 0, frame = 0;
  let image = null, manualImage = null, linkedImg = null, linkedSrc = '', cardCache = null;
  const thumbCache = new Map();
  const R = 1.55;
  let blockedNote = '';
  let resolved = null; // light 1 as the last run resolved it, when graph inputs drive it
  const drivenFields = () => (drivenInputs?.() || []).map(n => DRIVE_FIELDS[n]).filter(Boolean);
  function lightsView() {
    const fields = drivenFields();
    if (!fields.length || !resolved) return model.lights;
    const first = { ...model.lights[0] };
    for (const f of fields) { first[f] = resolved[f]; if (f === 'kelvin') first.colorMode = 'kelvin'; }
    return [first, ...model.lights.slice(1)];
  }
  const light = () => model.lights[active];
  const shown = () => lightsView()[active];
  const styleOf = () => looks?.() || { sun: false, reference: true };

  function save() {
    lastRaw = JSON.stringify(model); write(lastRaw); cardCache = null; schedule();
  }
  function edit(patch) {
    if (active === 0) {
      const blocked = drivenFields().filter(f => f in patch || (f === 'kelvin' && 'colorMode' in patch));
      for (const f of blocked) { delete patch[f]; if (f === 'kelvin') delete patch.colorMode; }
      blockedNote = blocked.length ? 'Luz 1: ' + blocked.map(f => FIELD_PT[f]).join(', ') + ' vem do grafo. Desconecte a entrada para editar aqui.' : '';
      if (!Object.keys(patch).length) { schedule(); return; }
    }
    if (!drivenFields().length || active !== 0) blockedNote = '';
    Object.assign(light(), patch); model.preset = null; save();
  }
  function schedule() { if (frame) return; frame = requestAnimationFrame(() => { frame = 0; if (!disposed) render(); }); }

  // ------------------------------------------------------------------ dome view
  function setupCanvas(c) {
    const w = c.clientWidth || 300, h = c.clientHeight || 300, dpr = devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); return [w, h];
  }
  const worldOf = (az, el, r = R) => [Math.cos(rad(el)) * Math.sin(rad(az)) * r, Math.sin(rad(el)) * r, Math.cos(rad(el)) * Math.cos(rad(az)) * r];
  let view = { w: 300, h: 300, scale: 70, cx: 150, cy: 150 };
  function project([x, y, z]) {
    const X = x * Math.cos(yaw) - z * Math.sin(yaw), Z = x * Math.sin(yaw) + z * Math.cos(yaw);
    return [view.cx + X * view.scale, view.cy - (y * Math.cos(pitch) - Z * Math.sin(pitch)) * view.scale, y * Math.sin(pitch) + Z * Math.cos(pitch)];
  }
  function unproject(sx, sy, front) {
    const X = (sx - view.cx) / view.scale, Y2 = (view.cy - sy) / view.scale;
    let rr = Math.hypot(X, Y2), x2 = X, y2 = Y2;
    if (rr > R) { x2 = X / rr * R * 0.999; y2 = Y2 / rr * R * 0.999; rr = R * 0.999; }
    const D = Math.sqrt(Math.max(R * R - x2 * x2 - y2 * y2, 0)) * (front ? 1 : -1);
    const y = y2 * Math.cos(pitch) + D * Math.sin(pitch), Z = -y2 * Math.sin(pitch) + D * Math.cos(pitch);
    const x = x2 * Math.cos(yaw) + Z * Math.sin(yaw), z = -x2 * Math.sin(yaw) + Z * Math.cos(yaw);
    return { azimuth: wrapAz(deg(Math.atan2(x, z))), elevation: Math.round(deg(Math.asin(clamp(y / R, -1, 1)))) };
  }
  function litCard() {
    if (cardCache) return cardCache;
    const ratio = image ? clamp(image.naturalWidth / image.naturalHeight, 0.5, 2) : 0.8;
    const W = ratio >= 1 ? 240 : Math.round(240 * ratio), H = ratio >= 1 ? Math.round(240 / ratio) : 240;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    if (image) g.drawImage(image, 0, 0, W, H);
    else {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5a5f6b'); gr.addColorStop(1, '#3b3e46'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#c9c3bb'; g.beginPath(); g.arc(W / 2, H * .36, W * .14, 0, 7); g.fill(); g.beginPath(); g.ellipse(W / 2, H * .92, W * .3, H * .34, 0, Math.PI, 0); g.fill();
    }
    // A rough look at direction and colour, painted in 2D: not a relight, just orientation.
    const amb = { default: 0.5, black: 0.3, white: 0.68 }[model.background];
    g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${amb * 255},${amb * 255},${amb * 255})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'screen';
    for (const l of lightsView()) {
      const [r, gg, b] = lightRgb(l), a = rad(l.azimuth), e = rad(l.elevation);
      const front = 0.5 + 0.5 * Math.cos(a) * Math.cos(e), sx = Math.sin(a) * Math.cos(e), sy = -Math.sin(e);
      const k = l.intensity / 100 * (0.3 + 0.7 * front), len = Math.hypot(sx, sy);
      let grad;
      if (len < 0.25) { grad = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .7); }
      else { const ux = sx / len, uy = sy / len; grad = g.createLinearGradient(W / 2 + ux * W * .55, H / 2 + uy * H * .55, W / 2 - ux * W * .45, H / 2 - uy * H * .45); }
      grad.addColorStop(0, `rgba(${r},${gg},${b},${clamp(k * 1.1, 0, 1)})`); grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      if (front < 0.35) { // backlight: glow the edges
        const rim = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .62);
        rim.addColorStop(0, `rgba(${r},${gg},${b},0)`); rim.addColorStop(1, `rgba(${r},${gg},${b},${l.intensity / 100 * .8})`);
        g.fillStyle = rim; g.fillRect(0, 0, W, H);
      }
    }
    g.globalCompositeOperation = 'source-over';
    return (cardCache = c);
  }
  function drawDome() {
    const [w, h] = setupCanvas(canvas);
    view = { w, h, scale: Math.min(w, h) * 0.25, cx: w / 2, cy: h * 0.5 };
    const line = (a, b, color, width = 1, dash) => { const p = project(a), q = project(b); ctx.beginPath(); ctx.setLineDash(dash || []); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); ctx.setLineDash([]); };
    const fy = -1.05;
    for (let i = -4; i <= 4; i++) { line([i * .45, fy, -1.8], [i * .45, fy, 1.8], '#2b2a31'); line([-1.8, fy, i * .45], [1.8, fy, i * .45], '#2b2a31'); }
    const ring = (fn, color, width, dash, n = 96) => { for (let i = 0; i < n; i++) line(fn(i / n), fn((i + 1) / n), color, width, dash); };
    ring(t => worldOf(t * 360, 0), '#4a4752', 1.2);
    ring(t => worldOf(t * 360, 45), '#34323b', 1, [3, 4]);
    ring(t => worldOf(0, t * 360 - 180), '#2f2d36', 1);
    ring(t => worldOf(90, t * 360 - 180), '#2f2d36', 1);
    const labels = [[0, 'frente'], [90, 'direita'], [180, 'trás'], [-90, 'esquerda']];
    ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    for (const [az, txt] of labels) { const p = project(worldOf(az, 0, R + 0.22)); ctx.fillStyle = p[2] >= 0 ? '#8a8598' : '#56525f'; ctx.fillText(translate(txt, getLanguage()), p[0], p[1] + 3); }
    // camera glyph on the camera side, looking at the subject
    const cam = project([0, 0.02, R + 0.42]); ctx.save(); ctx.translate(cam[0], cam[1]);
    ctx.fillStyle = '#6c21ce'; ctx.fillRect(-9, -6, 13, 11); ctx.fillStyle = '#9f62ff'; ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(10, -7); ctx.lineTo(10, 6); ctx.lineTo(4, 2); ctx.fill(); ctx.restore();
    const items = lightsView().map((l, i) => ({ i, l, p: worldOf(l.azimuth, l.elevation), q: project(worldOf(l.azimuth, l.elevation)) }));
    const drawLight = ({ i, l, p, q }) => {
      const hex = rgbHex(lightRgb(l)), on = i === active;
      const foot = worldOf(l.azimuth, 0);
      for (let k = 0; k < 24; k++) {
        const e0 = l.elevation * k / 24, e1 = l.elevation * (k + 1) / 24;
        line(worldOf(l.azimuth, e0), worldOf(l.azimuth, e1), on ? '#8c7aa8' : '#4a4556', 1, [2, 3]);
      }
      const f = project(foot); ctx.fillStyle = '#5c566a'; ctx.beginPath(); ctx.arc(f[0], f[1], 2, 0, 7); ctx.fill();
      const g = ctx.createLinearGradient(q[0], q[1], ...project([0, 0, 0]).slice(0, 2));
      g.addColorStop(0, hex + (on ? 'cc' : '88')); g.addColorStop(1, hex + '00');
      const c0 = project([0, 0, 0]); ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(c0[0], c0[1]); ctx.strokeStyle = g; ctx.lineWidth = on ? 3 : 2; ctx.stroke();
      const rr = on ? 9 : 7, glow = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr * 2.6);
      glow.addColorStop(0, hex + '99'); glow.addColorStop(1, hex + '00'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(q[0], q[1], rr * 2.6, 0, 7); ctx.fill();
      ctx.fillStyle = hex; ctx.strokeStyle = on ? '#fff' : '#0008'; ctx.lineWidth = on ? 2 : 1; ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.font = '600 9px system-ui'; ctx.fillText(String(i + 1), q[0], q[1] + 3);
      if (q[2] < 0) { ctx.fillStyle = '#17171c88'; ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, 7); ctx.fill(); }
    };
    items.filter(it => it.q[2] < 0).forEach(drawLight);
    const card = litCard(), ratio = card.width / card.height, cw = 1.15 * Math.min(ratio, 1.35), ch = cw / ratio;
    const A = project([-cw / 2, ch / 2, 0]), B = project([cw / 2, ch / 2, 0]), D = project([-cw / 2, -ch / 2, 0]);
    ctx.save(); ctx.transform((B[0] - A[0]) / card.width, (B[1] - A[1]) / card.width, (D[0] - A[0]) / card.height, (D[1] - A[1]) / card.height, A[0], A[1]);
    ctx.drawImage(card, 0, 0);
    const edge = { default: '#00000000', black: '#050507', white: '#f1f1f4' }[model.background];
    if (model.background !== 'default') { ctx.strokeStyle = edge; ctx.lineWidth = 8; ctx.strokeRect(0, 0, card.width, card.height); }
    ctx.restore();
    items.filter(it => it.q[2] >= 0).forEach(drawLight);
    markerScreens = items.map(it => ({ i: it.i, x: it.q[0], y: it.q[1], front: it.q[2] >= 0 }));
  }

  // ------------------------------------------------------------------ ball
  function drawBall() {
    const size = 188, dpr = Math.min(devicePixelRatio || 1, 2), px = Math.round(size * dpr), st = styleOf();
    if (ballCanvas.width !== px) { ballCanvas.width = px; ballCanvas.height = px; }
    paintBall(bctx, lightsView(), model.background, st.sun ? 'venti' : 'sphere', 0, 0, px, px);
    $('.ballpane').dataset.off = st.reference ? '0' : '1';
    $('[data-role=ballstyle]').textContent = st.reference ? (st.sun ? 'cena Venti' : 'esfera') : 'desligada: só texto';
  }
  function ballToLight(e) {
    const r = ballCanvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let n;
    if (styleOf().sun) { // perspective: the Venti camera
      const d = ventiRay(x, y, r.width, r.height), eye = [0, 6, 8], b = d[0] * eye[0] + d[1] * eye[1] + d[2] * eye[2];
      const closest = Math.sqrt(Math.max(100 - b * b, 0));
      if (closest <= 1) { const t = -b - Math.sqrt(b * b - 99); n = [eye[0] + t * d[0], eye[1] + t * d[1], eye[2] + t * d[2]]; }
      else { // beyond the silhouette: swing the light behind, keeping its side
        const q = [eye[0] - b * d[0], eye[1] - b * d[1], eye[2] - b * d[2]], qn = Math.hypot(...q);
        const phi = Math.min((closest - 1) / 0.55, 1) * rad(75);
        n = [0, 1, 2].map(i => Math.cos(phi) * q[i] / qn + Math.sin(phi) * d[i]);
      }
    } else { // orthographic front view, the MiniMax sphere
      const s2 = 2 / (0.46 * r.width), u = (x - r.width / 2) * s2, v = -(y - r.height / 2) * s2, rr = Math.hypot(u, v);
      if (rr <= 1) n = [u, v, Math.sqrt(1 - rr * rr)];
      else { const phi = Math.min((rr - 1) / 0.55, 1) * rad(75); n = [u / rr * Math.cos(phi), v / rr * Math.cos(phi), -Math.sin(phi)]; }
    }
    const nn = Math.hypot(...n); n = n.map(c => c / nn);
    return { azimuth: wrapAz(deg(Math.atan2(n[0], n[2]))), elevation: Math.round(deg(Math.asin(clamp(n[1], -1, 1)))) };
  }
  ballCanvas.addEventListener('pointerdown', e => { ballCanvas.setPointerCapture(e.pointerId); drag = { ball: true }; edit(ballToLight(e)); });
  ballCanvas.addEventListener('pointermove', e => { if (drag?.ball) edit(ballToLight(e)); });
  ballCanvas.addEventListener('pointerup', () => { drag = null; renderPanel(); });
  ballCanvas.addEventListener('keydown', e => {
    const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (!step) return; e.preventDefault(); edit({ azimuth: wrapAz(light().azimuth + step[0]), elevation: clamp(light().elevation + step[1], -90, 90) }); renderPanel();
  });

  // ------------------------------------------------------------------ dome interaction
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = markerScreens.filter(m => Math.hypot(m.x - x, m.y - y) < 16).sort((a, b) => b.front - a.front)[0];
    canvas.setPointerCapture(e.pointerId);
    if (hit) { active = hit.i; drag = { light: true, front: hit.front }; renderPanel(); }
    else drag = { view: true, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!drag) { canvas.style.cursor = markerScreens.some(m => Math.hypot(m.x - x, m.y - y) < 16) ? 'grab' : 'move'; return; }
    if (drag.light) { edit(unproject(x, y, drag.front)); return; }
    if (drag.view) { yaw += (e.clientX - drag.x) * .008; pitch = clamp(pitch + (e.clientY - drag.y) * .008, -0.2, 1.35); drag.x = e.clientX; drag.y = e.clientY; drawDome(); }
  });
  const endDrag = () => { if (drag?.light) renderPanel(); drag = null; };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

  // ------------------------------------------------------------------ tabs and cards
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
      else if (k === 'style') n.style.cssText = v; else if (k in n && k !== 'list') n[k] = v; else n.setAttribute(k, v);
    }
    n.append(...kids.filter(k => k != null)); return n;
  }
  function describe(l) {
    return `${DIRECTIONS_PT[directionIndex(l.azimuth)]} · ${ALTITUDE_PT[altitudeBand(l.elevation)]}`;
  }
  function lightsTab() {
    const l = shown(), kind = LIGHT_TYPES[l.type];
    const dial = el('canvas', { className: 'dial', tabIndex: 0, role: 'slider', 'aria-label': 'Azimute da luz', 'aria-valuemin': -180, 'aria-valuemax': 180, 'aria-valuenow': l.azimuth });
    const drawDial = () => {
      const g = dial.getContext('2d'), dpr = devicePixelRatio || 1; dial.width = 74 * dpr; dial.height = 74 * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#1b1922'; g.strokeStyle = '#3b3846'; g.beginPath(); g.arc(37, 37, 31, 0, 7); g.fill(); g.stroke();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(37 + Math.sin(a) * 25, 37 + Math.cos(a) * 25); g.lineTo(37 + Math.sin(a) * 30, 37 + Math.cos(a) * 30); g.stroke(); }
      g.fillStyle = '#9f62ff'; g.fillRect(33, 64, 8, 6);
      g.fillStyle = '#9c9ba3'; g.beginPath(); g.arc(37, 37, 3, 0, 7); g.fill();
      const a = rad(l.azimuth), hex = rgbHex(lightRgb(l));
      g.strokeStyle = hex + '88'; g.lineWidth = 2; g.beginPath(); g.moveTo(37, 37); g.lineTo(37 + Math.sin(a) * 30, 37 + Math.cos(a) * 30); g.stroke();
      g.fillStyle = hex; g.strokeStyle = '#fff'; g.beginPath(); g.arc(37 + Math.sin(a) * 30, 37 + Math.cos(a) * 30, 6, 0, 7); g.fill(); g.stroke();
    };
    const dialSet = e => { const r = dial.getBoundingClientRect(); edit({ azimuth: wrapAz(deg(Math.atan2(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2))) }); drawDial(); syncNumbers(); };
    dial.addEventListener('pointerdown', e => { dial.setPointerCapture(e.pointerId); dial.dataset.drag = '1'; dialSet(e); });
    dial.addEventListener('pointermove', e => { if (dial.dataset.drag) dialSet(e); });
    dial.addEventListener('pointerup', () => { delete dial.dataset.drag; renderPanel(); });
    dial.addEventListener('keydown', e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); edit({ azimuth: wrapAz(l.azimuth + (e.key === 'ArrowRight' ? 5 : -5)) }); renderPanel(); });
    const numbers = [];
    const numberInput = (field, min, max, label) => {
      const n = el('input', { className: 'number', type: 'number', min, max, step: 1, 'aria-label': label, value: l[field],
        on: { change: () => { const v = Number(n.value); if (!Number.isFinite(v)) return; edit({ [field]: field === 'azimuth' ? wrapAz(v) : clamp(Math.round(v), min, max) }); renderPanel(); } } });
      numbers.push([n, field]); return n;
    };
    const range = (field, min, max, label, extra = {}) => {
      const r = el('input', { type: 'range', min, max, step: 1, value: l[field], 'aria-label': label, ...extra,
        on: { input: () => { edit({ [field]: Number(r.value) }); syncNumbers(); drawDial(); } } });
      return r;
    };
    const dirname = el('div', { className: 'dirname' });
    const intensityText = el('span');
    const syncNumbers = () => {
      for (const [n, f] of numbers) if (document.activeElement !== n) n.value = shown()[f];
      dirname.replaceChildren(document.createTextNode(describe(shown())), el('span', {}, `${shown().azimuth}° · ${shown().elevation}°`));
      intensityText.textContent = (shown().intensity / 10).toFixed(1);
    };
    const typeSeg = el('div', { className: 'seg', role: 'group', 'aria-label': 'Tipo de luz' },
      ...Object.entries(LIGHT_TYPES).map(([id, t]) => el('button', { type: 'button', 'aria-pressed': String(l.type === id), textContent: t.label, title: t.hint, on: { click: () => { edit({ type: id }); renderPanel(); } } })));
    const colorSeg = el('div', { className: 'seg', role: 'group', 'aria-label': 'Modo de cor' },
      ...[['kelvin', 'Kelvin'], ['hex', 'HEX']].map(([id, t]) => el('button', { type: 'button', 'aria-pressed': String(l.colorMode === id), textContent: t, on: { click: () => { edit({ colorMode: id }); renderPanel(); } } })));
    let colorBody;
    if (l.colorMode === 'kelvin') {
      const stops = [1000, 1800, 2600, 3200, 4400, 5600, 7000, 8500, 10000].map(k => `${rgbHex(kelvinRgb(k))} ${(k - 1000) / 90}%`).join(',');
      const kNum = numberInput('kelvin', 1000, 10000, 'Temperatura de cor em Kelvin'); kNum.step = 100; kNum.style.width = '52px';
      const kr = range('kelvin', 1000, 10000, 'Temperatura de cor', { step: 100 });
      colorBody = [el('div', { className: 'heading' }, el('span', {}, 'Temperatura'), el('span', {}, kNum, 'K')), el('div', { className: 'kelvin', style: `background:linear-gradient(90deg,${stops})` }), kr];
    } else {
      const picker = el('input', { type: 'color', value: l.color, 'aria-label': 'Cor da luz', on: { input: () => { edit({ color: picker.value }); hex.value = picker.value.toUpperCase(); }, change: () => renderPanel() } });
      const hex = el('input', { className: 'hex', value: l.color.toUpperCase(), 'aria-label': 'Cor HEX', spellcheck: false,
        on: { change: () => { const v = hex.value.trim().toLowerCase(); if (/^#?[0-9a-f]{6}$/.test(v)) { edit({ color: v.startsWith('#') ? v : '#' + v }); renderPanel(); } else hex.value = light().color.toUpperCase(); } } });
      colorBody = [el('div', { className: 'colorrow' }, picker, hex)];
    }
    const cards = el('div', { className: 'cards' },
      el('div', { className: 'card' }, el('div', { className: 'heading' }, el('span', {}, 'Direção'), el('span', {}, numberInput('azimuth', -180, 180, 'Azimute em graus'), '°')),
        el('div', { className: 'dirrow' }, dial, dirname),
        el('div', { className: 'heading' }, el('span', {}, 'Elevação'), el('span', {}, numberInput('elevation', -90, 90, 'Elevação em graus'), '°')),
        range('elevation', -90, 90, 'Elevação')),
      el('div', { className: 'card' }, el('div', { className: 'heading' }, el('span', {}, 'Tipo')), typeSeg, el('div', { className: 'typehint' }, kind.hint),
        el('div', { className: 'heading' }, el('span', {}, 'Intensidade'), intensityText), range('intensity', 10, 100, 'Intensidade')),
      el('div', { className: 'card' }, el('div', { className: 'heading' }, el('span', {}, 'Cor')), colorSeg, ...colorBody,
        el('div', { className: 'swatch' }, el('i', { style: `background:${rgbHex(lightRgb(l))}` }), colorName(l))));
    requestAnimationFrame(drawDial); syncNumbers();
    if (active === 0) {
      const fields = drivenFields();
      const lock = f => { for (const inp of cards.querySelectorAll(`input[aria-label]`)) if ((f === 'azimuth' && /Azimute/.test(inp.getAttribute('aria-label'))) || (f === 'elevation' && /Elevação/.test(inp.getAttribute('aria-label'))) || (f === 'intensity' && /Intensidade/.test(inp.getAttribute('aria-label'))) || (f === 'kelvin' && /Temperatura|Cor|Kelvin/.test(inp.getAttribute('aria-label')))) { inp.disabled = true; inp.title = 'Vem do grafo'; } };
      fields.forEach(lock);
      if (fields.includes('azimuth')) { dial.style.pointerEvents = 'none'; dial.style.opacity = '.55'; }
      if (fields.includes('kelvin')) for (const b of cards.querySelectorAll('.seg[aria-label="Modo de cor"] button')) b.disabled = true;
      if (fields.length) cards.prepend(el('div', { className: 'drivenbar' }, `Luz 1 conduzida pelo grafo: ${fields.map(f => FIELD_PT[f]).join(', ')}. ${resolved ? 'Mostrando o valor da última execução.' : 'O valor aparece depois de rodar.'}`));
    }
    return cards;
  }
  function colorName(l) {
    if (l.colorMode === 'kelvin') {
      const k = l.kelvin;
      return k < 2000 ? 'âmbar de vela' : k < 2800 ? 'tungstênio laranja' : k < 3600 ? 'tungstênio quente' : k < 4800 ? 'neutro quente'
        : k < 6000 ? 'luz do dia' : k < 7500 ? 'dia frio' : k < 9000 ? 'azul frio' : 'azul profundo';
    }
    return l.color.toUpperCase();
  }
  function thumb(p) {
    if (!thumbCache.has(p.id)) {
      const c = document.createElement('canvas'), n = Math.round(52 * Math.min(devicePixelRatio || 1, 2)); c.width = c.height = n;
      paintBall(c.getContext('2d'), p.lights, p.background, 'sphere', 0, 0, n, n, { fraction: 0.9 });
      thumbCache.set(p.id, c);
    }
    const c = document.createElement('canvas'), src = thumbCache.get(p.id); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c;
  }
  function presetsTab() {
    const filters = el('div', { className: 'filters', role: 'group', 'aria-label': 'Filtrar presets' },
      ...[['all', 'Todos'], ['portrait', 'Retrato'], ['product', 'Produto']].map(([id, t]) => el('button', { type: 'button', 'aria-pressed': String(filter === id), textContent: t, on: { click: () => { filter = id; renderPanel(); } } })));
    const grid = el('div', { className: 'presets' }, ...DATA.presets.filter(p => filter === 'all' || p.category === filter).map(p =>
      el('button', { className: 'preset', type: 'button', 'aria-pressed': String(model.preset === p.id), title: `${p.lights.length} luz(es) · ${EFFECTS[p.effect]?.prompt || ''}`,
        on: { click: () => { model = { version: 1, preset: p.id, lights: p.lights.map(l => ({ ...l })), background: p.background, effect: p.effect }; active = 0; save(); renderPanel(); } } },
        thumb(p), el('span', {}, p.label))));
    return el('div', {}, filters, grid);
  }
  function backgroundTab() {
    const text = { default: 'Mantém o cenário da foto e ilumina ele com as mesmas luzes.', black: 'Troca o fundo por estúdio preto infinito; a luz cai para o escuro.', white: 'Troca o fundo por estúdio branco, high-key, com sombra de contato suave.' };
    return el('div', { className: 'bgs' }, ...Object.entries(BACKGROUNDS).map(([id, b]) => el('button', { className: 'bgcard', type: 'button', 'aria-pressed': String(model.background === id),
      on: { click: () => { model.background = id; model.preset = null; save(); renderPanel(); } } },
      el('i', { style: id === 'default' ? 'background:linear-gradient(135deg,#556070,#9a8467)' : `background:rgb(${b.plate.join(',')})` }), el('b', {}, b.label), el('span', {}, text[id]))));
  }
  function effectsTab() {
    const note = el('div', { className: 'effectnote' });
    const current = () => model.effect === 'default' ? 'Sem atmosfera: só as luzes do plano.' : `${EFFECTS[model.effect].label}: ${EFFECTS[model.effect].prompt}.`;
    note.textContent = current();
    const grid = el('div', { className: 'effects' }, ...[{ id: 'default', label: 'Nenhuma' }, ...DATA.effects].map(e => el('button', { className: 'effect', type: 'button', 'aria-pressed': String(model.effect === e.id), textContent: e.label, title: e.prompt || '',
      on: { click: () => { model.effect = e.id; model.preset = null; save(); renderPanel(); } } })));
    return el('div', {}, grid, note);
  }
  function renderPanel() {
    for (const b of root.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    const body = { lights: lightsTab, presets: presetsTab, background: backgroundTab, effects: effectsTab }[tab]();
    $('.panel').replaceChildren(body);
    renderStrip(); render();
  }
  function renderStrip() {
    const view = lightsView(), { roles } = lightRoles(view), driven = drivenFields().length > 0;
    const chips = view.map((l, i) => el('button', { className: 'chip', type: 'button', 'aria-pressed': String(i === active), style: `color:${rgbHex(lightRgb(l))}`,
      on: { click: () => { active = i; tab = 'lights'; renderPanel(); } } }, el('i', { style: `background:${rgbHex(lightRgb(l))}` }), el('span', { style: 'color:#ddd5ea' }, `Luz ${i + 1}`), el('small', {}, ROLES_PT[roles[i]]), i === 0 && driven ? el('b', { title: 'Conduzida pelo grafo' }, 'grafo') : null));
    const add = el('button', { className: 'add', type: 'button', textContent: '+ Adicionar luz', disabled: model.lights.length >= 3,
      on: { click: () => { const [h, v] = DATA.added_lights[model.lights.length] || [0, 0]; model.lights.push({ type: 'spotlight', intensity: 60, azimuth: h, elevation: v, colorMode: 'kelvin', color: '#ffffff', kelvin: 6500 }); active = model.lights.length - 1; model.preset = null; tab = 'lights'; save(); renderPanel(); } } });
    const drop = el('button', { className: 'drop', type: 'button', textContent: '− Remover luz', disabled: model.lights.length <= 1,
      on: { click: () => { model.lights.splice(active, 1); active = Math.min(active, model.lights.length - 1); model.preset = null; save(); renderPanel(); } } });
    $('.strip').replaceChildren(...chips, add, drop);
  }
  function render() {
    drawDome(); drawBall(); paintSwitches();
    const view = lightsView(), { key, roles } = lightRoles(view), l = shown();
    $('.readout').replaceChildren(
      el('div', {}, `Luz ${active + 1} · ${ROLES_PT[roles[active]]}`),
      el('div', {}, el('span', {}, 'vem da '), describe(l)),
      el('div', {}, el('span', {}, `${LIGHT_TYPES[l.type].label.toLowerCase()} · ${(l.intensity / 10).toFixed(1)} · `), l.colorMode === 'kelvin' ? `${l.kelvin}K` : l.color.toUpperCase()),
      el('div', {}, el('span', {}, 'principal: '), `luz ${key + 1}`),
      el('div', { className: 'ltx', title: 'Frase equivalente para o LTX-2.3 Relight IC-LoRA (saída ltx_prompt)' },
        `LTX: ${ltxLookOf(view[key])} from ${['the front', 'the front-right', 'the right', 'the back-right', 'behind', 'the back-left', 'the left', 'the front-left'][directionIndex(view[key].azimuth)]}`));
    $('[data-role=preset]').textContent = model.preset ? `Preset: ${PRESETS[model.preset].label}` : 'Configuração livre';
    const hard = view.filter(x => x.type === 'spotlight'), top = Math.max(0, ...hard.map(x => x.intensity));
    const notes = [];
    if (hard.filter(x => x.intensity >= 0.8 * top).length >= 2 && new Set(hard.map(x => directionIndex(x.azimuth))).size > 1) notes.push('Duas luzes duras de força parecida: espere sombras duplas.');
    if ([3, 4, 5].includes(directionIndex(view[key].azimuth))) notes.push('A principal está atrás: rostos ficam escuros sem uma luz de frente.');
    if (view.length >= 2 && !view.some(x => [3, 4, 5].includes(directionIndex(x.azimuth)))) {
      const levels = view.map(x => x.intensity);
      if (Math.max(...levels) < 1.35 * Math.min(...levels)) notes.push('Luzes de força parecida e nenhuma atrás: pode sair chapado. Separe os papéis em vez de somar efeitos.');
    }
    if (blockedNote) notes.unshift(blockedNote);
    $('.note').textContent = notes.join(' ');
  }
  function paintSwitches() {
    const row = $('.switches'), list = switches?.() || [];
    row.style.display = list.length ? '' : 'none'; if (!list.length) return;
    row.replaceChildren(el('b', {}, 'Testes'), ...list.map(item => el('button', { className: 'sw', type: 'button', 'data-on': item.on ? '1' : '0', textContent: item.label, title: item.hint || '',
      on: { click: () => { item.toggle(); cardCache = null; renderPanel(); } } })));
  }
  function ltxLookOf(l) { // mirrors ltx_look() in relight.py, for the label only
    const i = directionIndex(l.azimuth), hard = l.type === 'spotlight', el_ = l.elevation, [r, g, b] = lightRgb(l);
    const warm = l.colorMode === 'kelvin' ? l.kelvin < 4000 : (r > b + 40 && r >= g), cool = l.colorMode === 'kelvin' ? l.kelvin > 6500 : b > r + 30;
    if ([3, 4, 5].includes(i)) return hard ? 'strong backlight with rim light' : 'soft hazy backlight';
    if (l.type === 'directionalLight' && l.intensity <= 40) return 'dim overcast light';
    if (warm && el_ < 33) return [0, 1, 7].includes(i) ? 'warm golden low front sun' : 'warm golden low side sun';
    if (hard) return el_ >= 58 ? 'hard high-angle sunlight' : (el_ < 33 && i !== 0) ? 'hard low-angle sunlight' : i === 0 ? 'frontal sunlight' : 'hard directional sunlight';
    if (warm || (l.colorMode === 'kelvin' && l.kelvin < 4800)) return 'soft warm afternoon light';
    return cool ? 'cool soft daylight' : 'soft diffused daylight';
  }

  root.addEventListener('click', e => {
    const t = e.target.closest('[data-tab],[data-action]'); if (!t || !root.contains(t)) return;
    if (t.dataset.tab) { tab = t.dataset.tab; renderPanel(); return; }
    const action = t.dataset.action;
    if (action === 'reset') { model = defaults(); active = 0; save(); renderPanel(); }
    if (action === 'image') $('input[type=file]').click();
    if (action === 'clearref') { manualImage = null; linkedSrc = ''; refreshReference(); }
  });
  $('input[type=file]').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { manualImage = img; URL.revokeObjectURL(url); refreshReference(); };
    img.onerror = () => { URL.revokeObjectURL(url); $('.error').textContent = 'Não foi possível abrir a imagem.'; };
    img.src = url;
  });
  function referenceLabel() {
    const box = $('[data-role=refsrc]'); box.replaceChildren(document.createTextNode(manualImage ? 'Foto: arquivo local' : image ? 'Foto: node conectado' : 'Foto: nenhuma · conecte a imagem em image'));
    if (manualImage) box.append(el('button', { className: 'clearref', textContent: 'usar o node', on: { click: () => { manualImage = null; linkedSrc = ''; refreshReference(); } } }));
  }
  function setImage(img) { if (image !== img) { image = img; cardCache = null; drawDome(); } referenceLabel(); }
  function refreshReference() {
    if (manualImage) { setImage(manualImage); return; }
    const src = linkedImage?.() || '';
    if (src !== linkedSrc) {
      linkedSrc = src; linkedImg = null;
      if (src) { const img = new Image(); img.onload = () => { if (disposed || linkedSrc !== src) return; linkedImg = img; setImage(img); }; img.onerror = () => { if (!disposed && linkedSrc === src) setImage(null); }; img.src = src; }
      else setImage(null);
      return;
    }
    setImage(linkedImg);
  }
  let lastSig = null;
  function sync() {
    const raw = read(), sig = (drivenInputs?.() || []).join(',');
    // The widget callback echoes every write back here. Rebuilding the tab on that echo destroyed the slider
    // being dragged, so a drag only registered as a click. Rebuild only when something changed from outside.
    if (raw === lastRaw && sig === lastSig) { schedule(); return; }
    lastSig = sig;
    if (raw !== lastRaw) {
      try { model = normalizeLighting(raw); lastRaw = raw; active = Math.min(active, model.lights.length - 1); $('.error').textContent = ''; }
      catch (err) { $('.error').textContent = `Iluminação inválida: ${err.message || 'JSON malformado'}. Corrija o JSON ou use Reiniciar.`; return; }
    }
    renderPanel();
  }
  const observer = new ResizeObserver(() => schedule()); observer.observe(canvas);
  sync(); refreshReference(); poll = setInterval(refreshReference, 1200);
  return {
    element: root,
    sync() { sync(); refreshReference(); language.sync(); locale.apply(); },
    reflect(data) { resolved = data && data.driven && data.driven.length ? data.light : null; renderPanel(); },
    destroy() { locale.destroy(); disposed = true; clearInterval(poll); cancelAnimationFrame(frame); observer.disconnect(); },
  };
}
