import { auth, db } from "./firebase.js";
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const actionCodeSettings = {
  url: window.location.origin,
  handleCodeInApp: true
};

if (isSignInWithEmailLink(auth, window.location.href)) {
  let email = localStorage.getItem("emailForSignIn");
  if (!email) email = prompt("Enter your email to confirm:");
  signInWithEmailLink(auth, email, window.location.href)
    .then(async result => {
      localStorage.removeItem("emailForSignIn");
      await setDoc(doc(db, "users", result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.email.split("@")[0],
        lastSeen: new Date()
      }, { merge: true });
      window.location.href = "/";
    }).catch(err => console.error(err));
}

auth.onAuthStateChanged(user => {
  const onLogin = window.location.pathname.includes("login");
  if (user && onLogin) {
    window.location.href = "/";
  } else if (!user && !onLogin) {
    window.location.href = "/login.html";
  }
});

window.sendOTP = async function () {
  const email = document.getElementById("emailInput").value.trim();
  const msg = document.getElementById("message");
  if (!email) { msg.textContent = "Please enter your email"; return; }
  try {
    msg.textContent = "Sending...";
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    localStorage.setItem("emailForSignIn", email);
    msg.textContent = "Login link sent! Check your email.";
    document.getElementById("step1").classList.add("hidden");
    document.getElementById("step2").classList.remove("hidden");
  } catch (err) {
    msg.textContent = "Error: " + err.message;
  }
};

window.goBack = function () {
  document.getElementById("step1").classList.remove("hidden");
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("message").textContent = "";
};
