# my-batman-collection-web

Public-facing web view of the Batman figure collection and wishlist stored by the Android app at [Garyfimo/my-batman-collection](https://github.com/Garyfimo/my-batman-collection).

Reads the same Firestore backend; the Android app is the source of truth, this site is the read-only window for friends to browse.

Design docs live in `docs/superpowers/specs/`.

## Firebase setup (one-time)

1. In Firebase Console → Project settings → Your apps → Add app → Web.
2. Name it `my-batman-collection-web`; skip Firebase Hosting.
3. Copy the `firebaseConfig` object shown to you.
4. Paste its values into `js/firebase.js`, replacing the existing config values.
5. Commit and push.

If you fork or rotate the API key, replace the values in `js/firebase.js` with the config from your own Firebase Console → Project settings → Your apps → web app.

## Deploy Firestore rules

Required once (and whenever `firestore.rules` changes).

1. Find your Firebase UID: Firebase Console → Authentication → Users → your email → UID column.
2. In a local working copy, open `firestore.rules` and replace every `<OWNER_UID>` placeholder with that UID. There are three; `grep -n REPLACE_OWNER_UID_BEFORE_DEPLOY firestore.rules` lists them. **Do not commit the replaced file.**
3. Install the Firebase CLI if you haven't: `npm install -g firebase-tools`.
4. Login once: `firebase login`.
5. Deploy: `firebase deploy --only firestore:rules --project my-batman-collection`.
6. Discard local changes: `git checkout firestore.rules`.

Or (quicker, less repeatable): paste the (UID-substituted) rules into Firebase Console → Firestore Database → Rules tab → Publish.

### Regression test

Verify the claim rule before every deploy. After deploying, open the site in a private window. In another tab, open DevTools and attempt:

```js
const { collection, doc, getDocs, limit, query, updateDoc, serverTimestamp } =
  await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js");
const { db } = await import("./js/firebase.js");
const claimed = (await getDocs(query(collection(db, "wishlist"), limit(10))))
  .docs.find(d => d.data().claimedBy);
if (!claimed) {
  throw new Error("Regression test needs a claimed wishlist doc to run against. Claim one from the deployed site, then re-run.");
}
try {
  await updateDoc(doc(db, "wishlist", claimed.id), { claimedBy: "hacked", claimedAt: serverTimestamp() });
  throw new Error("REGRESSION: overwrite of existing claim was permitted. Fix firestore.rules before trusting this site.");
} catch (err) {
  if (err?.code !== "permission-denied") throw err;
  console.log("OK: claim rule rejected overwrite as expected.");
}
```

If the snippet throws (including the REGRESSION error), the rules are regressed or the test could not run — fix before relying on the site.

## Deploy to GitHub Pages

One-time:

1. Settings → Pages → Source: "Deploy from a branch" → Branch `main`, Folder `/ (root)` → Save.
2. Wait ~30 seconds. The site is live at https://garyfimo.github.io/my-batman-collection-web/.

Every push to `main` thereafter republishes automatically.
