import Cookies from "./cookies";
import { plusMinusControls } from "./controls";

export default class LatencyCompensator {
  public getLatency;

  constructor(prefix: string, cookieName: string, defaultLatency: number) {
    const initial = parseInt(Cookies.get(cookieName)) || defaultLatency;
    this.getLatency = plusMinusControls(prefix, { initial: initial, min: -500, max: 500 });
    document.getElementById(`${prefix}-val`)!.addEventListener("input", () => {
      Cookies.set(cookieName, this.getLatency().toString());
    });
  }
}
