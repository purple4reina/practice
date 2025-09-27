export default class Drone {
  private audioContext: AudioContext;
  private oscillators: OscillatorNode[] = [];
  private gainNodes: GainNode[] = [];
  private masterGain: GainNode;
  private isPlaying: boolean = false;

  private droneButton = document.getElementById("drone") as HTMLElement;
  private pitchSelect = document.getElementById("drone-pitch") as HTMLSelectElement;
  private octaveSelect = document.getElementById("drone-octave") as HTMLSelectElement;

  private pitch: string = this.pitchSelect.value;
  private octave: string = this.octaveSelect.value;

  // Just intonation ratios for common harmonious intervals
  private justIntonationRatios = [
    { ratio: 1, volume: 0.45 },
    { ratio: 2, volume: 0.25 },
    { ratio: 3, volume: 0.05 },
    { ratio: 4, volume: 0.10 },
    { ratio: 5, volume: 0.04 },
    { ratio: 6, volume: 0.03 },
    { ratio: 8, volume: 0.02 },
    { ratio: 16, volume: 0.005 },
  ];

  constructor(audioContext: AudioContext, volume: number = 0.3) {
    this.audioContext = audioContext;

    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = volume;
    this.masterGain.connect(audioContext.destination);

    this.droneButton.addEventListener("click", this.toggle.bind(this));
    this.pitchSelect.addEventListener("change", this.pitchChange.bind(this));
    this.octaveSelect.addEventListener("change", this.octaveChange.bind(this));
  }

  private toggle() {
    if (this.isPlaying) {
      this.stop();
      this.droneButton.classList.remove("btn-primary");
      this.pitchSelect.classList.remove("bg-primary");
      this.octaveSelect.classList.remove("bg-primary");
    } else {
      this.start();
      this.droneButton.classList.add("btn-primary");
      this.pitchSelect.classList.add("bg-primary");
      this.octaveSelect.classList.add("bg-primary");
    }
  }

  private pitchChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newPitch = target.value;
    if (newPitch == this.pitch) return;
    this.pitch = newPitch;
    if (this.isPlaying) {
      this.start()
    }
  }

  private octaveChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newOctave = target.value;
    if (newOctave == this.octave) return;
    this.octave = newOctave;
    if (this.isPlaying) {
      this.start()
    }
  }

  private start() {
    if (this.isPlaying) {
      this.stop();
    }

    const fundamentalFrequency = this.getNoteFrequency(`${this.pitch}${this.octave}`);

    this.oscillators = [];
    this.gainNodes = [];

    // Create oscillators for each just intonation interval
    this.justIntonationRatios.forEach(({ ratio, volume }) => {
      const frequency = fundamentalFrequency * ratio;

      // Create oscillator
      const oscillator = this.audioContext.createOscillator();
      oscillator.type = 'sine'; // Pure sine waves for clean harmonics
      oscillator.frequency.value = frequency;

      // Create gain node for this oscillator
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume;

      // Connect: oscillator -> gain -> master gain -> destination
      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);

      // Start the oscillator
      oscillator.start();

      // Store references
      this.oscillators.push(oscillator);
      this.gainNodes.push(gainNode);
    });

    this.isPlaying = true;
  }

  private stop(): void {
    if (!this.isPlaying) return;

    // Stop all oscillators
    this.oscillators.forEach(oscillator => {
      try {
        oscillator.stop();
      } catch (e) {
        // Oscillator might already be stopped
      }
    });

    // Clear arrays
    this.oscillators = [];
    this.gainNodes = [];
    this.isPlaying = false;
  }

  // Helper method to get frequency for common notes
  private getNoteFrequency(note: string): number {
    const noteFrequencies: { [key: string]: number } = {
      'C0': 16.35,   'Db0': 17.32,  'D0': 18.35,   'Eb0': 19.45,
      'E0': 20.60,   'F0': 21.83,   'Gb0': 23.12,  'G0': 24.50,
      'Ab0': 25.96,  'A0': 27.50,   'Bb0': 29.14,  'B0': 30.87,

      'C1': 32.70,   'Db1': 34.65,  'D1': 36.71,   'Eb1': 38.89,
      'E1': 41.20,   'F1': 43.65,   'Gb1': 46.25,  'G1': 49.00,
      'Ab1': 51.91,  'A1': 55.00,   'Bb1': 58.27,  'B1': 61.74,

      'C2': 65.41,   'Db2': 69.30,  'D2': 73.42,   'Eb2': 77.78,
      'E2': 82.41,   'F2': 87.31,   'Gb2': 92.50,  'G2': 98.00,
      'Ab2': 103.83, 'A2': 110.00,  'Bb2': 116.54, 'B2': 123.47,

      'C3': 130.81,  'Db3': 138.59, 'D3': 146.83,  'Eb3': 155.56,
      'E3': 164.81,  'F3': 174.61,  'Gb3': 185.00, 'G3': 196.00,
      'Ab3': 207.65, 'A3': 220.00,  'Bb3': 233.08, 'B3': 246.94,

      'C4': 261.63,  'Db4': 277.18, 'D4': 293.66,  'Eb4': 311.13,
      'E4': 329.63,  'F4': 349.23,  'Gb4': 369.99, 'G4': 392.00,
      'Ab4': 415.30, 'A4': 440.00,  'Bb4': 466.16, 'B4': 493.88,

      'C5': 523.25,  'Db5': 554.37, 'D5': 587.33,  'Eb5': 622.25,
      'E5': 659.25,  'F5': 698.46,  'Gb5': 739.99, 'G5': 783.99,
      'Ab5': 830.61, 'A5': 880.00,  'Bb5': 932.33, 'B5': 987.77,

      'C6': 1046.50, 'Db6': 1108.73, 'D6': 1174.66, 'Eb6': 1244.51,
      'E6': 1318.51, 'F6': 1396.91,  'Gb6': 1479.98, 'G6': 1567.98,
      'Ab6': 1661.22, 'A6': 1760.00,  'Bb6': 1864.66, 'B6': 1975.53
    };

    return noteFrequencies[note] || 440; // Default to A4 if note not found
  }
}
