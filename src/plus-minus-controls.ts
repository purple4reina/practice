class PlusMinusControls {
  private _value: number = 0;

  private valueInput: HTMLInputElement | null = null;
  private minusButton: HTMLButtonElement | null = null;
  private plusButton: HTMLButtonElement | null = null;

  private minValue: number = 0
  private maxValue: number = 0;

  constructor(name: string, opts: { initial: number, min: number, max: number }) {
    this._value = opts.initial;
    this.minValue = opts.min;
    this.maxValue = opts.max;

    this.valueInput = document.getElementById(`${name}-val`) as HTMLInputElement | null;
    this.minusButton = document.getElementById(`${name}-minus`) as HTMLButtonElement | null;
    this.plusButton = document.getElementById(`${name}-plus`) as HTMLButtonElement | null;

    this.valueInput?.addEventListener("change", this.setVal.bind(this));
    this.minusButton?.addEventListener("click", this.minusVal.bind(this));
    this.plusButton?.addEventListener("click", this.plusVal.bind(this));

    this.updateValueInputs();
  }

  public value(): number {
    return this._value;
  }

  private setVal(event: Event): void {
    const val = this.parseValue(event.target);
    this._value = val !== null ? val : this._value;
    this.updateValueInputs();
  }

  private minusVal(): void {
    this._value--;
    this.updateValueInputs();
  }

  private plusVal(): void {
    this._value++;
    this.updateValueInputs();
  }

  private updateValueInputs(): void {
    this._value = Math.max(this.minValue, Math.min(this.maxValue, this._value));
    if (this.valueInput) {
      this.valueInput.value = this._value.toString();
    }
  }

  private parseValue(target: EventTarget | null): number | null {
    if (!(target instanceof HTMLInputElement)) {
      console.error("Invalid target for input.");
      return null;
    }
    const value = parseInt(target.value.trim(), 10);
    if (isNaN(value)) {
      console.error("Value must be a valid integer.");
      return null;
    }
    return value;
  }
}

export default function plusMinusControls(name: string, opts: { initial: number, min: number, max: number }): () => number {
  const c = new PlusMinusControls(name, opts);
  return c.value.bind(c);
}
