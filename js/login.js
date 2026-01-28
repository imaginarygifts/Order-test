import { auth } from "./firebase.js";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let confirmationResult = null;

/* ================= INIT ================= */
window.onload = () => {
  window.recaptchaVerifier = new RecaptchaVerifier(
    "recaptcha-container",
    { size: "invisible" },
    auth
  );
};

/* ================= SEND OTP ================= */
window.sendOTP = async function () {
  const phone = document.getElementById("phoneInput").value.trim();

  if (!phone || phone.length < 10) {
    alert("Enter valid mobile number");
    return;
  }

  const fullPhone = "+91" + phone;

  try {
    confirmationResult = await signInWithPhoneNumber(
      auth,
      fullPhone,
      window.recaptchaVerifier
    );

    document.getElementById("phoneStep").style.display = "none";
    document.getElementById("otpStep").style.display = "block";

  } catch (err) {
    alert(err.message);
  }
};

/* ================= VERIFY OTP ================= */
window.verifyOTP = async function () {
  const otp = document.getElementById("otpInput").value.trim();

  if (!otp) return alert("Enter OTP");

  try {
    await confirmationResult.confirm(otp);

    // ✅ Redirect back
    const redirect = localStorage.getItem("redirectAfterLogin") || "index.html";
    localStorage.removeItem("redirectAfterLogin");
    location.href = redirect;

  } catch (err) {
    alert("Invalid OTP");
  }
};