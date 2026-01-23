import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const list = document.getElementById("ordersList");
let allOrders = [];

// LOAD ORDERS
async function loadOrders() {
  const snap = await getDocs(collection(db, "orders"));
  allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderOrders(allOrders);
}

loadOrders();

// RENDER
function renderOrders(orders) {
  list.innerHTML = "";

  orders.forEach(o => {
    const div = document.createElement("div");
    div.className = "order-card";

    div.innerHTML = `
      <div class="order-head">
        <span>${o.orderNumber}</span>
        <span class="order-status">${o.status}</span>
      </div>

      <div class="order-body">
        <div><b>${o.customer?.name}</b> (${o.customer?.phone})</div>
        <div>${o.product?.name || "Manual Order"}</div>
        <div>₹${o.pricing?.total || 0}</div>
        <div>Payment: ${o.payment?.method} (${o.payment?.status})</div>
      </div>

      <div class="order-actions">
        <select onchange="changeStatus('${o.id}', this.value)">
          ${statusOptions(o.status)}
        </select>
      </div>
    `;

    list.appendChild(div);
  });
}

// STATUS OPTIONS
function statusOptions(current) {
  const statuses = [
    "pending",
    "ready",
    "shipped",
    "in_transit",
    "delivered",
    "completed",
    "cancelled",
    "returned"
  ];

  return statuses.map(s =>
    `<option value="${s}" ${s === current ? "selected" : ""}>${s}</option>`
  ).join("");
}

// UPDATE STATUS
window.changeStatus = async function (id, newStatus) {
  const ref = doc(db, "orders", id);

  await updateDoc(ref, {
    status: newStatus,
    [`timeline.${newStatus}`]: serverTimestamp()
  });

  loadOrders();
};

// FILTER
window.filterOrders = function () {
  const val = document.getElementById("statusFilter").value;

  if (val === "all") renderOrders(allOrders);
  else renderOrders(allOrders.filter(o => o.status === val));
};