import { db } from "./firebase.js";
import { doc, getDoc, updateDoc } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

let orderRef;
let orderData;

async function loadOrder() {
  orderRef = doc(db, "orders", id);
  const snap = await getDoc(orderRef);

  if (!snap.exists()) {
    alert("Order not found");
    return;
  }

  orderData = snap.data();

  document.getElementById("orderNumber").innerText = orderData.orderNumber;
  document.getElementById("orderDate").innerText =
    new Date(orderData.createdAt).toLocaleString("en-IN");

  // STATUS
  document.getElementById("statusSelect").value = orderData.orderStatus;

  // PRODUCT
  document.getElementById("productImage").src =
    orderData.productImage || "img/no-image.png";
  document.getElementById("productName").innerText = orderData.productName;

  const v = orderData.variants || {};
  document.getElementById("variants").innerHTML = `
    ${v.color ? `Color: ${v.color.name}<br>` : ""}
    ${v.size ? `Size: ${v.size.name}` : ""}
  `;

  // OPTIONS
  const optBox = document.getElementById("customOptions");
  optBox.innerHTML = "";
  (orderData.customOptions || []).forEach(o => {
    optBox.innerHTML += `
      <div>
        ${o.label}: ${o.value}
        ${o.image ? `<img src="${o.image}" width="50">` : ""}
      </div>
    `;
  });

  // PRICING
  document.getElementById("subTotal").innerText =
    orderData.pricing?.subTotal || 0;
  document.getElementById("discount").innerText =
    orderData.pricing?.discount || 0;
  document.getElementById("finalAmount").innerText =
    orderData.pricing?.finalAmount || orderData.price || 0;

  // CUSTOMER
  const c = orderData.customer || {};
  custName.innerText = c.name;
  custPhone.innerText = c.phone;
  custAddress.innerText = `${c.address}, ${c.pincode}`;

  waBtn.onclick = () => {
    window.open(`https://wa.me/${c.phone}`);
  };

  // PAYMENT
  const p = orderData.payment || {};
  paymentMode.innerText = p.mode || orderData.paymentMode || "";
  paymentStatus.innerText = p.status || "";
  paymentId.innerText = p.paymentId || "—";
}

window.updateStatus = async function () {
  const val = document.getElementById("statusSelect").value;
  await updateDoc(orderRef, { orderStatus: val });
  alert("Status updated");
};

loadOrder();