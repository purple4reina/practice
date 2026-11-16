import { staffNote } from "./theory";

const HALF = 8;            // half a staff space, px
const BOTTOM_STEP = 30;    // E4, the bottom treble line
const BOTTOM_Y = 176;
const NOTE_X = 190;
const WIDTH = 280;
const HEIGHT = 250;

const y = (step: number) => BOTTOM_Y - (step - BOTTOM_STEP) * HALF;

// Treble clef with one whole note-head, as an SVG string.
export function renderStaff(writtenMidi: number): string {
  const n = staffNote(writtenMidi);
  const lines: string[] = [];
  const stroke = `stroke="currentColor" stroke-width="1.5"`;

  for (let i = 0; i < 5; i++) {
    const ly = y(BOTTOM_STEP + 2 * i);
    lines.push(`<line x1="10" x2="${WIDTH - 10}" y1="${ly}" y2="${ly}" ${stroke}/>`);
  }
  // Ledger lines: every even step outside the staff, up to the note.
  for (let s = BOTTOM_STEP - 2; s >= n.step; s -= 2) {
    lines.push(`<line x1="${NOTE_X - 18}" x2="${NOTE_X + 18}" y1="${y(s)}" y2="${y(s)}" ${stroke}/>`);
  }
  for (let s = BOTTOM_STEP + 10; s <= n.step; s += 2) {
    lines.push(`<line x1="${NOTE_X - 18}" x2="${NOTE_X + 18}" y1="${y(s)}" y2="${y(s)}" ${stroke}/>`);
  }

  const cy = y(n.step);
  const up = n.step < BOTTOM_STEP + 4;
  const stemX = up ? NOTE_X + 8.5 : NOTE_X - 8.5;
  const stemEnd = up ? cy - 52 : cy + 52;
  const accidental = n.accidental
    ? `<text x="${NOTE_X - 36}" y="${cy + 9}" font-size="30" text-anchor="middle" fill="currentColor">${n.accidental === "#" ? "♯" : "♭"}</text>`
    : "";

  return `<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img"
      aria-label="Treble clef, written ${n.letter}${n.accidental}${n.octave}" style="max-width:100%;height:auto">
    ${lines.join("")}
    <text x="10" y="${y(BOTTOM_STEP + 2) + 4}" font-size="150" fill="currentColor"
      font-family="'Noto Music','Apple Symbols','Segoe UI Symbol',serif">\u{1D11E}</text>
    ${accidental}
    <ellipse cx="${NOTE_X}" cy="${cy}" rx="10" ry="7" transform="rotate(-20 ${NOTE_X} ${cy})" fill="currentColor"/>
    <line x1="${stemX}" x2="${stemX}" y1="${cy}" y2="${stemEnd}" ${stroke}/>
  </svg>`;
}
