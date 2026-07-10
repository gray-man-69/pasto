// Firebase init (Auth + Firestore). The web API key is public by design — data
// is protected by Auth + the Firestore security rules (each user can only touch
// users/{their-uid}/**). Analytics is intentionally omitted (not needed, and it
// touches browser-only APIs that break during static prerender).
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCKz33bgbB1EZq5KvFKweepj61ThCViVUM",
  authDomain: "pasto-9b607.firebaseapp.com",
  projectId: "pasto-9b607",
  messagingSenderId: "219274290870",
  appId: "1:219274290870:web:0d9ef1b2f66ea5eb7c2817",
};

const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
// ignoreUndefinedProperties: records carry optional fields (mealId, components…)
// that are often undefined; Firestore rejects undefined unless told to skip it.
export const firestore: Firestore = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
