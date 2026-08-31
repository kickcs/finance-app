/**
 * Синтез аудиоряда: подложка и звуковой дизайн.
 *
 * Лицензионного трека взять неоткуда, поэтому звук пишется здесь, на чистом
 * Node, без зависимостей и без вопросов о правах. Темп 100 BPM совпадает с
 * гридом монтажа (доля 18 кадров при 30 fps), так что подложка ложится на резы
 * без подгонки — не потому, что её подвинули, а потому, что она так написана.
 *
 * Шум берётся из детерминированного генератора: одинаковый запуск даёт
 * побайтово одинаковый файл, иначе пересборка звука меняла бы ролик без
 * причины.
 *
 * SFX лежат отдельными файлами намеренно: их позиции правятся в Studio, а если
 * подложка на слух окажется лишней, её можно отключить одной строкой, и
 * звуковой дизайн останется.
 *
 *   cd promo && npm run audio
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "audio");

const BPM = 100;
const BEAT = 60 / BPM; // 0.6 c
const BAR = BEAT * 4; // 2.4 c
const BARS = 35; // 35 × 2.4 = 84.0 c ровно

// Границы ярусов в тактах. Привязаны к монтажу, а не к круглым числам:
// ударные входят сразу после «Утра» (оно кончается на 2.5-м такте) и уходят
// на десктопной сцене, шестнадцатые поднимают темп к аналитике и бюджету.
const DRUMS_IN = 3;
const DRUMS_OUT = 31;
const PLUCK_IN = 14;
const SIXTEENTHS_FROM = 25;
const PAD_CLOSE_FROM = 31;
const DURATION = BAR * BARS;

// ── примитивы ──────────────────────────────────────────────────────────────

/** Детерминированный шум: xorshift32, чтобы файл не менялся от запуска к запуску. */
function makeNoise(seed = 0x1a2b3c4d) {
  let s = seed;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s |= 0;
    return s / 0x7fffffff;
  };
}

const saw = (phase) => 2 * (phase - Math.floor(phase + 0.5));
const tri = (phase) => 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1;
const sine = (phase) => Math.sin(2 * Math.PI * phase);
const softClip = (x) => Math.tanh(x);

/** Коэффициент однополюсного фильтра для частоты среза в герцах. */
const poleA = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / SR);

function lowpass(buf, hzAt) {
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = poleA(hzAt(i / SR));
    y += a * (buf[i] - y);
    buf[i] = y;
  }
  return buf;
}

function highpass(buf, hz) {
  const a = Math.exp((-2 * Math.PI * hz) / SR);
  let yPrev = 0;
  let xPrev = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = a * (yPrev + x - xPrev);
    buf[i] = y;
    yPrev = y;
    xPrev = x;
  }
  return buf;
}

/** Реверберация Шрёдера: четыре гребёнки параллельно, два алл-пасса подряд. */
function reverb(buf, { combGain = 0.8, mix = 1 } = {}) {
  const combs = [1116, 1188, 1277, 1356];
  const out = new Float32Array(buf.length);
  for (const d of combs) {
    const line = new Float32Array(buf.length + d);
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i] + combGain * line[i];
      line[i + d] = v;
      out[i] += v * 0.25;
    }
  }
  for (const d of [556, 441]) {
    const g = 0.5;
    const line = new Float32Array(out.length + d);
    for (let i = 0; i < out.length; i++) {
      const v = out[i] + g * line[i];
      line[i + d] = v;
      out[i] = -g * v + line[i];
    }
  }
  if (mix < 1) for (let i = 0; i < out.length; i++) out[i] = buf[i] * (1 - mix) + out[i] * mix;
  return out;
}

function add(dst, src, atSec, gain = 1) {
  const start = Math.round(atSec * SR);
  for (let i = 0; i < src.length; i++) {
    const j = start + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i] * gain;
  }
}

function normalize(buf, peak = 0.9) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] / max) * peak;
  return buf;
}

function writeWav(path, channels) {
  const n = channels[0].length;
  const ch = channels.length;
  const bytes = n * ch * 2;
  const b = Buffer.alloc(44 + bytes);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + bytes, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * ch * 2, 28);
  b.writeUInt16LE(ch * 2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(bytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, channels[c][i]));
      b.writeInt16LE(Math.round(v * 32767), o);
      o += 2;
    }
  }
  writeFileSync(path, b);
  return b.length;
}

// ── голоса ─────────────────────────────────────────────────────────────────

function kick(dur = 0.4) {
  const buf = new Float32Array(Math.round(dur * SR));
  let phase = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const f = 40 + 100 * Math.exp(-t / 0.028);
    phase += f / SR;
    buf[i] = softClip(sine(phase) * 1.15) * Math.exp(-t / 0.13);
  }
  return buf;
}

function hat(noise, dur = 0.05, decay = 0.015) {
  const buf = new Float32Array(Math.round(dur * SR));
  for (let i = 0; i < buf.length; i++) buf[i] = noise() * Math.exp(-i / SR / decay);
  return highpass(buf, 6200);
}

function bassNote(freq, dur) {
  const buf = new Float32Array(Math.round(dur * SR));
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.008) * Math.exp(-t / (dur * 0.55));
    buf[i] = softClip(sine(freq * t) * 1.6) * env;
  }
  return lowpass(buf, () => 320);
}

function pluckNote(freq, dur) {
  const buf = new Float32Array(Math.round(dur * SR));
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    buf[i] = tri(freq * t) * Math.min(1, t / 0.004) * Math.exp(-t / 0.19);
  }
  return lowpass(buf, () => 2600);
}

/** Пэд: четыре расстроенные пилы, медленная атака, фильтр открывается по ходу. */
function padChord(freqs, dur, cutoffAt) {
  const buf = new Float32Array(Math.round(dur * SR));
  const detune = [0.994, 0.998, 1.002, 1.006];
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const f of freqs) for (const d of detune) v += saw(f * d * t);
    const env = Math.min(1, t / 0.9) * Math.min(1, (dur - t) / 0.7);
    buf[i] = (v / (freqs.length * detune.length)) * env;
  }
  lowpass(buf, cutoffAt);
  return lowpass(buf, cutoffAt);
}

// ── подложка ───────────────────────────────────────────────────────────────

// Ля минор. Гармония держится по два такта: Am – F – C – G. Петля из восьми
// тактов повторяется, последний такт возвращает Am.
const A2 = 110,
  C3 = 130.81,
  F2 = 87.31,
  G2 = 98;
const A3 = 220,
  B3 = 246.94,
  C4 = 261.63,
  D4 = 293.66,
  E4 = 329.63,
  F4 = 349.23,
  G4 = 392,
  A4 = 440,
  C5 = 523.25;

const PROGRESSION = [
  { root: A2, pad: [A3, C4, E4, A4], scale: [A3, C4, D4, E4, G4, A4, C5] },
  { root: F2, pad: [A3, C4, F4, A4], scale: [F4, A3, C4, E4, F4, A4, C5] },
  { root: C3, pad: [C4, E4, G4, C5], scale: [C4, E4, G4, A4, C5, E4, G4] },
  { root: G2, pad: [B3, D4, G4, B3 * 2], scale: [G4, B3, D4, E4, G4, A4, D4] },
];

function buildBed() {
  const n = Math.round(DURATION * SR);
  const drums = new Float32Array(n);
  const bass = new Float32Array(n);
  const pad = new Float32Array(n);
  const pluck = new Float32Array(n);
  const noise = makeNoise();

  // Фильтр пэда открывается за первые восемь тактов и снова прикрывается в
  // финале: это и есть «рассвет» и «выдох» ролика, без смены нот.
  const cutoffAt = (t) => {
    const open = 420 + 1800 * Math.min(1, t / (BAR * 8));
    const closeFrom = BAR * PAD_CLOSE_FROM;
    return t < closeFrom ? open : open - (open - 700) * Math.min(1, (t - closeFrom) / (BAR * 3));
  };

  for (let bar = 0; bar < BARS; bar++) {
    const t0 = bar * BAR;
    const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];

    add(
      pad,
      padChord(chord.pad, BAR + 0.4, (t) => cutoffAt(t0 + t)),
      t0,
      0.6,
    );

    // Ударные и бас входят сразу после «Утра» и уходят на десктопной сцене:
    // ролик начинается в тишине и в ней же заканчивается.
    if (bar >= DRUMS_IN && bar < DRUMS_OUT) {
      add(drums, kick(), t0, 1);
      add(drums, kick(), t0 + BEAT * 2, 0.92);
      const sixteenths = bar >= SIXTEENTHS_FROM;
      const step = sixteenths ? BEAT / 4 : BEAT / 2;
      for (let t = step; t < BAR; t += step) {
        const accent = Math.abs(t % BEAT) < 1e-6 ? 0.26 : 0.14;
        add(drums, hat(noise), t0 + t, accent);
      }
      for (let b = 0; b < 4; b++) {
        const f = b === 3 ? chord.root * 1.5 : chord.root;
        add(bass, bassNote(f, BEAT * 0.9), t0 + b * BEAT, 0.55);
      }
    }

    // Плак-арпеджио — с середины: к этому времени ролик уже рассказывает про
    // чек и делёж, и мелодии есть что поддерживать.
    if (bar >= PLUCK_IN && bar < DRUMS_OUT) {
      for (let s = 0; s < 8; s++) {
        const f = chord.scale[(s + bar) % chord.scale.length];
        add(pluck, pluckNote(f, BEAT * 0.6), t0 + s * (BEAT / 2), s % 2 === 0 ? 0.3 : 0.18);
      }
    }
  }

  const wet = reverb(
    Float32Array.from({ length: n }, (_, i) => pad[i] * 0.35 + pluck[i] * 0.4),
    { combGain: 0.78 },
  );

  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const widthDelay = Math.round(0.011 * SR);
  for (let i = 0; i < n; i++) {
    const dry = drums[i] * 0.72 + bass[i] * 0.72 + pad[i] * 0.78 + pluck[i] * 0.42;
    const w = wet[i] * 0.3;
    left[i] = softClip((dry + w) * 0.8);
    right[i] = softClip((dry + (i >= widthDelay ? wet[i - widthDelay] * 0.3 : w)) * 0.8);
  }
  normalize(left, 0.86);
  normalize(right, 0.86);
  return [left, right];
}

// ── звуковой дизайн ────────────────────────────────────────────────────────

function whoosh() {
  const noise = makeNoise(0x5eed01);
  const dur = 0.38;
  const buf = new Float32Array(Math.round(dur * SR));
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.09) * Math.exp(-Math.max(0, t - 0.09) / 0.1);
    buf[i] = noise() * env;
  }
  highpass(buf, 400);
  lowpass(buf, (t) => 700 + 4200 * Math.sin(Math.min(1, t / dur) * Math.PI));
  return normalize(buf, 0.85);
}

function tick() {
  const noise = makeNoise(0x5eed02);
  const buf = new Float32Array(Math.round(0.06 * SR));
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    buf[i] = (noise() * 0.7 + sine(2300 * t) * 0.5) * Math.exp(-t / 0.012);
  }
  highpass(buf, 1800);
  return normalize(buf, 0.7);
}

function thock() {
  const buf = new Float32Array(Math.round(0.14 * SR));
  let phase = 0;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    phase += (120 + 90 * Math.exp(-t / 0.02)) / SR;
    buf[i] = sine(phase) * Math.exp(-t / 0.045);
  }
  return normalize(buf, 0.8);
}

function chime() {
  const dur = 1.1;
  const buf = new Float32Array(Math.round(dur * SR));
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    buf[i] = sine(880 * t) * Math.exp(-t / 0.36) * 0.6 + sine(1320 * t) * Math.exp(-t / 0.28) * 0.35 + sine(1760 * t) * Math.exp(-t / 0.16) * 0.16;
  }
  const wet = reverb(buf, { combGain: 0.72, mix: 0.45 });
  return normalize(wet, 0.8);
}

// ── сборка ─────────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });

const bed = buildBed();
const files = [
  ["bed.wav", bed],
  ["sfx-whoosh.wav", [whoosh()]],
  ["sfx-tick.wav", [tick()]],
  ["sfx-thock.wav", [thock()]],
  ["sfx-chime.wav", [chime()]],
];

for (const [name, channels] of files) {
  const size = writeWav(join(OUT, name), channels);
  const seconds = (channels[0].length / SR).toFixed(3);
  console.log(`✓ ${name.padEnd(16)} ${seconds} c  ${(size / 1024 / 1024).toFixed(2)} МБ  ${channels.length === 2 ? "стерео" : "моно"}`);
}

console.log(`\nПодложка: ${BPM} BPM, ${BARS} тактов по ${BAR} c = ${DURATION.toFixed(2)} c`);
