import { db, auth } from "./firebase.js";
import {
  collection, addDoc, onSnapshot,
  orderBy, query, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.createStatus = async function () {
  const text = prompt("What's on your mind?");
  if (!text) return;
  await addDoc(collection(db, "status"), {
    text,
    userId: auth.currentUser.uid,
    userName: auth.currentUser.email?.split("@")[0] || "Dev",
    createdAt: serverTimestamp()
  });
};

export function loadStatus() {
  const q = query(
    collection(db, "status"),
    orderBy("createdAt", "desc")
  );
  onSnapshot(q, snap => {
    const list = document.getElementById("statusList");
    if (!list) return;
    list.innerHTML = "";
    snap.forEach(d => {
      const s = d.data();
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div class="item-avatar">${(s.userName || "D")[0].toUpperCase()}</div>
        <div class="item-body">
          <div class="item-name">${s.userName}</div>
          <div class="item-preview">${s.text}</div>
        </div>
      `;
      list.appendChild(div);
    });
  });
}

auth.onAuthStateChanged(user => {
  if (user) loadStatus();
});
