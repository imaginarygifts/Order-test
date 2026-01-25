import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= STATE ================= */
let allOrders = [];
let filteredOrders = [];
let categoryMap = {}; // {id: name}
let activeRange = "today";
let currentPage = 1;
const PAGE_SIZE = 25;

/* ================= DOM ================= */
const listEl = document.getElementById("ordersList");
const pageNoEl = document.getElementById("pageNo");
const searchInput = document.getElementById("searchInput");

const productFilter = document.getElementById("productFilter");
const categoryFilter = document.getElementById("categoryFilter");
const paymentFilter = document.getElementById("paymentFilter");
const tagFilter = document.getElementById("tagFilter");
const statusFilter = document.getElementById("statusFilter");

/* ================= HELPERS ================= */
function formatDateTime(ts) {
  if (!ts) return "";

  const d = new Date(ts);

  const date = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  return `${date} • ${time}`;
}


async function loadCategories() {
  const snap = await getDocs(collection(db, "categories"));
  snap.forEach(doc => {
    categoryMap[doc.id] = doc.data().name;
  });
}

/* ================= LOAD ORDERS ================= */
async function loadOrders() {
  const q = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);
  allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  populateFilters();   // ✅ IMPORTANT: after data load
  applyFilters();
}
await loadCategories();
await loadOrders();


/* ================= DATE RANGE ================= */
window.setRange = function (range, btn) {
  activeRange = range;
  currentPage = 1;

  document.querySelectorAll(".range-btn")
    .forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  applyFilters();
};

function isInRange(ts) {
  if (activeRange === "all") return true;

  const DAY = 86400000;
  const diff = Date.now() - ts;

  if (activeRange === "today") return diff < DAY;
  return diff < Number(activeRange) * DAY;
}

/* ================= FILTER LOGIC ================= */
function applyFilters() {
  const search = searchInput.value.toLowerCase();

  filteredOrders = allOrders.filter(o => {
    if (!isInRange(o.createdAt)) return false;

    if (productFilter.value && o.productId !== productFilter.value) return false;
    if (categoryFilter.value && o.categoryId !== categoryFilter.value) return false;
    if (statusFilter.value && o.orderStatus !== statusFilter.value) return false;

    if (tagFilter.value && !(o.tags || []).includes(tagFilter.value)) return false;
    
    const payMode = getPaymentMode(o);

if (paymentFilter.value && payMode !== paymentFilter.value)
  return false;

    if (search) {
      const text =
        (o.orderNumber || "") +
        (o.productName || "") +
        (o.customer?.name || "") +
        (o.customer?.phone || "");
      if (!text.toLowerCase().includes(search)) return false;
    }

    return true;
  });

  currentPage = 1;
  renderOrders();
}

// ===== PAYMENT MODE RESOLVER (OLD + NEW ORDERS SUPPORT) =====
function getPaymentMode(o) {
  return (
    o.payment?.mode ||
    o.paymentMode ||
    ""
  ).toLowerCase();
}

/* ================= POPULATE FILTERS ================= */
function populateFilters() {
  // reset
  productFilter.innerHTML = `<option value="">All Products</option>`;
  categoryFilter.innerHTML = `<option value="">All Categories</option>`;
  tagFilter.innerHTML = `<option value="">All Tags</option>`;

  // PRODUCTS
  const productMap = new Map();
  allOrders.forEach(o => {
    if (o.productId && !productMap.has(o.productId)) {
      productMap.set(o.productId, o.productName);
    }
  });

  productMap.forEach((name, id) => {
    productFilter.innerHTML += `<option value="${id}">${name}</option>`;
  });

  // CATEGORIES
  [...new Set(allOrders.map(o => o.categoryId).filter(Boolean))]
    .forEach(id => {
      categoryFilter.innerHTML += `
  <option value="${id}">
    ${categoryMap[id] || "Unknown Category"}
  </option>
`;
    });

  // TAGS
  const tags = new Set();
  allOrders.forEach(o => (o.tags || []).forEach(t => tags.add(t)));
  tags.forEach(t => {
    tagFilter.innerHTML += `<option value="${t}">${t}</option>`;
  });
}

/* ================= RENDER ================= */
function renderOrders() {
  listEl.innerHTML = "";

  if (!filteredOrders.length) {
    listEl.innerHTML =
      `<p style="opacity:.6;text-align:center">No orders found</p>`;
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageOrders = filteredOrders.slice(start, start + PAGE_SIZE);

  pageOrders.forEach(o => {
    const card = document.createElement("div");
    card.className = "order-card";

    card.innerHTML = `
      <div class="order-left">
        <img
          src="${o.productImage || 'img/no-image.png'}"
          class="order-thumb"
          alt="product"
        >
      </div>

      <div class="order-middle">
        <div class="order-id">${o.orderNumber || "—"}</div>
        <div class="order-product">${o.productName || ""}</div>

        <div class="order-customer">
          ${o.customer?.name || "Customer"} • ${o.customer?.phone || ""}
        </div>

        <div class="order-date muted">
          ${formatDateTime(o.createdAt)}
        </div>
      </div>

      <div class="order-right">
        <div class="status ${o.orderStatus || "pending"}">
          ${o.orderStatus || "Pending"}
        </div>

        <div class="payment ${getPaymentMode(o)}">
  ${getPaymentMode(o)}
</div>

        <div class="order-price">₹${o.price || 0}</div>
      </div>
    `;

    card.onclick = () => {
      location.href = `order-view.html?id=${o.id}`;
    };

    listEl.appendChild(card);
  });

  pageNoEl.innerText = `Page ${currentPage}`;
}

/* ================= PAGINATION ================= */
window.nextPage = function () {
  if (currentPage * PAGE_SIZE < filteredOrders.length) {
    currentPage++;
    renderOrders();
  }
};

window.prevPage = function () {
  if (currentPage > 1) {
    currentPage--;
    renderOrders();
  }
};

/* ================= EVENT LISTENERS ================= */
productFilter.addEventListener("change", applyFilters);
categoryFilter.addEventListener("change", applyFilters);
paymentFilter.addEventListener("change", applyFilters);
statusFilter.addEventListener("change", applyFilters);
tagFilter.addEventListener("change", applyFilters);

searchInput.addEventListener("input", () => {
  currentPage = 1;
  applyFilters();
});