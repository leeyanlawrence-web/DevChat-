import { db, auth } from "./firebase.js";
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentChat = null;
let currentType = "dm";
let unsubscribe = null;

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function getInitial(name) {
  return (name || "?")[0].toUpperCase();
}

export async function loadUsers() {
  const list = document.getElementById("chatList");
  if (!list) return;
  const snap = await getDocs(collection(db, "users"));
  list.innerHTML = "";
  snap.forEach(d => {
    const user = d.data();
    if (d.id === auth.currentUser?.uid) return;
    const name = user.displayName || user.email?.split("@")[0] || "Developer";
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="item-avatar">${getInitial(name)}</div>
      <div class="item-body">
        <div class="item-name">${name}</div>
        <div class="item-preview">Tap to chat</div>
      </div>
    `;
    div.onclick = () => openChat(d.id, name);
    list.appendChild(div);
  });
  const me = auth.currentUser;
  if (me) {
    const myName = me.email?.split("@")[0] || "Dev";
    const nameEl = document.getElementById("userName");
    const avatarEl = document.getElementById("userAvatar");
    if (nameEl) nameEl.textContent = myName;
    if (avatarEl) avatarEl.textContent = getInitial(myName);
  }
}

export function openChat(userId, userName) {
  if (!auth.currentUser) return;
  currentChat = getChatId(auth.currentUser.uid, userId);
  currentType = "dm";
  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("activeChat").classList.remove("hidden");
  document.getElementById("chatName").textContent = userName;
  const avatar = document.getElementById("activeChatAvatar");
  if (avatar) avatar.textContent = getInitial(userName);
  document.getElementById("sidebar")?.classList.remove("open");
  const backBtn = document.getElementById("backBtn");
  if (backBtn) backBtn.style.display = "flex";
  listenMessages();
}

function listenMessages() {
  if (unsubscribe) unsubscribe();
  const col = currentType === "dm"
    ? collection(db, "chats", currentChat, "messages")
    : collection(db, "groups", currentChat, "messages");
  const q = query(col, orderBy("createdAt"));
  unsubscribe = onSnapshot(q, snap => {
    const box = document.getElementById("messages");
    if (!box) return;
    box.innerHTML = "";
    snap.forEach(d => {
      const msg = d.data();
      const isMe = msg.senderId === auth.currentUser?.uid;
      const div = document.createElement("div");
      div.className = `msg ${isMe ? "sent" : "received"}`;
      div.innerHTML = `
        <div class="msg-bubble">${msg.text}</div>
        <div class="msg-time">${msg.createdAt?.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) || ""}</div>
      `;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}

window.sendMessage = async function () {
  const input = document.getElementById("msgInput");
  const text = input?.value.trim();
  if (!text || !currentChat) return;
  const col = currentType === "dm"
    ? collection(db, "chats", currentChat, "messages")
    : collection(db, "groups", currentChat, "messages");
  await addDoc(col, {
    text,
    senderId: auth.currentUser?.uid,
    senderName: auth.currentUser?.email?.split("@")[0] || "Dev",
    createdAt: serverTimestamp()
  });
  input.value = "";
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("msgInput")?.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });
});

window.switchTab = function (tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.getElementById(`panel-${tab}`)?.classList.add("active");
};

window.toggleSidebar = function () {
  document.getElementById("sidebar")?.classList.toggle("open");
};

window.closeChat = function () {
  document.getElementById("activeChat")?.classList.add("hidden");
  document.getElementById("emptyState")?.classList.remove("hidden");
  document.getElementById("sidebar")?.classList.add("open");
  const backBtn = document.getElementById("backBtn");
  if (backBtn) backBtn.style.display = "none";
};

window.goBack = window.closeChat;

auth.onAuthStateChanged(user => {
  if (user) loadUsers();
});
