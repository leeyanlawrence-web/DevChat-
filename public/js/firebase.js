import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
const app = initializeApp({
  apiKey: "AIzaSyBDbDMX9gLZGHCjDmbI8xLAoD7DJMKtD5A",
  authDomain: "lee-app-77a83.firebaseapp.com",
  projectId: "lee-app-77a83",
  storageBucket: "lee-app-77a83.firebasestorage.app",
  messagingSenderId: "627364403515",
  appId: "1:627364403515:web:c2cd7bb6ea8a315e467f1e"
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
