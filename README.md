# my-batman-collection-web

Public-facing web view of the Batman figure collection and wishlist stored by the Android app at [Garyfimo/my-batman-collection](https://github.com/Garyfimo/my-batman-collection).

Reads the same Firestore backend; the Android app is the source of truth, this site is the read-only window for friends to browse.

Stack, deployment, and scope are being brainstormed in `docs/superpowers/specs/` — see the first design doc for details.

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
2. In a local working copy, open `firestore.rules` and replace BOTH `<OWNER_UID>` placeholders with that UID. **Do not commit the replaced file.**
3. Install the Firebase CLI if you haven't: `npm install -g firebase-tools`.
4. Login once: `firebase login`.
5. Deploy: `firebase deploy --only firestore:rules --project my-batman-collection`.
6. Discard local changes: `git checkout firestore.rules`.

Or (quicker, less repeatable): paste the (UID-substituted) rules into Firebase Console → Firestore Database → Rules tab → Publish.
