import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= GLOBAL STATE ================= */
let orderData = null;
let subTotal = 0;
let discount = 0;
let finalAmount = 0;
let appliedCoupon = null;
let selectedPaymentMode = "online";
let availableCoupons = [];
let orderNumber = null;

/* ================= ORDER NUMBER ================= */
async function generateOrderNumber() {
  const ref = doc(db, "counters", "orders");
  const snap = await getDoc(ref);

  let next = 1001;

  if (snap.exists()) {
    next = (snap.data().current || 1000) + 1;
    await updateDoc(ref, { current: next });
  } else {
    await setDoc(ref, { current: next });
  }

  return `IG-${next}`;
}

/* ================= SAVE ORDER ================= */
async function saveOrder(paymentMode, paymentStatus, paymentId = null) {
  const customer = validateForm();
  if (!customer || !orderData) return null;

  orderNumber = await generateOrderNumber();

  const order = {
    orderNumber,

    productId: orderData.product.id || null,
    productName: orderData.product.name || "",
    productImage: orderData.product.images?.[0] || "",

    categoryId: orderData.product.categoryId || null,
    categoryName: orderData.product.categoryName || "",

    tags: orderData.product.tags || [],

    variants: {
      color: orderData.color || null,
      size: orderData.size || null
    },

    customOptions: Object.keys(orderData.options || {}).map(i => ({
      label: orderData.product.customOptions[i]?.label,
      value: orderData.optionValues?.[i] || "Selected",
      image: orderData.imageLinks?.[i] || null
    })),

    pricing: {
      subTotal,
      discount,
      finalAmount
    },

    customer: {
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      pincode: customer.pincode
    },

    paymentMode: paymentMode.toLowerCase(), // 🔑 IMPORTANT
    paymentStatus,
    paymentId,

    orderStatus: "pending",
    source: "frontend",
    createdAt: Date.now()
  };

  await addDoc(collection(db, "orders"), order);
  return order;
}

/* ================= LOAD ORDER ================= */
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

/* ================= SUMMARY ================= */
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
  finalAmount = Math.max(0, subTotal - discount);
  document.getElementById("finalAmount").innerText = "₹" + finalAmount;
}

/* ================= COUPONS ================= */
async function loadCoupons() {
  const snap = await getDocs(collection(db, "coupons"));
  availableCoupons = [];

  snap.forEach(d => {
    const c = d.data();
    if (!c.active) return;
    if (c.allowedModes && !c.allowedModes.includes(selectedPaymentMode)) return;
    availableCoupons.push({ id: d.id, ...c });
  });

  renderCoupons();
}

/* ================= PLACE ORDER ================= */
window.placeOrder = async function () {
  try {
    if (selectedPaymentMode === "cod") {
      const order = await saveOrder("cod", "pending");
      if (order) sendWhatsApp(order, null);
    } else {
      startPayment();
    }
  } catch (e) {
    alert(e.message);
  }
};

/* ================= WHATSAPP ================= */
function sendWhatsApp(order, paymentId = null) {
  let msg = `🧾 Order No: ${order.orderNumber}\n`;
  msg += `Product: ${order.productName}\n`;
  msg += `Total: ₹${order.pricing.finalAmount}\n`;
  if (paymentId) msg += `Payment ID: ${paymentId}\n`;

  const url = `https://wa.me/917030191819?text=${encodeURIComponent(msg)}`;
  window.location.href = url; // 🔑 IMPORTANT
}

/* ================= RAZORPAY ================= */
function startPayment() {
  const options = {
    key: "rzp_test_8OmRCO9SiPeXWg",
    amount: finalAmount * 100,
    currency: "INR",
    handler: async res => {
      const order = await saveOrder("online", "paid", res.razorpay_payment_id);
      if (order) sendWhatsApp(order, res.razorpay_payment_id);
    }
  };

  new Razorpay(options).open();
}

/* ================= VALIDATION ================= */
function validateForm() {
  if (!custName.value || !custPhone.value || !custAddress.value || !custPincode.value) {
    alert("Fill all details");
    return false;
  }
  return {
    name: custName.value,
    phone: custPhone.value,
    address: custAddress.value,
    pincode: custPincode.value
  };
}