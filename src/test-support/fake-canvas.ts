import { vi } from "vitest";

// jsdom doesn't implement canvas rendering (HTMLCanvasElement.getContext('2d')
// returns null), so Visualizer can't be constructed without this stub. Only
// the subset of CanvasRenderingContext2D this codebase actually calls.
export function installFakeCanvasContext(): any {
  const ctx: any = {
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);
  return ctx;
}
