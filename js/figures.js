import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { db } from "./firebase.js";

const figures = [];
let currentFilter = null; // null = "All"

const filterRow = document.getElementById("filter-row");
const grid = document.getElementById("figures-grid");
const emptyEl = document.getElementById("figures-empty");
const errorEl = document.getElementById("figures-error");
const loadingEl = document.getElementById("figures-loading");

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

function renderFilterChips() {
  const tipos = [...new Set(figures.map((f) => f.tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  filterRow.replaceChildren();
  for (const label of [null, ...tipos]) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = label ?? "All";
    chip.dataset.filter = label ?? "";
    chip.setAttribute("aria-pressed", label === currentFilter ? "true" : "false");
    if (label === currentFilter) chip.classList.add("selected");
    chip.addEventListener("click", () => {
      currentFilter = label;
      for (const c of filterRow.children) {
        c.classList.toggle("selected", c === chip);
        c.setAttribute("aria-pressed", c === chip ? "true" : "false");
      }
      renderGrid();
    });
    filterRow.append(chip);
  }
}

function renderGrid() {
  const visible = currentFilter === null ? figures : figures.filter((f) => f.tipo === currentFilter);
  grid.replaceChildren();
  for (const f of visible) {
    const card = document.createElement("article");
    card.className = "card";

    const img = document.createElement("img");
    img.className = "card-image";
    img.loading = "lazy";
    img.alt = f.nombre ?? "";
    const src = f.imageUrl ? safeHttpUrl(f.imageUrl) : null;
    if (src) img.src = src;

    const body = document.createElement("div");
    body.className = "card-body";
    body.append(textEl("p", "overline", f.tipo ?? ""), textEl("h2", "headline", f.nombre ?? ""));
    if (f.serie) body.append(textEl("p", "supporting", f.serie));

    card.append(img, body);
    grid.append(card);
  }
  if (figures.length === 0) {
    emptyEl.textContent = "No figures yet.";
  } else if (visible.length === 0) {
    emptyEl.textContent = "No figures match this filter.";
  }
  emptyEl.hidden = visible.length > 0;
}

async function load() {
  try {
    const snap = await getDocs(query(collection(db, "figures"), orderBy("createdAt", "desc")));
    loadingEl.hidden = true;
    for (const d of snap.docs) {
      const { tipo, nombre, serie, imageUrl } = d.data();
      figures.push({ id: d.id, tipo, nombre, serie, imageUrl });
    }
    renderFilterChips();
    renderGrid();
  } catch (e) {
    console.error(e);
    loadingEl.hidden = true;
    errorEl.textContent = "Couldn't load the collection. Try refreshing.";
    errorEl.hidden = false;
  }
}

load();
