// Motion engine: deterministic frame renderer. renderFrame(f) draws frame f to #c.
// Every scene is a function of time; scenes with simulation state reset on their first frame,
// so render workers can start at any scene boundary.

const W = 1920, H = 1080, FPS = 60, BPM = 128;
const BEAT = 60 / BPM, BAR = BEAT * 4, SCN = BAR * 2;
const TOTAL = 30, FRAMES = TOTAL * FPS;
const TAU = Math.PI * 2;

const C = {
  bg: '#05060b', o: '#ff4d1c', c: '#19e3ff', m: '#ff2bd6', y: '#ffd23f', w: '#f4f1ea', k: '#05060b',
};
const FONT = 'Inter';
const MONO = '"DejaVu Sans Mono", monospace';

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const fract = x => x - Math.floor(x);
const E = {
  lin: t => t,
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * TAU / 3) + 1),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inQuart: t => t * t * t * t,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());

// Improved Perlin noise 3D
const PERM = (() => {
  const r = rng(1337), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return new Uint8Array([...p, ...p]);
})();
function grad(h, x, y, z) {
  const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}
function noise(x, y, z = 0) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
  const P = PERM, A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(
    lerp(lerp(grad(P[AA] & 15, x, y, z), grad(P[BA] & 15, x - 1, y, z), u),
      lerp(grad(P[AB] & 15, x, y - 1, z), grad(P[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad(P[AA + 1] & 15, x, y, z - 1), grad(P[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(grad(P[AB + 1] & 15, x, y - 1, z - 1), grad(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}

// beat envelope: 1 on each beat, decaying
const beatEnv = (t, k = 8) => Math.exp(-fract(t / BEAT) * BEAT * k);

// ---------- canvases ----------
function mk(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const out = document.getElementById('c');
const octx = out.getContext('2d');
const scene = mk(), g = scene.getContext('2d');
const layer = mk(), lg = layer.getContext('2d');
const trail = mk(), tg = trail.getContext('2d');
const small = mk(W / 4, H / 4), smg = small.getContext('2d');
const tmp = mk(), tmg = tmp.getContext('2d');
const vign = mk(); {
  const v = vign.getContext('2d');
  const gr = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.75)');
  v.fillStyle = gr; v.fillRect(0, 0, W, H);
}

let FX;
function resetFX() { FX = { shake: 0, ca: 0, glitch: 0, flash: 0, flashColor: '255,255,255', bloom: 0.55, hud: 1 }; }

// ---------- helpers ----------
function font(px, weight = 900, fam = FONT) { return `${weight} ${px}px ${fam}`; }
function clear(ctx, col = C.bg) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
function textPoints(str, px, n, seed, weight = 900, spacing = 0) {
  const c = mk(), x = c.getContext('2d');
  x.font = font(px, weight); x.textAlign = 'center'; x.textBaseline = 'middle';
  if (spacing) x.letterSpacing = spacing + 'px';
  x.fillStyle = '#fff'; x.fillText(str, W / 2, H / 2);
  const d = x.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 3) for (let xx = 0; xx < W; xx += 3) if (d[(y * W + xx) * 4 + 3] > 128) pts.push([xx, y]);
  const r = rng(seed);
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  const res = [];
  for (let i = 0; i < n; i++) res.push(pts[i % pts.length]);
  return res;
}
// draw a word letter by letter; fn(i, n, ch) -> {dx,dy,s,a,rot,col}
function letters(ctx, str, cx, cy, px, fn, weight = 900, spacing = 0) {
  ctx.font = font(px, weight); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const ws = [...str].map(ch => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + spacing * (str.length - 1);
  let x = cx - total / 2;
  [...str].forEach((ch, i) => {
    const o = fn(i, str.length, ch) || {};
    ctx.save();
    ctx.translate(x + ws[i] / 2 + (o.dx || 0), cy + px * 0.36 + (o.dy || 0));
    if (o.rot) ctx.rotate(o.rot);
    const s = o.s ?? 1; ctx.scale(s, o.sy ?? s);
    ctx.globalAlpha = clamp(o.a ?? 1);
    ctx.fillStyle = o.col || ctx.fillStyle;
    if (o.stroke) { ctx.strokeStyle = o.col; ctx.lineWidth = o.stroke; ctx.strokeText(ch, -ws[i] / 2, 0); }
    else ctx.fillText(ch, -ws[i] / 2, 0);
    ctx.restore();
    x += ws[i] + spacing;
  });
  return total;
}
function glowDot(ctx, x, y, r, col, a = 1) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.25, `rgba(${col},${a * 0.45})`); gr.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
const RGB = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hex2rgb(v)]));
function typeText(str, p) { const n = Math.floor(str.length * clamp(p)); return str.slice(0, n) + (p > 0 && p < 1 ? '▌' : ''); }
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=<>/\\';

// 3D
function rot3(p, ax, ay, az = 0) {
  let [x, y, z] = p;
  let c = Math.cos(ax), s = Math.sin(ax); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ay); s = Math.sin(ay); [x, z] = [x * c + z * s, -x * s + z * c];
  if (az) { c = Math.cos(az); s = Math.sin(az); [x, y] = [x * c - y * s, x * s + y * c]; }
  return [x, y, z];
}
function proj(p, f = 900, cz = 3.4, cx = W / 2, cy = H / 2) {
  const z = p[2] + cz; const k = f / Math.max(0.05, z);
  return [cx + p[0] * k, cy + p[1] * k, z, k];
}
