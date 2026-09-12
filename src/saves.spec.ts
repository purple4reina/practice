import { expect, describe, test, beforeEach, vi } from "vitest";
import Saves from "./saves";
import Cookies from "./cookies";
import { resetDom } from "./test-support/dom";

function saveLinks(): string[] {
  return [...document.querySelectorAll("#saves .save-link a")].map(a => (a as HTMLElement).innerText);
}

beforeEach(() => {
  resetDom();
  localStorage.clear();
  for (const key of Object.keys(Cookies.getAll())) {
    Cookies.delete(key);
  }
});

describe("Saves initial load", () => {
  test("always shows a 'Default' entry pointing at the page's own origin+path", () => {
    new Saves();
    const links = [...document.querySelectorAll("#saves .save-link a")] as HTMLAnchorElement[];
    expect(links[0].innerText).toBe("Default");
    expect(links[0].href).toBe(window.location.origin + window.location.pathname);
  });

  test("lists saves already present in localStorage", () => {
    localStorage.setItem("practice-recorder-saved-save-zzz-1", "My Save,http://example.com/a");
    new Saves();
    expect(saveLinks()).toEqual(["Default", "My Save"]);
  });

  test("lists saves present as cookies, marked with a trailing asterisk", () => {
    Cookies.set("practice-recorder-saved-save-zzz-1", "Cookie Save,http://example.com/b");
    new Saves();
    expect(saveLinks()).toEqual(["Default", "Cookie Save *"]);
  });

  test("sorts saves by their storage key", () => {
    localStorage.setItem("practice-recorder-saved-save-zzz-b", "B,http://example.com/b");
    localStorage.setItem("practice-recorder-saved-save-zzz-a", "A,http://example.com/a");
    new Saves();
    expect(saveLinks()).toEqual(["Default", "A", "B"]);
  });

  test("ignores unrelated localStorage/cookie entries", () => {
    localStorage.setItem("some-other-app-key", "irrelevant");
    Cookies.set("some-other-cookie", "irrelevant");
    new Saves();
    expect(saveLinks()).toEqual(["Default"]);
  });
});

describe("Saves new-save flow", () => {
  test("clicking New reveals the name input and hides the New/Delete buttons", () => {
    new Saves();
    document.getElementById("save-new")!.dispatchEvent(new MouseEvent("click"));

    expect((document.getElementById("save-new-group-1") as HTMLElement).hidden).toBe(true);
    expect((document.getElementById("save-new-group-2") as HTMLElement).hidden).toBe(false);
  });

  test("submitting a name persists it to localStorage and re-renders the list", () => {
    new Saves();
    const nameInput = document.getElementById("save-name") as HTMLInputElement;
    nameInput.value = "Rehearsal Mix";
    document.getElementById("save-submit")!.dispatchEvent(new MouseEvent("click"));

    expect(saveLinks()).toEqual(["Default", "Rehearsal Mix"]);
    expect(nameInput.value).toBe("");
    expect((document.getElementById("save-new-group-1") as HTMLElement).hidden).toBe(false);
    expect((document.getElementById("save-new-group-2") as HTMLElement).hidden).toBe(true);
  });

  test("submitting an empty name saves nothing", () => {
    new Saves();
    document.getElementById("save-submit")!.dispatchEvent(new MouseEvent("click"));
    expect(saveLinks()).toEqual(["Default"]);
  });

  test("pressing Enter in the name field submits", () => {
    new Saves();
    const nameInput = document.getElementById("save-name") as HTMLInputElement;
    nameInput.value = "Via Enter";
    nameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(saveLinks()).toEqual(["Default", "Via Enter"]);
  });

  test("Cancel discards the typed name without saving", () => {
    new Saves();
    const nameInput = document.getElementById("save-name") as HTMLInputElement;
    nameInput.value = "Discard Me";
    document.getElementById("save-cancel")!.dispatchEvent(new MouseEvent("click"));

    expect(saveLinks()).toEqual(["Default"]);
    expect(nameInput.value).toBe("");
    expect((document.getElementById("save-new-group-2") as HTMLElement).hidden).toBe(true);
  });

  test("closing the offcanvas resets the new-save UI", () => {
    new Saves();
    document.getElementById("save-new")!.dispatchEvent(new MouseEvent("click"));
    (document.getElementById("save-name") as HTMLInputElement).value = "abandoned";

    window.dispatchEvent(new Event("hidden.bs.offcanvas"));

    expect((document.getElementById("save-name") as HTMLInputElement).value).toBe("");
    expect((document.getElementById("save-new-group-2") as HTMLElement).hidden).toBe(true);
  });
});

describe("Saves delete flow", () => {
  test("Delete toggles deleting mode, showing trash icons and relabeling the button", () => {
    localStorage.setItem("practice-recorder-saved-save-zzz-1", "A Save,http://example.com/a");
    new Saves();

    const deleteButton = document.getElementById("save-delete") as HTMLElement;
    deleteButton.dispatchEvent(new MouseEvent("click"));

    expect(deleteButton.classList.contains("btn-danger")).toBe(true);
    expect(deleteButton.innerText).toBe("Deleting...");
    const trash = document.querySelector("#saves .bi-trash") as HTMLElement;
    expect(trash.hidden).toBe(false);

    deleteButton.dispatchEvent(new MouseEvent("click")); // toggle back off
    expect(deleteButton.classList.contains("btn-danger")).toBe(false);
    expect(deleteButton.innerText).toBe("Delete");
  });

  test("clicking a trash icon removes that save from localStorage and the list", () => {
    localStorage.setItem("practice-recorder-saved-save-zzz-1", "A Save,http://example.com/a");
    new Saves();

    document.getElementById("save-delete")!.dispatchEvent(new MouseEvent("click"));
    const trash = document.querySelector("#saves .bi-trash") as HTMLElement;
    trash.dispatchEvent(new MouseEvent("click"));

    expect(saveLinks()).toEqual(["Default"]);
    expect(localStorage.getItem("practice-recorder-saved-save-zzz-1")).toBeNull();
  });

  test("deleting a cookie-backed save also clears the cookie", () => {
    Cookies.set("practice-recorder-saved-save-zzz-1", "Cookie Save,http://example.com/b");
    new Saves();

    document.getElementById("save-delete")!.dispatchEvent(new MouseEvent("click"));
    const trash = document.querySelector("#saves .bi-trash") as HTMLElement;
    trash.dispatchEvent(new MouseEvent("click"));

    expect(saveLinks()).toEqual(["Default"]);
    expect(Cookies.get("practice-recorder-saved-save-zzz-1")).toBe("");
  });

  test("the Default entry never gets a trash icon", () => {
    new Saves();
    document.getElementById("save-delete")!.dispatchEvent(new MouseEvent("click"));
    const firstLink = document.querySelectorAll("#saves .save-link")[0];
    expect(firstLink.querySelector(".bi-trash")).toBeNull();
  });
});
