# Codebase Overview: Practice Recorder

## Purpose

A browser-based practice recorder for musicians. Core workflow: record yourself playing with a programmable metronome, then replay the recording at any speed (e.g. 1/2, 1/4) to analyze detail, check intonation, or practice difficult passages.

Deployed at: `purple4reina.github.io/practice` (GitHub Pages, static)

---

## Tech Stack

| Layer | Tool |
|---|---|
| Build | Vite 7.1.2 |
| Language | TypeScript ~5.8.3 (strict mode) |
| Testing | Vitest 4.0.16 |
| UI framework | Bootstrap 5.3.7 (CDN) + Bootstrap Icons 1.11.0 (CDN) |
| Analytics | Datadog Browser RUM 6.18.1 |
| Auth | Google Sign-In (CDN, conditional) |
| Core audio | Web Audio API (native browser) |

**Key npm dependencies:**
- `audiobuffer-to-wav` — export recordings as WAV
- `pitchfinder 2.3.2` — pitch detection for tuner
- `lz-string 1.5.0` — compress session data for URL sharing

**Build output:** `docs/` (served by GitHub Pages)
**Base path:** `/practice/`
**Build commands:**
```
npm run dev        # vite dev server
npm run build      # tsc + vite build --outDir docs
npm test           # vitest
```

---

## Project Structure

```
src/
├── main.ts                  # App entry point and top-level controller
├── recorder.ts              # Audio capture (AudioWorklet + ScriptProcessorNode fallback)
├── player.ts                # Audio playback with variable speed
├── metronome.ts             # Click generation (recording + playback metronomes)
├── synth.ts                 # Audio synthesis (clicks, drones, MIDI notes)
├── drone.ts                 # Drone tone feature
├── tapper.ts                # Tap tempo detection
├── visualizer/              # Real-time waveform, pitch, loudness display (Canvas)
├── clips.ts                 # Recording/playback abstraction + WAV download
├── video-recorder.ts        # Video capture via MediaRecorder
├── video-player.ts          # Video playback synchronized with audio
├── latency.ts               # Latency compensator (audio + video)
├── saves.ts                 # Session persistence (localStorage + URL sharing)
├── query-params.ts          # URL query parameter parsing for session sharing
├── login.ts                 # Google Sign-In integration
├── monitoring.ts            # Datadog RUM initialization
├── midi.ts                  # MIDI sequencer
├── state.ts                 # State enum: UNKNOWN | RECORDING | STOPPED | PLAYING
├── utils.ts                 # sleep() and other small utilities
├── blocks/                  # Composable practice workflow blocks (17 files)
└── controls/                # Reusable UI control components (7 files)

assets/
├── favicon.ico
└── style.css

index.html                   # Entry HTML; loads Bootstrap + Google Sign-In from CDN
vite.config.js               # { base: '/practice/' }
tsconfig.json                # ES2016 target, ES2022 modules, strict
```

---

## Architecture

### Controller Pattern

`WebAudioRecorderController` in `main.ts` is the central orchestrator. It holds and coordinates all subsystems:

```
WebAudioRecorderController
├── AudioContext               (shared across all audio nodes)
├── RecorderDevice             (captures mic input)
├── PlayerDevice               (plays back recordings)
├── RecordingMetronome         (click during recording)
├── PlaybackMetronome          (click during playback)
├── BlockManager               (manages practice block sequence)
├── Visualizer                 (waveform/pitch canvas)
├── LatencyCompensator x2      (audio + video offset)
├── VideoRecorderDevice        (optional video capture)
├── VideoPlayerDevice          (optional video playback)
├── Tapper                     (tap tempo)
└── Drone                      (sustained reference pitch)
```

State is a simple enum (`UNKNOWN → STOPPED → RECORDING → STOPPED → PLAYING`). No Redux or reactive state management.

### Block System (Composite Pattern)

The block manager lets musicians compose reusable practice sequences. Each block implements `IBlock` and returns click intervals for metronome timing.

Available blocks (in `src/blocks/`):
| Block | Purpose |
|---|---|
| `MetronomeBlock` | Set BPM and time signature |
| `PatternBlock` | Define beat patterns |
| `SubdivisionBlock` | Set rhythmic subdivisions |
| `BeatsBlock` | Count a specific number of beats |
| `MeasuresBlock` | Count specific measures |
| `DurationBlock` | Record for a set duration |
| `AccelerandoBlock` | Gradually increase tempo |
| `PauseBlock` | Insert silence |
| `StartRecordingBlock` | Begin recording at a specific point |
| `StopRecordingBlock` | End recording at a specific point |
| `MidiBlock` | Play MIDI note sequences alongside recording |
| `StartBlock` | Session start marker |
| `StopBlock` | Session end marker |

Sessions (block configurations) can be serialized to URL query params for sharing.

### Audio Recording

`recorder.ts` uses `AudioWorklet` for off-main-thread recording:
- Worklet processor code is inlined as a string and loaded via `URL.createObjectURL(blob)` (line 81-82)
- Falls back to `ScriptProcessorNode` if AudioWorklet fails (line 40-42)
- Max recording length: 5 minutes

### Video Recording

`video-recorder.ts` uses `MediaRecorder` with `video/webm;codecs=vp9` (hardcoded, line 3-4). Requires `getUserMedia({ video: true })`. Synchronized with audio via `requestVideoFrameCallback` (with `performance.now()` fallback).

### Session Persistence

`saves.ts` stores sessions to `localStorage`. Sessions can also be shared via URL: block configuration is LZ-compressed and base64-encoded into a `?record=` query parameter.

### Monitoring Gate

`main.ts` lines 36-39: Datadog RUM and Google Sign-In only activate when `window.location.hostname === "purple4reina.github.io"`. This is intentional — they are disabled in local development.

---

## Key Files for iOS Work

| File | Why it matters for iOS |
|---|---|
| `src/main.ts:42` | `new AudioContext()` at construction — iOS suspends until user gesture |
| `src/main.ts:36-39` | Hostname gate for monitoring — won't fire under Capacitor's `capacitor://localhost` |
| `src/recorder.ts:81-82` | Blob URL for AudioWorklet — WKWebView may block this; fallback at line 40-42 |
| `src/video-recorder.ts:3-4` | Hardcoded `video/webm;codecs=vp9` — not supported on iOS; needs runtime detection |
| `vite.config.js:2` | `base: '/practice/'` — must be `'/'` for Capacitor builds |

---

## Feature Summary

| Feature | Status | Notes |
|---|---|---|
| Audio recording | Complete | Web Audio API + fallback |
| Variable-speed playback | Complete | Fractional speed (e.g. 1/2, 3/4) |
| Dual metronome (record + playback) | Complete | Configurable clicks, patterns, subdivisions |
| Waveform visualization | Complete | Canvas, scrollable, zoomable |
| Pitch detection / Tuner | Complete | Pitchfinder library |
| Loudness analyzer | Complete | Canvas-based |
| Video recording + sync | Complete | WebM only (iOS fix needed) |
| Practice blocks (13 types) | Complete | Composable sequences |
| Session save/load | Complete | localStorage + URL sharing |
| WAV download | Complete | audiobuffer-to-wav |
| MIDI playback | Complete | Software synthesis, not Web MIDI API |
| Drone tone | Complete | Sustained oscillator |
| Tap tempo | Complete | |
| Latency compensation | Complete | Configurable audio + video offsets |
| Analytics | Conditional | Datadog RUM, GitHub Pages only |
| Google Sign-In | Conditional | GitHub Pages only |
