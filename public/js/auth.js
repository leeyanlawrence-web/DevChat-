import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function saveUser(user, displayName) {
  const name = displayName || user.displayName || user.email?.split("@")[0] || "Developer";
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email || "",
    displayName: name,
    photo: user.photoURL || "",
    lastSeen: new Date(),
    online: true,
    joinedAt: new Date()
  }, { merge: true });
}

// Auth state listener
auth.onAuthStateChanged(user => {
  document.body.style.visibility = "visible";
  const onLogin = window.location.pathname.includes("login");
  if (user && onLogin) {
    window.location.replace("/");
  } else if (!user && !onLogin) {
    window.location.replace("/login.html");
  }
});

// Email login
window.loginWithEmail = async function () {
  const email = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;
  const msg = document.getElementById("message");
  if (!msg) return;
  msg.className = "";

  if (!email || !password) {
    msg.textContent = "Please fill in all fields";
    return;
  }

  try {
    msg.textContent = "Signing in...";
    const btn = document.querySelector(".btn-primary");
    if (btn) btn.disabled = true;

    const result = await signInWithEmailAndPassword(auth, email, password);
    await saveUser(result.user);
    window.location.replace("/");
  } catch (err) {
    const btn = document.querySelector(".btn-primary");
    if (btn) btn.disabled = false;
    switch(err.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
        msg.textContent = "Wrong email or password";
        break;
      case "auth/user-not-found":
        msg.textContent = "No account found with this email";
        break;
      case "auth/too-many-requests":
        msg.textContent = "Too many attempts. Try again later";
        break;
      default:
        msg.textContent = err.message;
    }
  }
};

// Email signup
window.signupWithEmail = async function () {
  const name = document.getElementById("signupName")?.value.trim();
  const email = document.getElementById("signupEmail")?.value.trim();
  const password = document.getElementById("signupPassword")?.value;
  const confirm = document.getElementById("confirmPassword")?.value;
  const msg = document.getElementById("message");
  if (!msg) return;
  msg.className = "";

  if (!name || !email || !password) {
    msg.textContent = "Please fill in all fields";
    return;
  }
  if (password !== confirm) {
    msg.textContent = "Passwords don't match";
    return;
  }
  if (password.length < 6) {
    msg.textContent = "Password must be at least 6 characters";
    return;
  }

  try {
    msg.textContent = "Creating account...";
    const btn = document.querySelector(".btn-primary");
    if (btn) btn.disabled = true;

    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    await saveUser(result.user, name);

    msg.className = "success";
    msg.textContent = "Account created! Welcome to DevChat 🎉";
    setTimeout(() => window.location.replace("/"), 1000);
  } catch (err) {
    const btn = document.querySelector(".btn-primary");
    if (btn) btn.disabled = false;
    switch(err.code) {
      case "auth/email-already-in-use":
        msg.textContent = "Email already in use. Try signing in.";
        break;
      case "auth/invalid-email":
        msg.textContent = "Invalid email address";
        break;
      case "auth/weak-password":
        msg.textContent = "Password is too weak";
        break;
      default:
        msg.textContent = err.message;
    }
  }
};

// Google
window.signInWithGoogle = async function () {
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await saveUser(result.user);
    window.location.replace("/");
  } catch (err) {
    const msg = document.getElementById("message");
    if (msg) msg.textContent = err.code === "auth/popup-closed-by-user" ? "Login cancelled" : err.message;
  }
};

// GitHub
window.signInWithGithub = async function () {
  try {
    const result = await signInWithPopup(auth, new GithubAuthProvider());
    await saveUser(result.user);
    window.location.replace("/");
  } catch (err) {
    const msg = document.getElementById("message");
    if (msg) msg.textContent = err.code === "auth/popup-closed-by-user" ? "Login cancelled" : err.message;
  }
};

// Logout
window.logoutUser = async function () {
  if (!confirm("Are you sure you want to logout?")) return;
  try {
    const me = auth.currentUser;
    if (me) {
      await updateDoc(doc(db, "users", me.uid), { online: false });
    }
    await signOut(auth);
    window.location.replace("/login.html");
  } catch (err) {
    console.error(err);
  }
};

window.toggleMode = function () {
  document.getElementById("loginMode")?.classList.toggle("hidden");
  document.getElementById("signupMode")?.classList.toggle("hidden");
  const msg = document.getElementById("message");
  if (msg) msg.textContent = "";
};
