// Eight scenes, two bars each (3.75 s at 128 BPM). Signature: (lt, t, first) where lt is scene-local time.

// ============ 01 IGNITION: singularity -> explosion -> particles assemble into a word ============
const S1 = (() => {
  const N = 2600, TE = BEAT * 2;
  let P = null;
  const stars = (() => { const r = rng(3); return Array.from({ length: 220 }, () => [r() * W, r() * H, r() * 1.6 + 0.3, r()]); })();
  const suck = (() => { const r = rng(4); return Array.from({ length: 260 }, () => ({ a: r() * TAU, R: 300 + r() * 900, st: r() * 0.55 })); })();
  function init() {
    const r = rng(11), tgt = textPoints('MOTION', 310, N, 5, 900, 10);
    P = tgt.map(([tx, ty]) => ({
      a: r() * TAU, sp: 220 + Math.pow(r(), 0.7) * 1300, tx, ty,
      ta: 1.3 + r() * 0.5 + (tx / W) * 0.3, sw: (r() - 0.5) * 520, grp: r() < 0.45 ? 0 : r() < 0.6 ? 1 : 2,
    }));
  }
  function pos(p, t) {
    if (t < TE) return [W / 2, H / 2];
    const e = 1 - Math.exp(-3.2 * (t - TE));
    let x = W / 2 + Math.cos(p.a) * p.sp * e, y = H / 2 + Math.sin(p.a) * p.sp * e * 0.72;
    x += noise(p.a * 3, t * 0.7) * 50; y += noise(p.a * 3 + 9, t * 0.7) * 50;
    const k = E.inOutCubic(inv(p.ta, p.ta + 0.85, t));
    if (k > 0) {
      const sw = Math.sin(k * Math.PI) * p.sw;
      x = lerp(x, p.tx, k) + sw * Math.sin(p.a); y = lerp(y, p.ty, k) + sw * Math.cos(p.a) * 0.5;
    }
    return [x, y];
  }
  return function (lt) {
    if (!P) init();
    clear(g);
    // stars
    g.globalCompositeOperation = 'lighter';
    for (const [x, y, s, ph] of stars) {
      g.globalAlpha = (0.25 + 0.25 * Math.sin(lt * 3 + ph * 20)) * (lt > TE ? 1 : 0.5);
      g.fillStyle = C.w; g.fillRect((x + lt * 12 * s) % W, y, s, s);
    }
    g.globalAlpha = 1;
    if (lt < TE) {
      // the singularity
      const grow = E.outCubic(inv(0.05, 0.8, lt)), imp = 1 - E.inExpo(inv(TE - 0.16, TE, lt));
      const r0 = (2 + 7 * grow * (1 + 0.25 * Math.sin(lt * 40))) * imp;
      g.save(); g.translate(W / 2, H / 2); g.scale(1, 0.018);
      glowDot(g, 0, 0, W * 0.45 * grow * imp, RGB.c, 0.7);
      g.restore();
      glowDot(g, W / 2, H / 2, 160 * grow * imp, RGB.o, 0.5);
      g.fillStyle = C.w; g.beginPath(); g.arc(W / 2, H / 2, r0, 0, TAU); g.fill();
      g.strokeStyle = C.w; g.lineWidth = 1.5; g.beginPath();
      for (const s of suck) {
        const k = inv(s.st, TE, lt); if (k <= 0 || k >= 1) continue;
        const d1 = s.R * (1 - E.inCubic(k)), d2 = s.R * (1 - E.inCubic(Math.max(0, k - 0.06)));
        g.moveTo(W / 2 + Math.cos(s.a) * d1, H / 2 + Math.sin(s.a) * d1);
        g.lineTo(W / 2 + Math.cos(s.a) * d2, H / 2 + Math.sin(s.a) * d2);
      }
      g.globalAlpha = 0.6; g.stroke(); g.globalAlpha = 1;
      FX.ca = 4 * inv(TE - 0.3, TE, lt);
    } else {
      const q = lt - TE;
      FX.flash = 0.95 * Math.exp(-q * 7); FX.ca = 26 * Math.exp(-q * 4); FX.shake = 34 * Math.exp(-q * 6);
      // light leaks
      glowDot(g, W * 0.15 + q * 60, H * 0.2, 900, RGB.o, 0.22 * Math.exp(-q * 0.8));
      glowDot(g, W * 0.85 - q * 60, H * 0.85, 900, RGB.c, 0.18 * Math.exp(-q * 0.8));
      // shockwaves
      [1500, 1050, 700].forEach((R, i) => {
        const k = E.outExpo(inv(i * 0.05, 1.3 + i * 0.1, q));
        if (k <= 0 || k >= 1) return;
        g.strokeStyle = i === 1 ? C.o : C.w; g.globalAlpha = (1 - k) * 0.9; g.lineWidth = 2 + 26 * (1 - k);
        g.beginPath(); g.ellipse(W / 2, H / 2, R * k, R * k * 0.72, 0, 0, TAU); g.stroke();
      });
      g.globalAlpha = 1;
      // particles with motion-blur streaks
      const pa = 1 - inv(2.6, 3.05, lt) * 0.9;
      const cols = [C.o, C.w, C.c];
      g.lineCap = 'round'; g.lineWidth = 2.4;
      for (let grp = 0; grp < 3; grp++) {
        g.strokeStyle = cols[grp]; g.globalAlpha = pa; g.beginPath();
        for (const p of P) {
          if (p.grp !== grp) continue;
          const a = pos(p, lt), b = pos(p, lt - 0.03);
          g.moveTo(b[0], b[1]); g.lineTo(a[0] + 0.5, a[1] + 0.5);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';
    // solid wordmark + subtitle on a layer (so it can be sliced on exit)
    const ta = E.outCubic(inv(2.3, 2.75, lt));
    if (ta > 0) {
      lg.clearRect(0, 0, W, H);
      lg.font = font(310); lg.letterSpacing = '10px'; lg.textAlign = 'center'; lg.textBaseline = 'middle';
      lg.fillStyle = C.w; lg.globalAlpha = ta; lg.fillText('MOTION', W / 2, H / 2);
      lg.globalAlpha = 1; lg.letterSpacing = '0px';
      // scan bar through the letters
      lg.globalCompositeOperation = 'source-atop';
      const sx = lerp(-400, W + 400, E.inOutCubic(inv(2.35, 3.0, lt)));
      const gr = lg.createLinearGradient(sx - 250, 0, sx + 250, 0);
      gr.addColorStop(0, 'rgba(255,77,28,0)'); gr.addColorStop(0.5, 'rgba(255,77,28,1)'); gr.addColorStop(1, 'rgba(255,77,28,0)');
      lg.fillStyle = gr; lg.fillRect(0, 0, W, H);
      lg.globalCompositeOperation = 'source-over';
      const sp = inv(2.45, 2.95, lt);
      lg.font = font(22, 500, MONO); lg.letterSpacing = '12px'; lg.fillStyle = C.c;
      lg.fillText(typeText('A 30-SECOND STUDY IN PURE CODE', sp), W / 2, H / 2 + 205);
      lg.letterSpacing = '0px';
      const lw = 420 * E.outExpo(inv(2.45, 3.0, lt));
      lg.fillStyle = C.o; lg.fillRect(W / 2 - 560 - lw / 2 + 210, H / 2 + 204, lw, 2); lg.fillRect(W / 2 + 560 - lw / 2 - 210, H / 2 + 204, lw, 2);
      // exit: horizontal slices fly apart
      const n = 16, sh = H / n;
      for (let i = 0; i < n; i++) {
        const k = E.inExpo(inv(2.98 + (i % 4) * 0.04, 3.72, lt));
        const dx = (i % 2 ? 1 : -1) * k * W * (0.8 + ((i * 0.37) % 1));
        g.drawImage(layer, 0, i * sh, W, sh, dx, i * sh, W, sh);
      }
      FX.glitch = E.inCubic(inv(2.95, 3.75, lt)) * 0.9;
      FX.ca = Math.max(FX.ca, 18 * inv(2.95, 3.75, lt));
    }
  };
})();

// ============ 02 KINETIC TYPE: a new idea on every beat ============
const S2 = (() => {
  function withScale(cx, cy, s, fn) { g.save(); g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); fn(); g.restore(); }
  const words = [
    // DESIGN: letters rise through a mask
    bt => {
      clear(g);
      g.save(); g.beginPath(); g.rect(0, H / 2 - 190, W, 360); g.clip();
      g.fillStyle = C.w;
      letters(g, 'DESIGN', W / 2, H / 2, 290, i => {
        const d = i * 0.028, k = E.outBack(inv(d, d + 0.3, bt));
        return { dy: (1 - k) * 340, col: C.w };
      }, 900, 6);
      g.restore();
      const lw = 1200 * E.outExpo(inv(0.05, 0.4, bt));
      g.fillStyle = C.o; g.fillRect(W / 2 - lw / 2, H / 2 + 185, lw, 8);
    },
    // IN: circular wipe to orange
    bt => {
      clear(g);
      g.fillStyle = C.o; g.beginPath(); g.arc(W / 2, H / 2, 1200 * E.outExpo(inv(0, 0.3, bt)), 0, TAU); g.fill();
      withScale(W / 2, H / 2, lerp(1.7, 1, E.outExpo(inv(0, 0.35, bt))), () => {
        g.fillStyle = C.k; letters(g, 'IN', W / 2, H / 2, 680, () => ({ col: C.k }), 900, -10);
      });
      FX.bloom = 0.15;
    },
    // MOTION: echo tunnel of outlines
    bt => {
      clear(g);
      g.font = font(250); g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '8px';
      for (let k = 12; k >= 1; k--) {
        const s = 1 + k * 0.13 + bt * 0.9;
        g.save(); g.translate(W / 2, H / 2); g.scale(s, s);
        g.strokeStyle = k % 2 ? C.o : C.c; g.globalAlpha = (1 - k / 12) * 0.7; g.lineWidth = 2.2 / s;
        g.strokeText('MOTION', 0, 0); g.restore();
      }
      g.globalAlpha = 1;
      const s = lerp(0.85, 1, E.outExpo(inv(0, 0.3, bt)));
      g.save(); g.translate(W / 2, H / 2); g.scale(s, s); g.fillStyle = C.w; g.fillText('MOTION', 0, 0); g.restore();
      g.letterSpacing = '0px';
    },
    // EVERY / FRAME: masked line reveals on white
    bt => {
      clear(g, C.w);
      FX.bloom = 0.08;
      [['EVERY', C.k, -125, 0], ['FRAME', C.o, 125, 0.07]].forEach(([w, col, oy, d]) => {
        g.save(); g.beginPath(); g.rect(0, H / 2 + oy - 115, W, 230); g.clip();
        const k = E.outExpo(inv(d, d + 0.32, bt));
        g.fillStyle = col; letters(g, w, W / 2, H / 2 + oy + (1 - k) * 240, 235, () => ({ col }), 900, 4);
        g.restore();
      });
      g.fillStyle = C.k;
      const lw = W * E.outExpo(inv(0, 0.35, bt));
      g.fillRect(0, H / 2 - 2, lw, 4); g.fillRect(W - lw, H / 2 - 247, lw, 2); g.fillRect(W - lw, H / 2 + 245, lw, 2);
      g.font = font(18, 600, MONO); g.textAlign = 'left'; g.fillText('FIG. 04 — TIMING', 80, H / 2 - 265);
      g.textAlign = 'right'; g.fillText('1/60 s', W - 80, H / 2 + 275);
    },
    // COUNTS: marquee wall on cyan
    (bt, lt) => {
      clear(g, C.c);
      FX.bloom = 0.1;
      g.font = font(132); g.textBaseline = 'middle'; g.textAlign = 'left';
      const unit = 'COUNTS — ', uw = g.measureText(unit).width;
      for (let i = 0; i < 8; i++) {
        const dir = i % 2 ? 1 : -1, y = 70 + i * 135;
        const entry = (1 - E.outExpo(inv(i * 0.02, i * 0.02 + 0.32, bt))) * W * dir;
        let x = ((dir * lt * 1400 + i * 211) % uw) - uw * 2 + entry;
        g.fillStyle = C.k; g.strokeStyle = C.k; g.lineWidth = 3;
        for (; x < W + uw; x += uw) i % 2 ? g.strokeText(unit, x, y) : g.fillText(unit, x, y);
      }
    },
    // 60 FPS: kinetic ring of type + counter
    bt => {
      clear(g);
      const sc = E.outBack(inv(0, 0.28, bt));
      const ring = (str, R, px, rot, col) => {
        g.font = font(px, 800); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col;
        let a = rot;
        for (const ch of str) {
          const w = g.measureText(ch).width + px * 0.12;
          a += w / R / 2;
          g.save(); g.translate(W / 2 + Math.cos(a) * R * sc, H / 2 + Math.sin(a) * R * sc); g.rotate(a + Math.PI / 2); g.scale(sc, sc);
          g.fillText(ch, 0, 0); g.restore();
          a += w / R / 2;
        }
      };
      ring('PIXEL PERFECT • PIXEL PERFECT • PIXEL PERFECT • ', 400, 48, -E.outExpo(inv(0, 0.45, bt)) * Math.PI - bt * 0.6, C.w);
      ring('SIXTY FRAMES PER SECOND • SIXTY FRAMES PER SECOND • ', 315, 26, E.outExpo(inv(0, 0.45, bt)) * Math.PI + bt * 0.8, C.c);
      g.strokeStyle = C.o; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, H / 2, 455 * sc, -Math.PI / 2, -Math.PI / 2 + TAU * E.outExpo(inv(0, 0.4, bt))); g.stroke();
      const n = Math.round(60 * E.outExpo(inv(0.02, 0.38, bt)));
      g.font = font(240); g.fillStyle = C.o; g.fillText(String(n).padStart(2, '0'), W / 2, H / 2 - 20);
      g.font = font(26, 600, MONO); g.fillStyle = C.w; g.letterSpacing = '14px'; g.fillText('FPS', W / 2 + 7, H / 2 + 110); g.letterSpacing = '0px';
    },
    // CODE = ART: decode scramble
    (bt, lt) => {
      clear(g, '#070a12');
      g.strokeStyle = 'rgba(25,227,255,0.07)'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x < W; x += 48) { g.moveTo(x, 0); g.lineTo(x, H); }
      for (let y = 0; y < H; y += 48) { g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();
      const str = 'CODE = ART';
      g.font = `bold 170px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      const cw = g.measureText('M').width, x0 = W / 2 - (cw * str.length) / 2;
      [...str].forEach((ch, i) => {
        const ti = 0.04 + i * 0.03, done = bt > ti + 0.06;
        if (bt < ti) return;
        let c = ch;
        if (!done && ch !== ' ') c = GLYPHS[(Math.floor(lt * 40) * 7 + i * 13) % GLYPHS.length];
        g.fillStyle = done ? (ch === '=' ? C.o : C.w) : C.c;
        g.fillText(c, x0 + i * cw, H / 2);
      });
      if (Math.floor(lt * 8) % 2 === 0) { g.fillStyle = C.o; g.fillRect(x0 + cw * str.length + 10, H / 2 - 75, 26, 150); }
      g.font = font(18, 500, MONO); g.fillStyle = C.c; g.globalAlpha = 0.7; g.textAlign = 'left';
      g.fillText('> render --fps 60 --frames 1800 --no-plugins', x0, H / 2 + 130); g.globalAlpha = 1;
    },
    // NO LIMITS: dive into the O
    bt => {
      clear(g);
      const str = 'NO LIMITS', px = 300;
      g.font = font(px);
      const ws = [...str].map(c => g.measureText(c).width), total = ws.reduce((a, b) => a + b, 0);
      const ox = W / 2 - total / 2 + ws[0] + ws[1] / 2, oy = H / 2;
      const s = lerp(0.82, 1, E.outExpo(inv(0, 0.12, bt))) * (1 + E.inExpo(inv(0.12, 0.47, bt)) * 90);
      g.save(); g.translate(ox, oy); g.scale(s, s); g.translate(-ox, -oy);
      g.fillStyle = C.w; letters(g, str, W / 2, H / 2, px, (i) => ({ col: i > 2 ? C.o : C.w }));
      g.restore();
      FX.ca = 12 * inv(0.25, 0.47, bt);
    },
  ];
  return function (lt) {
    const b = Math.min(7, Math.floor(lt / BEAT)), bt = lt - b * BEAT;
    words[b](bt, lt);
    FX.shake = 10 * Math.exp(-bt * 14);
    FX.ca = Math.max(FX.ca, 10 * Math.exp(-bt * 16));
  };
})();

// ============ 03 GEOMETRY: morphing parametric wireframes + HUD ============
const S3 = (() => {
  const U = 32, V = 16;
  const names = ['SPHERE', 'TORUS', 'TREFOIL KNOT', 'WAVE FIELD'];
  const knotC = s => [Math.sin(s) + 2 * Math.sin(2 * s), Math.cos(s) - 2 * Math.cos(2 * s), -Math.sin(3 * s)].map(v => v * 0.36);
  function shape(id, u, v, t) {
    const th = u * TAU;
    if (id === 0) { const ph = v * Math.PI; return [Math.sin(ph) * Math.cos(th) * 1.25, Math.cos(ph) * 1.25, Math.sin(ph) * Math.sin(th) * 1.25]; }
    if (id === 1) { const R = 1.05, r = 0.45, a = v * TAU; return [(R + r * Math.cos(a)) * Math.cos(th), r * Math.sin(a), (R + r * Math.cos(a)) * Math.sin(th)]; }
    if (id === 2) {
      const c = knotC(th), c2 = knotC(th + 0.01), c3 = knotC(th - 0.01);
      const T = c2.map((x, i) => x - c3[i]), N0 = c2.map((x, i) => x + c3[i] - 2 * c[i]);
      const nl = Math.hypot(...T); const t0 = T.map(x => x / nl);
      const dt = N0.reduce((a, x, i) => a + x * t0[i], 0); let n = N0.map((x, i) => x - dt * t0[i]); const nn = Math.hypot(...n) || 1; n = n.map(x => x / nn);
      const bn = [t0[1] * n[2] - t0[2] * n[1], t0[2] * n[0] - t0[0] * n[2], t0[0] * n[1] - t0[1] * n[0]];
      const a = v * TAU, r = 0.2;
      return c.map((x, i) => x + r * (Math.cos(a) * n[i] + Math.sin(a) * bn[i]));
    }
    const x = (u * 2 - 1) * 1.7, z = (v * 2 - 1) * 1.7;
    return [x, 0.28 * Math.sin(3 * x + t * 4) + 0.2 * Math.cos(4 * z + t * 3), z];
  }
  function hud(lt, si, ay) {
    g.globalAlpha = E.outCubic(inv(0.1, 0.5, lt)) * 0.85;
    g.strokeStyle = C.w; g.lineWidth = 2;
    const m = 70, L = 40;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
      g.beginPath(); g.moveTo(x, y + L * sy); g.lineTo(x, y); g.lineTo(x + L * sx, y); g.stroke();
    });
    g.beginPath(); g.moveTo(W / 2 - 18, H / 2); g.lineTo(W / 2 + 18, H / 2); g.moveTo(W / 2, H / 2 - 18); g.lineTo(W / 2, H / 2 + 18); g.stroke();
    g.font = font(17, 500, MONO); g.fillStyle = C.w; g.textAlign = 'left'; g.textBaseline = 'top';
    const since = lt - si * 2 * BEAT;
    g.fillStyle = C.o; g.fillText(typeText(`OBJ_0${si + 1} // ${names[si]}`, inv(0, 0.35, since)), m + 20, m + 20);
    g.fillStyle = C.w;
    g.fillText(`VERTS ${U * (V + 1)}   EDGES ${U * V * 2 + U}`, m + 20, m + 48);
    g.textAlign = 'right';
    g.fillText(`ROT.Y ${((ay * 180 / Math.PI) % 360).toFixed(2).padStart(7, '0')}°`, W - m - 20, m + 20);
    g.fillText(`MORPH ${(E.inOutExpo(inv(0, 0.7 * BEAT, since)) * 100).toFixed(0).padStart(3, '0')}%`, W - m - 20, m + 48);
    // scrolling ruler
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (let i = -2; i < 40; i++) {
      const x = i * 60 - ((lt * 240) % 60) + 100; if (x < m + 40 || x > W - m - 40) continue;
      const big = (i + Math.floor(lt * 4)) % 5 === 0;
      g.fillRect(x, H - m - (big ? 22 : 10), 1.5, big ? 22 : 10);
    }
    g.globalAlpha = 1;
  }
  return function (lt) {
    clear(g);
    const bl = lt / BEAT, si = bl < 2 ? 0 : bl < 4 ? 1 : bl < 6 ? 2 : 3;
    const mk = si > 0 ? E.inOutExpo(inv(si * 2, si * 2 + 0.7, bl)) : 1, from = Math.max(0, si - 1);
    // dot grid
    g.fillStyle = 'rgba(244,241,234,0.09)';
    for (let y = -((lt * 30) % 60); y < H; y += 60) for (let x = 0; x < W; x += 60) g.fillRect(x, y, 2, 2);
    let sc = E.outBack(inv(0, 0.5, lt)) * (1 + E.inExpo(inv(SCN - 0.5, SCN, lt)) * 14);
    const kick = beatEnv(lt, 9);
    const ay = lt * 0.85 + si * Math.PI * 0.5 + mk * Math.PI * 0.5, ax = 0.4 + 0.18 * Math.sin(lt * 1.3);
    const pts = [];
    for (let j = 0; j <= V; j++) for (let i = 0; i < U; i++) {
      const u = i / U, v = j / V;
      const a = shape(from, u, v, lt), b = shape(si, u, v, lt);
      let p = a.map((x, k) => lerp(x, b[k], mk));
      const d = 1 + 0.09 * kick * noise(u * 6, v * 6, lt);
      p = rot3(p.map(x => x * sc * d), ax, ay);
      pts.push(proj(p, 760, 4.2));
    }
    // orbit rings
    g.lineWidth = 1.5;
    [[1.9, 0.9, C.c], [2.2, -0.6, C.o]].forEach(([R, tilt, col], ri) => {
      g.strokeStyle = col; g.globalAlpha = 0.5 * E.outCubic(inv(0.2, 0.8, lt)); g.beginPath();
      for (let k = 0; k <= 96; k++) {
        const a = k / 96 * TAU, q = proj(rot3([Math.cos(a) * R * Math.min(sc, 1.2), 0, Math.sin(a) * R * Math.min(sc, 1.2)], tilt + ax, ay * 0.4 + ri), 760, 4.2);
        k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
      }
      g.stroke();
      const a = lt * (2 + ri), q = proj(rot3([Math.cos(a) * R, 0, Math.sin(a) * R], tilt + ax, ay * 0.4 + ri), 760, 4.2);
      g.globalAlpha = 1; glowDot(g, q[0], q[1], 26, ri ? RGB.o : RGB.c, 1);
    });
    g.globalAlpha = 1;
    // edges bucketed by depth
    const NB = 7, buckets = Array.from({ length: NB }, () => []);
    const zs = pts.map(p => p[2]), zmin = Math.min(...zs), zmax = Math.max(...zs) + 1e-6;
    const idx = (i, j) => j * U + ((i + U) % U);
    for (let j = 0; j <= V; j++) for (let i = 0; i < U; i++) {
      const a = idx(i, j);
      const ns = [idx(i + 1, j)]; if (j < V) ns.push(idx(i, j + 1));
      if (si === 3 && mk > 0.5 && i === U - 1) ns.shift();
      for (const b of ns) {
        const z = (pts[a][2] + pts[b][2]) / 2, bi = Math.min(NB - 1, Math.floor((z - zmin) / (zmax - zmin) * NB));
        buckets[bi].push(a, b);
      }
    }
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    const near = [255, 77, 28], far = [25, 227, 255];
    buckets.forEach((bk, bi) => {
      const k = bi / (NB - 1);
      g.strokeStyle = `rgb(${near.map((x, i) => Math.round(lerp(x, far[i], k))).join(',')})`;
      g.globalAlpha = lerp(1, 0.28, k); g.lineWidth = lerp(2.6, 0.9, k);
      g.beginPath();
      for (let n = 0; n < bk.length; n += 2) { const p = pts[bk[n]], q = pts[bk[n + 1]]; g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
      g.stroke();
    });
    g.globalAlpha = 1; g.fillStyle = C.w;
    for (const p of pts) { const s = clamp(p[3] / 260, 1, 5); g.fillRect(p[0] - s / 2, p[1] - s / 2, s, s); }
    g.globalCompositeOperation = 'source-over';
    hud(lt, si, ay);
    FX.shake = 5 * kick; FX.ca = 3 + 6 * kick + 20 * inv(SCN - 0.4, SCN, lt);
    FX.flash = 0.5 * E.inExpo(inv(SCN - 0.3, SCN, lt)); FX.flashColor = RGB.c;
  };
})();

// ============ 04 HYPERSPACE: tunnel flythrough + countdown, then the gap before the drop ============
const S4 = (() => {
  const streaks = (() => { const r = rng(21); return Array.from({ length: 320 }, () => ({ a: r() * TAU, rr: 1.15 + r() * 1.6, z: r(), c: r() < 0.5 ? C.w : r() < 0.5 ? C.o : C.c })); })();
  const path = z => [Math.sin(z * 0.21) * 0.9 + Math.sin(z * 0.07) * 0.6, Math.cos(z * 0.17) * 0.6];
  const END = SCN - BEAT; // last beat is the silent gap
  return function (lt) {
    clear(g);
    const zc = 3 * lt + 2.4 * lt * lt, speed = 3 + 4.8 * lt;
    const roll = lt * 0.5 + Math.sin(lt * 1.5) * 0.35 + E.inCubic(inv(0, END, lt)) * 2;
    const pc = path(zc), fade = 1 - inv(END, END + 0.1, lt);
    const f = 560;
    g.save(); g.translate(W / 2, H / 2); g.rotate(roll);
    const look = path(zc + 6), vx = (look[0] - pc[0]) * f / 6, vy = (look[1] - pc[1]) * f / 6;
    g.globalAlpha = fade; glowDot(g, vx, vy, 380 + 80 * beatEnv(lt), RGB.o, 0.35); g.globalAlpha = 1;
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let k = Math.ceil(zc + 0.12); k < zc + 30; k++) {
      const rel = k - zc, s = f / rel, pk = path(k);
      const cx = (pk[0] - pc[0]) * s, cy = (pk[1] - pc[1]) * s;
      const a = clamp(1 - rel / 30) * clamp(rel / 0.8) * fade;
      const col = k % 4 === 0 ? C.o : k % 4 === 2 ? C.c : C.w;
      g.strokeStyle = col; g.globalAlpha = a * (k % 2 ? 0.5 : 1); g.lineWidth = clamp(0.045 * s, 0.6, 46);
      g.beginPath();
      const sides = 6, rot = k * 0.12;
      for (let j = 0; j < sides; j++) {
        if ((k * 7 + j * 3) % 5 === 0) continue;
        const a0 = rot + j / sides * TAU, a1 = rot + (j + 1) / sides * TAU;
        g.moveTo(cx + Math.cos(a0) * s, cy + Math.sin(a0) * s); g.lineTo(cx + Math.cos(a1) * s, cy + Math.sin(a1) * s);
      }
      g.stroke();
      if (k % 3 === 0) {
        g.fillStyle = col;
        for (let j = 0; j < 24; j++) { const a2 = j / 24 * TAU - rot; const d = 0.82 * s; g.fillRect(cx + Math.cos(a2) * d - 1.5, cy + Math.sin(a2) * d - 1.5, clamp(s * 0.012, 1, 8), clamp(s * 0.012, 1, 8)); }
      }
    }
    // speed streaks
    g.lineWidth = 2;
    for (const st of streaks) {
      const z = (fract(st.z - zc / 30)) * 30 + 0.2, len = 0.15 + speed * 0.09;
      const s1 = f / z, s2 = f / (z + len), p1 = path(zc + z), p2 = path(zc + z + len);
      g.strokeStyle = st.c; g.globalAlpha = clamp(1 - z / 30) * fade * 0.9; g.beginPath();
      g.moveTo((p1[0] - pc[0] + Math.cos(st.a) * st.rr) * s1, (p1[1] - pc[1] + Math.sin(st.a) * st.rr) * s1);
      g.lineTo((p2[0] - pc[0] + Math.cos(st.a) * st.rr) * s2, (p2[1] - pc[1] + Math.sin(st.a) * st.rr) * s2);
      g.stroke();
    }
    g.restore(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // countdown 3-2-1 on beats 4,5,6
    const b = Math.floor(lt / BEAT), bt = lt - b * BEAT;
    if (b >= 4 && b <= 6) {
      const s = lerp(0.6, 2.4, E.outCubic(bt / BEAT)), a = 1 - inv(0.2, BEAT, bt);
      g.save(); g.translate(W / 2, H / 2); g.scale(s, s);
      g.font = font(360); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.globalAlpha = a; g.fillStyle = C.w; g.fillText(String(7 - b), 0, 0);
      g.globalAlpha = a * 0.6; g.strokeStyle = C.o; g.lineWidth = 3 / s; g.strokeText(String(7 - b), 0, 0);
      g.restore(); g.globalAlpha = 1;
      FX.ca = 14 * Math.exp(-bt * 6);
    }
    // the gap: one pulsing point, everything holds its breath
    if (lt > END) {
      const q = lt - END;
      const r0 = 3 + 3 * Math.sin(q * 60);
      g.fillStyle = C.w; g.beginPath(); g.arc(W / 2, H / 2, r0 * (1 - E.inExpo(inv(BEAT - 0.1, BEAT, q))), 0, TAU); g.fill();
      const lw = W * (1 - E.outExpo(inv(0, BEAT, q)));
      g.fillStyle = C.o; g.fillRect(W / 2 - lw / 2, H / 2 - 1, lw, 2);
    }
    FX.shake = (2 + 10 * inv(0, END, lt)) * (lt < END ? 1 : 0) + 8 * beatEnv(lt) * (lt < END ? 1 : 0);
    FX.ca = Math.max(FX.ca, 3 + 10 * inv(0, END, lt)) * fade;
  };
})();

// ============ 05 THE DROP: curl-noise flow field + beat-reactive visualizer ============
const S5 = (() => {
  const N = 3600; let P;
  const words = ['MAX', 'POWER', 'FULL', 'SPEED', 'PURE', 'ENERGY', 'ZERO', 'LIMITS'];
  function spawn(p, r, R) {
    const a = r() * TAU, sp = 8 + r() * 34;
    p.x = W / 2 + Math.cos(a) * R; p.y = H / 2 + Math.sin(a) * R; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
  }
  return function (lt, t, first) {
    if (first || !P) {
      const r = rng(77); P = Array.from({ length: N }, (_, i) => { const p = { g: i % 3 }; spawn(p, r, 20 + r() * 60); return p; });
      tg.globalCompositeOperation = 'source-over'; tg.fillStyle = C.bg; tg.fillRect(0, 0, W, H);
      S5.r = rng(78);
    }
    const kick = beatEnv(lt, 10);
    tg.globalCompositeOperation = 'source-over'; tg.fillStyle = 'rgba(5,6,11,0.13)'; tg.fillRect(0, 0, W, H);
    tg.globalCompositeOperation = 'lighter'; tg.lineWidth = 1.7; tg.lineCap = 'round';
    const cols = [C.o, C.m, C.c];
    for (let grp = 0; grp < 3; grp++) {
      tg.strokeStyle = cols[grp]; tg.globalAlpha = 0.6; tg.beginPath();
      for (const p of P) {
        if (p.g !== grp) continue;
        const a = noise(p.x * 0.0017, p.y * 0.0017, lt * 0.35) * TAU * 2;
        const dx = p.x - W / 2, dy = p.y - H / 2, d = Math.hypot(dx, dy) + 1;
        p.vx = p.vx * 0.93 + Math.cos(a) * 1.1 + dx / d * kick * 2.4;
        p.vy = p.vy * 0.93 + Math.sin(a) * 1.1 + dy / d * kick * 2.4;
        const ox = p.x, oy = p.y; p.x += p.vx; p.y += p.vy;
        if (p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) { spawn(p, S5.r, 250); continue; }
        tg.moveTo(ox, oy); tg.lineTo(p.x, p.y);
      }
      tg.stroke();
    }
    tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over';
    g.drawImage(trail, 0, 0);
    // visualizer
    const R = 235 + 30 * kick, NBR = 128, rot = lt * 0.4;
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineWidth = 7;
    for (let i = 0; i < NBR; i++) {
      const a = rot + i / NBR * TAU, m = Math.abs(((i + NBR / 4) % (NBR / 2)) - NBR / 4) / (NBR / 4);
      const len = 18 + 230 * kick * (0.35 + 0.65 * Math.abs(noise(m * 3, lt * 2.2))) + 60 * Math.abs(noise(i * 0.3, lt * 5));
      const k = i / NBR;
      g.strokeStyle = `rgb(255,${Math.round(lerp(77, 43, Math.abs(Math.sin(k * Math.PI * 2))))},${Math.round(lerp(28, 214, Math.abs(Math.sin(k * Math.PI * 2))))})`;
      g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * R, H / 2 + Math.sin(a) * R); g.lineTo(W / 2 + Math.cos(a) * (R + len), H / 2 + Math.sin(a) * (R + len)); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = C.bg; g.beginPath(); g.arc(W / 2, H / 2, R - 16, 0, TAU); g.fill();
    g.strokeStyle = C.w; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, H / 2, R - 16, 0, TAU); g.stroke();
    g.save(); g.translate(W / 2, H / 2); g.rotate(-lt * 0.9); g.setLineDash([3, 16]); g.strokeStyle = C.c; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, R + 300, 0, TAU); g.stroke(); g.rotate(lt * 1.6); g.setLineDash([60, 30, 4, 30]); g.strokeStyle = C.o;
    g.beginPath(); g.arc(0, 0, R + 340, 0, TAU); g.stroke(); g.restore(); g.setLineDash([]);
    const b = Math.min(7, Math.floor(lt / BEAT)), bt = lt - b * BEAT, w = words[b];
    const s = lerp(1.35, 1, E.outExpo(inv(0, 0.18, bt)));
    g.save(); g.translate(W / 2, H / 2); g.scale(s, s);
    g.font = font(w.length > 4 ? 92 : 120); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = b % 2 ? C.o : C.w;
    g.fillText(w, 0, 6); g.restore();
    FX.flash = Math.exp(-lt * 4.5); FX.ca = 28 * Math.exp(-lt * 3) + 7 * kick; FX.shake = 18 * kick + 44 * Math.exp(-lt * 5);
    FX.glitch = Math.max(E.inCubic(inv(SCN - 0.3, SCN, lt)), 0.5 * Math.exp(-lt * 8));
  };
})();

// ============ 06 SYSTEMS: Swiss grid of 28 looping micro-animations ============
const S6 = (() => {
  const COLS = 7, ROWS = 4, S = 216, GAP = 18;
  const OX = (W - (COLS * S + (COLS - 1) * GAP)) / 2, OY = (H - (ROWS * S + (ROWS - 1) * GAP)) / 2;
  const PAL = [['#12141c', C.w], [C.o, C.k], [C.w, C.k], [C.c, C.k], ['#12141c', C.o], [C.y, C.k], ['#12141c', C.c]];
  function mini(type, x, s, tt, fg) {
    x.fillStyle = fg; x.strokeStyle = fg; x.lineWidth = 6; x.lineCap = 'round';
    const h = s / 2;
    switch (type) {
      case 0: for (let k = 0; k < 3; k++) { x.save(); x.rotate(tt * (1.2 + k) * (k % 2 ? -1 : 1)); const r = h * (0.7 - k * 0.2); x.strokeRect(-r, -r, r * 2, r * 2); x.restore(); } break;
      case 1: { const p = Math.abs(Math.sin(tt * 4.2)), y = lerp(h * 0.55, -h * 0.55, p), sq = 1 + 0.4 * Math.max(0, 1 - p * 5);
        x.beginPath(); x.ellipse(0, y, 28 * sq, 28 / sq, 0, 0, TAU); x.fill(); x.fillRect(-h * 0.6, h * 0.55 + 28, h * 1.2, 5); break; }
      case 2: for (let k = 0; k < 4; k++) { const p = fract(tt * 0.9 + k / 4); x.globalAlpha = 1 - p; x.beginPath(); x.arc(0, 0, p * h * 0.85, 0, TAU); x.stroke(); } x.globalAlpha = 1; break;
      case 3: x.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40, px = lerp(-h * 0.75, h * 0.75, u), py = Math.sin(u * TAU * 1.5 + tt * 6) * h * 0.4; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); break;
      case 4: { const a = tt * 5, e = (Math.sin(tt * 3) + 1) * 2.2 + 0.4; x.lineWidth = 12; x.beginPath(); x.arc(0, 0, h * 0.55, a, a + e); x.stroke(); break; }
      case 5: for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const r = 10 + 14 * (0.5 + 0.5 * Math.sin(tt * 5 - (i + j) * 1.2)); x.beginPath(); x.arc(i * h * 0.55, j * h * 0.55, r, 0, TAU); x.fill(); } break;
      case 6: x.lineWidth = 8; for (let k = 0; k < 3; k++) { x.save(); x.rotate(tt * (k + 1) * 1.3); x.beginPath(); x.moveTo(0, 0); x.lineTo(h * (0.7 - k * 0.15), 0); x.stroke(); x.restore(); } x.beginPath(); x.arc(0, 0, 9, 0, TAU); x.fill(); break;
      case 7: x.font = font(120); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(Math.floor(tt * 16) % 100).padStart(2, '0'), 0, 6); break;
      case 8: x.save(); x.rotate(tt * 2); x.lineWidth = 7; x.beginPath(); for (let k = 0; k < 3; k++) { const a = k / 3 * TAU - Math.PI / 2; x.lineTo(Math.cos(a) * h * 0.6, Math.sin(a) * h * 0.6); } x.closePath(); x.stroke(); x.restore(); break;
      case 9: x.save(); x.beginPath(); x.rect(-h, -h, s, s); x.clip(); x.rotate(Math.PI / 4); for (let k = -6; k <= 6; k++) x.fillRect(k * 34 + fract(tt) * 34 - 8, -s, 14, s * 2); x.restore(); break;
      case 10: for (let k = 0; k < 2; k++) { x.save(); x.rotate(E.inOutExpo(fract(tt * 0.8)) * Math.PI * (k ? -1 : 1)); x.beginPath(); x.arc(0, 0, h * 0.6 - k * 22, 0, Math.PI); x.fill(); x.restore(); x.globalCompositeOperation = 'xor'; } x.globalCompositeOperation = 'source-over'; break;
      case 11: { const k = E.outElastic(fract(tt / BEAT) * 1.4); x.save(); x.rotate(Math.floor(tt / BEAT) * Math.PI / 4 + k * Math.PI / 4); x.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k); x.fillRect(-h * 0.6, -14, h * 1.2, 28); x.fillRect(-14, -h * 0.6, 28, h * 1.2); x.restore(); break; }
    }
  }
  return function (lt) {
    clear(g);
    const kick = beatEnv(lt, 9), gs = 1 + 0.018 * kick;
    g.save(); g.translate(W / 2, H / 2); g.scale(gs, gs); g.rotate(Math.sin(lt * 0.8) * 0.01); g.translate(-W / 2, -H / 2);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c, d = (c + r) * 0.045;
      const kin = E.outBack(inv(d, d + 0.45, lt));
      const kout = 1 - E.inBack(inv(SCN - 0.65 + d * 0.5, SCN - 0.35 + d * 0.5, lt));
      let sc = Math.max(0, kin * kout); if (sc <= 0.001) continue;
      // palette flips every two beats, rippling across the grid
      let flips = 0, sx = 1;
      for (let k = 1; k <= 3; k++) {
        const p = inv(k * 2 * BEAT + d * 0.8, k * 2 * BEAT + d * 0.8 + 0.28, lt);
        if (p > 0 && p < 1) sx = Math.abs(Math.cos(p * Math.PI));
        if (p >= 0.5) flips++;
      }
      const [bg, fg] = PAL[(i * 3 + flips * 2) % PAL.length];
      const cx = OX + c * (S + GAP) + S / 2, cy = OY + r * (S + GAP) + S / 2;
      g.save(); g.translate(cx, cy); g.rotate((1 - kin) * Math.PI / 2); g.scale(sc * sx, sc);
      g.fillStyle = bg; g.fillRect(-S / 2, -S / 2, S, S);
      g.save(); g.beginPath(); g.rect(-S / 2, -S / 2, S, S); g.clip();
      mini((i * 5 + flips) % 12, g, S, lt + i * 0.13, fg);
      g.restore();
      g.restore();
    }
    g.restore();
    // giant word in difference mode sweeping over the grid
    const wk = inv(BEAT * 1.5, SCN - 0.5, lt);
    if (wk > 0 && wk < 1) {
      g.globalCompositeOperation = 'difference';
      g.font = font(470); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
      g.fillText('SYSTEMS', lerp(W * 1.35, -W * 0.35, E.inOutSine(wk)), H / 2 + 10);
      g.globalCompositeOperation = 'source-over';
    }
    FX.bloom = 0.3; FX.shake = 4 * kick; FX.ca = 2 + 4 * kick;
  };
})();

// ============ 07 PARTICLES: 6000 points morph galaxy -> DNA helix -> living sphere ============
const S7 = (() => {
  const N = 6000;
  const R = (() => { const r = rng(99); return Array.from({ length: N }, () => ({ r: Math.pow(r(), 0.55) * 1.75, sp: gauss(r), gy: gauss(r), f: r(), c: Math.floor(r() * 3) })); })();
  function galaxy(i, lt) {
    const p = R[i], arm = i % 3;
    const ang = arm * TAU / 3 + p.r * 3.1 + p.sp * 0.28 / (p.r + 0.35) + lt * 0.9 / (0.45 + p.r);
    return [Math.cos(ang) * p.r, p.gy * 0.06 * (1.9 - p.r), Math.sin(ang) * p.r];
  }
  function helix(i, lt) {
    const p = R[i], rung = i % 6 === 0;
    let s = i / N; if (rung) s = Math.round(s * 34) / 34;
    const y = (s * 2 - 1) * 1.8, a = s * TAU * 2.5 + lt * 2.4;
    const p1 = [Math.cos(a) * 0.6, y, Math.sin(a) * 0.6], p2 = [-p1[0], y, -p1[2]];
    if (rung) return p1.map((v, k) => lerp(v, p2[k], p.f));
    const q = i % 2 ? p1 : p2; return q.map((v, k) => v + p.sp * 0.03 * (k !== 1));
  }
  function sphere(i, lt) {
    const k = i + 0.5, ph = Math.acos(1 - 2 * k / N), th = Math.PI * (1 + Math.sqrt(5)) * k;
    const x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th);
    const d = 1.15 + 0.22 * noise(x * 1.8 + lt * 0.8, y * 1.8, z * 1.8 + lt * 0.5) + 0.08 * beatEnv(lt);
    return [x * d, y * d, z * d];
  }
  const cols = [C.o, C.c, C.w];
  function draw(posFn, cam, alphaMul = 1, streak = 0) {
    g.globalCompositeOperation = 'lighter';
    for (let grp = 0; grp < 3; grp++) {
      g.fillStyle = cols[grp]; g.strokeStyle = cols[grp];
      if (streak) g.beginPath();
      for (let i = grp; i < N; i += 3) {
        const p = posFn(i); if (!p) continue;
        const q = proj(rot3(p, cam.ax, cam.ay, cam.az || 0), 820, 4);
        const s = clamp(q[3] / 300, 0.8, 4);
        if (streak) {
          const p2 = posFn(i, true); const q2 = proj(rot3(p2, cam.ax, cam.ay, cam.az || 0), 820, 4);
          g.moveTo(q2[0], q2[1]); g.lineTo(q[0], q[1]);
        } else {
          g.globalAlpha = clamp(lerp(1, 0.25, (q[2] - 2.5) / 3)) * alphaMul;
          g.fillRect(q[0] - s / 2, q[1] - s / 2, s, s);
        }
      }
      if (streak) { g.globalAlpha = alphaMul; g.lineWidth = 1.6; g.stroke(); }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  const fn = function (lt) {
    clear(g);
    const bl = lt / BEAT;
    const m1 = i => E.inOutExpo(inv(3 + (i / N) * 0.6, 3.9 + (i / N) * 0.6, bl));
    const m2 = i => E.inOutExpo(inv(5.5 + (i / N) * 0.6, 6.4 + (i / N) * 0.6, bl));
    const posFn = i => {
      const a = m1(i), b = m2(i);
      let p = galaxy(i, lt);
      if (a > 0) p = p.map((v, k) => lerp(v, helix(i, lt)[k], a));
      if (b > 0) p = p.map((v, k) => lerp(v, sphere(i, lt)[k], b));
      return p.map(v => v * (0.2 + 0.8 * E.outExpo(inv(0, 0.8, lt))));
    };
    const gw = 1 - E.inOutExpo(inv(3, 4, bl));
    const cam = {
      ax: lerp(lerp(1.15, 0.55, E.inOutSine(inv(0, 3, bl))), 0.2, 1 - gw),
      ay: lt * 0.45, az: lerp(0.25 * (1 - gw), 0, E.inOutExpo(inv(5.5, 6.5, bl))),
    };
    glowDot(g, W / 2, H / 2, 420, RGB.o, 0.35 * gw + 0.12);
    draw(posFn, cam);
    // HUD
    g.font = font(17, 500, MONO); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = C.w; g.globalAlpha = 0.8;
    const mode = bl < 3.5 ? 'GALAXY' : bl < 6 ? 'DOUBLE HELIX' : 'NOISE SPHERE';
    g.fillText(`PARTICLES ${N}`, 90, 90); g.fillStyle = C.o; g.fillText(`MODE: ${mode}`, 90, 118);
    g.fillStyle = C.w; g.fillText(`CAM ${(cam.ax).toFixed(3)} ${(cam.ay % TAU).toFixed(3)}`, 90, 146);
    g.globalAlpha = 1;
    FX.shake = 3 * beatEnv(lt); FX.ca = 3 + 4 * beatEnv(lt);
  };
  fn.sphere = sphere; fn.draw = draw; fn.N = N;
  return fn;
})();

// ============ 08 FINALE: implosion -> boom -> signature ============
const S8 = (() => {
  const debris = (() => { const r = rng(5); return Array.from({ length: 1400 }, () => ({ a: r() * TAU, sp: 300 + Math.pow(r(), 0.6) * 1500, c: r() < 0.5 ? C.o : r() < 0.6 ? C.w : C.c })); })();
  return function (lt, t) {
    clear(g);
    const TB = BAR;
    if (lt < TB) {
      const k = E.inExpo(inv(0.15, TB, lt));
      const posFn = (i, prev) => {
        const tt = prev ? lt - 0.035 : lt; const kk = E.inExpo(inv(0.15, TB, tt));
        const p = S7.sphere(i, SCN + tt);
        const sp = E.inCubic(inv(0, TB, tt)) * TAU * 1.5;
        return rot3(p.map(v => v * (1 - kk) * 1), 0, sp * (1 + (i % 7) * 0.1));
      };
      S7.draw(posFn, { ax: 0.2, ay: (SCN + lt) * 0.45 }, 1, k > 0.02);
      for (let j = 0; j < 4; j++) {
        const r = (1 - E.inQuart(inv(j * 0.2, TB, lt))) * (900 + j * 120);
        g.strokeStyle = j % 2 ? C.o : C.c; g.lineWidth = 2; g.globalAlpha = 0.6 * inv(j * 0.2, j * 0.2 + 0.3, lt);
        g.beginPath(); g.arc(W / 2, H / 2, Math.max(0, r), 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
      glowDot(g, W / 2, H / 2, 100 + 300 * k, RGB.w, 0.6 * k);
      FX.shake = 14 * k; FX.ca = 4 + 24 * k; FX.glitch = 0.4 * E.inExpo(inv(TB - 0.4, TB, lt));
      return;
    }
    const q = lt - TB;
    FX.hud = 0;
    FX.flash = Math.exp(-q * 4.5); FX.ca = 36 * Math.exp(-q * 3); FX.shake = 40 * Math.exp(-q * 6);
    // rays
    g.save(); g.translate(W / 2, H / 2); g.rotate(q * 0.15);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 28; i++) {
      g.rotate(TAU / 28); g.fillStyle = i % 2 ? 'rgba(255,77,28,0.05)' : 'rgba(25,227,255,0.035)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(1400, -60); g.lineTo(1400, 60); g.fill();
    }
    g.restore();
    glowDot(g, W / 2, H / 2, 700, RGB.o, 0.25);
    // shockwaves + debris
    [1700, 1200].forEach((R, i) => {
      const k = E.outExpo(inv(i * 0.06, 1.4, q)); if (k >= 1) return;
      g.strokeStyle = i ? C.o : C.w; g.globalAlpha = 1 - k; g.lineWidth = 3 + 30 * (1 - k);
      g.beginPath(); g.arc(W / 2, H / 2, R * k, 0, TAU); g.stroke();
    });
    g.globalAlpha = 1;
    for (const d of debris) {
      const e = 1 - Math.exp(-2.6 * q), e2 = 1 - Math.exp(-2.6 * Math.max(0, q - 0.03));
      g.strokeStyle = d.c; g.globalAlpha = Math.exp(-q * 1.2) * 0.9; g.lineWidth = 2;
      g.beginPath(); g.moveTo(W / 2 + Math.cos(d.a) * d.sp * e2, H / 2 + Math.sin(d.a) * d.sp * e2 * 0.8);
      g.lineTo(W / 2 + Math.cos(d.a) * d.sp * e, H / 2 + Math.sin(d.a) * d.sp * e * 0.8); g.stroke();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // signature
    const sp = lerp(150, 26, E.outExpo(inv(0, 1.1, q)));
    g.fillStyle = C.w;
    letters(g, 'CLAUDE', W / 2, H / 2 - 20, 230, i => {
      const d = 0.04 * i, k = E.outExpo(inv(d, d + 0.5, q));
      return { dy: (1 - k) * 60 * (i % 2 ? 1 : -1), a: k, col: C.w };
    }, 900, sp);
    const lw = 980 * E.outExpo(inv(0.3, 1.0, q));
    g.fillStyle = C.o; g.fillRect(W / 2 - lw / 2, H / 2 + 120, lw, 7);
    g.font = font(17, 500, MONO); g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '10px';
    g.fillStyle = C.c; g.fillText(typeText('// RENDERED FRAME BY FRAME BY', inv(0.25, 0.75, q)), W / 2 + 5, H / 2 - 190);
    g.font = font(24, 500, MONO); g.fillStyle = C.w;
    g.fillText(typeText('MOTION DESIGN  ·  1800 FRAMES  ·  100% CODE', inv(0.5, 1.15, q)), W / 2 + 5, H / 2 + 180);
    g.letterSpacing = '0px';
    // fade out
    const fo = inv(TOTAL - 0.4, TOTAL - 1 / FPS, t);
    if (fo > 0) { g.globalAlpha = fo; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  };
})();

const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8];
const NAMES = ['IGNITION', 'KINETIC TYPE', 'GEOMETRY', 'HYPERSPACE', 'THE DROP', 'SYSTEMS', 'PARTICLES', 'FINALE'];
