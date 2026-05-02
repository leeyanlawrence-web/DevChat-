import { auth, db } from "./firebase.js";
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const actionCodeSettings = {
  url: window.location.origin + "/login.html",
  handleCodeInApp: true
};

let resendTimer = null;
let lastEmail = "";

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

// Handle email link
async function handleEmailLink() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return;
  let email = localStorage.getItem("emailForSignIn");
  if (!email) email = prompt("Enter your email to confirm login:");
  if (!email) return;
  try {
    const result = await signInWithEmailLink(auth, email, window.location.href);
    localStorage.removeItem("emailForSignIn");
    await saveUser(result.user);
    window.location.replace("/");
  } catch (err) {
    console.error(err);
    const msg = document.getElementById("message");
    if (msg) msg.textContent = "Login failed: " + err.message;
  }
}

handleEmailLink();

// Auth state
auth.onAuthStateChanged(user => {
  document.body.style.visibility = "visible";
  const onLogin = window.location.pathname.includes("login");
  if (user && onLogin && !isSignInWithEmailLink(auth, window.location.href)) {
    window.location.replace("/");
  } else if (!user && !onLogin) {
    window.location.replace("/login.html");
  }
});

// Google Sign In
window.signInWithGoogle = async function () {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await saveUser(result.user);
    window.location.replace("/");
  } catch (err) {
    const msg = document.getElementById("message");
    if (msg) msg.textContent = "Error: " + err.message;
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
    const msg = document.getElementById("message");
    if (msg) msg.textContent = "Error: " + err.message;
  }
};

// Email link
window.sendOTP = async function () {
  const email = document.getElementById("emailInput").value.trim();
  const msg = document.getElementById("message");
  if (!email) { msg.textContent = "Please enter your email"; return; }
  try {
    msg.textContent = "Sending...";
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    localStorage.setItem("emailForSignIn", email);
    lastEmail = email;
    msg.textContent = "Login link sent! Check your email.";
    document.getElementById("step1").classList.add("hidden");
    document.getElementById("step2").classList.remove("hidden");
    startResendTimer();
  } catch (err) {
    msg.textContent = "Error: " + err.message;
  }
};

function startResendTimer() {
  const btn = document.getElementById("resendBtn");
  const countdown = document.getElementById("resendCountdown");
  if (!btn || !countdown) return;
  btn.style.display = "none";
  countdown.style.display = "block";
  let seconds = 60;
  resendTimer = setInterval(() => {
    seconds--;
    countdown.textContent = `Resend link in ${seconds}s`;
    if (seconds <= 0) {
      clearInterval(resendTimer);
      countdown.style.display = "none";
      btn.style.display = "block";
    }
  }, 1000);
}

window.resendOTP = async function () {
  const msg = document.getElementById("message");
  const btn = document.getElementById("resendBtn");
  try {
    btn.textContent = "Sending...";
    await sendSignInLinkToEmail(auth, lastEmail, actionCodeSettings);
    msg.textContent = "New link sent! Check your email.";
    btn.textContent = "Resend link";
    startResendTimer();
  } catch (err) {
    msg.textContent = "Error: " + err.message;
  }
};

window.goBack = function () {
  document.getElementById("step1").classList.remove("hidden");
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("message").textContent = "";
  if (resendTimer) clearInterval(resendTimer);
};
