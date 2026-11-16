import { createPitchDetectors, MAX_FREQUENCY, MIN_FREQUENCY } from "../visualizer/pitch-track";
import { sleep } from "../utils";
import { renderStaff } from "./staff";
import { playTone, randomTimbre } from "./tone";
import {
  Exercise, INTERVAL_TYPES, noteName, pickExercise, scoreFrames, tuningExercise,
} from "./theory";

const ROUNDS = 12; // one per pitch class
const LISTEN_MS = 5000;   // how long each exercise runs
const SETTLE_MS = LISTEN_MS / 2; // only the second half is scored; the first half is for finding the note
const LEAD_IN_MS = 2000;  // note is shown this long before the tone starts
const POLL_MS = 50;
const MIN_RMS = 0.01;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const typesEl = $("interval-types");
const quizEl = $("quiz");
const summaryEl = $("summary");
const actionBtn = $<HTMLButtonElement>("action");
const errorEl = $("error");
const retryBtn = $<HTMLButtonElement>("retry");

let typeIndex = 0;
INTERVAL_TYPES.forEach((t, i) => {
  typesEl.insertAdjacentHTML("beforeend", `
    <input type="radio" class="btn-check" name="interval" id="type-${i}" autocomplete="off" ${i === 0 ? "checked" : ""}>
    <label class="btn btn-outline-secondary" for="type-${i}">${t.label}</label>`);
  $(`type-${i}`).addEventListener("change", () => { typeIndex = i; });
});

interface Round { exercise: Exercise; timbre: number; cents: number | null }

let rounds: Round[] = [];
let warmup: Round | null = null;    // round 0: tuning note, not part of the score
let lastWasWarmup = false;
let busy = false;

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let detectPitch: ((b: Float32Array) => number | null) | null = null;

let micTrack: MediaStreamTrack | null = null;

// Make sure the context is running and the mic is live; reopen the mic if its
// track has ended (e.g. a Bluetooth headset switching modes).
async function ensureAudio() {
  if (audioContext && micTrack?.readyState === "live") {
    if (audioContext.state !== "running") await audioContext.resume();
    return;
  }
  if (audioContext) await audioContext.close();
  // All browser audio processing off. It can gate the mic to silence while the tone plays,
  // and it distorts pitch. `exact` forces it; fall back to a plain request if refused.
  // Use headphones to keep the reference tone out of the mic.
  const raw = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, voiceIsolation: false };
  const off = { exact: false };
  const exact = { echoCancellation: off, noiseSuppression: off, autoGainControl: off, voiceIsolation: off };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: exact });
  } catch (e) {
    if (e instanceof Error && e.name === "NotAllowedError") throw e;
    stream = await navigator.mediaDevices.getUserMedia({ audio: raw });
  }
  micTrack = stream.getAudioTracks()[0];
  audioContext = new AudioContext();
  await audioContext.resume();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  detectPitch = createPitchDetectors(audioContext.sampleRate).detectPitch;
}

function rms(buf: Float32Array): number {
  let s = 0;
  for (const v of buf) s += v * v;
  return Math.sqrt(s / buf.length);
}

function applied() {
  const st = micTrack?.getSettings() as Record<string, unknown> | undefined;
  return { echo: st?.echoCancellation, noise: st?.noiseSuppression, agc: st?.autoGainControl, voiceIso: st?.voiceIsolation };
}

interface Listened { cents: number | null; why: string }

function listen(ex: Exercise, timbre: number): Promise<Listened> {
  const ctx = audioContext!;
  const buf = new Float32Array(analyser!.fftSize);
  const freqs: number[] = [];
  let maxRms = 0;
  const tone = playTone(ctx, ex.refFreq, timbre);
  const start = performance.now();
  const bar = $("progress");
  bar.style.transition = "none"; // Bootstrap's width transition makes the bar lag and slide back from 100%
  bar.style.width = "0%";
  $("progress-wrap").hidden = false;

  return new Promise(resolve => {
    const timer = setInterval(() => {
      const elapsed = performance.now() - start;
      bar.style.width = `${Math.min(100, (elapsed / LISTEN_MS) * 100)}%`;
      if (elapsed >= LISTEN_MS) {
        clearInterval(timer);
        tone.stop();
        $("progress-wrap").hidden = true;
        const cents = scoreFrames(freqs, ex.targetFreq);
        const why = `${freqs.length} pitched frames, loudest mic level ${maxRms.toFixed(3)} (needs ${MIN_RMS}); audio ${ctx.state}, mic ${micTrack?.readyState}${micTrack?.muted ? " (muted)" : ""}, processing ${JSON.stringify(applied())}`;
        if (cents === null) console.log("no note:", why, freqs.map(f => Math.round(f)));
        resolve({ cents, why });
        return;
      }
      if (elapsed < SETTLE_MS) return;
      analyser!.getFloatTimeDomainData(buf);
      const level = rms(buf);
      maxRms = Math.max(maxRms, level);
      if (level < MIN_RMS) return;
      const f = detectPitch!(buf);
      if (f && f >= MIN_FREQUENCY && f <= MAX_FREQUENCY) freqs.push(f);
    }, POLL_MS);
  });
}

// Whole cents. Round before choosing the sign so -0.3 reads "0¢", not "−0¢".
const fmt = (c: number) => {
  const r = Math.round(c);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)}¢`;
};
const word = (c: number) => (Math.round(c) === 0 ? "spot on" : c > 0 ? "sharp" : "flat");

// A retry replays the last round's exact note and tone quality, and overwrites its score.
// The first round of a session is round 0: a unison on concert A, which isn't scored.
async function runRound(retry = false) {
  const warm = retry ? lastWasWarmup : warmup === null;
  const index = retry ? rounds.length - 1 : rounds.length;
  const prev = retry ? (warm ? warmup! : rounds[index]) : null;
  const ex = prev ? prev.exercise : warm ? tuningExercise()
    : pickExercise(INTERVAL_TYPES[typeIndex], Math.random, new Set(rounds.map(r => r.exercise.writtenMidi % 12)));
  const timbre = prev ? prev.timbre : randomTimbre();
  const written = warm ? `Written ${noteName(ex.writtenMidi)} (concert A).` : `Written ${noteName(ex.writtenMidi)}.`;
  $("round-label").textContent = warm ? "Round 0: tuning note" : `Round ${index + 1} of ${ROUNDS}`;
  $("staff").innerHTML = renderStaff(ex.writtenMidi);
  $("hint").textContent = `${written} Get ready...`;
  $("result").textContent = "";
  quizEl.hidden = false;
  summaryEl.hidden = true;
  actionBtn.disabled = true;
  retryBtn.hidden = true;
  try {
    await ensureAudio();
    await sleep(LEAD_IN_MS);
    $("hint").textContent = `${written} Tune to the tone.`;
    const heard = await listen(ex, timbre);
    const why = heard.why;
    // Whole cents from here on, so the table, average and tendency all agree.
    const cents = heard.cents === null ? null : Math.round(heard.cents) + 0; // + 0 turns -0 into 0
    if (warm) warmup = { exercise: ex, timbre, cents }; else rounds[index] = { exercise: ex, timbre, cents };
    lastWasWarmup = warm;
    retryBtn.hidden = false;
    $("result").innerHTML = cents === null
      ? "No note detected"
      : `${fmt(cents)} <span class="text-secondary fs-6">${word(cents)}</span>`;
    $("hint").textContent = cents === null
      ? `Heard ${why}.`
      : warm ? "Tuning note: not scored." : `Target was ${fmt(ex.targetCents)} from equal temperament.`;
    actionBtn.textContent = !warm && rounds.length >= ROUNDS ? "See results" : "Next";
  } finally {
    actionBtn.disabled = false;
  }
}

function showSummary() {
  const scored = rounds.filter(r => r.cents !== null) as { exercise: Exercise; cents: number }[];
  const avgAbs = scored.length ? scored.reduce((s, r) => s + Math.abs(r.cents), 0) / scored.length : null;
  const bias = scored.length ? scored.reduce((s, r) => s + r.cents, 0) / scored.length : null;
  const rows = rounds.map((r, i) => `
    <tr><td>${i + 1}</td><td>${noteName(r.exercise.writtenMidi)}</td>
    <td>${r.cents === null ? "no note detected" : `${fmt(r.cents)} ${word(r.cents)}`}</td></tr>`).join("");

  summaryEl.innerHTML = `
    <h3>Final score</h3>
    <p class="fs-1 mb-0">${avgAbs === null ? "—" : `±${Math.round(avgAbs)}¢`}</p>
    <p class="text-secondary">average distance from just intonation${
      bias === null ? "" : `<br>overall tendency: ${fmt(bias)} ${word(bias)}`}</p>
    <table class="table table-sm mx-auto" style="max-width: 360px">
      <thead><tr><th>#</th><th>Written</th><th>Result</th></tr></thead><tbody>${rows}</tbody>
    </table>`;
  quizEl.hidden = true;
  summaryEl.hidden = false;
  retryBtn.hidden = true;
  actionBtn.textContent = "Try again";
}

actionBtn.addEventListener("click", async () => {
  if (busy) return;
  errorEl.textContent = "";
  busy = true;
  const unlock = () => typesEl.querySelectorAll("input").forEach(i => (i.disabled = false));
  try {
    const label = actionBtn.textContent;
    if (label === "Start" || label === "Try again") {
      rounds = [];
      warmup = null;
      typesEl.querySelectorAll("input").forEach(i => (i.disabled = true)); // locked for the session
      await runRound();
    } else if (label === "Next") {
      await runRound();
    } else {
      showSummary();
      unlock();
    }
  } catch (e) {
    errorEl.textContent = e instanceof Error && e.name === "NotAllowedError"
      ? "Microphone access is needed to hear you play."
      : `Something went wrong: ${e instanceof Error ? e.message : e}`;
    actionBtn.disabled = false;
    unlock();
  } finally {
    busy = false;
  }
});

retryBtn.addEventListener("click", async () => {
  if (busy) return;
  errorEl.textContent = "";
  busy = true;
  try {
    await runRound(true);
  } catch (e) {
    errorEl.textContent = `Something went wrong: ${e instanceof Error ? e.message : e}`;
  } finally {
    busy = false;
  }
});

// Space bar does what the action button does (Start / Next / See results / Try again).
// keyup is also suppressed so a focused button doesn't fire a second native click.
document.addEventListener("keydown", e => {
  if (e.code !== "Space") return;
  e.preventDefault();
  if (!e.repeat && !actionBtn.disabled) actionBtn.click();
});
document.addEventListener("keyup", e => {
  if (e.code === "Space") e.preventDefault();
});
