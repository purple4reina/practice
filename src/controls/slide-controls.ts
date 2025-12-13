class SlideControls {
  private _value: number = 0;
  private min: number = 0;
  private max: number = 10;
  private step: number = 0.5;
  private name: string = "";
  private labelText: string = "";
  private valueSuffix: string = "";

  private labelElement: HTMLElement | null = null;
  private slideInput: HTMLInputElement | null = null;
  private minusButton: HTMLButtonElement | null = null;
  private plusButton: HTMLButtonElement | null = null;

  constructor(name: string, opts: { initial: number, min: number, max: number, step: number, valueSuffix?: string, label?: string }) {
    this._value = opts.initial;
    for (const [key, value] of new URLSearchParams(window.location.search)) {
      if (key == name) {
        this._value = parseInt(value);
      }
    }

    this.min = opts.min;
    this.max = opts.max;
    this.step = opts.step;
    this.name = name;
    this.labelText = opts.label || "";
    this.valueSuffix = opts.valueSuffix || "";

    this.slideInput = document.getElementById(name) as HTMLInputElement | null;
    this.minusButton = document.getElementById(`${name}-minus`) as HTMLButtonElement | null;
    this.plusButton = document.getElementById(`${name}-plus`) as HTMLButtonElement | null;

    this.slideInput?.addEventListener("change", this.setVal.bind(this));
    this.minusButton?.addEventListener("click", this.minusVal.bind(this));
    this.plusButton?.addEventListener("click", this.plusVal.bind(this));

    this.labelElement = document.getElementById(`${name}-label`) as HTMLElement | null;
    if (this.labelElement) {
      this.labelText = this.labelText || this.labelElement.innerText;
      let setLabelText = this.setLabelText.bind(this);
      this.slideInput?.addEventListener("input", function() {
        setLabelText(this.value);
      });
    }

    this.updateSlideInput();
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
      this.slideInput.dispatchEvent(new CustomEvent("input"));
    }
    this.setLabelText(this._value.toString());

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.append(this.name, this._value.toString());
    for (const [paramKey, paramValue] of new URLSearchParams(window.location.search)) {
      if (paramKey !== this.name) {
        url.searchParams.append(paramKey, paramValue);
      }
    }
    window.history.pushState(null, '', url.toString());
  }

  private setLabelText(text: string): void {
    if (this.labelElement) {
      this.labelElement.innerText = `${this.labelText} (${text}${this.valueSuffix}):`;
    }
  }

  private parseValue(target: EventTarget | null): number | null {
    if (!(target instanceof HTMLInputElement)) {
      console.error("Invalid target for input.");
      return null;
    }
    const value = parseFloat(target.value.trim());
    if (isNaN(value)) {
      console.error("Value must be a valid float.");
      return null;
    }
    return value;
  }
}

export default function slideControls(name: string, opts: { initial: number, min: number, max: number, step: number, valueSuffix?: string, label?: string }): () => number {
  const c = new SlideControls(name, opts);
  return c.value.bind(c);
}
