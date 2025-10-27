class BoolSwitchControls {
  private name: string;
  private elem: HTMLInputElement;
  private _value: boolean;

  constructor(name: string, opts?: { initial?: boolean }) {
    this.name = name;
    this.elem = document.getElementById(name) as HTMLInputElement;
    this.elem.addEventListener("click", () => { this.setValue(this.elem.checked) });

    this._value = false;
    for (const [key, value] of new URLSearchParams(window.location.search)) {
      if (key == name) {
        this.setValue(value === "true");
        return;
      }
    }
    this.setValue(opts?.initial || false);
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

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.append(this.name, val.toString());
    for (const [paramKey, paramValue] of new URLSearchParams(window.location.search)) {
      if (paramKey !== this.name) {
        url.searchParams.append(paramKey, paramValue);
      }
    }
    window.history.pushState(null, '', url.toString());
  }
}

export default function boolSwitchControls(name: string, opts?: { initial?: boolean }): () => boolean {
  const c = new BoolSwitchControls(name, opts);
  return c.value.bind(c);
}
