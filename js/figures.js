import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { db } from "./firebase.js";

const figures = [];
let currentFilter = null; // null = "All"

const filterRow = document.getElementById("filter-row");
const grid = document.getElementById("figures-grid");
const emptyEl = document.getElementById("figures-empty");
const errorEl = document.getElementById("figures-error");

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
    if (label === currentFilter) chip.classList.add("selected");
    chip.addEventListener("click", () => {
      currentFilter = label;
      for (const c of filterRow.children) c.classList.toggle("selected", c === chip);
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
    if (f.imageUrl) img.src = f.imageUrl;

    const body = document.createElement("div");
    body.className = "card-body";
    body.append(textEl("p", "overline", f.tipo ?? ""), textEl("h2", "headline", f.nombre ?? ""));
    if (f.serie) body.append(textEl("p", "supporting", f.serie));

    card.append(img, body);
    grid.append(card);
  }
  emptyEl.hidden = figures.length > 0;
}

async function load() {
  try {
    const snap = await getDocs(query(collection(db, "figures"), orderBy("createdAt", "desc")));
    for (const d of snap.docs) {
      const { tipo, nombre, serie, imageUrl } = d.data();
      figures.push({ id: d.id, tipo, nombre, serie, imageUrl });
    }
    renderFilterChips();
    renderGrid();
  } catch (e) {
    console.error(e);
    errorEl.textContent = "Couldn't load the collection. Try refreshing.";
    errorEl.hidden = false;
  }
}

load();
