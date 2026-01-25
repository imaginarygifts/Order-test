import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ===== GLOBAL STATE =====
let orderData = null;
let subTotal = 0;
let discount = 0;
let finalAmount = 0;
let appliedCoupon = null;
let selectedPaymentMode = "online";
let availableCoupons = [];
let orderNumber = null;

// ===== order number =====

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

// ===== save order =====

async function saveOrder(paymentMode, paymentStatus, paymentId = null) {
  const customer = validateForm();
  if (!customer) return null;

  if (!orderData) {
    alert("Order data missing");
    return null;
  }

  orderNumber = await generateOrderNumber();

  const order = {
    orderNumber,

    productId: orderData.product.id || null,
    productName: orderData.product.name,
    productImage: product.images?.[0] || "",

    categoryId: orderData.product.categoryId || null,

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

    payment: {
      mode: paymentMode,
      status: paymentStatus,
      paymentId
    },

    orderStatus: "pending",
    source: "frontend",

    createdAt: Date.now()
  };

  await addDoc(collection(db, "orders"), order);
  return order;
}

// ===== LOAD ORDER DATA =====
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

// ===== RENDER SUMMARY =====
function renderSummary() {
  const box = document.getElementById("orderSummary");

  let html = `
    <div><b>${orderData.product.name}</b></div>
    <div>Base Price: ₹${orderData.product.basePrice}</div>
  `;

  if (orderData.color) html += `<div>Color: ${orderData.color.name}</div>`;
  if (orderData.size) html += `<div>Size: ${orderData.size.name}</div>`;

  if (orderData.options && Object.keys(orderData.options).length) {
    html += `<div style="margin-top:6px">Options:</div>`;
    Object.keys(orderData.options).forEach(i => {
      const label = orderData.product.customOptions[i].label;
      const value = orderData.optionValues[i] || "Selected";
      html += `<div>- ${label}: ${value}</div>`;
    });
  }

  box.innerHTML = html;
}

// ===== PAYMENT MODE FILTER =====
function setupPaymentModes() {
  const ps = orderData.product.paymentSettings || {};

  const onlineLabel = document.getElementById("onlineOption");
  const codLabel = document.getElementById("codOption");
  const advanceLabel = document.getElementById("advanceOption");

  if (!ps.online?.enabled && onlineLabel) onlineLabel.style.display = "none";
  if (!ps.cod?.enabled && codLabel) codLabel.style.display = "none";
  if (!ps.advance?.enabled && advanceLabel) advanceLabel.style.display = "none";

  if (ps.online?.enabled) selectedPaymentMode = "online";
  else if (ps.cod?.enabled) selectedPaymentMode = "cod";
  else if (ps.advance?.enabled) selectedPaymentMode = "advance";

  const firstRadio = document.querySelector(`input[value="${selectedPaymentMode}"]`);
  if (firstRadio) firstRadio.checked = true;

  document.querySelectorAll("input[name='paymode']").forEach(radio => {
    radio.addEventListener("change", () => {
      selectedPaymentMode = radio.value;
      removeCoupon();
      loadCoupons();
      recalcPrice();
    });
  });
}

// ===== PRICE =====
function recalcPrice() {
  finalAmount = subTotal - discount;
  if (finalAmount < 0) finalAmount = 0;

  document.getElementById("subTotal").innerText = "₹" + subTotal;
  document.getElementById("discountAmount").innerText = "-₹" + discount;
  document.getElementById("finalAmount").innerText = "₹" + finalAmount;
}

// ===== LOAD COUPONS =====
async function loadCoupons() {
  const snap = await getDocs(collection(db, "coupons"));
  availableCoupons = [];

  const now = new Date();

  snap.forEach(d => {
    const c = d.data();

    if (!c.active) return;

    const expiry = c.expiry?.toDate ? c.expiry.toDate() : null;
    if (expiry && expiry < now) return;

    if (c.minOrder && subTotal < c.minOrder) return;

    if (c.allowedModes && !c.allowedModes.includes(selectedPaymentMode)) return;

    if (c.scope === "product" && c.productIds?.length) {
      if (!c.productIds.includes(orderData.product.id)) return;
    }

    availableCoupons.push({ id: d.id, ...c });
  });

  renderCoupons();
}

// ===== RENDER COUPONS =====
function renderCoupons() {
  const list = document.getElementById("couponListUI");
  if (!list) return;

  list.innerHTML = "";

  if (!availableCoupons.length) {
    list.innerHTML = `<p class="no-coupon">No coupons available</p>`;
    return;
  }

  availableCoupons.forEach(c => {
    const div = document.createElement("div");
    div.className = "coupon-card";

    if (appliedCoupon && appliedCoupon.id === c.id) {
      div.classList.add("applied");
    }

    const valueText = c.type === "percent"
      ? `${c.value}% OFF`
      : `₹${c.value} OFF`;

    const btnText = appliedCoupon && appliedCoupon.id === c.id ? "Remove" : "Apply";

    div.innerHTML = `
      <div>
        <b>${c.code}</b>
        <small>${valueText}</small>
      </div>
      <button onclick="${btnText === "Remove" ? `removeCoupon()` : `applyCoupon('${c.id}')`}">
        ${btnText}
      </button>
    `;

    list.appendChild(div);
  });
}

// ===== APPLY COUPON =====
window.applyCoupon = function (id) {
  const c = availableCoupons.find(x => x.id === id);
  if (!c) return;

  let newDiscount = 0;

  if (c.type === "percent") {
    newDiscount = Math.round(subTotal * (c.value / 100));
  } else {
    newDiscount = c.value;
  }

  appliedCoupon = c;
  discount = newDiscount;

  document.getElementById("couponInput").value = c.code;
  document.getElementById("couponMsg").innerText = `Applied: ${c.code}`;
  document.getElementById("couponMsg").style.color = "#00ff9c";

  renderCoupons();
  recalcPrice();
};

// ===== REMOVE COUPON =====
window.removeCoupon = function () {
  appliedCoupon = null;
  discount = 0;

  document.getElementById("couponInput").value = "";
  document.getElementById("couponMsg").innerText = "Coupon removed";
  document.getElementById("couponMsg").style.color = "#aaa";

  renderCoupons();
  recalcPrice();
};

// ===== MANUAL COUPON =====
window.applyManualCoupon = function () {
  const code = document.getElementById("couponInput").value.trim().toUpperCase();
  if (!code) return;

  const c = availableCoupons.find(x => x.code === code);

  if (!c) {
    document.getElementById("couponMsg").innerText = "Invalid coupon";
    document.getElementById("couponMsg").style.color = "red";
    return;
  }

  applyCoupon(c.id);
};

// ===== VALIDATION =====
function validateForm() {
  const name = custName.value.trim();
  const phone = custPhone.value.trim();
  const address = custAddress.value.trim();
  const pincode = custPincode.value.trim();

  if (!name || !phone || !address || !pincode) {
    alert("Please fill all fields");
    return false;
  }

  return { name, phone, address, pincode };
}

// ===== PLACE ORDER =====

window.placeOrder = async function () {
  try {
    const customer = validateForm();
    if (!customer) return;

    if (selectedPaymentMode === "cod") {
      const order = await saveOrder("COD", "pending");
      if (!order) return;

      sendWhatsApp("COD", order.orderNumber);
      alert("Order placed successfully!");
    } 
    else {
      startPayment(customer);
    }

  } catch (err) {
    alert("Order failed: " + err.message);
  }
};

// ===== WHATSAPP =====
function sendWhatsApp(mode, orderNo, paymentId = null) {
  let msg = `🛍 *New Order — Imaginary Gifts*\n\n`;

  msg += `🧾 Order No: *${orderNo}*\n\n`;
  msg += `Name: ${custName.value}\n`;
  msg += `Phone: ${custPhone.value}\n`;
  msg += `Address: ${custAddress.value}\n`;
  msg += `Pincode: ${custPincode.value}\n\n`;

  msg += `Product: ${orderData.product.name}\n`;

  if (orderData.color) msg += `Color: ${orderData.color.name}\n`;
  if (orderData.size) msg += `Size: ${orderData.size.name}\n`;

  if (orderData.options) {
    msg += `Options:\n`;
    Object.keys(orderData.options).forEach(i => {
      msg += `- ${orderData.product.customOptions[i].label}: ${orderData.optionValues[i]}\n`;
    });
  }

  msg += `\nTotal: ₹${finalAmount}\n`;
  msg += `Payment: ${mode}\n`;

  if (paymentId) msg += `Payment ID: ${paymentId}\n`;

  const url = `https://wa.me/917030191819?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

// ===== RAZORPAY =====
function startPayment(customer) {
  const options = {
    key: "rzp_test_8OmRCO9SiPeXWg",
    amount: finalAmount * 100,
    currency: "INR",
    name: "Imaginary Gifts",
    description: "Order Payment",

    handler: async function (response) {
      const order = await saveOrder(
        "ONLINE",
        "paid",
        response.razorpay_payment_id
      );

      if (order) {
        sendWhatsApp("ONLINE", order.orderNumber, response.razorpay_payment_id);
        alert("Payment successful!");
      }
    },

    prefill: {
      name: customer.name,
      contact: customer.phone
    },

    theme: { color: "#00f5ff" }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}