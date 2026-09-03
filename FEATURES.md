# Practice Recorder — Product Features

For use in creating promotional and App Store materials. Describes what the app does from the user's perspective.

---

## What It Is

Practice Recorder is a musician's practice tool that runs in the browser. The core idea: record yourself playing, then replay the recording at any speed — half time, quarter time, or slower — to analyze your technique, check intonation, and practice difficult passages with precision.

---

## Recording

- **Record from your microphone** with a single tap
- **Adjustable recording speed** — slow down the recording process itself so you can physically play a passage more slowly while the metronome keeps accurate fractional time
- **5-minute maximum** recording length
- **Clean audio capture** — echo cancellation, noise suppression, and auto gain control are all disabled to preserve the natural sound of your instrument

---

## Playback

- **Variable-speed playback** — replay recordings at any fraction of normal speed (1/2, 1/4, 3/8, etc.) using a fraction-based speed control
- **Auto-play** — optionally start playback automatically after each recording
- **Speed persists** — your playback speed is saved in the URL, so it survives page reloads

---

## Metronome

- **Recording metronome** — audible click track during recording to keep time
- **Playback metronome** — audible click track during playback, automatically adjusted to match playback speed
- **Random click silencing** — randomly omit a percentage of clicks to test whether you can keep time independently
- **Click flash** — full-screen visual flash on every beat for visual timing feedback (toggleable)
- **Beat hierarchy** — distinct pitch levels for beats, subdivisions, and sub-subdivisions

---

## Practice Block System

Build a reusable practice sequence by chaining blocks together. The block sequence runs from top to bottom, controlling the metronome and recording state automatically.

| Block | What it does |
|---|---|
| **Set Metronome** | Set BPM (5–512) and time signature |
| **Set Beat Pattern** | Define a custom beat grid — which beats are strong, weak, or silent |
| **Set Subdivision** | Set how many subdivisions the metronome clicks per beat, independently for recording and playback |
| **Beats** | Play for a set number of beats (up to 256) |
| **Measures** | Play for a set number of measures (up to 256) |
| **Duration** | Play for a set number of seconds (up to 10 minutes) |
| **Pause** | Insert silence (up to 1 minute) |
| **Accelerando** | Gradually increase tempo from a starting BPM to a target BPM, with selectable curves (linear, quadratic, cosine, circular) |
| **MIDI Notation** | Enter notes in Lilypond notation syntax; the app synthesizes and plays them alongside you during recording or playback |
| **Start/Stop Recording** | Place recording start and end points anywhere in the sequence |

Practice sequences are saved and can be shared as a URL — send your setup to a student or colleague and they can load it instantly.

---

## Waveform Visualization

- **Real-time waveform** — see your recording as a waveform while you play
- **Scrollable and zoomable** — drag to scrub through long recordings; scroll or pinch to zoom
- **Amplitude grid** — horizontal reference lines showing loudness levels
- **Time grid** — vertical 1-second markers for recordings over 15 seconds
- **Auto-scroll during playback** — a position marker follows playback through the waveform

---

## Pitch Detection & Tuner

- **Intonation overlay** — after recording, a line appears on the waveform showing your pitch deviation (in cents) from equal temperament at every moment
- **Live tuner** — a color-coded display shows the detected pitch and how sharp or flat you are in real time
- **Note colors** — each note of the chromatic scale is assigned a distinct color, with shading by octave
- **YIN algorithm** — pitch detection tuned for wind instruments, with an adaptive large-window pass that resolves low fundamentals down to the bottom of the bass clarinet's range (concert ~52 Hz)

---

## Drone

- Generate a **sustained reference tone** for ear training or tuning
- Choose any chromatic pitch (C through B) and any octave (1–6)
- Change pitch while the drone is playing
- Toggle on and off independently from recording

---

## Tap Tempo

- Tap Enter repeatedly to measure BPM by feel
- Displays the calculated tempo in real time
- Averages your last 8 taps for stability

---

## Video Recording

- **Record video from your webcam** synchronized with audio
- Mirrored preview so you can watch yourself while playing
- **Synchronized playback** — video plays back alongside your audio recording, with automatic drift correction at any playback speed
- **Expandable video panel** — view video full-height alongside the waveform
- Toggle video recording on or off independently from audio

---

## Saving & Sharing

- **Named saves** — save your entire practice setup (all blocks, BPM, speeds, patterns) under a custom name
- **Reload anytime** — saves are stored in the browser and persist across sessions
- **Shareable URL** — every practice configuration is encoded into the URL; paste it anywhere to share your exact setup

---

## Export & Download

- **Download as WAV** — export your recording as a standard WAV audio file, timestamped
- **Download video** — if video was recorded, download it as a video file alongside the audio

---

## Advanced Settings

- **Audio latency compensation** — adjustable offset (default 145 ms) to correct for hardware and OS audio delay
- **Video latency compensation** — adjustable offset to sync video with audio
- All settings are adjustable within the app — no configuration files needed

---

## Platform

- Runs entirely in the browser — no installation required for the web version
- No server backend — all recordings stay on your device
- iOS app available (coming soon)
