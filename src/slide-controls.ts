class SlideControls {
  private _value: number = 0;
  private min: number = 0;
  private max: number = 10;
  private step: number = 0.5;

  private slideInput: HTMLInputElement | null = null;
  private minusButton: HTMLButtonElement | null = null;
  private plusButton: HTMLButtonElement | null = null;

  constructor(name: string, opts: { initial: number, min: number, max: number, step: number }) {
    this._value = opts.initial;
    this.min = opts.min;
    this.max = opts.max;
    this.step = opts.step;

    this.slideInput = document.getElementById(name) as HTMLInputElement | null;
    this.minusButton = document.getElementById(`${name}-minus`) as HTMLButtonElement | null;
    this.plusButton = document.getElementById(`${name}-plus`) as HTMLButtonElement | null;

    this.slideInput?.addEventListener("change", this.setVal.bind(this));
    this.minusButton?.addEventListener("click", this.minusVal.bind(this));
    this.plusButton?.addEventListener("click", this.plusVal.bind(this));

    this.updateSlideInput();

    this.slideInput?.addEventListener("keydown", (e) => {
        const activeElement = document.activeElement as HTMLInputElement;
        if (activeElement === this.slideInput) {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            this.plusVal();
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            this.minusVal();
          }
        }
    });
  }

  public value(): number {
    return this._value;
  }

  private setVal(event: Event): void {
    const val = this.parseValue(event.target);
    this._value = val !== null ? val : this._value;
    this.updateSlideInput();
  }

  private minusVal(): void {
    this._value -= this.step;
    this.updateSlideInput();
  }

  private plusVal(): void {
    this._value += this.step;
    this.updateSlideInput();
  }

  private updateSlideInput(): void {
    this._value = Math.max(this.min, Math.min(this.max, this._value));
    if (this.slideInput) {
      this.slideInput.value = this._value.toString();
    }
  }

  private parseValue(target: EventTarget | null): number | null {
    if (!(target instanceof HTMLInputElement)) {
      console.error("Invalid target for input.");
      return null;
    }
    const value = parseFloat(target.value.trim());
    if (isNaN(value)) {
      console.error("Value must be a valid integer.");
      return null;
    }
    return value;
  }
}

export default function slideControls(name: string, opts: { initial: number, min: number, max: number, step: number }): () => number {
  const c = new SlideControls(name, opts);
  return c.value.bind(c);
}
