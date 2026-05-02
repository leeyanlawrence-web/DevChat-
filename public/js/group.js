import { db, auth } from "./firebase.js";
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentGroup = null;

window.createGroup = async function () {
  const name = prompt("Enter group name:");
  if (!name) return;
  await addDoc(collection(db, "groups"), {
    name,
    createdBy: auth.currentUser.uid,
    members: [auth.currentUser.uid],
    createdAt: serverTimestamp()
  });
  loadGroups();
};

export async function loadGroups() {
  const list = document.getElementById("groupList");
  if (!list) return;
  const snap = await getDocs(collection(db, "groups"));
  list.innerHTML = "";
  snap.forEach(d => {
    const group = d.data();
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="item-avatar">👥</div>
      <div class="item-body">
        <div class="item-name">${group.name}</div>
        <div class="item-preview">Group chat</div>
      </div>
    `;
    div.onclick = () => openGroup(d.id, group.name);
    list.appendChild(div);
  });
}

function openGroup(groupId, groupName) {
  currentGroup = groupId;
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("activeChat").classList.remove("hidden");
  document.getElementById("chatName").textContent = groupName;
  document.getElementById("activeChatAvatar").textContent = "👥";
  document.getElementById("sidebar")?.classList.remove("open");
  listenGroupMessages();
}

function listenGroupMessages() {
  const q = query(
    collection(db, "groups", currentGroup, "messages"),
    orderBy("createdAt")
  );
  onSnapshot(q, snap => {
    const box = document.getElementById("messages");
    if (!box) return;
    box.innerHTML = "";
    snap.forEach(d => {
      const msg = d.data();
      const isMe = msg.senderId === auth.currentUser?.uid;
      const div = document.createElement("div");
      div.className = `msg ${isMe ? "sent" : "received"}`;
      div.innerHTML = `
        <div class="msg-bubble">
          ${!isMe ? `<small style="color:#58a6ff;font-size:0.75rem">${msg.senderName}</small><br>` : ""}
          ${msg.text}
        </div>
        <div class="msg-time">${msg.createdAt?.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) || ""}</div>
      `;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}

auth.onAuthStateChanged(user => {
  if (user) loadGroups();
});
