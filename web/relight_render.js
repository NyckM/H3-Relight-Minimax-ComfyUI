// Same arithmetic as render_ball() and the direction helpers in relight.py, so the preview in the
// panel is the image the node will send as <Picture 2>. tests/parity.mjs checks the two agree.
// Free of ComfyUI imports so it runs in the node test and in preview.html.
import { DATA } from './relight_data.js';

export { DATA };
export const LIGHT_TYPES = DATA.light_types;
export const BACKGROUNDS = DATA.backgrounds;
export const DIRECTIONS = ['the front', 'the front-right', 'the right', 'the back-right', 'behind', 'the back-left',
  'the left', 'the front-left'];
export const DIRECTIONS_PT = ['frente', 'frente-direita', 'direita', 'trás-direita', 'trás', 'trás-esquerda',
  'esquerda', 'frente-esquerda'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function kelvinRgb(kelvin) {
  const table = DATA.kelvin_table;
  const k = clamp(kelvin, table[0][0], table[table.length - 1][0]);
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i], b = table[i + 1];
    if (k >= a[0] && k <= b[0]) {
      const u = b[0] === a[0] ? 0 : (k - a[0]) / (b[0] - a[0]);
      return [1, 2, 3].map(j => Math.floor(a[j] + (b[j] - a[j]) * u + 0.5));
    }
  }
  return table[table.length - 1].slice(1);
}

export function lightRgb(light) {
  if (light.colorMode === 'kelvin') return kelvinRgb(light.kelvin);
  const hex = light.color;
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}

export const rgbHex = rgb => '#' + rgb.map(c => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('');

const toLinear = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = x => { x = clamp(x, 0, 1); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; };

export function lightDirection(azimuth, elevation) {
  const a = azimuth * Math.PI / 180, e = elevation * Math.PI / 180;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
}

export function lightStrength(light) {
  return (light.intensity / 100 * 3.2 + 0.3) * LIGHT_TYPES[light.type].factor * 0.55;
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Returns a Float32Array of width*height*3 values in 0..1, row-major, like the numpy render. */
export function renderBallFloat(lights, background = 'default', style = 'sphere', width = 256, height = 256, opts = {}) {
  width = Math.max(1, width | 0); height = Math.max(1, height | 0);
  const bg = BACKGROUNDS[background] || BACKGROUNDS.default;
  const sun = style === 'sun';
  const pitch = (sun ? 25 : 0) * Math.PI / 180;
  const fraction = opts.fraction || (sun ? 0.36 : 0.46);
  const [cx, cy] = opts.center || (sun ? [0.5, 0.38] : [0.5, 0.5]);
  const plate = opts.plate || (sun ? [173, 173, 173] : bg.plate);
  const s = 2 / (fraction * Math.min(width, height));
  const d = [0, -Math.sin(pitch), -Math.cos(pitch)];
  const up = [0, Math.cos(pitch), -Math.sin(pitch)];
  const view = [-d[0], -d[1], -d[2]];
  const sphereY = sun ? 1.08 : 0;
  const ground = bg.ground.map(toLinear);
  const used = lights.slice(0, 3).map(light => {
    const kind = LIGHT_TYPES[light.type];
    const L = lightDirection(light.azimuth, light.elevation);
    const color = lightRgb(light).map(toLinear);
    const power = lightStrength(light);
    const hv = [L[0] + view[0], L[1] + view[1], L[2] + view[2]];
    const hn = Math.max(Math.hypot(...hv), 1e-9);
    const back = Math.max(0, -dot(L, view));
    const fl = [L[0] - dot(L, view) * view[0], L[1] - dot(L, view) * view[1], L[2] - dot(L, view) * view[2]];
    const fn = Math.hypot(...fl);
    const flat = fn > 1e-3 ? fl.map(x => x / fn) : null;
    return { kind, L, color, power, half: hv.map(x => x / hn), back, flat };
  });
  const weightsRaw = used.map(x => x.power), wsum = Math.max(weightsRaw.reduce((a, b) => a + b, 0), 1e-9);
  const out = new Float32Array(width * height * 3);
  const plateF = plate.map(c => c / 255);
  for (let j = 0; j < height; j++) {
    const v = -((j + 0.5) - cy * height) * s;
    for (let i = 0; i < width; i++) {
      const u = ((i + 0.5) - cx * width) * s;
      const r2 = u * u + v * v, r = Math.sqrt(r2);
      const coverage = clamp((1 - r) / s + 0.5, 0, 1);
      const o = (j * width + i) * 3;
      let base0 = plateF[0], base1 = plateF[1], base2 = plateF[2];
      let ball = null;
      if (coverage > 0 || (!sun && r > 1 && r < 2.5)) {
        const depth = Math.sqrt(clamp(1 - Math.min(r2, 0.9999), 0, 1));
        let n = [u, v * up[1] + depth * view[1], v * up[2] + depth * view[2]];
        const nn = Math.hypot(...n); n = n.map(x => x / nn);
        const hemi = (n[1] + 1) / 2;
        const ls = [0, 1, 2].map(c => bg.ambient + bg.hemisphere * (ground[c] + (1 - ground[c]) * hemi));
        const sp = [0, 0, 0];
        const ndv = clamp(dot(n, view), 0, 1);
        const outside = Math.max(r - 1, 0);
        for (const x of used) {
          const ndl = dot(n, x.L);
          const diffuse = Math.max(0, (ndl + x.kind.wrap) / (1 + x.kind.wrap));
          for (let c = 0; c < 3; c++) ls[c] += x.power * diffuse * x.color[c];
          if (x.kind.spec > 0) {
            const spec = x.kind.spec * Math.max(dot(n, x.half), 0) ** x.kind.shininess * (ndl > 0 ? 1 : 0);
            for (let c = 0; c < 3; c++) sp[c] += x.power * spec * x.color[c];
          }
        }
        for (const x of used) {
          if (x.back <= 0) continue;
          let side = 1, ringSide = 1;
          if (x.flat) {
            side = clamp(0.35 + 0.65 * dot(n, x.flat), 0, 1);
            const ring = u * x.flat[0] + v * (x.flat[0] * up[0] + x.flat[1] * up[1] + x.flat[2] * up[2]);
            ringSide = clamp(0.35 + 0.65 * ring / Math.max(r, 1e-6), 0, 1);
          }
          const rim = x.back * (1 - ndv) ** 3 * side * x.kind.rim;
          for (let c = 0; c < 3; c++) sp[c] += x.power * rim * x.color[c];
          if (!sun && r > 1) {
            const glow = x.back * Math.exp(-outside * 9) * ringSide * x.kind.rim * 0.22 * x.power;
            base0 += glow * x.color[0]; base1 += glow * x.color[1]; base2 += glow * x.color[2];
          }
        }
        ball = [0, 1, 2].map(c => toSrgb(1 - Math.exp(-(0.85 * ls[c] + sp[c]))));
      }
      base0 = clamp(base0, 0, 1); base1 = clamp(base1, 0, 1); base2 = clamp(base2, 0, 1);
      if (sun) {
        const originY = sphereY + v * up[1] - 10 * d[1];
        const t = originY / -d[1];
        const gx = u, gz = v * up[2] - 10 * d[2] + t * d[2];
        let darkness = 0;
        used.forEach((x, k) => {
          if (x.L[1] <= 0.02) return;
          const vx = -gx, vy = sphereY, vz = -gz;
          const along = vx * x.L[0] + vy * x.L[1] + vz * x.L[2];
          const dist = Math.sqrt(Math.max((vx - along * x.L[0]) ** 2 + (vy - along * x.L[1]) ** 2 + (vz - along * x.L[2]) ** 2, 0));
          const soft = x.kind.penumbra * (0.25 + Math.max(along, 0) * 0.35) + 0.02;
          const edge = clamp((1 + soft - dist) / (2 * soft), 0, 1);
          const shadow = edge * edge * (3 - 2 * edge) * (along > 0 ? 1 : 0);
          darkness = Math.max(darkness, shadow * x.kind.shadow * (0.45 + 0.55 * weightsRaw[k] / wsum));
        });
        const f = 1 - 0.72 * darkness;
        base0 *= f; base1 *= f; base2 *= f;
      }
      if (ball && coverage > 0) {
        out[o] = base0 + (ball[0] - base0) * coverage;
        out[o + 1] = base1 + (ball[1] - base1) * coverage;
        out[o + 2] = base2 + (ball[2] - base2) * coverage;
      } else { out[o] = base0; out[o + 1] = base1; out[o + 2] = base2; }
    }
  }
  return out;
}

// Sphere-Light-Render's scene, mirrored from render_venti() in relight.py: perspective camera, fov 35, at (0, 6, 8)
// looking at (0, -0.5, 0); #cccccc sphere of radius 1 on a #8a8a8a plane at y = -1; ambient 0.2; no tone mapping.
const EYE = [0, 6, 8], TARGET = [0, -0.5, 0], FOV = 35;
export function ventiCamera() {
  const f = [TARGET[0] - EYE[0], TARGET[1] - EYE[1], TARGET[2] - EYE[2]], fn = Math.hypot(...f);
  const forward = f.map(x => x / fn);
  return { forward, right: [1, 0, 0], up: [0, -forward[2], forward[1]], th: Math.tan(FOV / 2 * Math.PI / 180) };
}
export function ventiRay(px, py, width, height) {
  const { forward, right, up, th } = ventiCamera();
  const x = (px / width * 2 - 1) * th * (width / height), y = (1 - py / height * 2) * th;
  const d = [0, 1, 2].map(i => forward[i] + x * right[i] + y * up[i]), n = Math.hypot(...d);
  return d.map(v => v / n);
}
export function renderVentiFloat(lights, width = 512, height = 512) {
  width = Math.max(1, width | 0); height = Math.max(1, height | 0);
  const { th } = ventiCamera(), cc = dot(EYE, EYE), pixel = 2 * th / height * Math.sqrt(cc);
  const sphereAlb = toLinear(204), planeAlb = toLinear(138);
  const used = lights.slice(0, 3).map(l => ({ kind: LIGHT_TYPES[l.type], L: lightDirection(l.azimuth, l.elevation),
    color: lightRgb(l).map(toLinear), power: l.intensity / 100 * 3 }));
  const out = new Float32Array(width * height * 3);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const d = ventiRay(i + 0.5, j + 0.5, width, height);
    const b = dot(d, EYE), closest = Math.sqrt(Math.max(cc - b * b, 0));
    const coverage = clamp((1 - closest) / pixel + 0.5, 0, 1) * (b < 0 ? 1 : 0);
    const t = -b - Math.sqrt(Math.max(b * b - cc + 1, 0));
    let n = [EYE[0] + t * d[0], EYE[1] + t * d[1], EYE[2] + t * d[2]]; const nn = Math.hypot(...n); n = n.map(x => x / nn);
    const tp = (-1 - EYE[1]) / d[1], P = [EYE[0] + tp * d[0], -1, EYE[2] + tp * d[2]];
    const sph = [0.2, 0.2, 0.2], pl = [0.2, 0.2, 0.2], sp = [0, 0, 0], view = [-d[0], -d[1], -d[2]];
    for (const x of used) {
      const ndl = Math.max(dot(n, x.L), 0);
      const h = [x.L[0] + view[0], x.L[1] + view[1], x.L[2] + view[2]], hn = Math.hypot(...h);
      const spec = x.power * 0.05 * Math.max(dot(n, h) / hn, 0) ** 6 * (ndl > 0 ? 1 : 0);
      for (let c = 0; c < 3; c++) { sph[c] += x.power * ndl * x.color[c]; sp[c] += spec * x.color[c]; }
      if (x.L[1] > 0) {
        const v = [-P[0], -P[1], -P[2]], along = dot(v, x.L);
        const dist = Math.hypot(v[0] - along * x.L[0], v[1] - along * x.L[1], v[2] - along * x.L[2]);
        const soft = 0.02 + 0.08 * x.kind.penumbra * Math.max(along, 0);
        const e = clamp((1 + soft - dist) / (2 * soft), 0, 1), lit = 1 - e * e * (3 - 2 * e) * (along > 0 ? 1 : 0);
        for (let c = 0; c < 3; c++) pl[c] += x.power * x.L[1] * lit * x.color[c];
      }
    }
    const o = (j * width + i) * 3;
    for (let c = 0; c < 3; c++) {
      const s = toSrgb(sphereAlb * sph[c] + sp[c]), p = toSrgb(planeAlb * pl[c]);
      out[o + c] = p + (s - p) * coverage;
    }
  }
  return out;
}

/** Draws the ball into a canvas 2D context at (x, y). */
export function paintBall(ctx, lights, background, style, x, y, width, height, opts) {
  const f = style === 'venti' ? renderVentiFloat(lights, width, height) : renderBallFloat(lights, background, style, width, height, opts);
  const img = ctx.createImageData(width, height);
  for (let p = 0, q = 0; p < f.length; p += 3, q += 4) {
    img.data[q] = f[p] * 255 + 0.5; img.data[q + 1] = f[p + 1] * 255 + 0.5; img.data[q + 2] = f[p + 2] * 255 + 0.5;
    img.data[q + 3] = 255;
  }
  ctx.putImageData(img, x, y);
}

export const directionIndex = az => Math.floor((((az % 360) + 360) % 360 + 22.5) / 45) % 8;
export const directionPhrase = az => DIRECTIONS[directionIndex(az)];
export function altitudeBand(el) {
  if (el <= -15) return 'from below';
  if (el < 33) return 'low';
  if (el < 58) return 'mid';
  if (el < 80) return 'high';
  return 'overhead';
}
export const ALTITUDE_PT = { 'from below': 'de baixo', low: 'baixa', mid: 'média', high: 'alta', overhead: 'zenital' };

/** Key is the strongest light; lights behind are rims; the rest fill or second key. Mirrors light_roles(). */
export function lightRoles(lights) {
  const order = lights.map((_, i) => i).sort((a, b) => (lights[b].intensity - lights[a].intensity) || (a - b));
  const key = order[0], roles = {};
  lights.forEach((l, i) => {
    const back = [3, 4, 5].includes(directionIndex(l.azimuth));
    if (i === key) roles[i] = back && lights.length === 1 ? 'backlight key' : 'key light';
    else if (back) roles[i] = 'rim light';
    else if (l.intensity >= 0.8 * lights[key].intensity) roles[i] = 'second key light';
    else roles[i] = 'fill light';
  });
  return { key, roles };
}
export const ROLES_PT = { 'key light': 'principal', 'backlight key': 'contraluz principal', 'rim light': 'recorte',
  'second key light': 'segunda principal', 'fill light': 'preenchimento' };
