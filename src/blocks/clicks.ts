import { MidiNote, MidiSequencer } from "../midi";

class ClickStateAccel {
  enabled: boolean = false;
  kind: string | undefined;
  clicks: Click[] = [];

  reset() {
    this.enabled = false;
    this.kind = undefined;
    this.clicks = [];
  }

  start(kind: string) {
    this.reset();
    this.enabled = true;
    this.kind = kind;
  }
}

export class ClickState {
  phase: string;
  bpm: number = 0;
  beatsPerMeasure: number = 1;
  subdivisions: number = 1;
  beatIndex: number = 1;
  beatPattern: number[] = [1];
  started: boolean = false;
  recording: boolean = false;
  accel = new ClickStateAccel();
  midiSequencers: MidiSequencer[] = [];

  constructor(phase: "record" | "play") {
    this.phase = phase;
  }

  getLevel(): number {
    let level = this.beatPattern[this.beatIndex % this.beatsPerMeasure];
    if (this.phase == "play" && level === 0) {
      level = (this.beatIndex % this.beatsPerMeasure) === 0 ? 1 : 2;
    }
    return level;
  }

  getMidiNotesForBeat(beatMs: number): MidiNote[] {
    const result: MidiNote[] = [];
    for (const sequencer of this.midiSequencers) {
      for (const note of sequencer.getNotesForBeat(beatMs)) {
        result.push(note);
      }
    }
    return result;
  }

  getMidiNotesForPortion(beatsToAdvance: number, durationMs: number): MidiNote[] {
    const result: MidiNote[] = [];
    for (const sequencer of this.midiSequencers) {
      for (const note of sequencer.getNotesForPortion(beatsToAdvance, durationMs)) {
        result.push(note);
      }
    }
    return result;
  }
}

export interface Click {
  delay: number,
  level: number,
  started: boolean,
  recording: boolean,
  isBeat?: boolean,
  midiNotes?: MidiNote[],
}
