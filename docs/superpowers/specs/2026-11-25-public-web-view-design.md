# Public Web View — Design

**Date:** 2026-11-25
**Repo:** `my-batman-collection-web` (sibling to the Android repo `my-batman-collection`)
**Backend:** shares the Firestore project with the Android app.
**Size:** small project.

## Intent

A public, read-mostly web page where friends can browse the Batman figure collection and claim items from the wishlist. The Android app remains the source of truth and the only administration surface; the web client reads the same Firestore collections and makes narrow writes limited to the wishlist's "claim" fields.

### Why

- The collection is only ever visible to the owner on the Android device today; friends have no way to see it.
- The wishlist has no social coordination — multiple friends could buy the same figure without knowing.

## Goals

- Public, no-login browsing of `figures` (grid) and `wishlist` (list with outbound shop links).
- A **claim** button on each wishlist item: friend types their name (remembered in `localStorage`), the claim is written back to Firestore, and all later visitors see `Claimed by <name>`.
- The owner (you) sees all claims in the web UI. The Android app is unchanged by this project.
- Deploys as a static site to GitHub Pages at `https://garyfimo.github.io/my-batman-collection-web/`.

## Non-goals

- **No framework.** Plain HTML, CSS, vanilla JS (ES modules). No `npm`, no build step, no bundler.
- **No admin on the web.** Adding/editing/deleting figures or wishes is done exclusively in the Android app.
- **No auth of any kind.** No Google Sign-In, no magic links, no cookie sessions. Friends are identified only by the name they type.
- **No dependency on the Android repo.** Both projects share Firestore; neither imports from the other.
- **No comments, no reactions, no notifications.**
- **No search or custom sort.** Both pages are `createdAt desc`. Figures page has a `tipo` filter chip row matching the Android UI.

## Anti-goals (would make this a failure even if it technically works)

- A friend can mutate an item they didn't claim (vandalism risk via the surgical write rule being too loose).
- A friend can write to any field other than `claimedBy` / `claimedAt` on a wishlist doc.
- Anyone can touch the `figures` collection at all (public reads only; no writes ever from the web).
- A load that triggers Firestore's free-tier read limit on a normal friend's visit.

## Constraints

- Firestore collections are fixed: `figures/{id}` and `wishlist/{id}` with the fields the Android app already writes. The web app must consume them as-is — no schema changes to existing fields.
- Firestore security rules will be edited surgically to permit the two new behaviors (public reads on both collections; narrow public writes on `wishlist` for `claimedBy` + `claimedAt` only). Rules changes are deployed via the Firebase console or `firebase deploy --only firestore:rules` — out of scope for the GitHub Pages deploy.
- The Firebase web API key is **not a secret** and is committed to the repo. Security is enforced by the rules, not by hiding the key.
- Must work on mobile first (friends open on phones).
- No commit attribution trailer (`Co-Authored-By`, etc.) on commits in this repo either — same policy as the Android repo.

## Approaches considered

Stack sequencing (what the app is written in):

1. **Framework (SvelteKit / React / Vue).** Rejected by user preference: wants no build step, no `npm`, just HTML/CSS/JS.
2. **Plain HTML + vanilla JS (ES modules) + Firebase JS SDK via CDN.** ✓ **Chosen.** Zero build, zero dependencies, deploys as-is to any static host. For two pages with modest interactivity, the framework overhead would be larger than the code it replaces.

Hosting:

1. **Firebase Hosting.** Would be natural (same Firebase project). Rejected by user preference: wants GitHub Pages so workflow stays on GitHub.
2. **GitHub Pages, deploy from `main` root.** ✓ **Chosen.** Push → auto-republish in ~30s. No CI pipeline.
3. GitHub Pages via a `gh-pages` branch + GitHub Actions. Rejected: more infrastructure than this project warrants.

Visual identity:

1. **Neutral / generic palette.** Rejected: the Android app has a visual identity (Classic Batman: midnight-blue + bat-yellow), and the web view should feel like its companion.
2. **Reuse Classic Batman palette.** ✓ **Chosen.** Midnight-blue background, bat-yellow accents. `prefers-color-scheme` auto-swaps light and dark.

## The how, as decided

### File layout

```
my-batman-collection-web/
├── index.html           Figures gallery (landing page)
├── wishlist.html        Wishlist with claim flow
├── styles.css           Shared styles, Classic Batman palette
├── js/
│   ├── firebase.js      SDK init; exports `db` (Firestore handle)
│   ├── figures.js       Loads figures, renders grid, filter chip interactions
│   └── wishlist.js      Loads wishlist, renders list, claim modal + localStorage name
├── README.md            What it is, how to deploy, how to update rules
├── .gitignore           Already present (scratchpad + env-leaked files)
└── docs/superpowers/    Specs + plans (this file)
```

### Firebase SDK integration

Load the modular v10 SDK from Google's CDN inside `js/firebase.js`:

```html
<script type="module" src="./js/firebase.js"></script>
```

Inside `firebase.js`:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "<public>",
  authDomain: "...",
  projectId: "...",
  // ... from Firebase console → Project settings → Web app config
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

### Firestore reads

- **Figures**: `getDocs(query(collection(db, "figures"), orderBy("createdAt", "desc")))` on page load. One-shot read, not a live listener — no need for live updates since the data changes rarely.
- **Wishlist**: same pattern. On claim success, re-render the single affected item (or re-read the whole list — cheaper to just re-render in place with the result).

### Claim flow

1. Friend clicks "Claim this" on an unclaimed item.
2. Modal opens with a name field, pre-filled from `localStorage.getItem("claimerName")`.
3. Friend confirms → write `{ claimedBy: name, claimedAt: serverTimestamp() }` to that wishlist doc via `updateDoc(doc(db, "wishlist", id), { claimedBy, claimedAt: serverTimestamp() })`.
4. `localStorage.setItem("claimerName", name)` so the next claim pre-fills.
5. UI updates in place: button becomes grey text `Claimed by <name>`.
6. "Change my name" link in the page header clears and re-prompts on next claim.

Un-claim is not a user-facing feature; if a friend wants to release a claim they contact the owner, who can edit it in the Firebase console (or in a future Android-app follow-up).

### Firestore rules diff

Current (presumed) rules reject all client writes except from the owner's UID. New rules add:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Figures: public read, owner-only write.
    match /figures/{id} {
      allow read: if true;
      allow create, update, delete: if request.auth != null
        && request.auth.uid == "<OWNER_UID>";
    }

    // Wishlist: public read; owner can do anything; anyone can SET exactly
    // claimedBy + claimedAt and nothing else.
    match /wishlist/{id} {
      allow read: if true;

      allow create, delete: if request.auth != null
        && request.auth.uid == "<OWNER_UID>";

      allow update: if
        // Owner: unrestricted update.
        (request.auth != null && request.auth.uid == "<OWNER_UID>")
        ||
        // Anyone else: must change ONLY claimedBy and claimedAt, and claimedBy
        // must be a non-empty string under a length cap.
        (request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(["claimedBy", "claimedAt"])
          && request.resource.data.claimedBy is string
          && request.resource.data.claimedBy.size() > 0
          && request.resource.data.claimedBy.size() <= 60);
    }
  }
}
```

The `<OWNER_UID>` placeholder is the Firebase UID of your signed-in account on the Android app — look it up in Firebase Console → Authentication → Users. The owner deploys this rules file with `firebase deploy --only firestore:rules` (or pastes it into the console).

### Visual

- Palette matches Classic Batman from the Android app: midnight `#122145` and bat-yellow `#FFCC00` as the primary pair in light mode; `#0B1226` and `#FFCC00` in dark mode. Hexes taken verbatim from the Android `ClassicLightColorScheme.kt` / `ClassicDarkColorScheme.kt`.
- `prefers-color-scheme` switches light / dark automatically.
- Mobile-first: single-column grid on narrow screens, 2–3 columns at ≥ 768 px, 4 at ≥ 1024 px.
- Typography: system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). No webfont download.

### Hosting

- Settings → Pages in the GitHub repo → "Deploy from a branch" → `main` branch, `/` root. GitHub Pages republishes on every push to `main`.
- The site URL is `https://garyfimo.github.io/my-batman-collection-web/` (we can bind a custom domain later; not needed for v1).

## What's left to the builder

- Exact bat-logo (favicon + header). A simple SVG bat silhouette is enough; builder may pick one from a public-domain source or hand-draw one.
- Empty-state copy ("No figures yet" / "Wishlist is empty"), loading-state copy ("Loading…"), error-state copy ("Couldn't reach Firestore. Try again?").
- Exact layout of the wishlist item card (claim button position, claimed-by presentation) — anything that reads cleanly on mobile is fine.
- README content specifics (how to copy the Firebase config, where to find the OWNER_UID, how to deploy the rules).
