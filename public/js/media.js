import { storage, db, auth } from "./firebase.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import {
  collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.attachFile = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,.pdf,.js,.py,.txt,.zip";
  input.onchange = e => uploadFile(e.target.files[0]);
  input.click();
};

async function uploadFile(file) {
  if (!file) return;
  const path = `uploads/${auth.currentUser.uid}/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);
  sendFileMessage(url, file.name, file.type);
}

async function sendFileMessage(url, name, type) {
  const chatId = window.currentChat;
  if (!chatId) return;
  const isImage = type.startsWith("image/");
  await addDoc(collection(db, "chats", chatId, "messages"), {
    text: isImage ? `📷 ${name}` : `📎 ${name}`,
    fileUrl: url,
    fileType: type,
    senderId: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });
}
