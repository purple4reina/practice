import Cookies from "./cookies";
import { plusMinusControls } from "./controls";

export default class LatencyCompensator {
  private readonly cookieName = "latency-compensation";
  public getLatency;

  constructor() {
    const initial = parseInt(Cookies.get(this.cookieName)) || 145;
    this.getLatency = plusMinusControls("latency-compensator", { initial: initial, min: -500, max: 500 });
    document.getElementById("latency-compensator-val")!.addEventListener("input", () => {
      Cookies.set(this.cookieName, this.getLatency().toString());
    });
  }
}
