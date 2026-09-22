import { State } from "./state";

// Module scope so tests can exercise the real processor source instead of a
// hand-written stand-in of it.
export const RECORDER_WORKLET_SOURCE = `
  class RecorderWorklet extends AudioWorkletProcessor {
    constructor() {
      super();
      this.isRecording = false;
      this.port.onmessage = (event) => {
        if (event.data.command === "start") {
          this.isRecording = true;
        } else if (event.data.command === "stop") {
          this.isRecording = false;
          // Ack *after* clearing the flag. A MessagePort delivers in FIFO
          // order, so this arrives on the main thread behind every
          // "audiodata" message already posted and ahead of none - which is
          // what lets stop() know the tail of the recording has landed.
          this.port.postMessage({ type: "stopped" });
        }
      };
    }

    process(inputs, outputs) {
      if (this.isRecording && inputs[0] && inputs[0][0]) {
        const left = inputs[0][0];
        const right = inputs[0][1] || inputs[0][0]; // duplicate mono sources to both channels
        // Send both channels to the main thread
        this.port.postMessage({
          type: "audiodata",
          audioDataL: left.slice(),
          audioDataR: right.slice()
        });
      }
      return true;
    }
  }
  registerProcessor("recorder-worklet", RecorderWorklet);
`;

export default class RecorderDevice {
  private audioContext: AudioContext;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private recordingNode: AudioWorkletNode | null = null;
  private state: State = State.UNKNOWN;
  private recordedBuffer: AudioBuffer | null = null;
  private recordingDataL: Float32Array[] = [];
  private recordingDataR: Float32Array[] = [];
  private sampleRate: number = 44100;
  private maxRecordingLength: number = 300; // 5 minutes max
  private stopFlushTimeoutMs: number = 250;
  private pendingStop: Promise<void> | null = null;
  private resolveFlush: (() => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;
  }

  async initialize(): Promise<void> {
    try {
      // Get user media
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: this.sampleRate,
          channelCount: { ideal: 2 }
        }
      });

      // Create source node
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

      // Try to register AudioWorklet, fallback to ScriptProcessor
      try {
        await this.audioContext.audioWorklet.addModule(this.getRecorderWorkletCode());
        this.recordingNode = new AudioWorkletNode(this.audioContext, "recorder-worklet");
        this.setupWorkletRecording();
      } catch (error) {
        console.warn("AudioWorklet not supported, falling back to ScriptProcessorNode");
        this.setupScriptProcessorRecording();
      }

      this.state = State.STOPPED;
    } catch (error) {
      console.error("Error initializing Web Audio recorder:", error);
      throw error;
    }
  }

  private getRecorderWorkletCode(): string {
    // Create a blob URL for the AudioWorklet processor
    const blob = new Blob([RECORDER_WORKLET_SOURCE], { type: "application/javascript" });
    return URL.createObjectURL(blob);
  }

  private setupWorkletRecording(): void {
    if (!this.recordingNode) return;

    this.recordingNode.port.onmessage = (event) => {
      if (event.data.type === "audiodata") {
        this.recordingDataL.push(new Float32Array(event.data.audioDataL));
        this.recordingDataR.push(new Float32Array(event.data.audioDataR));

        // Prevent memory overflow
        if (this.recordingDataL.length > this.maxRecordingLength * this.sampleRate / 128) {
          console.warn("Maximum recording length reached");
          void this.stop();
        }
      } else if (event.data.type === "stopped") {
        this.resolveFlush?.();
      }
    };
  }

  private setupScriptProcessorRecording(): void {
    // Fallback to ScriptProcessorNode (deprecated but widely supported)
    const bufferSize = 4096;
    const scriptNode = this.audioContext.createScriptProcessor(bufferSize, 2, 2);

    scriptNode.onaudioprocess = (event) => {
      if (this.state === State.RECORDING) {
        const left = event.inputBuffer.getChannelData(0);
        const right = event.inputBuffer.numberOfChannels > 1
          ? event.inputBuffer.getChannelData(1)
          : left; // duplicate mono sources to both channels
        this.recordingDataL.push(new Float32Array(left));
        this.recordingDataR.push(new Float32Array(right));

        // Prevent memory overflow
        if (this.recordingDataL.length > this.maxRecordingLength * this.sampleRate / bufferSize) {
          console.warn("Maximum recording length reached");
          void this.stop();
        }
      }
    };

    this.recordingNode = scriptNode as any; // Type hack for compatibility
  }

  start() {
    if (this.state !== State.STOPPED) {
      console.error("Recorder is not in a stopped state, cannot start recording");
      return;
    }

    try {
      // Clear previous recording
      this.recordingDataL = [];
      this.recordingDataR = [];

      // Connect the audio graph
      if (this.sourceNode && this.recordingNode) {
        this.sourceNode.connect(this.recordingNode);
        // For ScriptProcessorNode, we need to connect to destination
        if (this.recordingNode instanceof ScriptProcessorNode) {
          this.recordingNode.connect(this.audioContext.destination);
        }
      }

      // Start recording
      this.state = State.RECORDING;

      if (this.recordingNode instanceof AudioWorkletNode) {
        this.recordingNode.port.postMessage({ command: "start" });
      }
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  }

  // Both capture paths hand audio to the main thread through the event loop,
  // so at the instant stop() is called the last several render quanta have
  // been captured but not yet delivered. Snapshotting the buffer here
  // synchronously (as this used to) dropped them - i.e. chopped the end off
  // the last recorded beat - so the flush below has to finish first.
  async stop(): Promise<void> {
    if (this.pendingStop) {
      return this.pendingStop;
    }
    if (this.state !== State.RECORDING) {
      return;
    }

    this.pendingStop = this.finishRecording();
    try {
      await this.pendingStop;
    } finally {
      this.pendingStop = null;
    }
  }

  private async finishRecording(): Promise<void> {
    try {
      if (this.recordingNode instanceof AudioWorkletNode) {
        await this.flushWorklet(this.recordingNode);
      } else {
        // ScriptProcessorNode's onaudioprocess already runs on the main
        // thread, so there is no cross-thread ack to wait for - but its events
        // are still queued tasks, so one bufferSize of captured audio can be
        // sitting undelivered. Yield a turn with the node still connected and
        // still in RECORDING state so that handler can append it first.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.error("Error flushing recorded audio:", error);
    }

    this.state = State.STOPPED;

    try {
      // Disconnect only after the flush: a worklet node with nothing left
      // feeding it may stop being pulled by the graph, and would then never
      // see the stop command or send the ack the flush is waiting on.
      if (this.sourceNode && this.recordingNode) {
        this.sourceNode.disconnect(this.recordingNode);
        if (this.recordingNode instanceof ScriptProcessorNode) {
          this.recordingNode.disconnect();
        }
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
    }

    this.processRecordedData();
  }

  // Resolves once the worklet has acked the stop command, which - because the
  // ack is posted after every "audiodata" message and the port is FIFO - means
  // every captured quantum has been delivered. Kept on a timeout so a
  // suspended context or a torn-down node can't hang the UI.
  private flushWorklet(node: AudioWorkletNode): Promise<void> {
    return new Promise<void>(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.resolveFlush = null;
        resolve();
      };
      this.resolveFlush = finish;
      const timer = setTimeout(finish, this.stopFlushTimeoutMs);
      node.port.postMessage({ command: "stop" });
    });
  }

  private processRecordedData(): void {
    if (this.recordingDataL.length === 0) {
      console.warn("No audio data recorded");
      return;
    }

    // Calculate total length
    const totalLength = this.recordingDataL.reduce((sum, chunk) => sum + chunk.length, 0);

    // Create a stereo AudioBuffer (mono sources were already duplicated to
    // both channels upstream, so this is always safe)
    this.recordedBuffer = this.audioContext.createBuffer(2, totalLength, this.sampleRate);
    const left = this.recordedBuffer.getChannelData(0);
    const right = this.recordedBuffer.getChannelData(1);

    // Copy data into buffer
    let offset = 0;
    for (let i = 0; i < this.recordingDataL.length; i++) {
      left.set(this.recordingDataL[i], offset);
      right.set(this.recordingDataR[i], offset);
      offset += this.recordingDataL[i].length;
    }
  }

  getAudioBuffer(): AudioBuffer | null {
    try {
      return this.recordedBuffer;
    } finally {
      this.recordedBuffer = null; // Clear after retrieval
    }
  }

  getMediaStream(): MediaStream | null {
    return this.stream;
  }

  async reset(): Promise<void> {
    if (this.state === State.RECORDING) {
      await this.stop();
    }

    if (this.stream && this.sourceNode) {
      try {
        this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

        if (this.recordingNode instanceof AudioWorkletNode) {
          this.recordingNode = new AudioWorkletNode(this.audioContext, "recorder-worklet");
          this.setupWorkletRecording();
        } else {
          this.setupScriptProcessorRecording();
        }

        this.state = State.STOPPED;
      } catch (error) {
        console.error("Error resetting recorder:", error);
      }
    }
  }
}
