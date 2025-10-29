import Cookies from "./cookies";

export default class Saves {
  private savesPrefix = "saved-save-";
  private savesDiv = document.getElementById("saves") as HTMLElement;

  constructor() {
    Cookies.set(this.savesPrefix+"456", "home,https://purple4reina.github.io");
    this.loadSaves();
  }

  private loadSaves() {
    const saves = Cookies.getAll();
    for (const key of Object.keys(Cookies.getAll())) {
      if (key.startsWith(this.savesPrefix)) {
        const value = Cookies.get(key);
        const [name, url] = value.split(",");
        const div = document.createElement("div");
        div.classList.add("save-link");
        const a = document.createElement("a");
        a.classList.add("save-link");
        a.href = url;
        a.innerText = name;
        div.appendChild(a);
        this.savesDiv.appendChild(div);
      }
    }
  }
}
