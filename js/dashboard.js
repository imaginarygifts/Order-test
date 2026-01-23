import { db, storage } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, listAll, getMetadata, deleteObject, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const statsBox = document.getElementById("stats");
const cleanupList = document.getElementById("cleanupList");

let cleanupFiles = [];

// ================== STATS ==================
async function loadStats() {
  const productsSnap = await getDocs(collection(db, "products"));
  const catsSnap = await getDocs(collection(db, "categories"));

  statsBox.innerHTML = `
    <div class="card">Total Products: ${productsSnap.size}</div>
    <div class="card" style="margin-top:12px">Total Categories: ${catsSnap.size}</div>
  `;
}

// ================== LOAD CUSTOM IMAGES ==================
async function loadCustomImages() {
  try {
    const folderRef = ref(storage, "custom-images/");
    const res = await listAll(folderRef);

    cleanupFiles = [];

    for (const item of res.items) {
      const meta = await getMetadata(item);
      const url = await getDownloadURL(item);

      const created = new Date(meta.timeCreated).getTime();
      const ageDays = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));

      cleanupFiles.push({
        ref: item,
        url,
        ageDays,
        name: item.name
      });
    }

    renderCleanupList();
  } catch (err) {
    console.error("Load images error:", err);
  }
}

// ================== RENDER ==================
function renderCleanupList() {
  cleanupList.innerHTML = "";

  cleanupFiles.forEach((f) => {
    const card = document.createElement("div");
    card.className = "cleanup-card";

    card.innerHTML = `
      <input type="checkbox" class="cleanup-check" data-path="${f.ref.fullPath}">
      <img src="${f.url}">
      <small>${f.ageDays} days old</small>
    `;

    cleanupList.appendChild(card);
  });
}

// ================== DELETE SELECTED ==================
window.deleteSelectedImages = async function () {
  const checks = document.querySelectorAll(".cleanup-check:checked");

  if (!checks.length) {
    alert("No images selected");
    return;
  }

  if (!confirm("Delete selected images?")) return;

  try {
    for (const c of checks) {
      const path = c.dataset.path;
      console.log("Deleting:", path);

      const fileRef = ref(storage, path);
      await deleteObject(fileRef);
    }

    alert("Deleted successfully");
    loadCustomImages();
  } catch (err) {
    alert("Delete failed: " + err.message);
    console.error(err);
  }
};

// ================== DELETE > 7 DAYS ==================
window.deleteOlderThan7Days = async function () {
  if (!confirm("Delete all images older than 7 days?")) return;

  try {
    for (const f of cleanupFiles) {
      if (f.ageDays > 7) {
        await deleteObject(f.ref);
      }
    }

    alert("Old images deleted");
    loadCustomImages();
  } catch (err) {
    alert("Delete failed: " + err.message);
    console.error(err);
  }
};
let allSelected = false;

window.toggleSelectAll = function () {
  const checks = document.querySelectorAll(".cleanup-check");

  allSelected = !allSelected;

  checks.forEach(c => {
    c.checked = allSelected;
  });

  document.getElementById("selectAllBtn").innerText = allSelected ? "Deselect All" : "Select All";
};

// ================== INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadCustomImages();
});