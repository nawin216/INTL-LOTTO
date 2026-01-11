// public/js/wallet.js

const API_URL = "/api";
const token = localStorage.getItem("token");

if (!token) {
  alert("กรุณาเข้าสู่ระบบก่อน");
  window.location.href = "index.html";
}

// =====================
// DOM
// =====================
const btnActive = document.getElementById("btn-active-orders");
const btnClosed = document.getElementById("btn-closed-orders");
const balanceText = document.getElementById("balance");
const orderList = document.getElementById("order-list");

let currentTab = "active";

// =====================
// SOCKET (Real-time)
// =====================
const socket = io({
  auth: { token }
});

// =====================
// API LOADERS
// =====================
async function loadWallet() {
  try {
    const res = await fetch(`${API_URL}/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (typeof data.balance === "number") {
      balanceText.textContent = `USDT: ${parseFloat(data.balance).toFixed(2)}`;
    }
  } catch (err) {
    console.error("โหลดยอดคงเหลือล้มเหลว:", err);
  }
}

async function loadOrders(status = "active") {
  try {
    const res = await fetch(`${API_URL}/trade/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const orders = await res.json();

    orderList.innerHTML = "";
    const filtered = orders.filter(o =>
      o.status === (status === "active" ? "open" : "closed")
    );

    filtered.forEach(order => {
      const el = renderOrder(order, status === "closed");
      orderList.appendChild(el);
    });
  } catch (err) {
    console.error("โหลดออเดอร์ล้มเหลว:", err);
  }
}

// =====================
// UI EVENTS
// =====================
if (btnActive) {
  btnActive.addEventListener("click", () => {
    currentTab = "active";
    btnActive.classList.add("bg-orange-500");
    if (btnClosed) btnClosed.classList.remove("bg-orange-500");
    loadOrders("active");
  });
}

if (btnClosed) {
  btnClosed.addEventListener("click", () => {
    currentTab = "closed";
    btnClosed.classList.add("bg-orange-500");
    if (btnActive) btnActive.classList.remove("bg-orange-500");
    loadOrders("closed");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadWallet();
  loadOrders(currentTab);
});

// =====================
// SOCKET EVENTS
// =====================

// เดิม: มีการอัปเดตออเดอร์
socket.on("orderUpdated", () => {
  loadWallet();
  loadOrders(currentTab);
});

// 🔔 ใหม่: ระบบหวยจ่ายเงิน → อัปเดตยอดเงินทันที
socket.on("wallet:update", (payload) => {
  console.log("💰 wallet:update", payload);

  if (payload && typeof payload.balance === "number") {
    balanceText.textContent = `USDT: ${payload.balance.toFixed(2)}`;
  } else {
    // fallback กรณีไม่มี balance ส่งมา
    loadWallet();
  }
});

// 🎯 ใหม่: หวยออกผล → รีเฟรชข้อมูล (ถ้ามีหน้าที่เกี่ยวกับออเดอร์/ประวัติ)
socket.on("lottery:resultAnnounced", (data) => {
  console.log("🎉 lottery:resultAnnounced", data);
  loadWallet();
  loadOrders(currentTab);
});

// =====================
// HELPERS
// =====================

// (คงไว้เพื่อกัน error จากโค้ดเดิม ถ้ามีการเรียกใช้งาน)
function renderBalance() {
  if (!balanceText) return;
  const rawText = balanceText.textContent;
  const match = rawText.match(/[\d.]+/);
  if (match) {
    const currentBalance = parseFloat(match[0]);
    balanceText.textContent = `USDT: ${currentBalance.toFixed(2)}`;
  }
}
