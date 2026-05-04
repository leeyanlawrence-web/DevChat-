import { auth, db, storage } from "./firebase.js";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, getDocs, doc,
  getDoc, updateDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let me = null, myData = null;
let currentChatId = null, currentChatType = "dm";
let unsub = null, allUsers = [];

// CUSTOM CONFIRM DIALOG
function customConfirm(message, onConfirm) {
  const existing = document.getElementById("customConfirmModal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "customConfirmModal";
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px;
    animation:fadeIn 0.15s ease;
  `;
  modal.innerHTML = `
    <div style="
      background:var(--surface);border-radius:16px;padding:24px;
      width:100%;max-width:320px;box-shadow:0 20px 40px rgba(0,0,0,0.3);
      animation:scaleIn 0.2s ease;
    ">
      <p style="font-size:0.95rem;font-weight:500;color:var(--text);margin-bottom:20px;text-align:center;line-height:1.5">${message}</p>
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('customConfirmModal').remove()" style="
          flex:1;padding:12px;border-radius:10px;border:1.5px solid var(--border);
          background:var(--surface2);color:var(--text);font-size:0.88rem;font-weight:600;
          cursor:pointer;font-family:inherit;transition:all 0.2s
        ">Cancel</button>
        <button id="confirmOkBtn" style="
          flex:1;padding:12px;border-radius:10px;border:none;
          background:#ef4444;color:white;font-size:0.88rem;font-weight:700;
          cursor:pointer;font-family:inherit;transition:all 0.2s
        ">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById("confirmOkBtn").onclick = () => {
    modal.remove();
    onConfirm();
  };
}

function customAlert(message, type = "info") {
  const existing = document.getElementById("customAlertModal");
  if (existing) existing.remove();
  const color = type === "success" ? "#25d366" : type === "error" ? "#ef4444" : "#0084ff";
  const modal = document.createElement("div");
  modal.id = "customAlertModal";
  modal.style.cssText = `
    position:fixed;top:20px;left:50%;transform:translateX(-50%);
    z-index:9999;animation:slideDown 0.3s ease;max-width:320px;width:90%;
  `;
  modal.innerHTML = `
    <div style="
      background:var(--surface);border-radius:12px;padding:14px 18px;
      box-shadow:0 8px 24px rgba(0,0,0,0.2);border-left:4px solid ${color};
      display:flex;align-items:center;gap:10px;
    ">
      <span style="font-size:1.1rem">${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}</span>
      <span style="font-size:0.88rem;font-weight:500;color:var(--text)">${message}</span>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.remove(), 3000);
}

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
  listenStoriesPreview();
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

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setAvatar(id, name, photo) {
  const el = document.getElementById(id);
  if (!el) return;
  if (photo) el.innerHTML = `<img src="${photo}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
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
function esc(t) { return String(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// LISTEN USERS
function listenUsers() {
  onSnapshot(collection(db, "users"), snap => {
    allUsers = [];
    snap.forEach(d => { if (d.id !== me.uid) allUsers.push({id: d.id, ...d.data()}); });
    renderUserList(allUsers);
    renderModalList(allUsers);
  });
}

function renderUserList(users) {
  const list = document.getElementById("userList");
  if (!list) return;
  list.innerHTML = "";
  if (users.length === 0) {
    list.innerHTML = `<div style="padding:30px;text-align:center;color:var(--muted);font-size:0.85rem">No users found</div>`;
    return;
  }
  users.forEach(u => {
    const name = u.displayName || u.email?.split("@")[0] || "Developer";
    const isActive = currentChatId === getChatId(me.uid, u.id);
    const div = document.createElement("div");
    div.className = "chat-row" + (isActive ? " active" : "");
    div.dataset.uid = u.id;
    div.innerHTML = `
      <div class="cr-avatar">
        ${u.photo ? `<img src="${u.photo}" alt="${esc(name)}">` : `<span>${name[0].toUpperCase()}</span>`}
        ${u.online ? '<div class="online-ring"></div>' : ''}
      </div>
      <div class="cr-body">
        <div class="cr-top">
          <div class="cr-name">${esc(name)}</div>
          <div class="cr-time">${u.lastSeen ? fmtDate(u.lastSeen.toDate()) : ""}</div>
        </div>
        <div class="cr-preview">${u.online ? '<span style="color:#25d366">● Online</span>' : '<span style="color:var(--muted)">● Offline</span>'}</div>
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
        ${u.photo ? `<img src="${u.photo}" alt="${esc(name)}">` : `<span>${name[0].toUpperCase()}</span>`}
      </div>
      <div class="cr-body">
        <div class="cr-name">${esc(name)}</div>
        <div class="cr-preview">${esc(u.email||"")}</div>
      </div>
    `;
    div.onclick = () => { closeModal("newChatModal"); openDM(u.id, name, u.photo||""); };
    list.appendChild(div);
  });
}

// GROUPS
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

// DM
function getChatId(a, b) { return [a, b].sort().join("_"); }

function openDM(userId, userName, userPhoto) {
  currentChatId = getChatId(me.uid, userId);
  currentChatType = "dm";
  showChat(userName, userPhoto, false);
  listenMessages();
  document.querySelectorAll(".chat-row[data-uid]").forEach(r => r.classList.remove("active"));
  document.querySelector(`.chat-row[data-uid="${userId}"]`)?.classList.add("active");
  closeSidebar();
}

function openGroup(groupId, groupName) {
  currentChatId = groupId;
  currentChatType = "group";
  showChat(groupName, "", true);
  listenMessages();
  closeSidebar();
}

function showChat(name, photo, isGroup) {
  document.getElementById("noChat")?.classList.add("hidden");
  document.getElementById("activeChat")?.classList.remove("hidden");
  document.getElementById("chName").textContent = name;
  document.getElementById("chStatus").textContent = isGroup ? "Group chat" : "● online";
  document.getElementById("tbarTitle").textContent = name;
  const av = document.getElementById("chAvatar");
  if (av) {
    if (photo) av.innerHTML = `<img src="${photo}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    else { av.textContent = (name||"?")[0].toUpperCase(); }
    av.style.background = isGroup ? "linear-gradient(135deg,#7c3aed,#a78bfa)" : "";
  }
  setTimeout(() => document.getElementById("msgInput")?.focus(), 300);
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
          content = `<img src="${msg.fileUrl}" style="max-width:220px;border-radius:8px;display:block;cursor:pointer;margin-top:4px" onclick="window.open('${msg.fileUrl}','_blank')">`;
        } else if (msg.fileType?.startsWith("video/")) {
          content = `<video src="${msg.fileUrl}" controls style="max-width:220px;border-radius:8px;display:block;margin-top:4px"></video>`;
        } else {
          content = `<a href="${msg.fileUrl}" target="_blank" style="color:inherit;display:flex;align-items:center;gap:6px;text-decoration:none">📎 ${esc(msg.text||"File")}</a>`;
        }
      }
      wrap.innerHTML = `
        ${!isMe && currentChatType==="group" ? `<div class="sender-name">${esc(msg.senderName||"")}</div>` : ""}
        <div class="bubble">${content}</div>
        <div class="msg-meta">
          ${date ? fmtTime(date) : ""}
          ${isMe ? ' <svg width="14" height="10" viewBox="0 0 18 11" fill="none"><path d="M1 5.5L5.5 10L12 1" stroke="#25d366" stroke-width="1.5" stroke-linecap="round"/><path d="M6 5.5L10.5 10L17 1" stroke="#25d366" stroke-width="1.5" stroke-linecap="round"/></svg>' : ""}
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
      text, senderId: me.uid,
      senderName: myData.displayName || me.email?.split("@")[0] || "Dev",
      createdAt: serverTimestamp()
    });
  } catch(e) { customAlert("Failed to send: " + e.message, "error"); }
};

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("msgInput");
  if (input) {
    input.addEventListener("keypress", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
  }
});

// ATTACH FILE
window.attachFile = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*,.pdf,.txt,.js,.py,.zip,.doc,.docx";
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file || !currentChatId) return;
    customAlert("Uploading...", "info");
    const r = ref(storage, `uploads/${me.uid}/${Date.now()}_${file.name}`);
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
    customAlert("File sent!", "success");
  };
  input.click();
};

// VOICE NOTE (placeholder)
window.startVoice = function () {
  customAlert("Voice messages coming soon!", "info");
};

// CALL (placeholder)
window.startCall = function (type) {
  customAlert(`${type === "video" ? "Video" : "Voice"} calls coming soon!`, "info");
};

// EMOJI PICKER
window.pickEmoji = function () {
  const existing = document.getElementById("emojiPicker");
  if (existing) { existing.remove(); return; }
  const emojis = ["😊","😂","❤️","👍","🔥","✅","💯","🚀","😎","🙌","💻","⚡","🎉","👋","🤔","😅","🥳","😍","🤩","💪","👏","🙏","😢","😭","😡","🤣","😏","🤭","😴","🥱","🤯","🫡","👀","💀","🫶","🥰","😇","🤓","😬","🫠"];
  const picker = document.createElement("div");
  picker.id = "emojiPicker";
  picker.style.cssText = `
    position:fixed;bottom:80px;right:16px;left:16px;max-width:400px;margin:0 auto;
    background:var(--surface);border-radius:16px;padding:16px;
    box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:500;
    display:grid;grid-template-columns:repeat(8,1fr);gap:4px;
    border:1px solid var(--border);animation:slideUp2 0.2s ease;
  `;
  emojis.forEach(e => {
    const btn = document.createElement("button");
    btn.textContent = e;
    btn.style.cssText = "background:none;border:none;font-size:1.4rem;cursor:pointer;padding:4px;border-radius:8px;transition:background 0.15s";
    btn.onmouseover = () => btn.style.background = "var(--surface2)";
    btn.onmouseout = () => btn.style.background = "none";
    btn.onclick = () => {
      const input = document.getElementById("msgInput");
      if (input) { input.value += e; input.focus(); }
      picker.remove();
    };
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);
  setTimeout(() => document.addEventListener("click", function h(ev) {
    if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener("click", h); }
  }), 100);
};

// STORIES
window.addStory = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    customAlert("Uploading story...", "info");
    try {
      const r = ref(storage, `stories/${me.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await addDoc(collection(db, "status"), {
        type: file.type.startsWith("video/") ? "video" : "photo",
        url, userId: me.uid,
        userName: myData.displayName || me.email?.split("@")[0] || "Dev",
        userPhoto: myData.photo || me.photoURL || "",
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 86400000)
      });
      customAlert("Story posted! 🎉", "success");
    } catch(e) { customAlert("Upload failed: " + e.message, "error"); }
  };
  input.click();
};

// LISTEN STORIES PREVIEW (show circles at top)
function listenStoriesPreview() {
  const q = query(collection(db, "status"), orderBy("createdAt","desc"));
  onSnapshot(q, snap => {
    const wrap = document.getElementById("storiesWrap");
    if (!wrap) return;
    const now = new Date();
    const items = [];
    snap.forEach(d => {
      const s = d.data();
      if (s.expiresAt?.toDate() < now) return;
      items.push({id: d.id, ...s});
    });
    wrap.innerHTML = "";
    // Add story button
    const addBtn = document.createElement("div");
    addBtn.className = "story-add";
    addBtn.innerHTML = `
      <div class="story-circle add-circle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke="white" stroke-width="1.5"/>
          <path d="M12 7v10M7 12h10" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <span>Add Story</span>
    `;
    addBtn.onclick = () => addStory();
    wrap.appendChild(addBtn);
    // Existing stories
    const seen = new Set();
    items.forEach(s => {
      if (seen.has(s.userId)) return;
      seen.add(s.userId);
      const isMe = s.userId === me.uid;
      const div = document.createElement("div");
      div.className = "story-item";
      div.innerHTML = `
        <div class="story-circle ${isMe ? "my-story" : ""}">
          ${s.userPhoto
            ? `<img src="${s.userPhoto}" alt="${esc(s.userName)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : `<span style="font-size:1.1rem;font-weight:700;color:white">${(s.userName||"?")[0].toUpperCase()}</span>`}
        </div>
        <span>${isMe ? "You" : esc(s.userName.split(" ")[0])}</span>
      `;
      div.onclick = () => viewStories(s.userId, items);
      wrap.appendChild(div);
    });
  });
}

function viewStories(userId, allItems) {
  const userStories = allItems.filter(s => s.userId === userId);
  if (!userStories.length) return;
  let current = 0;
  const ov = document.createElement("div");
  ov.id = "storyViewer";
  ov.style.cssText = "position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;";

  function render() {
    const s = userStories[current];
    const diff = s.expiresAt?.toDate() - new Date();
    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
    const timeLeft = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
    const isMe = s.userId === me.uid;
    ov.innerHTML = `
      <div style="position:absolute;top:0;left:0;right:0;z-index:2;padding:12px 16px">
        <div style="display:flex;gap:4px;margin-bottom:10px">
          ${userStories.map((_,i) => `<div style="flex:1;height:3px;border-radius:2px;background:${i<=current ? 'white' : 'rgba(255,255,255,0.4)'}"></div>`).join("")}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;overflow:hidden;flex-shrink:0">
            ${s.userPhoto ? `<img src="${s.userPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : (s.userName||"?")[0].toUpperCase()}
          </div>
          <div style="flex:1">
            <div style="color:white;font-weight:600;font-size:0.88rem">${esc(s.userName)}</div>
            <div style="color:rgba(255,255,255,0.6);font-size:0.72rem">${timeLeft}</div>
          </div>
          ${isMe ? `<button onclick="deleteStory('${s.id}')" style="background:none;border:none;color:white;cursor:pointer;font-size:1.1rem;padding:4px">🗑</button>` : ""}
          <button onclick="document.getElementById('storyViewer').remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:1.4rem;padding:4px;width:32px;height:32px;display:flex;align-items:center;justify-content:center">✕</button>
        </div>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;position:relative">
        ${s.type==="video"
          ? `<video src="${s.url}" controls autoplay style="max-width:100%;max-height:100%;"></video>`
          : `<img src="${s.url}" style="max-width:100%;max-height:100%;object-fit:contain">`
        }
        ${current > 0 ? `<button onclick="prevStory()" style="position:absolute;left:0;top:0;bottom:0;width:40%;background:none;border:none;cursor:pointer"></button>` : ""}
        ${current < userStories.length-1 ? `<button onclick="nextStory()" style="position:absolute;right:0;top:0;bottom:0;width:40%;background:none;border:none;cursor:pointer"></button>` : ""}
      </div>
    `;
  }

  window.prevStory = () => { if (current > 0) { current--; render(); } };
  window.nextStory = () => {
    if (current < userStories.length - 1) { current++; render(); }
    else ov.remove();
  };
  window.deleteStory = async (id) => {
    await deleteDoc(doc(db, "status", id));
    ov.remove();
    customAlert("Story deleted", "success");
  };

  document.body.appendChild(ov);
  render();
}

// STORIES LIST (for sidebar)
function listenStoriesList() {
  const q = query(collection(db, "status"), orderBy("createdAt","desc"));
  onSnapshot(q, snap => {
    const list = document.getElementById("statusItems");
    if (!list) return;
    const now = new Date();
    const allItems = [];
    snap.forEach(d => { const s = d.data(); if (s.expiresAt?.toDate() > now) allItems.push({id:d.id,...s}); });
    list.innerHTML = "";
    const seen = new Set();
    allItems.forEach(s => {
      if (seen.has(s.userId)) return;
      seen.add(s.userId);
      const isMe = s.userId === me.uid;
      const diff = s.expiresAt?.toDate() - now;
      const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
      const div = document.createElement("div");
      div.className = "status-item";
      div.innerHTML = `
        <div class="status-thumb" style="border:2px solid ${isMe ? '#25d366' : '#0084ff'}">
          ${s.type==="video"
            ? `<video src="${s.url}" style="width:100%;height:100%;object-fit:cover"></video>`
            : `<img src="${s.url}" alt="" style="width:100%;height:100%;object-fit:cover">`}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:0.88rem;color:var(--text)">${isMe ? "My Story" : esc(s.userName)}</div>
          <div style="font-size:0.72rem;color:var(--muted)">${s.type==="video" ? "🎥 Video" : "📷 Photo"} · ${h>0 ? h+"h "+m+"m" : m+"m"} left</div>
        </div>
        ${isMe ? `<button onclick="event.stopPropagation();deleteStoryItem('${s.id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1rem;padding:4px;flex-shrink:0">🗑</button>` : ""}
      `;
      div.onclick = () => viewStories(s.userId, allItems);
      list.appendChild(div);
    });
    if (allItems.length === 0) {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:0.83rem">No stories yet.<br>Be the first to post!</div>`;
    }
  });
}

window.deleteStoryItem = async function(id) {
  await deleteDoc(doc(db, "status", id));
  customAlert("Story deleted", "success");
};

// CREATE GROUP
window.createGroup = async function () {
  const name = document.getElementById("groupName")?.value.trim();
  if (!name) { customAlert("Please enter a group name", "error"); return; }
  const ref2 = await addDoc(collection(db, "groups"), {
    name, createdBy: me.uid, members: [me.uid], createdAt: serverTimestamp()
  });
  closeModal("groupModal");
  document.getElementById("groupName").value = "";
  openGroup(ref2.id, name);
  customAlert("Group created! 🎉", "success");
};

// FILTER
window.filterUsers = function (q) {
  const filtered = allUsers.filter(u => {
    const name = (u.displayName || u.email || "").toLowerCase();
    return name.includes(q.toLowerCase());
  });
  renderUserList(filtered);
};

window.modalFilter = function (q) {
  renderModalList(allUsers.filter(u => (u.displayName||u.email||"").toLowerCase().includes(q.toLowerCase())));
};

window.filterTab = function (btn, tab) {
  document.querySelectorAll(".ftab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("userList")?.classList.add("hidden");
  document.getElementById("groupList")?.classList.add("hidden");
  document.getElementById("statusList")?.classList.add("hidden");
  if (tab === "all" || tab === "online") {
    document.getElementById("userList")?.classList.remove("hidden");
    renderUserList(tab === "online" ? allUsers.filter(u => u.online) : allUsers);
  } else if (tab === "groups") {
    document.getElementById("groupList")?.classList.remove("hidden");
  } else if (tab === "stories") {
    document.getElementById("statusList")?.classList.remove("hidden");
    listenStoriesList();
  }
};

window.navTab = function (tab, btn) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  if (tab === "chats") filterTab(document.querySelector(".ftab"), "all");
  else if (tab === "groups") filterTab(document.querySelectorAll(".ftab")[2], "groups");
  else if (tab === "stories") filterTab(document.querySelectorAll(".ftab")[3], "stories");
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
  renderMe();
  document.getElementById("settingsPanel")?.classList.remove("hidden");
  updateThemeToggle();
};
window.closeSettings = function () { document.getElementById("settingsPanel")?.classList.add("hidden"); };

// THEME
function applyTheme() {
  if (localStorage.getItem("theme") === "dark") document.documentElement.setAttribute("data-dark","");
  updateThemeToggle();
}
function updateThemeToggle() {
  const t = document.getElementById("themeToggle");
  if (t) t.className = "toggle-pill" + (document.documentElement.hasAttribute("data-dark") ? " on" : "");
}
window.toggleTheme = function () {
  const dark = document.documentElement.hasAttribute("data-dark");
  dark ? document.documentElement.removeAttribute("data-dark") : document.documentElement.setAttribute("data-dark","");
  localStorage.setItem("theme", dark ? "light" : "dark");
  updateThemeToggle();
};

// PROFILE
window.openProfile = function () { openSettings(); };
window.editName = async function () {
  const current = myData?.displayName || me.email?.split("@")[0] || "";
  showInputModal("Edit Display Name", "Your name", current, async (name) => {
    if (!name.trim()) return;
    await updateDoc(doc(db, "users", me.uid), { displayName: name.trim() });
    await updateProfile(me, { displayName: name.trim() });
    myData.displayName = name.trim();
    renderMe();
    customAlert("Name updated! ✅", "success");
  });
};
window.editBio = async function () {
  showInputModal("Edit Bio", "About me...", myData?.bio || "", async (bio) => {
    await updateDoc(doc(db, "users", me.uid), { bio: bio.trim() });
    myData.bio = bio.trim();
    customAlert("Bio updated!", "success");
  });
};

function showInputModal(title, placeholder, defaultVal, onSave) {
  const existing = document.getElementById("inputModal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "inputModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.15s ease";
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:24px;width:100%;max-width:340px;box-shadow:0 20px 40px rgba(0,0,0,0.3)">
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:16px;color:var(--text)">${title}</h3>
      <input id="inputModalField" type="text" value="${esc(defaultVal)}" placeholder="${placeholder}" style="
        width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:10px;
        font-size:0.92rem;outline:none;background:var(--surface2);color:var(--text);font-family:inherit;
        margin-bottom:16px;transition:border 0.2s
      ">
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('inputModal').remove()" style="flex:1;padding:11px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>
        <button id="inputModalSave" style="flex:1;padding:11px;border-radius:10px;border:none;background:#25d366;color:white;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const field = document.getElementById("inputModalField");
  field.focus();
  field.select();
  field.addEventListener("focus", () => field.style.borderColor = "#25d366");
  field.addEventListener("blur", () => field.style.borderColor = "var(--border)");
  field.addEventListener("keypress", e => { if (e.key === "Enter") { modal.remove(); onSave(field.value); } });
  document.getElementById("inputModalSave").onclick = () => { modal.remove(); onSave(field.value); };
}

// LOGOUT
window.doLogout = function () {
  customConfirm("Are you sure you want to logout from DevChat?", async () => {
    await updateOnline(false);
    await signOut(auth);
    window.location.replace("/login.html");
  });
};

// MODALS
window.showNewChatModal = function () {
  renderModalList(allUsers);
  document.getElementById("newChatModal")?.classList.remove("hidden");
};
window.closeModal = function (id) { document.getElementById(id)?.classList.add("hidden"); };
window.focusSearch = function () { document.getElementById("searchInput")?.focus(); };

// MORE MENU
window.showMore = function () {
  const existing = document.getElementById("moreMenu");
  if (existing) { existing.remove(); return; }
  const m = document.createElement("div");
  m.id = "moreMenu";
  m.style.cssText = "position:fixed;top:54px;right:8px;background:var(--surface);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:999;min-width:180px;overflow:hidden;border:1px solid var(--border);animation:scaleIn 0.15s ease;transform-origin:top right";
  const items = [
   {icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`, label:"New Chat", fn:"showNewChatModal()"},
    {icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`, label:"New Group", fn:"document.getElementById('groupModal').classList.remove('hidden')"},
    {icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`, label:"Settings", fn:"openSettings()"},
    {icon:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>`, label:"Logout", fn:"doLogout()", red:true},
  ];
  items.forEach(item => {
    const btn = document.createElement("button");
    btn.style.cssText = `width:100%;padding:13px 16px;border:none;background:none;text-align:left;cursor:pointer;font-size:0.88rem;font-weight:500;display:flex;align-items:center;gap:10px;color:${item.red ? "#ef4444" : "var(--text)"};font-family:inherit;transition:background 0.15s`;
    btn.innerHTML = `${item.icon}<span>${item.label}</span>`;
    btn.onmouseover = () => btn.style.background = "var(--surface2)";
    btn.onmouseout = () => btn.style.background = "none";
    btn.onclick = () => { m.remove(); eval(item.fn); };
    m.appendChild(btn);
  });
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener("click", function h(ev) {
    if (!m.contains(ev.target) && ev.target.id !== "moreBtn") { m.remove(); document.removeEventListener("click", h); }
  }), 100);
};

// CHAT MORE
window.chatMore = function () {
  const existing = document.getElementById("chatMoreMenu");
  if (existing) { existing.remove(); return; }
  const m = document.createElement("div");
  m.id = "chatMoreMenu";
  m.style.cssText = "position:fixed;top:54px;right:8px;background:var(--surface);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:999;min-width:180px;overflow:hidden;border:1px solid var(--border);animation:scaleIn 0.15s ease;transform-origin:top right";
  const items = [
    {icon:"🔍", label:"Search Messages"},
    {icon:"🔔", label:"Mute Notifications"},
    {icon:"📌", label:"Pin Chat"},
    {icon:"🚫", label:"Block User", red:true},
    {icon:"🗑", label:"Clear Chat", red:true},
  ];
  items.forEach(item => {
    const btn = document.createElement("button");
    btn.style.cssText = `width:100%;padding:13px 16px;border:none;background:none;text-align:left;cursor:pointer;font-size:0.88rem;font-weight:500;display:flex;align-items:center;gap:10px;color:${item.red?"#ef4444":"var(--text)"};font-family:inherit;transition:background 0.15s`;
    btn.innerHTML = `<span>${item.icon}</span><span>${item.label}</span>`;
    btn.onmouseover = () => btn.style.background = "var(--surface2)";
    btn.onmouseout = () => btn.style.background = "none";
    btn.onclick = () => { m.remove(); customAlert(`${item.label} coming soon!`, "info"); };
    m.appendChild(btn);
  });
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener("click", function h(ev) {
    if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("click", h); }
  }), 100);
};
