import { db } from "./firebase.js";
import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= GLOBAL STATE ================= */
let orderData = null;
let subTotal = 0;
let discount = 0;
let finalAmount = 0;
let appliedCoupon = null;
let selectedPaymentMode = "online";
let availableCoupons = [];

/* ================= LOAD ORDER DATA ================= */
function loadOrder() {
  const raw = localStorage.getItem("checkoutData");
  if (!raw) {
    alert("No product selected");
    location.href = "index.html";
    return;
  }

  orderData = JSON.parse(raw);
  subTotal = orderData.finalPrice;

  renderSummary();
  setupPaymentModes();
  loadCoupons();
  recalcPrice();
}
loadOrder();

/* ================= RENDER SUMMARY ================= */
function renderSummary() {
  const box = document.getElementById("orderSummary");

  let html = `<div><b>${orderData.product.name}</b></div>`;

  if (orderData.color) html += `<div>Color: ${orderData.color.name}</div>`;
  if (orderData.size) html += `<div>Size: ${orderData.size.name}</div>`;

  box.innerHTML = html;
}

/* ================= PAYMENT MODES ================= */
function setupPaymentModes() {
  const ps = orderData.product.paymentSettings || {};

  if (ps.online?.enabled) selectedPaymentMode = "online";
  else if (ps.cod?.enabled) selectedPaymentMode = "cod";
  else if (ps.advance?.enabled) selectedPaymentMode = "advance";

  document.querySelectorAll("input[name='paymode']").forEach(radio => {
    radio.addEventListener("change", () => {
      selectedPaymentMode = radio.value;
      removeCoupon();
      loadCoupons();
      recalcPrice();
    });
  });
}

/* ================= PRICE ================= */
function recalcPrice() {
  finalAmount = subTotal - discount;
  if (finalAmount < 0) finalAmount = 0;

  document.getElementById("finalAmount").innerText = "₹" + finalAmount;
}

/* ================= SAVE ORDER TO FIRESTORE ================= */
async function saveOrderToFirestore(paymentMode, paymentStatus, paymentId = null) {
  try {
    const orderNumber = "IG-" + Date.now();

    const order = {
      orderNumber,

      productId: orderData.product.id || null,
      productName: orderData.product.name,
      productImage: orderData.product.images?.[0] || "",

      categoryId: orderData.product.categoryId || null,
      tags: orderData.product.tags || [],

      variants: {
        color: orderData.color || null,
        size: orderData.size || null
      },

      pricing: {
        subTotal,
        discount,
        finalAmount
      },

      customer: {
        name: custName.value,
        phone: custPhone.value,
        address: custAddress.value,
        pincode: custPincode.value
      },

      paymentMode,              // online / cod
      paymentStatus,            // pending / paid
      paymentId,

      orderStatus: "pending",
      source: "frontend",
      createdAt: Date.now()
    };

    await addDoc(collection(db, "orders"), order);
  } catch (e) {
    console.warn("Order save failed (non-blocking):", e.message);
  }
}

/* ================= PLACE ORDER ================= */
window.placeOrder = function () {
  const customer = validateForm();
  if (!customer) return;

  if (selectedPaymentMode === "cod") {
    saveOrderToFirestore("cod", "pending");
    sendWhatsApp("COD");
  } else {
    startPayment(customer);
  }
};

/* ================= WHATSAPP ================= */
function sendWhatsApp(mode, paymentId = null) {
  let msg = `🛍 New Order — Imaginary Gifts\n\n`;

  msg += `Name: ${custName.value}\n`;
  msg += `Phone: ${custPhone.value}\n`;
  msg += `Address: ${custAddress.value}\n`;
  msg += `Pincode: ${custPincode.value}\n\n`;

  msg += `Product: ${orderData.product.name}\n`;

  if (orderData.color) msg += `Color: ${orderData.color.name}\n`;
  if (orderData.size) msg += `Size: ${orderData.size.name}\n`;

  msg += `\nTotal: ₹${finalAmount}\n`;
  msg += `Payment Mode: ${mode}\n`;

  if (paymentId) msg += `Payment ID: ${paymentId}\n`;

  const url = `https://wa.me/917030191819?text=${encodeURIComponent(msg)}`;
  window.location.href = url;
}

/* ================= RAZORPAY ================= */
function startPayment(customer) {
  const options = {
    key: "rzp_test_8OmRCO9SiPeXWg",
    amount: finalAmount * 100,
    currency: "INR",
    name: "Imaginary Gifts",
    description: "Order Payment",

    handler: function (response) {
      saveOrderToFirestore(
        "online",
        "paid",
        response.razorpay_payment_id
      );

      sendWhatsApp("ONLINE", response.razorpay_payment_id);
    },

    prefill: {
      name: customer.name,
      contact: customer.phone
    },

    theme: { color: "#00f5ff" }
  };

  new Razorpay(options).open();
}

/* ================= VALIDATION ================= */
function validateForm() {
  if (!custName.value || !custPhone.value || !custAddress.value || !custPincode.value) {
    alert("Please fill all details");
    return false;
  }
  return true;
}