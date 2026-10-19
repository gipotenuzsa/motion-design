// Post stack: shake/zoom, chromatic aberration, bloom, glitch slices, flash, vignette, HUD.

function hud(t, si) {
  if (!FX.hud || t < SCN) return;
  const a = 0.55 * FX.hud;
  g.globalAlpha = a; g.font = font(15, 500, MONO); g.fillStyle = C.w; g.textBaseline = 'alphabetic';
  const f = Math.round(t * FPS), ss = Math.floor(t), ff = f % FPS;
  g.textAlign = 'left';
  g.fillText(`TC 00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}   F ${String(f).padStart(4, '0')}/${FRAMES}`, 40, H - 34);
  g.textAlign = 'right';
  g.fillText(`${String(si + 1).padStart(2, '0')} / ${NAMES[si]}`, W - 40, H - 34);
  g.fillText(`${BPM} BPM`, W - 40, 50);
  g.fillStyle = C.o;
  if (Math.floor(t * 2) % 2 === 0) { g.beginPath(); g.arc(W - 150, 44, 6, 0, TAU); g.fill(); }
  // timeline progress
  g.fillStyle = C.w; g.globalAlpha = a * 0.3; g.fillRect(40, H - 22, W - 80, 2);
  g.globalAlpha = a; g.fillStyle = C.o; g.fillRect(40, H - 22, (W - 80) * t / TOTAL, 2);
  g.globalAlpha = 1;
}

function drawShifted(ctx, src, dx, dy, m) { ctx.drawImage(src, dx - m, dy - m * H / W, W + 2 * m, H + 2 * m * H / W); }

function post(t) {
  const sh = FX.shake, dx = noise(t * 23, 1.7) * 2 * sh, dy = noise(t * 23, 8.3) * 2 * sh, m = sh * 1.3;
  octx.globalCompositeOperation = 'source-over'; octx.globalAlpha = 1;
  if (FX.ca > 0.6) {
    octx.fillStyle = '#000'; octx.fillRect(0, 0, W, H);
    for (const [col, o] of [['#ff0000', -FX.ca], ['#00ff00', 0], ['#0000ff', FX.ca]]) {
      tmg.globalCompositeOperation = 'copy'; tmg.drawImage(scene, 0, 0);
      tmg.globalCompositeOperation = 'multiply'; tmg.fillStyle = col; tmg.fillRect(0, 0, W, H);
      tmg.globalCompositeOperation = 'source-over';
      octx.globalCompositeOperation = 'lighter';
      drawShifted(octx, tmp, dx, dy, m + o);
    }
    octx.globalCompositeOperation = 'source-over';
  } else {
    drawShifted(octx, scene, dx, dy, m);
  }
  // bloom
  smg.clearRect(0, 0, W / 4, H / 4);
  smg.filter = 'blur(6px)'; smg.drawImage(out, 0, 0, W / 4, H / 4); smg.filter = 'none';
  octx.globalCompositeOperation = 'lighter'; octx.globalAlpha = FX.bloom;
  octx.drawImage(small, 0, 0, W, H);
  octx.globalAlpha = 1; octx.globalCompositeOperation = 'source-over';
  // glitch
  if (FX.glitch > 0.02) {
    tmg.globalCompositeOperation = 'copy'; tmg.drawImage(out, 0, 0); tmg.globalCompositeOperation = 'source-over';
    const r = rng(Math.floor(t * FPS) * 31 + 7), n = Math.floor(4 + FX.glitch * 22);
    for (let i = 0; i < n; i++) {
      const y = r() * H, h = 4 + r() * 90 * FX.glitch, ox = (r() - 0.5) * 320 * FX.glitch;
      octx.drawImage(tmp, 0, y, W, h, ox, y, W, h);
      if (r() < 0.25 * FX.glitch) {
        octx.fillStyle = [C.o, C.c, C.m, C.w][Math.floor(r() * 4)]; octx.globalAlpha = 0.8;
        octx.fillRect(r() * W, y, r() * 300, Math.min(h, 14)); octx.globalAlpha = 1;
      }
    }
  }
  if (FX.flash > 0.004) { octx.fillStyle = `rgba(${FX.flashColor},${clamp(FX.flash)})`; octx.fillRect(0, 0, W, H); }
  octx.drawImage(vign, 0, 0);
}

window.renderFrame = function (f) {
  const t = f / FPS, si = Math.min(7, Math.floor(f / (SCN * FPS))), lt = t - si * SCN;
  resetFX();
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.setLineDash([]); g.letterSpacing = '0px';
  SCENES[si](lt, t, f % Math.round(SCN * FPS) === 0);
  hud(t, si);
  post(t);
};
window.grab = function (f) { renderFrame(f); return out.toDataURL('image/png'); };
