import QueryParams from "../query-params";

class BoolSwitchControls {
  private name: string;
  private elem: HTMLInputElement;
  private _value: boolean;

  constructor(name: string, opts?: { initial?: boolean }) {
    this.name = name;
    this.elem = document.getElementById(name) as HTMLInputElement;
    this.elem.addEventListener("click", () => { this.setValue(this.elem.checked) });

    this._value = false;

    const value = QueryParams.get(name);
    if (value !== null) {
      this.setValue(value === "true");
    } else {
      this.setValue(opts?.initial || false);
    }
  }

  public value(): boolean {
    return this._value;
  }

  private setValue(val: boolean): void {
    this._value = val;
    if (this.elem.checked !== val) {
      this.elem.checked = val;
      this.elem.dispatchEvent(new Event("click"));
    }
    QueryParams.set(this.name, val.toString());
  }
}

export default function boolSwitchControls(name: string, opts?: { initial?: boolean }): () => boolean {
  const c = new BoolSwitchControls(name, opts);
  return c.value.bind(c);
}
