import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { db } from "./firebase.js";

const CLAIMER_KEY = "claimerName";
// Must match the 60-char cap in the Firestore rules (counted in code points).
const NAME_MAX = 60;

let wishes = [];
let activeWishId = null;

const listEl = document.getElementById("wish-list");
const emptyEl = document.getElementById("wish-empty");
const errorEl = document.getElementById("wish-error");
const loadingEl = document.getElementById("wish-loading");
const claimTitleEl = document.getElementById("claim-title");
const headerEl = document.getElementById("claimer-header");
const modal = document.getElementById("claim-modal");
const input = document.getElementById("claim-name-input");
const claimError = document.getElementById("claim-error");
const confirmBtn = document.getElementById("claim-confirm");
const cancelBtn = document.getElementById("claim-cancel");

function getClaimer() {
  try { return localStorage.getItem(CLAIMER_KEY); } catch { return null; }
}
function setClaimer(name) {
  try { localStorage.setItem(CLAIMER_KEY, name); } catch { /* ignore */ }
}
function clearClaimer() {
  try { localStorage.removeItem(CLAIMER_KEY); } catch { /* ignore */ }
}

function renderClaimerHeader() {
  headerEl.replaceChildren();
  const name = getClaimer();
  if (!name) return;
  const label = document.createElement("span");
  label.textContent = "Claiming as " + name + " · ";
  const change = document.createElement("a");
  change.href = "#";
  change.id = "change-name";
  change.textContent = "change";
  change.addEventListener("click", (event) => {
    event.preventDefault();
    clearClaimer();
    renderClaimerHeader();
  });
  headerEl.append(label, change);
}

function safeHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? s : null;
  } catch {
    return null;
  }
}

function textEl(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

function renderList() {
  listEl.replaceChildren();
  emptyEl.hidden = wishes.length > 0;
  for (const w of wishes) {
    const li = document.createElement("li");
    li.className = "wish-item";
    li.append(textEl("p", "overline", w.tipo ?? ""));
    li.append(textEl("p", "headline", w.nombre ?? ""));
    if (w.serie) li.append(textEl("p", "supporting", w.serie));

    const actions = document.createElement("div");
    actions.className = "wish-actions";
    const href = w.url ? safeHttpUrl(w.url) : null;
    if (href) {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "View on store →";
      actions.append(a);
    }
    if (typeof w.claimedBy === "string" && w.claimedBy.length > 0) {
      actions.append(textEl("span", "claimed-badge", "Claimed by " + w.claimedBy));
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "claim-button";
      btn.dataset.wishId = w.id;
      btn.textContent = "Claim this";
      actions.append(btn);
    }
    li.append(actions);
    listEl.append(li);
  }
}

listEl.addEventListener("click", (event) => {
  const btn = event.target.closest(".claim-button");
  if (!btn) return;
  activeWishId = btn.dataset.wishId;
  const target = wishes.find((x) => x.id === activeWishId);
  claimTitleEl.textContent = `Claim "${target?.nombre ?? "this item"}"`;
  input.value = getClaimer() ?? "";
  claimError.hidden = true;
  claimError.textContent = "";
  modal.showModal();
});

modal.addEventListener("close", () => {
  confirmBtn.disabled = false;
  cancelBtn.disabled = false;
  claimError.hidden = true;
  claimError.textContent = "";
});

cancelBtn.addEventListener("click", () => modal.close());
// Ignore Esc while a write is in flight.
modal.addEventListener("cancel", (event) => {
  if (confirmBtn.disabled) event.preventDefault();
});

confirmBtn.addEventListener("click", async () => {
  const trimmed = input.value.trim();
  if (trimmed.length === 0 || [...trimmed].length > NAME_MAX) {
    claimError.textContent = "Name required (max 60 chars).";
    claimError.hidden = false;
    return;
  }
  claimError.hidden = true;
  confirmBtn.disabled = true;
  cancelBtn.disabled = true;
  const wishId = activeWishId;
  let keepLocked = false;
  try {
    await updateDoc(doc(db, "wishlist", wishId), {
      claimedBy: trimmed,
      claimedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error(e);
    if (e?.code === "permission-denied") {
      claimError.textContent = "Already claimed — refreshing list.";
      claimError.hidden = false;
      keepLocked = true;
      activeWishId = null;
      setTimeout(() => modal.close(), 1500);
      await load();
    } else {
      claimError.textContent = "Couldn't save your claim. Try again.";
      claimError.hidden = false;
    }
    return;
  } finally {
    // On permission-denied the buttons stay locked until the modal closes.
    if (!keepLocked) {
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  }
  if (activeWishId !== wishId) return;
  setClaimer(trimmed);
  const w = wishes.find((x) => x.id === wishId);
  if (w) { w.claimedBy = trimmed; w.claimedAt = new Date(); }
  modal.close();
  activeWishId = null;
  renderList();
  renderClaimerHeader();
});

async function load() {
  try {
    const snap = await getDocs(query(collection(db, "wishlist"), orderBy("createdAt", "desc")));
    loadingEl.hidden = true;
    wishes = snap.docs.map((d) => {
      const x = d.data();
      return { id: d.id, tipo: x.tipo, nombre: x.nombre, serie: x.serie, url: x.url, claimedBy: x.claimedBy, claimedAt: x.claimedAt };
    });
    renderList();
  } catch (e) {
    console.error(e);
    loadingEl.hidden = true;
    errorEl.hidden = false;
  }
}

renderClaimerHeader();
load();
