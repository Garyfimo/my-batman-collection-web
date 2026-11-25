// SDK init for the public web view. The config values below come from
// Firebase Console → Project settings → Your apps → the web app config.
// These are NOT secrets — security is enforced by Firestore rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDu8ZecGY-xH9AhYO-pAyx3iF6N6jTtHcQ",
  authDomain: "my-batman-collection.firebaseapp.com",
  projectId: "my-batman-collection",
  storageBucket: "my-batman-collection.firebasestorage.app",
  messagingSenderId: "258516608138",
  appId: "1:258516608138:web:f03d062e9f0b0adda9f973",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
