import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* ================= FIREBASE INIT ================= */
// 🔴 DO NOT DUPLICATE if firebase.js already initializes app
// If firebase.js already exists, REMOVE initializeApp part

import { firebaseConfig } from "./firebase-config.js";
// firebase-config.js should export firebaseConfig

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/* ================= GLOBAL ================= */
window.confirmationResult = null;

/* ================= SEND OTP ================= */
window.sendOTP = async function () {
  const phoneInput = document.getElementById("phone");
  const phone = phoneInput.value.trim();

  if (!phone || phone.length < 10) {
    alert("Enter valid mobile number");
    return;
  }

  // Save current page for redirect after login
  localStorage.setItem("redirectAfterLogin", location.href);

  try {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        "recaptcha-container",
        { size: "invisible" },
        auth
      );
    }

    window.confirmationResult = await signInWithPhoneNumber(
      auth,
      "+91" + phone,
      window.recaptchaVerifier
    );

    document.getElementById("otpBox").style.display = "block";
    alert("OTP sent");

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

/* ================= VERIFY OTP ================= */
window.verifyOTP = async function () {
  const otp = document.getElementById("otp").value.trim();

  if (!otp) {
    alert("Enter OTP");
    return;
  }

  if (!window.confirmationResult) {
    alert("Please send OTP first");
    return;
  }

  try {
    const result = await window.confirmationResult.confirm(otp);
    const user = result.user;

    // Save customer session
    localStorage.setItem(
      "customer",
      JSON.stringify({
        uid: user.uid,
        phone: user.phoneNumber
      })
    );

    const redirect =
      localStorage.getItem("redirectAfterLogin") || "index.html";

    localStorage.removeItem("redirectAfterLogin");
    location.href = redirect;

  } catch (err) {
    console.error(err);
    alert("Invalid OTP");
  }
};

/* ================= AUTO LOGIN CHECK ================= */
onAuthStateChanged(auth, user => {
  if (user) {
    localStorage.setItem(
      "customer",
      JSON.stringify({
        uid: user.uid,
        phone: user.phoneNumber
      })
    );
  }
});