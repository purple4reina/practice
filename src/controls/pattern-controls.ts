class PatternButton {
  public value: number;
  private buttonDiv: HTMLElement;

  constructor(name: string, value: number, index: number, parent: HTMLElement) {
    this.value = value;

    const div = document.createElement('div') as HTMLElement;
    this.buttonDiv = div;
    div.classList.add("col");
    div.classList.add("btn");
    div.classList.add("pattern-btn");
    div.classList.add(`pattern-level-${value}`);
    div.classList.add("d-flex");
    div.classList.add("align-items-center");
    div.classList.add("justify-content-center");

    div.innerText = `${index+1}`;
    div.id = `${name}-${index}`;
    parent.appendChild(div);

    div.addEventListener("click", this.cycle.bind(this));
  }

  remove() {
    this.buttonDiv.remove();
  }

  private cycle() {
    this.value = (this.value + 1) % 4;
    for (let i = 0; i < 5; i++) {
      if (i === this.value) {
        this.buttonDiv.classList.add(`pattern-level-${this.value}`);
      } else {
        this.buttonDiv.classList.remove(`pattern-level-${i}`);
      }
    }
    this.buttonDiv.dispatchEvent(new CustomEvent("input", { bubbles: true }));
  }
}

export default class PatternControls {
  private patternBlock: HTMLElement;
  private patterns: PatternButton[];
  private name: string;

  constructor(name: string, opts: { initial: number[] }) {
    this.patternBlock = document.getElementById(name) as HTMLElement;
    this.patterns = opts.initial.map((p, i) => new PatternButton(name, p, i, this.patternBlock));
    this.name = name;
  }

  values(): number[] {
    return this.patterns.map(p => p.value);
  }

  setBeatCount(count: number) {
    while (count < this.patterns.length) {
      this.patterns.pop()?.remove();
    }
    while (count > this.patterns.length) {
      this.patterns.push(new PatternButton(this.name, 2, this.patterns.length, this.patternBlock));
    }
  }
}
