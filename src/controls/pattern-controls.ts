class PatternButton {
  public value: number;
  private buttonDiv: HTMLElement;
  private startDiv: HTMLElement;

  constructor(name: string, value: number, index: number, parent: HTMLElement) {
    this.value = value;

    const div = document.createElement('div') as HTMLElement;
    this.buttonDiv = div;
    div.classList.add("col");
    div.classList.add("pattern-btn");

    // pattern level
    const level = document.createElement("div") as HTMLElement;
    div.appendChild(level);
    level.classList.add("btn");
    level.classList.add(`pattern-level-${value}`);
    level.classList.add("d-flex");
    level.classList.add("align-items-center");
    level.classList.add("justify-content-center");

    level.innerText = `${index+1}`;
    level.id = `${name}-${index}`;
    parent.insertBefore(div, parent.children[parent.children.length-1]);

    // starting beat
    const start = document.createElement("div") as HTMLElement;
    this.startDiv = start;
    div.appendChild(start);
    start.classList.add("start-beat");

    // change pattern level on click
    level.addEventListener("click", () => {
      this.value = (this.value + 1) % 4;
      for (let i = 0; i < 5; i++) {
        if (i === this.value) {
          level.classList.add(`pattern-level-${this.value}`);
        } else {
          level.classList.remove(`pattern-level-${i}`);
        }
      }
      level.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    });
  }

  setStartBeat(val: boolean) {
    this.startDiv.innerText = val ? "start" : "";
  }

  remove() {
    this.buttonDiv.remove();
  }
}

export default class PatternControls {
  private patternBlock: HTMLElement;
  private patterns: PatternButton[];
  private name: string;

  constructor(name: string, opts: { initial: number[], start: number }) {
    this.patternBlock = document.getElementById(name) as HTMLElement;
    this.patterns = opts.initial.map((p, i) => new PatternButton(name, p, i, this.patternBlock));
    this.name = name;
    this.setStartBeat(opts.start || 1);
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

  setStartBeat(beat: number) {
    const index = beat - 1;
    for (let i = 0; i < this.patterns.length; i++) {
      this.patterns[i].setStartBeat(i === index);
    }
  }
}
