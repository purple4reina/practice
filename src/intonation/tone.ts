// A sustained, instrument-like reference tone: a band-limited harmonic series
// (not a bare sine), a soft attack/release, and a low-pass filter. One of two
// timbres is chosen per exercise.

interface Timbre {
  harmonics: (n: number) => number; // amplitude of the nth harmonic
  vibrato: boolean;
}

const TIMBRES: Timbre[] = [
  // clarinet-like: odd harmonics dominate
  { harmonics: n => (n % 2 ? 1 / n : 0.04 / n), vibrato: false },
  // string-like: full series with gentle vibrato
  { harmonics: n => 1 / Math.pow(n, 1.2), vibrato: true },
];

const HARMONICS = 20;

export interface Tone { stop(): void }

export function randomTimbre(): number {
  return Math.floor(Math.random() * TIMBRES.length);
}

export function playTone(ctx: AudioContext, freq: number, timbreIndex: number): Tone {
  const timbre = TIMBRES[timbreIndex];
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  for (let n = 1; n <= HARMONICS; n++) imag[n] = timbre.harmonics(n);

  const osc = ctx.createOscillator();
  osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
  osc.frequency.value = freq;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = Math.min(freq * 6, 6000);

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.08);

  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(now);

  let lfo: OscillatorNode | null = null;
  if (timbre.vibrato) {
    // ~5.5 Hz, about +/-4 cents, fading in after the attack.
    lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, now);
    depth.gain.linearRampToValueAtTime(freq * 0.0023, now + 0.8);
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(now);
  }

  return {
    stop() {
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.15);
      osc.stop(t + 0.2);
      lfo?.stop(t + 0.2);
    },
  };
}
