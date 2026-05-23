export const OVERTONES = [
  { ratio: 1,  volume: 0.45  },
  { ratio: 2,  volume: 0.25  },
  { ratio: 3,  volume: 0.05  },
  { ratio: 4,  volume: 0.10  },
  { ratio: 5,  volume: 0.04  },
  { ratio: 6,  volume: 0.03  },
  { ratio: 8,  volume: 0.02  },
  { ratio: 16, volume: 0.005 },
];

export class Synth {
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  // Start persistent overtone oscillators connected to output (for drone).
  // Returns oscillators so the caller can stop them later.
  startOvertones(frequency: number, output: AudioNode): OscillatorNode[] {
    const oscillators: OscillatorNode[] = [];
    for (const { ratio, volume } of OVERTONES) {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency * ratio;
      gainNode.gain.value = volume;

      oscillator.connect(gainNode);
      gainNode.connect(output);
      oscillator.start();

      oscillators.push(oscillator);
    }
    return oscillators;
  }

  // Schedule a timed MIDI note with attack/release envelope (for MIDI playback).
  // Returns the master gain and oscillator nodes so stop() can cancel them.
  scheduleNote(
    when: number,
    frequency: number,
    durationSec: number,
  ): { masterGain: GainNode; oscillators: OscillatorNode[] } {
    const minDuration = 0.02;
    const duration = Math.max(durationSec, minDuration);

    const attackTime = Math.min(0.001, duration * 0.1);
    const releaseTime = Math.min(0.08, duration * 0.25);

    const masterGain = this.audioContext.createGain();
    masterGain.gain.setValueAtTime(0, when);
    masterGain.gain.linearRampToValueAtTime(0.25, when + attackTime);
    masterGain.gain.setValueAtTime(0.25, when + duration - releaseTime);
    masterGain.gain.linearRampToValueAtTime(0, when + duration);
    masterGain.connect(this.audioContext.destination);

    const oscillators: OscillatorNode[] = [];
    for (const { ratio, volume } of OVERTONES) {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency * ratio, when);
      gainNode.gain.value = volume;

      oscillator.connect(gainNode);
      gainNode.connect(masterGain);

      oscillator.start(when);
      oscillator.stop(when + duration + 0.01);
      oscillators.push(oscillator);
    }

    return { masterGain, oscillators };
  }

  // Schedule a sharp click sound (for metronome).
  scheduleClick(when: number, hz: number, vol: number, type: OscillatorType = "square"): void {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(hz, when);

    gainNode.gain.setValueAtTime(0, when);
    gainNode.gain.linearRampToValueAtTime(vol, when + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.001, when + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(when);
    oscillator.stop(when + 0.05);
  }
}
