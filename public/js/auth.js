import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Save user to Firestore
async function saveUser(user) {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split("@")[0] || "Developer",
    photo: user.photoURL || "",
    lastSeen: new Date()
  }, { merge: true });
}

// Auth state
auth.onAuthStateChanged(user => {
  document.body.style.visibility = "visible";
  const onLogin = window.location.pathname.includes("login");
  if (user && onLogin) {
    window.location.replace("/");
  } else if (!user && !onLogin) {
    window.location.replace("/login.html");
  }
});

// Toggle between login and signup
window.toggleMode = function () {
  const isLogin = document.getElementById("loginMode").classList.contains("hidden");
  document.getElementById("loginMode").classList.toggle("hidden");
  document.getElementById("signupMode").classList.toggle("hidden");
  document.getElementById("message").textContent = "";
};

// Email login
window.loginWithEmail = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const msg = document.getElementById("message");
  if (!email || !password) { msg.textContent = "Please fill in all fields"; return; }
  try {
    msg.textContent = "Signing in...";
    const result = await signInWithEmailAndPassword(auth, email, password);
    await saveUser(result.user);
    window.location.replace("/");
  } catch (err) {
    msg.textContent = "Error: " + err.message;
  }
};

// Email signup
window.signupWithEmail = async function () {
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const confirm = document.getElementById("confirmPassword").value;
  const name = document.getElementById("signupName").value.trim();
  const msg = document.getElementById("message");

  if (!email || !password || !name) { msg.textContent = "Please fill in all fields"; return; }
  if (password !== confirm) { msg.textContent = "Passwords don't match"; return; }
  if (password.length < 6) { msg.textContent = "Password must be at least 6 characters"; return; }

  try {
    msg.textContent = "Creating account...";
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      email: result.user.email,
      displayName: name,
      photo: "",
      lastSeen: new Date()
    }, { merge: true });
    window.location.replace("/");
  } catch (err) {
    msg.textContent = "Error: " + err.message;
  }
};

// Google Sign In
window.signInWithGoogle = async function () {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await saveUser(result.user);
    window.location.replace("/");
  } catch (err) {
    document.getElementById("message").textContent = "Error: " + err.message;
  }
};

// GitHub Sign In
window.signInWithGithub = async function () {
  try {
    const provider = new GithubAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await saveUser(result.user);
    window.location.replace("/");
  } catch (err) {
    document.getElementById("message").textContent = "Error: " + err.message;
  }
};
