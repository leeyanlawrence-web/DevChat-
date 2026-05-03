import { db, auth } from "./firebase.js";
import {
  collection, addDoc, onSnapshot,
  query, orderBy, serverTimestamp,
  getDocs, doc, getDoc, setDoc, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentChat = null;
let currentType = "dm";
let unsubscribe = null;

window.currentChat = null;
window.currentType = "dm";

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function getInitial(name) {
  return (name || "?")[0].toUpperCase();
}

function formatTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function formatDate(date) {
  if (!date) return "";
  const now = new Date();
  const diff = now - date;
  if (diff < 86400000) return "Today";
  if (diff < 172800000) return "Yesterday";
  return date.toLocaleDateString([], {month:'short', day:'numeric'});
}

// Load all users
export async function loadUsers() {
  const me = auth.currentUser;
  if (!me) return;

  try {
    const userDoc = await getDoc(doc(db, "users", me.uid));
    const userData = userDoc.data();
    const myName = userData?.displayName || me.email?.split("@")[0] || "Dev";
    const myPhoto = userData?.photo || me.photoURL || "";

    const nameEl = document.getElementById("userName");
    const avatarEl = document.getElementById("userAvatar");
    if (nameEl) nameEl.textContent = myName;
    if (avatarEl) {
      avatarEl.innerHTML = myPhoto
        ? `<img src="${myPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : getInitial(myName);
    }

    // Listen to users in real time
    onSnapshot(collection(db, "users"), snap => {
      const list = document.getElementById("chatList");
      if (!list) return;
      list.innerHTML = "";

      snap.forEach(d => {
        if (d.id === me.uid) return;
        const user = d.data();
        const name = user.displayName || user.email?.split("@")[0] || "Developer";

        const div = document.createElement("div");
        div.className = "list-item";
        div.dataset.uid = d.id;
        div.dataset.name = name.toLowerCase();

        div.innerHTML = `
          <div class="item-avatar-wrap">
            <div class="item-avatar">
              ${user.photo
                ? `<img src="${user.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                : `<span>${getInitial(name)}</span>`
              }
            </div>
            ${user.online ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="item-body">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div class="item-name">${name}</div>
              <div class="item-time">${user.lastSeen ? formatDate(user.lastSeen.toDate()) : ''}</div>
            </div>
            <div class="item-preview">${user.online ? '🟢 Online' : '⚫ Offline'}</div>
          </div>
        `;

        div.onclick = () => openChat(d.id, name, user.photo || "");
        list.appendChild(div);
      });
    });

  } catch (err) {
    console.error("loadUsers error:", err);
  }
}

// Open a DM chat
export function openChat(userId, userName, userPhoto) {
  const me = auth.currentUser;
  if (!me) return;

  currentChat = getChatId(me.uid, userId);
  currentType = "dm";
  window.currentChat = currentChat;
  window.currentType = currentType;

  // Show chat window
  document.getElementById("emptyState")?.classList.add("hidden");
  const activeChat = document.getElementById("activeChat");
  activeChat?.classList.remove("hidden");

  // Set header
  document.getElementById("chatName").textContent = userName;
  document.getElementById("chatStatus").textContent = "● online";

  const avatar = document.getElementById("activeChatAvatar");
  if (avatar) {
    avatar.innerHTML = userPhoto
      ? `<img src="${userPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : getInitial(userName);
  }

  // Mobile - close sidebar
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("show");
  const backBtn = document.getElementById("backBtn");
  if (backBtn) backBtn.style.display = "flex";

  const topbarTitle = document.getElementById("topbarTitle");
  if (topbarTitle) topbarTitle.textContent = userName;

  // Highlight active
  document.querySelectorAll(".list-item").forEach(i => i.classList.remove("active"));
  document.querySelector(`[data-uid="${userId}"]`)?.classList.add("active");

  // Focus input
  setTimeout(() => document.getElementById("msgInput")?.focus(), 300);

  listenMessages();
}

// Listen to messages in real time
function listenMessages() {
  if (unsubscribe) unsubscribe();
  if (!currentChat) return;

  const col = currentType === "dm"
    ? collection(db, "chats", currentChat, "messages")
    : collection(db, "groups", currentChat, "messages");

  const q = query(col, orderBy("createdAt"));

  unsubscribe = onSnapshot(q, snap => {
    const box = document.getElementById("messages");
    if (!box) return;
    box.innerHTML = "";

    let lastDateStr = "";

    snap.forEach(d => {
      const msg = d.data();
      const isMe = msg.senderId === auth.currentUser?.uid;
      const msgDate = msg.createdAt?.toDate();

      // Date divider
      if (msgDate) {
        const dateStr = formatDate(msgDate);
        if (dateStr !== lastDateStr) {
          const divider = document.createElement("div");
          divider.className = "msg-date-divider";
          divider.innerHTML = `<span>${dateStr}</span>`;
          box.appendChild(divider);
          lastDateStr = dateStr;
        }
      }

      const div = document.createElement("div");
      div.className = `msg ${isMe ? "sent" : "received"}`;

      let content = escapeHtml(msg.text || "");

      if (msg.fileUrl) {
        if (msg.fileType?.startsWith("image/")) {
          content = `<img src="${msg.fileUrl}" style="max-width:220px;border-radius:10px;display:block;cursor:pointer;" onclick="window.open('${msg.fileUrl}','_blank')">`;
        } else if (msg.fileType?.startsWith("video/")) {
          content = `<video src="${msg.fileUrl}" controls style="max-width:220px;border-radius:10px;"></video>`;
        } else {
          content = `<a href="${msg.fileUrl}" target="_blank" style="color:inherit;display:flex;align-items:center;gap:6px;">📎 ${escapeHtml(msg.text || "File")}</a>`;
        }
      }

      if (!isMe && currentType === "group") {
        div.innerHTML = `
          <div class="msg-sender">${escapeHtml(msg.senderName || "")}</div>
          <div class="msg-bubble">${content}</div>
          <div class="msg-time">${msgDate ? formatTime(msgDate) : ""}</div>
        `;
      } else {
        div.innerHTML = `
          <div class="msg-bubble">${content}</div>
          <div class="msg-time">
            ${msgDate ? formatTime(msgDate) : ""}
            ${isMe ? ' <span style="color:var(--blue);font-size:0.7rem;">✓✓</span>' : ""}
          </div>
        `;
      }

      box.appendChild(div);
    });

    box.scrollTop = box.scrollHeight;
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Send a message
window.sendMessage = async function () {
  const input = document.getElementById("msgInput");
  const text = input?.value.trim();
  if (!text) return;
  if (!currentChat) {
    alert("Please select a chat first!");
    return;
  }

  input.value = "";

  try {
    const me = auth.currentUser;
    const col = currentType === "dm"
      ? collection(db, "chats", currentChat, "messages")
      : collection(db, "groups", currentChat, "messages");

    await addDoc(col, {
      text,
      senderId: me.uid,
      senderName: me.displayName || me.email?.split("@")[0] || "Dev",
      createdAt: serverTimestamp(),
      read: false
    });
  } catch (err) {
    console.error("sendMessage error:", err);
    alert("Failed to send message: " + err.message);
  }
};

// Enter key to send
document.addEventListener("DOMContentLoaded", () => {
  const msgInput = document.getElementById("msgInput");
  if (msgInput) {
    msgInput.addEventListener("keypress", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
});

// Tab switcher
window.switchTab = function (tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.getElementById(`panel-${tab}`)?.classList.add("active");
};

// Sidebar toggle
window.toggleSidebar = function () {
  document.getElementById("sidebar")?.classList.toggle("open");
  document.getElementById("sidebarOverlay")?.classList.toggle("show");
};

// Close chat
window.closeChat = function () {
  if (unsubscribe) unsubscribe();
  currentChat = null;
  window.currentChat = null;

  document.getElementById("activeChat")?.classList.add("hidden");
  document.getElementById("emptyState")?.classList.remove("hidden");
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebarOverlay")?.classList.add("show");

  const backBtn = document.getElementById("backBtn");
  if (backBtn) backBtn.style.display = "none";

  const topbarTitle = document.getElementById("topbarTitle");
  if (topbarTitle) topbarTitle.textContent = "<DevChat/>";
};

window.setCurrentChat = function(id) {
  currentChat = id;
  window.currentChat = id;
};

window.setCurrentType = function(type) {
  currentType = type;
  window.currentType = type;
};

window.listenMessages = listenMessages;

// Update user online status
function setOnlineStatus(online) {
  const me = auth.currentUser;
  if (!me) return;
  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
    .then(({ doc, updateDoc }) => {
      updateDoc(doc(db, "users", me.uid), {
        online,
        lastSeen: new Date()
      }).catch(() => {});
    });
}

// Auth state
auth.onAuthStateChanged(user => {
  if (user) {
    setOnlineStatus(true);
    loadUsers();

    // Set offline on tab close
    window.addEventListener("beforeunload", () => setOnlineStatus(false));
  }
});
