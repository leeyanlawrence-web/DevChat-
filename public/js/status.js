import { db, auth, storage } from "./firebase.js";
import {
  collection, addDoc, onSnapshot, deleteDoc,
  orderBy, query, serverTimestamp, where, getDocs, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Delete expired status posts older than 24 hours
async function cleanExpiredStatus() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const q = query(
    collection(db, "status"),
    where("createdAt", "<", cutoff)
  );
  const snap = await getDocs(q);
  snap.forEach(d => deleteDoc(doc(db, "status", d.id)));
}

// Create status - text, photo or video
window.createStatus = async function () {
  const choice = await showStatusPicker();
  if (!choice) return;

  if (choice === "text") {
    const text = prompt("What's on your mind?");
    if (!text) return;
    await addDoc(collection(db, "status"), {
      type: "text",
      text,
      userId: auth.currentUser.uid,
      userName: auth.currentUser.email?.split("@")[0] || "Dev",
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  } else {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = choice === "photo" ? "image/*" : "video/*";
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;

      const msg = document.getElementById("statusUploadMsg");
      if (msg) { msg.textContent = "Uploading..."; msg.style.display = "block"; }

      const path = `status/${auth.currentUser.uid}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      await addDoc(collection(db, "status"), {
        type: choice,
        url,
        text: choice === "photo" ? "📷 Photo" : "🎥 Video",
        userId: auth.currentUser.uid,
        userName: auth.currentUser.email?.split("@")[0] || "Dev",
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      if (msg) { msg.textContent = "Posted!"; setTimeout(() => msg.style.display = "none", 2000); }
    };
    input.click();
  }
};

// Show picker UI
function showStatusPicker() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.7);
      z-index:999;display:flex;align-items:center;justify-content:center;
      animation:fadeIn 0.2s ease;
    `;
    overlay.innerHTML = `
      <div style="background:#161b22;border:1px solid #30363d;border-radius:16px;padding:24px;width:90%;max-width:320px;text-align:center;">
        <h3 style="color:#58a6ff;margin-bottom:20px;font-family:'Fira Code',monospace;">Post Status</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="pickText" style="padding:14px;background:#21262d;border:1px solid #30363d;border-radius:10px;color:#fff;font-size:1rem;cursor:pointer;">✏️ Text</button>
          <button id="pickPhoto" style="padding:14px;background:#21262d;border:1px solid #30363d;border-radius:10px;color:#fff;font-size:1rem;cursor:pointer;">📷 Photo</button>
          <button id="pickVideo" style="padding:14px;background:#21262d;border:1px solid #30363d;border-radius:10px;color:#fff;font-size:1rem;cursor:pointer;">🎥 Video</button>
          <button id="pickCancel" style="padding:12px;background:none;border:none;color:#8b949e;font-size:0.9rem;cursor:pointer;">Cancel</button>
        </div>
        <p id="statusUploadMsg" style="color:#3fb950;margin-top:12px;display:none;"></p>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#pickText").onclick = () => { document.body.removeChild(overlay); resolve("text"); };
    overlay.querySelector("#pickPhoto").onclick = () => { document.body.removeChild(overlay); resolve("photo"); };
    overlay.querySelector("#pickVideo").onclick = () => { document.body.removeChild(overlay); resolve("video"); };
    overlay.querySelector("#pickCancel").onclick = () => { document.body.removeChild(overlay); resolve(null); };
  });
}

// Load and display status posts
export function loadStatus() {
  cleanExpiredStatus();
  const now = new Date();
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
      // Skip expired
      if (s.expiresAt && s.expiresAt.toDate() < now) return;

      const div = document.createElement("div");
      div.className = "list-item";
      div.style.cursor = "pointer";

      let preview = "";
      if (s.type === "photo") {
        preview = `<img src="${s.url}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0;">`;
      } else if (s.type === "video") {
        preview = `<div style="width:44px;height:44px;background:#21262d;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">🎥</div>`;
      } else {
        preview = `<div class="item-avatar">${(s.userName || "D")[0].toUpperCase()}</div>`;
      }

      const timeLeft = getTimeLeft(s.expiresAt?.toDate());

      div.innerHTML = `
        ${preview}
        <div class="item-body">
          <div class="item-name">${s.userName}</div>
          <div class="item-preview">${s.text}</div>
          <div class="status-item-time">⏱ ${timeLeft}</div>
        </div>
      `;

      // Open full view on tap
      div.onclick = () => openStatusView(s);
      list.appendChild(div);
    });
  });
}

// Full screen status viewer
function openStatusView(s) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;inset:0;background:#000;
    z-index:999;display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    animation:fadeIn 0.2s ease;
  `;

  let content = "";
  if (s.type === "photo") {
    content = `<img src="${s.url}" style="max-width:100%;max-height:80vh;border-radius:8px;">`;
  } else if (s.type === "video") {
    content = `<video src="${s.url}" controls style="max-width:100%;max-height:80vh;border-radius:8px;"></video>`;
  } else {
    content = `<p style="color:#fff;font-size:1.5rem;padding:20px;text-align:center;">${s.text}</p>`;
  }

  overlay.innerHTML = `
    <div style="color:#8b949e;margin-bottom:16px;font-size:0.9rem;">
      ${s.userName} • ${getTimeLeft(s.expiresAt?.toDate())} left
    </div>
    ${content}
    <button onclick="this.parentElement.remove()" style="
      margin-top:20px;padding:10px 24px;
      background:#21262d;border:1px solid #30363d;
      border-radius:10px;color:#fff;cursor:pointer;font-size:1rem;
    ">Close</button>
  `;
  document.body.appendChild(overlay);
}

// Time remaining helper
function getTimeLeft(expiresAt) {
  if (!expiresAt) return "24h left";
  const diff = expiresAt - new Date();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

auth.onAuthStateChanged(user => {
  if (user) loadStatus();
});
