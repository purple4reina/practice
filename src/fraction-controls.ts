class FractionControls {
  private numerator: number = 1;
  private denominator: number = 4;

  private _value: number = this.numerator / this.denominator;

  private numerValueInput: HTMLInputElement | null = null;
  private denomValueInput: HTMLInputElement | null = null;
  private minusButtom: HTMLButtonElement | null = null;
  private plusButton: HTMLButtonElement | null = null;

  constructor(name: string, opts: { initNum: number, initDen: number, arrowKeys?: boolean}) {
    this.numerator = opts.initNum;
    this.denominator = opts.initDen;

    this.numerValueInput = document.getElementById(`${name}-numer`) as HTMLInputElement;
    this.denomValueInput = document.getElementById(`${name}-denom`) as HTMLInputElement;
    this.minusButtom = document.getElementById(`${name}-minus`) as HTMLButtonElement;
    this.plusButton = document.getElementById(`${name}-plus`) as HTMLButtonElement;

    this.numerValueInput?.addEventListener("change", this.setNumerator.bind(this));
    this.denomValueInput?.addEventListener("change", this.setDenominator.bind(this));
    this.minusButtom?.addEventListener("click", this.minus.bind(this));
    this.plusButton?.addEventListener("click", this.plus.bind(this));

    if (opts.arrowKeys) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          this.plus();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          this.minus();
        }
      });
    }

    this.updateValueInput();
  }

  public value(): number {
    return this._value;
  }

  private updateValueInput(): void {
    if (this.numerValueInput) {
      this.numerValueInput.value = this.numerator.toString();
    }
    if (this.denomValueInput) {
      this.denomValueInput.value = this.denominator.toString();
    }
    this._value = this.numerator / this.denominator;
  }

  private setNumerator(event: Event): void {
    this.numerator = this.parseValue(event.target) || this.numerator;
    this.updateValueInput();
  }

  private setDenominator(event: Event): void {
    this.denominator = this.parseValue(event.target) || this.denominator;
    this.updateValueInput();
  }

  private parseValue(target: EventTarget | null): number {
    if (!(target instanceof HTMLInputElement)) {
      return 0;
    }
    const value = parseInt(target.value.trim(), 10);
    if (isNaN(value) || value <= 0) {
      return 0;
    }
    return value;
  }

  minus(): void {
    if (this.numerator === 1) {
      this.denominator++;
    } else {
      this.numerator--;
    }
    this.updateValueInput();
  }

  plus(): void {
    if (this.denominator === 1) {
      this.numerator++;
    } else {
      this.denominator--;
    }
    this.updateValueInput();
  }
}

export default function fractionControls(name: string, opts: { initNum: number, initDen: number, arrowKeys?: boolean }): () => number {
  const c = new FractionControls(name, opts);
  return c.value.bind(c);
}
