class BoolSwitchControls {
  private _value: boolean;

  constructor(name: string, opts?: { initial?: boolean }) {
    this._value = opts?.initial || false;
    document.getElementById(name)?.addEventListener("click", this.changeValue.bind(this));
  }

  public value(): boolean {
    return this._value;
  }

  private changeValue(event: Event): void {
    this._value = (event.target as HTMLInputElement).checked;
  }
}

export default function boolSwitchControls(name: string, opts?: { initial?: boolean }): () => boolean {
  const c = new BoolSwitchControls(name, opts);
  return c.value.bind(c);
}
