import Cookies from "./cookies";

export default class Saves {
  private savesPrefix = "practice-recorder-saved-save";

  private savesDiv = document.getElementById("saves") as HTMLElement;
  private buttonGroup1 = document.getElementById("save-new-group-1") as HTMLElement;
  private newButton = document.getElementById("save-new") as HTMLElement;
  private deleteButton = document.getElementById("save-delete") as HTMLElement;
  private buttonGroup2 = document.getElementById("save-new-group-2") as HTMLElement;
  private nameInput = document.getElementById("save-name") as HTMLInputElement;
  private submitButton = document.getElementById("save-submit") as HTMLElement;
  private cancelButton = document.getElementById("save-cancel") as HTMLElement;

  private trashIcons: HTMLElement[] = [];

  constructor() {
    this.loadSaves();
    this.newButton.addEventListener("click", () => {
      this.buttonGroup1.hidden = true;
      this.buttonGroup2.hidden = false;
      this.nameInput.focus();
      this.turnOffDeleting();
    });
    this.deleteButton.addEventListener("click", () => {
      if (this.isDeletingOn()) {
        this.turnOffDeleting();
      } else {
        this.turnOnDeleting();
      }
    });
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.submitButton.click();
      }
    });
    this.submitButton.addEventListener("click", () => {
      const name = this.nameInput.value;
      if (name !== "") {
        this.newSave(name, window.location.href);
      }
      this.nameInput.value = "";
      this.buttonGroup1.hidden = false;
      this.buttonGroup2.hidden = true;
    });
    this.cancelButton.addEventListener("click", () => {
      this.nameInput.value = "";
      this.buttonGroup1.hidden = false;
      this.buttonGroup2.hidden = true;
    });
    window.addEventListener("hidden.bs.offcanvas", () => {
      this.nameInput.value = "";
      this.buttonGroup1.hidden = false;
      this.buttonGroup2.hidden = true;
      this.turnOffDeleting();
    });
  }

  private isDeletingOn(): boolean {
    return [...this.deleteButton.classList].includes("btn-danger");
  }

  private turnOffDeleting() {
    if (this.isDeletingOn()) {
      this.deleteButton.classList.add("btn-outline-secondary");
      this.deleteButton.classList.remove("btn-danger");
      this.trashIcons.forEach(icon => icon.hidden = true);
      this.deleteButton.innerText = "Delete";
    }
  }

  private turnOnDeleting() {
    this.deleteButton.classList.add("btn-danger");
    this.deleteButton.classList.remove("btn-outline-secondary");
    this.trashIcons.forEach(icon => icon.hidden = false);
    this.deleteButton.innerText = "Deleting...";
  }

  private loadSaves() {
    this.savesDiv.innerText = "";
    this.addSave("Default", window.location.origin + window.location.pathname);

    const saves: Array<[string, string, boolean]> = [];

    // Load from Cookies
    for (const key of Object.keys(Cookies.getAll())) {
      if (key.startsWith(this.savesPrefix)) {
        const value = Cookies.get(key);
        if (value) saves.push([key, value, true]);
      }
    }

    // Load from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.savesPrefix)) {
        const value = localStorage.getItem(key);
        if (value) saves.push([key, value, false]);
      }
    }

    saves.sort((a, b) => {
      if (a[0] < b[0]) return -1;
      if (a[0] > b[0]) return 1;
      return 0;
    });

    // Render all saves
    for (const [key, value, isFromCookie] of saves) {
      const [name, url] = value.split(",");
      const displayName = isFromCookie ? `${name} *` : name;
      const div = this.addSave(displayName, url);

      const trash = document.createElement("i");
      this.trashIcons.push(trash);
      trash.classList.add("bi");
      trash.classList.add("bi-trash");
      trash.classList.add("bi-tiny");
      trash.classList.add("block-control");
      trash.style.marginLeft = "10px";
      trash.style.color = "red";
      trash.hidden = !this.isDeletingOn();
      div.appendChild(trash);

      trash.addEventListener("click", () => {
        this.deleteSave(key);
        this.loadSaves();
      });
    }
  }

  private addSave(name: string, url: string): HTMLElement {
    const div = document.createElement("div");
    div.classList.add("save-link");
    this.savesDiv.appendChild(div);

    const a = document.createElement("a");
    a.classList.add("save-link");
    a.href = url;
    a.innerText = name;
    div.appendChild(a);

    return div;
  }

  private newSave(name: string, url: string) {
    localStorage.setItem(`${this.savesPrefix}-zzz-${Date.now()}`, `${name},${url}`);
    this.loadSaves()
  }

  private deleteSave(key: string) {
    localStorage.removeItem(key);
    Cookies.delete(key);
  }
}
