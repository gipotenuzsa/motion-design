"""Synthesizes the 30 s soundtrack (128 BPM, A minor) in sync with the scene timeline. Writes out/audio.wav."""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
T = 30.0
N = int(SR * T)
BEAT = 60 / 128
BAR = BEAT * 4
rng = np.random.default_rng(7)

BUS = {k: np.zeros((2, N)) for k in ('drums', 'music', 'fx', 'send')}


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def put(sig, t0, gain=1.0, pan=0.0, bus='music', send=0.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(sig if sig.ndim == 1 else sig[0]) <= 0:
        return
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    s = sig[:, : N - i] * gain
    BUS[bus][:, i:i + s.shape[1]] += s
    if send:
        BUS['send'][:, i:i + s.shape[1]] += s * send


def filt(x, kind, f, order=2):
    sos = signal.butter(order, f, btype=kind, fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def noise(n):
    return rng.standard_normal(n)


def saw(freq, t, phase=0.0):
    return 2 * ((freq * t + phase) % 1.0) - 1


def note(n):  # midi -> Hz
    return 440 * 2 ** ((n - 69) / 12)


# ---------- instruments ----------
def kick(hard=1.0):
    t = tt(0.55)
    f = 46 + 140 * np.exp(-t * 28) + 40 * np.exp(-t * 200)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.0)
    click = filt(noise(len(t)), 'highpass', 2500) * np.exp(-t * 350) * 0.6
    return np.tanh((body + click) * 2.2 * hard) * 0.95


def clap():
    t = tt(0.4)
    env = sum(np.exp(-np.clip(t - d, 0, None) * 160) * (t >= d) for d in (0, 0.011, 0.023))
    env = env + 0.6 * np.exp(-np.clip(t - 0.03, 0, None) * 16) * (t >= 0.03)
    return filt(noise(len(t)), 'bandpass', [900, 4200]) * env * 0.55


def hat(open_=False):
    t = tt(0.32 if open_ else 0.07)
    return filt(noise(len(t)), 'highpass', 7500) * np.exp(-t * (11 if open_ else 75)) * 0.32


def snare():
    t = tt(0.25)
    tone = np.sin(2 * np.pi * 195 * t) * np.exp(-t * 28)
    return (tone * 0.5 + filt(noise(len(t)), 'bandpass', [1200, 9000]) * np.exp(-t * 20) * 0.6)


def crash():
    t = tt(2.2)
    return filt(noise(len(t)), 'highpass', 4000) * np.exp(-t * 2.2) * 0.35


def supersaw(freqs, dur, cutoff=5000, attack=0.01, release=0.2):
    t = tt(dur + release)
    out = np.zeros((2, len(t)))
    for f in freqs:
        for k, c in enumerate((-22, -13, -6, 0, 6, 13, 22)):
            v = saw(f * 2 ** (c / 1200), t, rng.random())
            pan = (k - 3) / 3 * 0.8
            a = (pan + 1) * np.pi / 4
            out[0] += v * np.cos(a)
            out[1] += v * np.sin(a)
    env = np.minimum(1, t / attack) * np.where(t > dur, np.exp(-(t - dur) * 10 / max(release, 1e-3)), 1)
    out = signal.sosfilt(signal.butter(2, cutoff, 'lowpass', fs=SR, output='sos'), out, axis=1)
    return out * env / (7 * len(freqs)) * 1.6


def pluck(f, dur=0.22, cutoff=3500):
    t = tt(dur)
    v = saw(f, t) * 0.6 + saw(f * 1.005, t) * 0.4
    return filt(v, 'lowpass', cutoff) * np.exp(-t * 14) * 0.5


def bass_pluck(f, dur=0.2):
    t = tt(dur)
    v = saw(f, t) + 0.6 * np.sin(2 * np.pi * f * t)
    return np.tanh(filt(v, 'lowpass', 700) * 2) * np.exp(-t * 9) * 0.55


def reese(f, dur):
    t = tt(dur)
    v = saw(f, t) + saw(f * 1.007, t, 0.3) + 1.2 * np.sin(2 * np.pi * f * t)
    lfo_cut = 500 + 300 * np.sin(2 * np.pi * t / BEAT)
    v = filt(v, 'lowpass', 900)
    v = np.tanh(v * 1.8) * (0.85 + 0.15 * (lfo_cut / 800))
    env = np.minimum(1, t / 0.01) * np.minimum(1, (dur - t) / 0.02)
    return v * env * 0.42


def impact(size=1.0):
    t = tt(3.0)
    f = 62 * np.exp(-t * 0.9) + 22
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    body = filt(noise(len(t)), 'lowpass', 1800) * np.exp(-t * 4.5)
    crack = filt(noise(len(t)), 'highpass', 3000) * np.exp(-t * 30)
    return np.tanh((sub * 1.3 + body * 0.5 + crack * 0.6) * 1.5 * size) * 0.9


def riser(dur, f0=180, f1=2400):
    t = tt(dur)
    k = t / dur
    f = f0 * (f1 / f0) ** (k ** 1.6)
    whine = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.25 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.2
    nz = filt(noise(len(t)), 'highpass', 600)
    # step the noise brightness up in blocks for a sweep
    blocks = 24
    out = np.zeros(len(t))
    for b in range(blocks):
        a, c = b * len(t) // blocks, (b + 1) * len(t) // blocks
        cut = 800 * (12000 / 800) ** (b / (blocks - 1))
        out[a:c] = filt(nz, 'lowpass', min(cut, SR / 2 - 100))[a:c]
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(2 + 18 * k ** 2) / SR)
    return (out * 0.5 + whine * 0.35) * k ** 2.2 * trem


def reverse_swell(dur):
    t = tt(dur)
    x = filt(noise(len(t)), 'bandpass', [300, 9000]) * np.exp(-t * 3)
    return x[::-1] * 0.6


def zap(f0, f1, dur):
    t = tt(dur)
    f = np.geomspace(f0, f1, len(t))
    v = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR))
    v = np.round(v * np.exp(-t * 18) * 6) / 6  # bitcrush
    return v * 0.2


def ping(f, dur=1.2):
    t = tt(dur)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t * 4) * 0.18


def whoosh(dur=0.45, up=True):
    t = tt(dur)
    k = t / dur
    nz = filt(noise(len(t)), 'bandpass', [800, 6000])
    env = np.sin(np.pi * k) ** 2
    return nz * env * 0.35


# ---------- arrangement ----------
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
ROOTS = [33, 29, 36, 31]
bt = lambda b: b * BEAT
chord_of = lambda b: CHORDS[int(b // 4) % 4]
root_of = lambda b: ROOTS[int(b // 4) % 4]

kicks = []

# --- intro 0 - 3.75: singularity, explosion, assembly, glitch exit
put(supersaw([note(45), note(52)], 1.0, cutoff=500, attack=0.8, release=0.4), 0, 0.9, send=0.3)
put(reverse_swell(0.94), 0.0, 0.9, bus='fx', send=0.4)
put(np.sin(2 * np.pi * np.cumsum(np.geomspace(60, 600, int(0.94 * SR))) / SR) * np.linspace(0, 0.25, int(0.94 * SR)), 0, 1, bus='fx')
put(impact(1.2), bt(2), 1.0, bus='fx', send=0.5)
put(crash(), bt(2), 0.9, bus='fx', send=0.3)
put(supersaw([note(57), note(64), note(69)], 2.6, cutoff=1800, attack=0.6, release=1.0), bt(2) + 0.1, 0.7, send=0.6)
for i in range(18):
    tp = 1.3 + i * 0.075 + rng.random() * 0.03
    put(ping(note([69, 72, 76, 81, 84, 88][i % 6])), tp, 0.8, pan=rng.uniform(-0.8, 0.8), bus='fx', send=0.6)
put(riser(0.85, 300, 3000), 2.9, 0.6, bus='fx')
for i in range(10):
    put(zap(rng.uniform(300, 3000), rng.uniform(80, 900), 0.05), 2.95 + i * 0.075, 0.9, pan=rng.uniform(-0.7, 0.7), bus='fx')

# --- groove: beats 8..30 (S2 kinetic type, S3 geometry, S4 tunnel build)
put(crash(), bt(8), 1.0, bus='fx', send=0.3)
put(impact(0.6), bt(8), 0.6, bus='fx', send=0.3)
for b in range(8, 31):
    kicks.append(bt(b))
    if b % 2 == 1 and b < 24:
        put(clap(), bt(b), 0.8, bus='drums', send=0.25)
    put(hat(), bt(b + 0.5), 0.7, pan=0.25, bus='drums')
    if b >= 16:
        put(hat(), bt(b + 0.25), 0.35, pan=-0.3, bus='drums')
        put(hat(), bt(b + 0.75), 0.35, pan=-0.3, bus='drums')
    put(bass_pluck(note(root_of(b))), bt(b + 0.5), 1.0, bus='music')
    if b < 28:
        put(bass_pluck(note(root_of(b) + 12), 0.12), bt(b + 0.75), 0.5, bus='music')
# word accents in S2 + decode ticks
for b in range(8, 16):
    put(whoosh(0.18), bt(b) - 0.09, 0.5, pan=(-1) ** b * 0.5, bus='fx')
for i in range(22):
    put(zap(2500, 1800, 0.012), bt(14) + i * 0.018, 0.6, pan=rng.uniform(-0.5, 0.5), bus='fx')
put(riser(0.45, 200, 4000), bt(15) + 0.02, 0.6, bus='fx')
# S3: arp + morph whooshes
ARP = [0, 1, 2, 1, 2, 0, 2, 1]
for b in range(16, 31):
    ch = chord_of(b)
    for s in range(4):
        n = ch[ARP[(b * 4 + s) % 8]] + 12
        put(pluck(note(n)), bt(b + s / 4), 0.55, pan=0.4 * np.sin(b + s), bus='music', send=0.35)
for b in (18, 20, 22):
    put(whoosh(0.4), bt(b) - 0.2, 0.9, bus='fx', send=0.3)
put(impact(0.5), bt(24), 0.5, bus='fx', send=0.3)
# S4 build: riser + snare roll + countdown hits, then silence
put(riser(bt(31) - bt(24), 150, 3200), bt(24), 0.9, bus='fx')
roll = [bt(b) for b in np.arange(24, 28, 0.5)] + [bt(b) for b in np.arange(28, 30, 0.25)] + [bt(b) for b in np.arange(30, 31, 0.125)]
for i, tr in enumerate(roll):
    put(snare(), tr, 0.25 + 0.6 * i / len(roll), pan=0.1 * (-1) ** i, bus='drums', send=0.3)
for b in (28, 29, 30):
    put(impact(0.4), bt(b), 0.45, bus='fx', send=0.4)
put(supersaw([note(n) for n in (45, 57, 64)], bt(7), cutoff=900, attack=bt(6), release=0.05), bt(24), 0.5, bus='music')
put(reverse_swell(0.3), bt(32) - 0.3, 0.5, bus='fx')

# --- drop: beats 32..47 (S5, S6)
put(impact(1.4), bt(32), 1.0, bus='fx', send=0.6)
put(crash(), bt(32), 1.0, bus='fx', send=0.4)
put(crash(), bt(40), 0.7, bus='fx', send=0.3)
for b in range(32, 48):
    kicks.append(bt(b))
    if b % 2 == 1:
        put(clap(), bt(b), 1.0, bus='drums', send=0.3)
    put(hat(True), bt(b + 0.5), 0.6, pan=0.3, bus='drums')
    for s in (0.25, 0.75):
        put(hat(), bt(b + s), 0.45, pan=-0.35, bus='drums')
for bar in range(8, 12):
    b0 = bar * 4
    put(reese(note(root_of(b0)), BAR), bt(b0), 1.0, bus='music')
    put(supersaw([note(n) for n in chord_of(b0)] + [note(chord_of(b0)[0] + 12)], BAR - 0.05, cutoff=6500, release=0.1), bt(b0), 0.9, bus='music', send=0.3)
    for s in range(16):
        n = chord_of(b0)[ARP[s % 8]] + 24
        put(pluck(note(n), 0.15, 6000), bt(b0 + s / 4), 0.35, pan=0.5 * np.sin(s * 1.7), bus='music', send=0.4)
put(riser(bt(48) - bt(46), 400, 5000), bt(46), 0.6, bus='fx')
for i in range(12):
    put(zap(rng.uniform(500, 4000), rng.uniform(100, 600), 0.04), bt(47.4) + i * 0.022, 0.8, pan=rng.uniform(-0.8, 0.8), bus='fx')

# --- galaxy: beats 48..55 (S7), half-time, wide pad
put(crash(), bt(48), 0.8, bus='fx', send=0.5)
for b in range(48, 56):
    if b % 4 == 0 or b % 4 == 3:
        kicks.append(bt(b) if b % 4 == 0 else bt(b + 0.5))
    if b % 4 == 2:
        put(clap(), bt(b), 0.9, bus='drums', send=0.5)
    put(hat(), bt(b + 0.5), 0.5, pan=0.3, bus='drums')
for bar in range(12, 14):
    b0 = bar * 4
    put(supersaw([note(n) for n in chord_of(b0)] + [note(chord_of(b0)[1] + 12)], BAR, cutoff=2200, attack=0.15, release=0.4), bt(b0), 1.0, bus='music', send=0.6)
    put(reese(note(root_of(b0)), BAR), bt(b0), 0.7, bus='music')
    for s in range(16):
        n = chord_of(b0)[ARP[(s * 3) % 8]] + 24
        put(pluck(note(n), 0.3, 4000), bt(b0 + s / 4), 0.4, pan=0.7 * np.sin(s * 0.9), bus='music', send=0.6)
for b in (51, 53, 55):
    put(whoosh(0.5), bt(b) + 0.1, 0.6, bus='fx', send=0.4)

# --- finale: implosion (56..59), boom at 60, tail
put(reverse_swell(BAR) * 1.3, bt(56), 1.0, bus='fx', send=0.3)
put(riser(BAR, 120, 4500), bt(56), 1.0, bus='fx')
froll = [bt(b) for b in np.arange(58, 60, 0.125)]
for i, tr in enumerate(froll):
    put(snare(), tr, 0.2 + 0.6 * i / len(froll), bus='drums', send=0.3)
put(impact(1.6), bt(60), 1.1, bus='fx', send=0.7)
put(crash(), bt(60), 1.1, bus='fx', send=0.5)
put(kick(1.4), bt(60), 1.0, bus='drums')
put(supersaw([note(n) for n in (45, 57, 64, 71, 76)], 1.4, cutoff=3500, attack=0.01, release=0.6), bt(60), 0.9, bus='fx', send=0.8)
for i, n in enumerate((81, 76, 72, 69, 64)):
    put(ping(note(n), 1.5), bt(60) + 0.25 + i * 0.12, 0.7, pan=(-1) ** i * 0.5, bus='fx', send=0.7)

for k in kicks:
    put(kick(), k, 1.0, bus='drums')

# ---------- mix ----------
t = np.arange(N) / SR
duck = np.ones(N)
for k in kicks + [bt(32), bt(60)]:
    m = t >= k
    duck[m] = np.minimum(duck[m], 1 - 0.8 * np.exp(-(t[m] - k) / 0.11))
music = BUS['music'] * duck

ir_t = tt(2.6)
ir = np.vstack([filt(noise(len(ir_t)), 'lowpass', 6000) * np.exp(-ir_t * 2.6) for _ in range(2)])
ir[:, : int(0.012 * SR)] = 0
verb = np.vstack([signal.fftconvolve(BUS['send'][c], ir[c])[:N] for c in range(2)]) * 0.12

mix = BUS['drums'] * 0.9 + music * 0.8 + BUS['fx'] * 0.9 + verb
mix = signal.sosfilt(signal.butter(2, 28, 'highpass', fs=SR, output='sos'), mix, axis=1)
mix = np.tanh(mix / np.percentile(np.abs(mix), 99.9) * 1.1)
fade = np.clip((T - t) / 0.45, 0, 1)
mix = mix * fade * 0.89
wavfile.write('out/audio.wav', SR, (mix.T * 32767).astype(np.int16))
print('ok', mix.shape, float(np.abs(mix).max()))
