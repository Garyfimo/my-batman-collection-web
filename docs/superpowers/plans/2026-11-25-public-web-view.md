# Public Web View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static two-page website (`index.html` + `wishlist.html`) that reads the Android app's Firestore collections and lets visitors claim wishlist items by typing a name; deploy as-is to GitHub Pages at `https://garyfimo.github.io/my-batman-collection-web/`.

**Architecture:** Plain HTML + CSS + vanilla JavaScript (ES modules). No framework, no bundler, no `npm`, no build step. Firebase JS SDK v10 loaded from Google's CDN. Reads go through `getDocs(query(..., orderBy("createdAt","desc")))`; the only write is an `updateDoc` on a wishlist doc that sets `claimedBy` + `claimedAt`. Security is enforced server-side by a surgical Firestore rule that permits only those two fields on anonymous updates.

**Tech Stack:** HTML5, CSS3 (CSS custom properties for the palette, `prefers-color-scheme` for light/dark), vanilla JavaScript ES modules, Firebase JS SDK v10.14.0 via CDN, GitHub Pages hosting.

**Spec:** `docs/superpowers/specs/2026-11-25-public-web-view-design.md`

## Global Constraints

- **No framework, no `npm`, no build step.** No `package.json`, no `node_modules/`, no bundler. Everything is runnable by opening `index.html` in a browser (with a local HTTP server for ES module support — see per-task verification notes).
- **ES modules only.** Scripts loaded with `<script type="module" src="./js/...">`. Top-level `import`/`export` allowed. No CommonJS, no AMD, no IIFE patterns.
- **All in-page paths are relative** (`./wishlist.html`, `js/firebase.js`), never absolute (`/wishlist.html`). GitHub Pages serves the site under the sub-path `/my-batman-collection-web/`, so absolute paths 404.
- **Firebase JS SDK v10.14.0** via `https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js` and `/firebase-firestore.js`. Pin the version; do not use `latest`.
- **User-supplied strings rendered via `textContent`** (or DOM `createElement` + property assignment), NEVER via `innerHTML` or template literals in `innerHTML`. Prevents XSS from the `claimedBy` field.
- **Mobile-first CSS**. Default layout targets a narrow viewport; media queries add columns at `min-width: 768px` and `min-width: 1024px`.
- **Classic Batman palette hexes** (copied verbatim from `my-batman-collection/app/.../ui/theme/ClassicLightColorScheme.kt` + `ClassicDarkColorScheme.kt`):
  - Light: bg `#F6EFD8`, surface `#FFFFFF`, primary `#122145`, onPrimary `#FFD54F`, accent `#FFCC00`, outline `#C7B88A`.
  - Dark: bg `#0B1226`, surface `#152042`, primary `#FFCC00`, onPrimary `#0B1226`, accent `#FFD54F`, outline `#2B3A66`.
- **Commits carry no attribution trailer** (no `Co-Authored-By`, no "Generated with Claude Code"). Same policy as the Android repo.
- **Firestore config in `js/firebase.js` is committed to git.** The web API key is explicitly not a secret; security is in the rules.

## Review Focus

Behaviors the spec implies but no step's happy-path check fully exercises; most-likely-to-bite first.

1. **Rule bypass — writing to a non-claim field.** An unauthenticated visitor should NOT be able to change `tipo`, `nombre`, `serie`, or `url` on a wishlist doc. Covered by Task 4 manual rule-verification step ("attempt to `updateDoc` a `tipo` field as an anonymous client → must fail with `permission-denied`").
2. **Rule bypass — invalid `claimedBy` payload.** Empty-string or over-60-char `claimedBy` should be rejected (vandalism cap). Covered by Task 4 ("attempt to `updateDoc` with `claimedBy: ""` → must fail").
3. **XSS via `claimedBy`.** A friend typing `<script>alert(1)</script>` as their name must render as inert text, not execute. Covered by Task 3's claim-flow verification ("render claim with name `<script>alert('x')</script>` and confirm no alert fires, name shows literally in the DOM text node").
4. **GitHub Pages sub-path routing.** Any `href="/..."` or `src="/..."` (absolute) will 404 under `/my-batman-collection-web/`. Covered by Task 5 ("open the deployed URL at `garyfimo.github.io/my-batman-collection-web/`, click the Wishlist tab, confirm the URL becomes `.../my-batman-collection-web/wishlist.html` and loads").
5. **No "change my name" affordance.** Once a friend's name is in `localStorage`, they have no way to update it without devtools. Covered by Task 3's header-link check ("the header shows `Claiming as <name> · change` link; clicking `change` clears localStorage and re-prompts on next claim").

---

## Task 1: Firebase SDK init + Firebase Console setup

**Files:**
- Create: `js/firebase.js`
- Modify: `README.md` (add a "Firebase setup (one-time)" section)

**Interfaces:**
- Produces:
  - `export const app` — the initialized `FirebaseApp`.
  - `export const db` — the `Firestore` handle, usable by `getDocs`, `doc`, `updateDoc`, etc.

**User-only prerequisite** (does not land in git, must happen before code):
- In Firebase Console → the existing `my-batman-collection` project → **Project settings** → **Your apps** → **Add app** → **Web** → name it `my-batman-collection-web` → copy the resulting config object.

- [ ] **Step 1: Create `js/firebase.js`**

```js
// SDK init for the public web view. The config values below come from
// Firebase Console → Project settings → Your apps → the web app config.
// These are NOT secrets — security is enforced by Firestore rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "<FILL_IN>",
  authDomain: "<FILL_IN>",
  projectId: "<FILL_IN>",
  storageBucket: "<FILL_IN>",
  messagingSenderId: "<FILL_IN>",
  appId: "<FILL_IN>",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

The implementer pastes the real values in place of the six `<FILL_IN>` tokens using the config object the user copied from the Firebase console. Commit the filled-in file.

- [ ] **Step 2: Add Firebase-setup section to `README.md`**

Minimal content:

```markdown
## Firebase setup (one-time)

1. In Firebase Console → Project settings → Your apps → Add app → Web.
2. Name it `my-batman-collection-web`; skip Firebase Hosting.
3. Copy the `firebaseConfig` object shown to you.
4. Paste its values into `js/firebase.js` replacing the six `<FILL_IN>` tokens.
5. Commit and push.
```

- [ ] **Step 3: Verify the module loads without error**

Serve the folder locally (modules need HTTP, not `file://`):

Run (from the repo root): `python3 -m http.server 8000`
Open: `http://localhost:8000/` (even though no `index.html` yet, the browser will list the directory — click `js/firebase.js` or the directory listing).
Open browser devtools → Console → paste: `import('./js/firebase.js').then(m => console.log(m.db))`.
Expected: a `Firestore` object is logged. No red errors.

- [ ] **Step 4: Commit**

```bash
git add js/firebase.js README.md
git commit -m "feat: initialize Firebase SDK (CDN, v10.14.0)

Registers js/firebase.js exporting the initialized Firestore handle.
README gets a one-time Firebase Console setup section for the
<FILL_IN> tokens.
"
```

---

## Task 2: Figures page (`index.html` + shared styles + figures.js)

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `js/figures.js`

**Interfaces:**
- Consumes: `db` from `js/firebase.js` (Task 1).
- Produces: a rendered HTML page showing the figures grid with a `tipo` filter chip row; nothing other files import.

- [ ] **Step 1: Create `styles.css`**

Define CSS custom properties for the Classic Batman palette (both light and dark variants via `prefers-color-scheme`). Set base typography (system font stack), link color, and reset default margins on `body`. Define reusable classes for `.page`, `.header`, `.nav-tabs`, `.chip-row`, `.chip` (selected/unselected), `.grid`, `.card`, `.card-image`, `.card-body`, and modal pieces (`.modal-backdrop`, `.modal`, `.modal-field`, `.modal-actions`). Mobile-first: `.grid` is single-column by default, 2 columns at `min-width: 768px`, 3 at `min-width: 1024px`. Keep under ~150 lines; this is utility CSS, not a full design system.

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gary's Batman Collection</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="page">
  <header class="header">
    <h1>🦇 Gary's Batman Collection</h1>
    <nav class="nav-tabs">
      <a href="index.html" aria-current="page">Collection</a>
      <a href="wishlist.html">Wishlist</a>
    </nav>
  </header>

  <main>
    <div class="chip-row" id="filter-row"></div>
    <div class="grid" id="figures-grid"></div>
    <p class="empty" id="figures-empty" hidden>No figures yet.</p>
    <p class="error" id="figures-error" hidden></p>
  </main>

  <script type="module" src="js/figures.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `js/figures.js`**

Imports `db` from `./firebase.js` and uses the Firestore modular SDK:

```js
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { db } from "./firebase.js";
```

On DOMContentLoaded (or at top level since modules are deferred), fetch `getDocs(query(collection(db, "figures"), orderBy("createdAt", "desc")))`, extract `{ id, tipo, nombre, serie, imageUrl }` from each doc, store in a module-level `const figures = []` array, then render.

Render pipeline:
- `renderFilterChips(figures)` — compute unique `tipo` values from the loaded figures, insert one `<button class="chip">All</button>` plus one per tipo into `#filter-row`. Clicking a chip updates a module-level `currentFilter` and calls `renderGrid()`.
- `renderGrid()` — filter `figures` by `currentFilter` (or show all if `null`), clear `#figures-grid`, append one `<article class="card">` per figure. Each card contains an `<img>` (lazy-loaded with `loading="lazy"`), the figure's `tipo` as an overline, `nombre` as headline, `serie` as supporting text. Use `document.createElement` + `textContent` (NOT `innerHTML`) to prevent XSS from any user-uploaded field.
- On fetch error, set `#figures-error.textContent` to a friendly message and `hidden = false`.
- On empty result, show `#figures-empty`.

- [ ] **Step 4: Manual verification**

Run: `python3 -m http.server 8000` from the repo root.
Open: `http://localhost:8000/index.html` on a desktop browser and on a phone (or Chrome devtools mobile emulator).
Expected: figures grid renders with Classic Light palette (or Dark under system dark mode). Filter chips work. Nav shows Collection + Wishlist tabs. On mobile viewport the grid is single-column.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css js/figures.js
git commit -m "feat: figures gallery page

Mobile-first grid rendered from the figures collection with a tipo
filter chip row. Shared styles land in styles.css for the wishlist
page to reuse.
"
```

---

## Task 3: Wishlist page + claim flow (`wishlist.html` + wishlist.js)

**Files:**
- Create: `wishlist.html`
- Create: `js/wishlist.js`
- Modify: `styles.css` (add wishlist-item + claimed-by-badge styles if missing)

**Interfaces:**
- Consumes: `db` from `js/firebase.js`.
- Produces: a rendered wishlist page with per-item claim modal and `localStorage`-backed name persistence; nothing other files import.

**Key behaviors to implement:**

- Header mirrors `index.html`'s but with `aria-current="page"` on the Wishlist tab.
- Header right-side shows the current claimer name from `localStorage.getItem("claimerName")` in the form `Claiming as <name> · change`. If no name is stored, header shows nothing (anonymous). The `change` link clears `localStorage` and re-renders the header.
- Each wishlist item renders: tipo (overline), nombre (headline), serie (supporting), and either:
  - **Unclaimed** (`claimedBy` absent or empty): a `View on store →` link (outbound, `rel="noopener"`) + a `Claim this` button.
  - **Claimed**: a `View on store →` link + a `Claimed by <name>` badge (no button).
- Clicking `Claim this` opens a modal dialog (either the native `<dialog>` element or a custom `.modal-backdrop` overlay). The modal has:
  - A name input pre-filled from `localStorage.getItem("claimerName")` if present.
  - A `Cancel` button that closes the modal without writing.
  - A `Confirm claim` button that writes `{ claimedBy: trimmedName, claimedAt: serverTimestamp() }` via `updateDoc(doc(db, "wishlist", id), { ... })`, stores the name in `localStorage.setItem("claimerName", trimmedName)`, closes the modal, and re-renders the affected item in place.
- All user-supplied strings (claimer name, item fields) rendered via `textContent` / `createTextNode` — NEVER `innerHTML`.

- [ ] **Step 1: Create `wishlist.html`**

Same frame as `index.html` but with:
- `<title>Wishlist — Gary's Batman Collection</title>`
- `<header>` containing the tab nav + a `<div id="claimer-header"></div>` on the right.
- `<main>` containing `<ul class="wish-list" id="wish-list"></ul>`, `<p class="empty" id="wish-empty" hidden>`, `<p class="error" id="wish-error" hidden>`.
- A `<dialog id="claim-modal">` (or `<div class="modal-backdrop" id="claim-modal" hidden>`) with the input + buttons.
- `<script type="module" src="js/wishlist.js"></script>`.

- [ ] **Step 2: Create `js/wishlist.js`**

Imports:

```js
import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { db } from "./firebase.js";
```

Module-level state:
```js
const CLAIMER_KEY = "claimerName";
const NAME_MAX = 60;
let wishes = [];
let activeWishId = null;
```

Flow:
1. On load: `renderClaimerHeader()`, then fetch `getDocs(query(collection(db, "wishlist"), orderBy("createdAt", "desc")))`, map to `{ id, tipo, nombre, serie, url, claimedBy, claimedAt }`, store in `wishes`, call `renderList()`.
2. `renderClaimerHeader()` reads `localStorage`, shows `Claiming as <name> · change` if present (append text nodes + an `<a>` with click handler that clears localStorage + re-renders header + re-renders list).
3. `renderList()` clears `#wish-list`, appends one `<li>` per wish. Each `<li>` built via `createElement` + `appendChild` + `textContent`. Button has `data-wish-id` attribute set to the wish id.
4. One delegated listener on `#wish-list` catches `click` events on `.claim-button`, reads `dataset.wishId`, opens the modal (sets `activeWishId`, pre-fills input, shows the dialog).
5. Modal `Confirm` button handler: reads trimmed input, rejects empty or `> NAME_MAX` chars with an inline error inside the modal (don't close), otherwise `await updateDoc(doc(db, "wishlist", activeWishId), { claimedBy: name, claimedAt: serverTimestamp() })`, stores in localStorage, closes modal, updates the local `wishes` entry, re-renders that item (or re-renders the whole list for simplicity).

- [ ] **Step 3: Manual verification — happy path**

Serve locally, open `wishlist.html`.
1. Items render with `View on store →` + `Claim this` button.
2. Click `Claim this` → modal opens with empty input.
3. Type `Alex`, click `Confirm claim` → modal closes, item now shows `Claimed by Alex`, no button. Reload page → claim persists. `localStorage.claimerName === "Alex"`.
4. Claim a second item → modal opens pre-filled with `Alex`. Confirm → second item shows `Claimed by Alex`.
5. Header shows `Claiming as Alex · change`. Click `change` → header empties, localStorage key removed.

- [ ] **Step 4: Manual verification — Review Focus checks**

- **XSS (Review Focus #3)**: in devtools console, run `localStorage.setItem("claimerName", "<script>alert('x')</script>")` and reload. Header must display the literal string `Claiming as <script>alert('x')</script> · change`. No alert fires.
- **Claim with long name**: type a 100-character name → modal shows inline error, does not write, does not close.
- **Claim with empty name**: type spaces only → modal shows inline error.
- **"Change my name" link (Review Focus #5)**: with a name stored, click `change` in the header → localStorage key removed, next claim modal opens empty.

- [ ] **Step 5: Commit**

```bash
git add wishlist.html js/wishlist.js styles.css
git commit -m "feat: wishlist page with public claim flow

Friends type a name (remembered in localStorage) and claim a wishlist
item; the single write targets claimedBy + claimedAt. All user text
is rendered via textContent to defend against XSS from the claimer
name field.
"
```

---

## Task 4: Firestore rules file + manual deploy + rule verification

**Files:**
- Create: `firestore.rules`
- Modify: `README.md` (add a "Deploy Firestore rules (one-time, then whenever rules change)" section)

**Interfaces:**
- Produces: `firestore.rules` as the source of truth for the project's security rules. Deployed manually via the Firebase CLI or by paste into the console.

- [ ] **Step 1: Create `firestore.rules`**

Content taken verbatim from the spec's "Firestore rules diff" section. Leave `<OWNER_UID>` as a literal placeholder — the user substitutes it locally before deploying and DOES NOT commit a real UID (in case the user later wants to add a second owner). Add a `// REPLACE_OWNER_UID_BEFORE_DEPLOY` comment on the two lines containing the placeholder so a grep can find them.

- [ ] **Step 2: Add rules-deploy section to `README.md`**

Minimal content:

```markdown
## Deploy Firestore rules

Required once (and whenever `firestore.rules` changes).

1. Find your Firebase UID: Firebase Console → Authentication → Users → your email → UID column.
2. In a local working copy, open `firestore.rules` and replace BOTH `<OWNER_UID>` placeholders with that UID. **Do not commit the replaced file.**
3. Install the Firebase CLI if you haven't: `npm install -g firebase-tools`.
4. Login once: `firebase login`.
5. Deploy: `firebase deploy --only firestore:rules --project my-batman-collection`.
6. Discard local changes: `git checkout firestore.rules`.

Or (quicker, less repeatable): paste the (UID-substituted) rules into Firebase Console → Firestore Database → Rules tab → Publish.
```

- [ ] **Step 3: Manual verification — rule enforcement (covers Review Focus #1 and #2)**

Once rules are deployed with a real UID, open `wishlist.html` locally, open devtools, and run these three checks. Each must fail as noted:

```js
// Setup (one-time per test session)
const { collection, doc, getDocs, limit, query, updateDoc } =
  await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js");
const { db } = await import("./js/firebase.js");
const sample = (await getDocs(query(collection(db, "wishlist"), limit(1)))).docs[0];
```

**Check A: anonymous writer tries to change `tipo` on a wishlist doc**
```js
await updateDoc(doc(db, "wishlist", sample.id), { tipo: "Hacked" });
// Expected: FirebaseError: Missing or insufficient permissions.
```

**Check B: anonymous writer tries to set an empty `claimedBy`**
```js
await updateDoc(doc(db, "wishlist", sample.id), { claimedBy: "", claimedAt: new Date() });
// Expected: FirebaseError: Missing or insufficient permissions.
```

**Check C: anonymous writer tries to write to the `figures` collection**
```js
const figure = (await getDocs(query(collection(db, "figures"), limit(1)))).docs[0];
await updateDoc(doc(db, "figures", figure.id), { nombre: "Hacked" });
// Expected: FirebaseError: Missing or insufficient permissions.
```

If any of those SUCCEED, the rules are wrong. Fix the rules file, redeploy, and re-run until all three fail as expected.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules README.md
git commit -m "feat: add Firestore security rules (public read, narrow claim write)

rules_version 2 rule set gates writes so unauthenticated visitors can
only mutate claimedBy + claimedAt on wishlist docs, each bounded by a
60-char length cap. OWNER_UID is left as a placeholder; the owner
substitutes locally and deploys separately via the Firebase CLI.
"
```

---

## Task 5: Deploy to GitHub Pages + end-to-end verification

**Files:**
- Modify: `README.md` (add a "Deploy to GitHub Pages" section + the site URL).

**No code changes in this task.** The user flips a repository setting; the plan documents it and the implementer verifies the live deploy.

- [ ] **Step 1: User action — enable GitHub Pages**

On `github.com/Garyfimo/my-batman-collection-web` → Settings → Pages → Source: **Deploy from a branch**, Branch: **main**, Folder: **/ (root)** → Save.

Within ~30 seconds, the site is live at `https://garyfimo.github.io/my-batman-collection-web/`.

- [ ] **Step 2: Add deploy section to `README.md`**

```markdown
## Deploy to GitHub Pages

One-time:

1. Settings → Pages → Source: "Deploy from a branch" → Branch `main`, Folder `/ (root)` → Save.
2. Wait ~30 seconds. The site is live at https://garyfimo.github.io/my-batman-collection-web/.

Every push to `main` thereafter republishes automatically.
```

- [ ] **Step 3: End-to-end verification against the live site (covers Review Focus #4)**

Open `https://garyfimo.github.io/my-batman-collection-web/` in a fresh browser (or private window — no cached localStorage).

- Figures grid renders. Filter chips work.
- Click `Wishlist` tab. URL becomes `https://garyfimo.github.io/my-batman-collection-web/wishlist.html` and page loads correctly (NOT a 404; this is where a leftover absolute path like `href="/wishlist.html"` would fail).
- Claim a wishlist item. Reload. Claim persists.
- Open the same URL from a phone on cellular (not wifi). Same checks pass.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add GitHub Pages deploy instructions + live URL

Site is deployed at https://garyfimo.github.io/my-batman-collection-web/.
"
```

---

## Not in scope

- Automated tests of any kind (no framework = no test runner; verification is manual per task).
- Un-claim UI for friends (owner handles un-claim via the Firebase console).
- Android app updates to show claim state (follow-up on the Android repo, not here).
- A custom domain for the deployed site (GitHub Pages supports one later via Settings → Pages → Custom domain; out of scope here).
- A bat-logo favicon beyond the inline `🦇` emoji — can land as a tiny follow-up with a committed `favicon.svg`.
