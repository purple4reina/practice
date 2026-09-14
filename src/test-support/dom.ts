import fs from "node:fs";
import path from "node:path";

const indexHtmlPath = path.resolve(__dirname, "../../index.html");
const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");
const bodyMatch = indexHtml.match(/<body>([\s\S]*)<\/body>/);
if (!bodyMatch) {
  throw new Error("Could not find <body> in index.html");
}
// Drop <script> tags - jsdom won't execute remote/module scripts anyway, and
// leaving them in just adds noise.
const bodyHtml = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, "");

// Resets the document to a fresh copy of the real app markup (index.html's
// <body>), so tests exercise the same element IDs/structure the app ships
// with instead of a hand-maintained fixture that can drift out of sync.
export function resetDom(): void {
  document.body.innerHTML = bodyHtml;
  document.body.className = "";
  window.history.replaceState({}, "", "/");
}
