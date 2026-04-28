import { auth } from "./firebase.js";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let confirmationResult;

// Setup invisible recaptcha
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
  size: 'invisible'
});

// Send OTP to phone number
window.sendOTP = async function () {
  const phone = document.getElementById('phoneInput').value;
  const msg = document.getElementById('message');

  try {
    msg.textContent = 'Sending OTP...';
    confirmationResult = await signInWithPhoneNumber(
      auth, phone, window.recaptchaVerifier
    );
    msg.textContent = 'OTP sent! Check your phone.';

    // Show OTP input
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');

  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
  }
};

// Verify OTP code
window.verifyOTP = async function () {
  const otp = document.getElementById('otpInput').value;
  const msg = document.getElementById('message');

  try {
    msg.textContent = 'Verifying...';
    await confirmationResult.confirm(otp);
    msg.textContent = 'Login successful!';

    // Go to main app
    window.location.href = '/';

  } catch (err) {
    msg.textContent = 'Wrong OTP. Try again.';
  }
};
