import { LocalStorageSavesStore, newSaveRecord } from "./saves-store";
import type { CloudSession } from "./saves-store";
import { compareRecords, syncSaves, tombstone } from "./saves-merge";
import type { SaveRecord } from "./saves-merge";

const SIGNED_OUT_TIP = "Sign in to sync saves across devices.";

export default class Saves {
  private local = new LocalStorageSavesStore();
  private session: CloudSession | null = null;
  private onSignOut: (() => void) | null = null;

  private savesDiv = document.getElementById("saves") as HTMLElement;
  private buttonGroup1 = document.getElementById("save-new-group-1") as HTMLElement;
  private newButton = document.getElementById("save-new") as HTMLElement;
  private deleteButton = document.getElementById("save-delete") as HTMLElement;
  private buttonGroup2 = document.getElementById("save-new-group-2") as HTMLElement;
  private nameInput = document.getElementById("save-name") as HTMLInputElement;
  private submitButton = document.getElementById("save-submit") as HTMLElement;
  private cancelButton = document.getElementById("save-cancel") as HTMLElement;
  private syncDiv = document.getElementById("saves-sync") as HTMLElement;
  private syncInfo = document.getElementById("saves-sync-info") as HTMLElement;
  private signOutButton = document.getElementById("saves-sync-signout") as HTMLElement;
  private signInDiv = document.getElementById("saves-signin") as HTMLElement;

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
        this.newSave(name, window.location.search);
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
    this.signOutButton.addEventListener("click", () => {
      if (this.onSignOut) this.onSignOut();
    });
    window.addEventListener("hidden.bs.offcanvas", () => {
      this.nameInput.value = "";
      this.buttonGroup1.hidden = false;
      this.buttonGroup2.hidden = true;
      this.turnOffDeleting();
    });
  }

  // Show the sync area (sign-in button / sign-out button + info tooltip). Only
  // called on builds where cloud sync exists, so other builds never see it.
  public enableSync(onSignOut: () => void) {
    this.onSignOut = onSignOut;
    this.syncDiv.hidden = false;
    this.renderSyncStatus(SIGNED_OUT_TIP);
  }

  // Called when the signed-in cloud account changes (null = signed out). On
  // sign-in, merges this device's saves with the cloud's: each side receives
  // whatever it was missing, so nothing is lost on either.
  public async setSession(session: CloudSession | null) {
    this.session = session;
    if (!session) {
      this.renderSyncStatus(SIGNED_OUT_TIP);
      return;
    }
    this.renderSyncStatus(`Syncing as ${session.email}...`);
    try {
      await syncSaves(this.local, session.remote);
      if (this.session !== session) return;  // signed out or switched mid-sync
      this.loadSaves();
      this.renderSyncStatus(`Synced as ${session.email}.`);
    } catch (e) {
      console.warn("saves sync failed; using this device's saves", e);
      if (this.session !== session) return;
      this.renderSyncStatus(`Couldn't reach the cloud as ${session.email}. Showing this device's saves.`);
    }
  }

  // The sync status lives in the info icon's tooltip rather than inline: signed
  // out the row shows the Google button, signed in it shows a sign-out button.
  private renderSyncStatus(tip: string) {
    const signedIn = this.session !== null;
    this.setSyncTip(tip);
    this.signOutButton.hidden = !signedIn;
    this.signInDiv.hidden = signedIn;
  }

  // Bootstrap moved the icon's title into its own tooltip at startup (main.ts),
  // so the text must be changed through its API. Without Bootstrap (e.g. the
  // CDN failed to load) fall back to a plain title attribute.
  private setSyncTip(text: string) {
    const tooltip = (window as any).bootstrap?.Tooltip?.getInstance(this.syncInfo);
    if (tooltip) {
      tooltip.setContent({ ".tooltip-inner": text });
    } else {
      this.syncInfo.setAttribute("title", text);
    }
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
    this.savesDiv.replaceChildren();
    this.trashIcons = [];
    this.addSave("Default", window.location.origin + window.location.pathname);

    const records = this.local.list().filter(r => !r.deleted).sort(compareRecords);

    for (const record of records) {
      const url = window.location.origin + window.location.pathname + record.query;
      const div = this.addSave(record.name, url);

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
        this.deleteSave(record);
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

  // Writes to this device immediately; the cloud copy is best-effort. If it
  // fails (offline), the next session's merge delivers it.
  private persist(record: SaveRecord) {
    this.local.put(record);
    if (this.session) this.session.remote.put(record).catch(() => {});
  }

  private newSave(name: string, query: string) {
    this.persist(newSaveRecord(name, query));
    this.loadSaves();
  }

  private deleteSave(record: SaveRecord) {
    this.persist(tombstone(record));
  }
}
