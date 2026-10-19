// Renders src/index.html frame by frame in headless Chromium and encodes with ffmpeg.
//   node render.mjs stills 0,120,500      -> out/stills/f0000.png ...
//   node render.mjs video [workers]       -> out/video_noaudio.mp4
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const URL_ = pathToFileURL(path.join(ROOT, 'src/index.html')).href;
const FPS = 60, FRAMES = 1800, SCENE_FRAMES = 225;
mkdirSync(OUT, { recursive: true });

async function page(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('console', m => console.log('[page]', m.text()));
  p.on('pageerror', e => { console.error('[pageerror]', e); process.exit(1); });
  await p.goto(URL_);
  await p.evaluate(() => window.ready);
  return p;
}
const png = async (p, f) => Buffer.from((await p.evaluate(f => grab(f), f)).split(',')[1], 'base64');

async function renderRange(browser, a, b, file) {
  const p = await page(browser);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '8', '-pix_fmt', 'yuv444p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = a; f < b; f++) {
    const buf = await png(p, f);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 60 === 0) console.log(`frames ${a}-${b}: ${f} (${((Date.now() - t0) / (f - a + 1)).toFixed(0)} ms/f)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await p.close();
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const [mode, arg] = process.argv.slice(2);
if (mode === 'stills') {
  mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  const p = await page(browser);
  for (const f of arg.split(',').map(Number)) {
    // stateful scenes need their history: replay from the scene start
    const s = Math.floor(f / SCENE_FRAMES) * SCENE_FRAMES;
    for (let k = s; k < f; k++) await p.evaluate(k => renderFrame(k), k);
    const t0 = Date.now();
    writeFileSync(path.join(OUT, 'stills', `f${String(f).padStart(4, '0')}.png`), await png(p, f));
    console.log('frame', f, Date.now() - t0, 'ms');
  }
} else {
  const workers = Number(arg || 4), per = 8 / workers;
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const a = w * per * SCENE_FRAMES, b = (w + 1) * per * SCENE_FRAMES;
    jobs.push(renderRange(browser, a, b, path.join(OUT, `part${w}.mp4`)));
  }
  await Promise.all(jobs);
  writeFileSync(path.join(OUT, 'parts.txt'), Array.from({ length: workers }, (_, w) => `file 'part${w}.mp4'`).join('\n'));
}
await browser.close();
