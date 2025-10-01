import plusMinusControls from "../plus-minus-controls";
import { Block } from "./block";

export default class ClicksBlock extends Block {
  private count;

  constructor(parent: HTMLElement) {
    super();
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="row block-element" id="${this.id}">
        <div class="row">
          <div class="col-3 text-left">
            <strong>Clicks</strong>
          </div>
          <div class="col-3">
            Count:
          </div>
          <div class="col input-group">
            <button class="btn" id="${this.id}-clicks-minus" type="button" tabindex="-1">-</button>
            <input type="text" class="form-control" id="${this.id}-clicks-val" value="0" pattern="[0-9]*">
            <button class="btn" id="${this.id}-clicks-plus" type="button" tabindex="-1">+</button>
          </div>
        </div>
      </div>
    `;
    parent.appendChild(div);
    this.count = plusMinusControls(`${this.id}-clicks`, { initial: 0, min: 0, max: 256 });
  }
}
