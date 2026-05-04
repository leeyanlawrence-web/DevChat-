import { auth, db, storage } from "./firebase.js";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, getDocs, doc,
  getDoc, updateDoc, setDoc, deleteDoc, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// STATE
let me = null;
let myData = null;
let currentChatId = null;
let currentChatType = "dm";
let currentTab = "chats";
let unsub = null;
let allUsers = [];

// INIT
auth.onAuthStateChanged(async user => {
  document.body.style.visibility = "visible";
  if (!user) return window.location.replace("/login.html");
  me = user;
  const d = await getDoc(doc(db, "users", me.uid));
  myData = d.data() || {};
  renderMe();
  listenUsers();
  listenGroups();
  applyTheme();
  updateOnline(true);
  window.addEventListener("beforeunload", () => updateOnline(false));
});

async function updateOnline(online) {
  if (!me) return;
  await updateDoc(doc(db, "users", me.uid), { online, lastSeen: new Date() }).catch(() => {});
}

function renderMe() {
  const name = myData.displayName || me.email?.split("@")[0] || "Dev";
  const photo = myData.photo || me.photoURL || "";
  setText("meName", name);
  setAvatar("meAvatar", name, photo);
  setText("pcName", name);
  setText("pcEmail", me.email || "");
  setAvatar("pcAvatar", name, photo);
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function setAvatar(id, name, photo) {
  const el = document.getElementById(id);
  if (!el) return;
  if (photo) el.innerHTML = `<img src="${photo}" alt="${name}">`;
  else el.textContent = (name || "?")[0].toUpperCase();
}

function fmtTime(d) { return d ? d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : ""; }
function fmtDate(d) {
  if (!d) return "";
  const now = new Date(), diff = now - d;
  if (diff < 86400000) return fmtTime(d);
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString([], {month:"short",day:"numeric"});
}
function esc(t) { return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// LISTEN USERS
function listenUsers() {
  onSnapshot(collection(db, "users"), snap => {
    allUsers = [];
    snap.forEach(d => {
      if (d.id !== me.uid) allUsers.push({id: d.id, ...d.data()});
    });
    renderUserList(allUsers);
    renderModalList(allUsers);
  });
}

function renderUserList(users) {
  const list = document.getElementById("userList");
  if (!list) return;
  list.innerHTML = "";
  users.forEach(u => {
    const name = u.displayName || u.email?.split("@")[0] || "Developer";
    const div = document.createElement("div");
    div.className = "chat-row" + (currentChatId === getChatId(me.uid, u.id) ? " active" : "");
    div.dataset.uid = u.id;
    div.innerHTML = `
      <div class="cr-avatar">
        ${u.photo ? `<img src="${u.photo}" alt="${name}">` : `<span>${name[0].toUpperCase()}</span>`}
        ${u.online ? '<div class="online-ring"></div>' : ''}
      </div>
      <div class="cr-body">
        <div class="cr-top">
          <div class="cr-name">${esc(name)}</div>
          <div class="cr-time">${u.lastSeen ? fmtDate(u.lastSeen.toDate()) : ""}</div>
        </div>
        <div class="cr-preview">${u.online ? "🟢 Online" : "⚫ Offline"}</div>
      </div>
    `;
    div.onclick = () => openDM(u.id, name, u.photo || "");
    list.appendChild(div);
  });
}

function renderModalList(users) {
  const list = document.getElementById("modalUserList");
  if (!list) return;
  list.innerHTML = "";
  users.forEach(u => {
    const name = u.displayName || u.email?.split("@")[0] || "Developer";
    const div = document.createElement("div");
    div.className = "chat-row";
    div.innerHTML = `
      <div class="cr-avatar">
        ${u.photo ? `<img src="${u.photo}" alt="${name}">` : `<span>${name[0].toUpperCase()}</span>`}
      </div>
      <div class="cr-body">
        <div class="cr-name">${esc(name)}</div>
        <div class="cr-preview">${u.email || ""}</div>
      </div>
    `;
    div.onclick = () => {
      closeModal("newChatModal");
      openDM(u.id, name, u.photo || "");
    };
    list.appendChild(div);
  });
}

// LISTEN GROUPS
function listenGroups() {
  onSnapshot(collection(db, "groups"), snap => {
    const list = document.getElementById("groupList");
    if (!list) return;
    list.innerHTML = "";
    snap.forEach(d => {
      const g = d.data();
      const div = document.createElement("div");
      div.className = "chat-row";
      div.innerHTML = `
        <div class="cr-avatar" style="background:linear-gradient(135deg,#7c3aed,#a78bfa)">
          <span>${(g.name||"G")[0].toUpperCase()}</span>
        </div>
        <div class="cr-body">
          <div class="cr-top">
            <div class="cr-name">${esc(g.name)}</div>
          </div>
          <div class="cr-preview">👥 ${g.members?.length || 1} members</div>
        </div>
      `;
      div.onclick = () => openGroup(d.id, g.name);
      list.appendChild(div);
    });
  });
}

// OPEN DM
function getChatId(a, b) { return [a, b].sort().join("_"); }

function openDM(userId, userName, userPhoto) {
  currentChatId = getChatId(me.uid, userId);
  currentChatType = "dm";
  showChat(userName, userPhoto);
  listenMessages();
  document.querySelectorAll(".chat-row[data-uid]").forEach(r => r.classList.remove("active"));
  document.querySelector(`.chat-row[data-uid="${userId}"]`)?.classList.add("active");
  closeSidebar();
}

function openGroup(groupId, groupName) {
  currentChatId = groupId;
  currentChatType = "group";
  showChat(groupName, "");
  listenMessages();
  closeSidebar();
}

function showChat(name, photo) {
  document.getElementById("noChat")?.classList.add("hidden");
  document.getElementById("activeChat")?.classList.remove("hidden");
  document.getElementById("chName").textContent = name;
  document.getElementById("chStatus").textContent = currentChatType === "group" ? "Group chat" : "online";
  const av = document.getElementById("chAvatar");
  if (av) {
    if (photo) av.innerHTML = `<img src="${photo}" alt="${name}">`;
    else av.textContent = (name || "?")[0].toUpperCase();
    if (currentChatType === "group") av.style.background = "linear-gradient(135deg,#7c3aed,#a78bfa)";
    else av.style.background = "";
  }
  document.getElementById("chName").textContent = name;
  document.getElementById("tbarTitle").textContent = name;
  document.getElementById("msgInput")?.focus();
}

// MESSAGES
function listenMessages() {
  if (unsub) unsub();
  if (!currentChatId) return;
  const col = currentChatType === "dm"
    ? collection(db, "chats", currentChatId, "messages")
    : collection(db, "groups", currentChatId, "messages");
  const q = query(col, orderBy("createdAt"));
  unsub = onSnapshot(q, snap => {
    const box = document.getElementById("messages");
    if (!box) return;
    box.innerHTML = "";
    let lastDate = "";
    snap.forEach(d => {
      const msg = d.data();
      const isMe = msg.senderId === me.uid;
      const date = msg.createdAt?.toDate();
      if (date) {
        const ds = date.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"});
        if (ds !== lastDate) {
          const div = document.createElement("div");
          div.className = "date-divider";
          div.innerHTML = `<span>${ds}</span>`;
          box.appendChild(div);
          lastDate = ds;
        }
      }
      const wrap = document.createElement("div");
      wrap.className = `msg ${isMe ? "me" : "them"}`;
      let content = esc(msg.text || "");
      if (msg.fileUrl) {
        if (msg.fileType?.startsWith("image/")) {
          content = `<img src="${msg.fileUrl}" style="max-width:220px;border-radius:8px;display:block;cursor:pointer" onclick="window.open('${msg.fileUrl}','_blank')">`;
        } else if (msg.fileType?.startsWith("video/")) {
          content = `<video src="${msg.fileUrl}" controls style="max-width:220px;border-radius:8px;"></video>`;
        } else {
          content = `<a href="${msg.fileUrl}" target="_blank" style="color:inherit">📎 ${esc(msg.text||"File")}</a>`;
        }
      }
      wrap.innerHTML = `
        ${!isMe && currentChatType==="group" ? `<div class="sender-name">${esc(msg.senderName||"")}</div>` : ""}
        <div class="bubble">${content}</div>
        <div class="msg-meta">
          ${date ? fmtTime(date) : ""}
          ${isMe ? ' ✓✓' : ''}
        </div>
      `;
      box.appendChild(wrap);
    });
    box.scrollTop = box.scrollHeight;
  });
}

// SEND MESSAGE
window.sendMsg = async function () {
  const input = document.getElementById("msgInput");
  const text = input?.value.trim();
  if (!text || !currentChatId) return;
  input.value = "";
  const col = currentChatType === "dm"
    ? collection(db, "chats", currentChatId, "messages")
    : collection(db, "groups", currentChatId, "messages");
  try {
    await addDoc(col, {
      text,
      senderId: me.uid,
      senderName: myData.displayName || me.email?.split("@")[0] || "Dev",
      createdAt: serverTimestamp()
    });
  } catch(e) { console.error(e); }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("msgInput")?.addEventListener("keypress", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
});

// ATTACH FILE
window.attachFile = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*,.pdf,.txt,.js,.py,.zip";
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    const path = `uploads/${me.uid}/${Date.now()}_${file.name}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    const col = currentChatType === "dm"
      ? collection(db, "chats", currentChatId, "messages")
      : collection(db, "groups", currentChatId, "messages");
    await addDoc(col, {
      text: file.name, fileUrl: url, fileType: file.type,
      senderId: me.uid, senderName: myData.displayName || "Dev",
      createdAt: serverTimestamp()
    });
  };
  input.click();
};

// EMOJI (simple)
window.pickEmoji = function () {
  const emojis = ["😊","😂","❤️","👍","🔥","✅","💯","🚀","😎","🙌","💻","⚡","🎉","👋","🤔"];
  const input = document.getElementById("msgInput");
  if (!input) return;
  const pick = prompt("Pick emoji: " + emojis.join(" "));
  if (pick) input.value += pick;
  input.focus();
};

// STATUS
window.addStatus = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const r = ref(storage, `status/${me.uid}/${Date.now()}_${file.name}`);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    await addDoc(collection(db, "status"), {
      type: file.type.startsWith("video/") ? "video" : "photo",
      url, userId: me.uid,
      userName: myData.displayName || me.email?.split("@")[0] || "Dev",
      userPhoto: myData.photo || "",
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 86400000)
    });
  };
  input.click();
};

// Load status
function listenStatus() {
  const q = query(collection(db, "status"), orderBy("createdAt","desc"));
  onSnapshot(q, snap => {
    const list = document.getElementById("statusItems");
    if (!list) return;
    list.innerHTML = "";
    const now = new Date();
    snap.forEach(d => {
      const s = d.data();
      if (s.expiresAt?.toDate() < now) return;
      const isMe = s.userId === me.uid;
      const diff = s.expiresAt?.toDate() - now;
      const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
      const timeLeft = h > 0 ? `${h}h ${m}m` : `${m}m`;
      const div = document.createElement("div");
      div.className = "status-item";
      div.innerHTML = `
        <div class="status-thumb">
          ${s.type==="video" ? `<video src="${s.url}" muted></video>` : `<img src="${s.url}" alt="">`}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:0.88rem">${isMe ? "My Status" : esc(s.userName)}</div>
          <div style="font-size:0.75rem;color:var(--muted)">${timeLeft} left</div>
        </div>
        ${isMe ? `<button onclick="delStatus('${d.id}',event)" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1.1rem;padding:4px">🗑</button>` : ""}
      `;
      div.onclick = () => viewStatus(s);
      list.appendChild(div);
    });
  });
}

window.delStatus = async function(id, e) {
  e.stopPropagation();
  if (confirm("Delete status?")) await deleteDoc(doc(db, "status", id));
};

function viewStatus(s) {
  const ov = document.createElement("div");
  ov.style.cssText = "position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center";
  ov.innerHTML = `
    <div style="position:absolute;top:0;left:0;right:0;padding:16px;display:flex;align-items:center;gap:10px;background:linear-gradient(to bottom,rgba(0,0,0,0.7),transparent)">
      <div style="width:36px;height:36px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;font-weight:700;color:white">${(s.userName||"?")[0].toUpperCase()}</div>
      <div style="flex:1;color:white"><div style="font-weight:600;font-size:0.88rem">${esc(s.userName)}</div></div>
      <button onclick="this.closest('div[style]').parentElement.remove()" style="background:none;border:none;color:white;font-size:1.5rem;cursor:pointer">✕</button>
    </div>
    ${s.type==="video" ? `<video src="${s.url}" controls autoplay style="max-width:100%;max-height:80vh;border-radius:8px">` : `<img src="${s.url}" style="max-width:100%;max-height:80vh;object-fit:contain">`}
  `;
  document.body.appendChild(ov);
}

// CREATE GROUP
window.createGroup = async function () {
  const name = document.getElementById("groupName")?.value.trim();
  if (!name) return;
  const ref2 = await addDoc(collection(db, "groups"), {
    name, createdBy: me.uid,
    members: [me.uid], createdAt: serverTimestamp()
  });
  closeModal("groupModal");
  openGroup(ref2.id, name);
};

// FILTER + SEARCH
window.filterUsers = function (q) {
  const filtered = allUsers.filter(u => {
    const name = (u.displayName || u.email || "").toLowerCase();
    return name.includes(q.toLowerCase());
  });
  renderUserList(filtered);
};

window.modalFilter = function (q) {
  const filtered = allUsers.filter(u => {
    const name = (u.displayName || u.email || "").toLowerCase();
    return name.includes(q.toLowerCase());
  });
  renderModalList(filtered);
};

window.filterTab = function (btn, tab) {
  document.querySelectorAll(".ftab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const userList = document.getElementById("userList");
  const groupList = document.getElementById("groupList");
  const statusList = document.getElementById("statusList");
  userList.classList.add("hidden");
  groupList.classList.add("hidden");
  statusList.classList.add("hidden");
  if (tab === "all" || tab === "online") {
    userList.classList.remove("hidden");
    if (tab === "online") renderUserList(allUsers.filter(u => u.online));
    else renderUserList(allUsers);
  } else if (tab === "groups") {
    groupList.classList.remove("hidden");
  } else if (tab === "status") {
    statusList.classList.remove("hidden");
    listenStatus();
  }
};

window.navTab = function (tab, btn) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentTab = tab;
  if (tab === "chats") filterTab(document.querySelector(".ftab"), "all");
  else if (tab === "groups") filterTab(document.querySelector(".ftab"), "groups");
  else if (tab === "status") filterTab(document.querySelector(".ftab"), "status");
  else if (tab === "settings") openSettings();
};

// SIDEBAR
window.toggleSidebar = function () {
  document.getElementById("sidebar")?.classList.toggle("open");
  document.getElementById("overlay")?.classList.toggle("show");
};

window.closeSidebar = function () {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("show");
};

window.backToList = function () {
  if (unsub) unsub();
  currentChatId = null;
  document.getElementById("activeChat")?.classList.add("hidden");
  document.getElementById("noChat")?.classList.remove("hidden");
  document.getElementById("tbarTitle").textContent = "DevChat";
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("overlay")?.classList.add("show");
};

// SETTINGS
window.openSettings = function () {
  document.getElementById("settingsPanel")?.classList.remove("hidden");
  updateThemeToggle();
};

window.closeSettings = function () {
  document.getElementById("settingsPanel")?.classList.add("hidden");
};

// THEME
function applyTheme() {
  const dark = localStorage.getItem("theme") === "dark";
  if (dark) document.documentElement.setAttribute("data-dark", "");
  updateThemeToggle();
}

function updateThemeToggle() {
  const t = document.getElementById("themeToggle");
  if (!t) return;
  const dark = document.documentElement.hasAttribute("data-dark");
  t.className = "toggle-pill" + (dark ? " on" : "");
}

window.toggleTheme = function () {
  const dark = document.documentElement.hasAttribute("data-dark");
  if (dark) {
    document.documentElement.removeAttribute("data-dark");
    localStorage.setItem("theme", "light");
  } else {
    document.documentElement.setAttribute("data-dark", "");
    localStorage.setItem("theme", "dark");
  }
  updateThemeToggle();
};

// PROFILE + NAME
window.openProfile = function () { openSettings(); };

window.editName = async function () {
  const current = myData?.displayName || me.email?.split("@")[0] || "";
  const name = prompt("Enter new display name:", current);
  if (!name?.trim() || name.trim() === current) return;
  await updateDoc(doc(db, "users", me.uid), { displayName: name.trim() });
  await updateProfile(me, { displayName: name.trim() });
  myData.displayName = name.trim();
  renderMe();
  alert("Name updated! ✅");
};

window.editBio = async function () {
  const bio = prompt("Enter your bio:", myData?.bio || "");
  if (bio === null) return;
  await updateDoc(doc(db, "users", me.uid), { bio: bio.trim() });
  myData.bio = bio.trim();
};

// LOGOUT
window.doLogout = async function () {
  if (!confirm("Logout from DevChat?")) return;
  await updateOnline(false);
  await signOut(auth);
  window.location.replace("/login.html");
};

// MODALS
window.showNewChatModal = function () {
  renderModalList(allUsers);
  document.getElementById("newChatModal")?.classList.remove("hidden");
};

window.closeModal = function (id) {
  document.getElementById(id)?.classList.add("hidden");
};

window.focusSearch = function () {
  document.getElementById("searchInput")?.focus();
};

// MORE MENU
window.showMore = function () {
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;top:54px;right:8px;background:var(--surface);border-radius:12px;box-shadow:var(--shadow-lg);z-index:999;min-width:160px;overflow:hidden;border:1px solid var(--border);animation:fadeIn 0.15s ease";
  m.innerHTML = `
    <div onclick="showNewChatModal();this.parentElement.remove()" style="padding:13px 16px;font-size:0.88rem;cursor:pointer;display:flex;gap:10px;align-items:center" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">✏️ New Chat</div>
    <div onclick="document.getElementById('groupModal').classList.remove('hidden');this.parentElement.remove()" style="padding:13px 16px;font-size:0.88rem;cursor:pointer;display:flex;gap:10px;align-items:center" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">👥 New Group</div>
    <div onclick="openSettings();this.parentElement.remove()" style="padding:13px 16px;font-size:0.88rem;cursor:pointer;display:flex;gap:10px;align-items:center" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">⚙️ Settings</div>
    <div onclick="doLogout();this.parentElement.remove()" style="padding:13px 16px;font-size:0.88rem;cursor:pointer;color:var(--red);display:flex;gap:10px;align-items:center" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">🚪 Logout</div>
  `;
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener("click", () => m.remove(), {once:true}), 100);
};

window.chatMore = function () {
  const m = document.createElement("div");
  m.style.cssText = "position:fixed;top:54px;right:8px;background:var(--surface);border-radius:12px;box-shadow:var(--shadow-lg);z-index:999;min-width:160px;overflow:hidden;border:1px solid var(--border);animation:fadeIn 0.15s ease";
  m.innerHTML = `
    <div style="padding:13px 16px;font-size:0.88rem;cursor:pointer" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">🔍 Search</div>
    <div style="padding:13px 16px;font-size:0.88rem;cursor:pointer" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">🔕 Mute</div>
    <div style="padding:13px 16px;font-size:0.88rem;cursor:pointer;color:var(--red)" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">🚫 Block</div>
  `;
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener("click", () => m.remove(), {once:true}), 100);
};
