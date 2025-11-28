class PatternButton {
  public value: number;
  private buttonDiv: HTMLElement | null;

  constructor(name: string, value: number, index: number, parent: HTMLElement | null) {
    this.value = value;

    const div = document.createElement('div');
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
    parent?.appendChild(div);

    div.addEventListener("click", this.cycle.bind(this));
  }

  cycle() {
    this.value = (this.value + 1) % 4;
    for (let i = 0; i < 5; i++) {
      if (i === this.value) {
        this.buttonDiv?.classList.add(`pattern-level-${this.value}`);
      } else {
        this.buttonDiv?.classList.remove(`pattern-level-${i}`);
      }
    }
  }
}

class PatternControls {
  private patterns: PatternButton[];
  private name: string;

  private patternBlock: HTMLElement | null = null;

  constructor(name: string, opts: { initial: number[] }) {
    this.patternBlock = document.getElementById(name);
    this.patterns = opts.initial.map((p, i) => new PatternButton(name, p, i, this.patternBlock));
    this.name = name;
  }

  public value(): number[] {
    return this.patterns.map(p => p.value);
  }
}

export default function patternControls(name: string, opts: { initial: number[] }): () => number[] {
  const c = new PatternControls(name, opts);
  return c.value.bind(c);
}
