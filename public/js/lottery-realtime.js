//js/lottery-realtime.js


// 1️⃣ ดึง token ก่อน
const token =
  localStorage.getItem("token") ||
  localStorage.getItem("authToken") ||
  localStorage.getItem("jwt");

// 2️⃣ สร้าง socket ก่อนใช้งาน
const socket = io({
  auth: { token }
});

// 3️⃣ ค่อย debug event
socket.onAny((event, payload) => {
  console.log("📡 socket event:", event, payload);
});


    function lottoFormatThDateTime(iso) {
      if (!iso) return "-";
      const d = new Date(iso);
      return d.toLocaleString("th-TH");
    }

    function lottoStatusText(status) {
      if (status === "won") return "ถูกรางวัล";
      if (status === "lost") return "ไม่ถูกรางวัล";
      if (status === "paid") return "รับรางวัลแล้ว";
      return "รอผล";
    }

    function lottoStatusClass(status) {
      if (status === "won") return "won";
      if (status === "lost") return "lost";
      if (status === "paid") return "paid";
      return "pending";
    }

    async function lottoFetchTickets(status) {
      try {
        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          localStorage.getItem("jwt");

        let url = "/api/lottery/tickets";
        if (status) url += `?status=${encodeURIComponent(status)}`;

        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        const data = await res.json();
        if (!data.ok) return [];
        return data.tickets || [];
      } catch (err) {
        console.error("lottoFetchTickets error:", err);
        return [];
      }
    }

    function lottoRenderTicketList(tickets, container, mode) {
      if (!container) return;

      if (!tickets.length) {
        container.innerHTML =
          `<div class="bill-card-empty">${
            mode === "pending" ? "ยังไม่มีบิลที่รอผล" : "ยังไม่มีประวัติบิล"
          }</div>`;
        return;
      }

      container.innerHTML = "";

      tickets.forEach((t) => {
        const card = document.createElement("div");
        card.className = "bill-card";

        const entries = Array.isArray(t.entries) ? t.entries : [];
        const firstEntry = entries[0] || null;
        const numbersMain = firstEntry ? firstEntry.numbers : "-";
        const numbersDetail = entries
          .map((e) => `${e.numbers} (${e.digitCount} ตัว)`)
          .join(", ");

        const statusCls = lottoStatusClass(t.status);
        const statusText = lottoStatusText(t.status);
        const totalStake = t.totalStake || 0;
        const totalPayout = t.totalPayout || 0;

        card.innerHTML = `
      <div class="bill-card-left">
        <div class="bill-card-label">เลขที่ซื้อ</div>
        <div class="bill-card-number">${numbersMain}</div>
        <div class="bill-card-numbers-detail">${numbersDetail}</div>
      </div>

      <div class="bill-card-middle-h">
        <div class="bill-card-field">
          <div class="bill-card-field-label">ยอดแทง</div>
          <div class="bill-card-field-value">฿${totalStake.toLocaleString("th-TH")}</div>
        </div>
        <div class="bill-card-field">
          <div class="bill-card-field-label">รับรางวัล</div>
          <div class="bill-card-field-value">฿${totalPayout.toLocaleString("th-TH")}</div>
        </div>
      </div>

      <div class="bill-card-right">
        <div class="bill-card-status ${statusCls}">${statusText}</div>
        <a class="bill-card-link" href="/lottery/bill/${t.ticketId}" target="_blank">
          ดูบิลเต็ม
        </a>
      </div>
    `;

        const meta = document.createElement("div");
        meta.className = "bill-card-meta";
        meta.textContent =
          "เวลา: " + lottoFormatThDateTime(t.createdAt) +
          " · งวด-" + t.roundId +
          " · Ticket ID: " + t.ticketId;

        container.appendChild(card);
        container.appendChild(meta);
      });
    }

    async function lottoLoadTicketCards() {
      const pendingContainer = document.getElementById("ticketCardsPending");
      const historyContainer = document.getElementById("ticketCardsHistory");
      if (!pendingContainer || !historyContainer) return;

      pendingContainer.innerHTML =
        '<div class="bill-card-empty">กำลังโหลดบิลที่รอผล...</div>';
      historyContainer.innerHTML =
        '<div class="bill-card-empty">กำลังโหลดประวัติบิล...</div>';

      const [pendingTickets, allTickets] = await Promise.all([
        lottoFetchTickets("pending"),
        lottoFetchTickets(null)
      ]);

      const historyTickets = allTickets.filter((t) => t.status !== "pending");

      lottoRenderTicketList(pendingTickets, pendingContainer, "pending");
      lottoRenderTicketList(historyTickets, historyContainer, "history");
    }

    function initLatestResultBanner() {
  const lastResultEl = document.getElementById("lastResultText");
  const digitsContainer = document.getElementById("latestResultDigits");
  const roundEl = document.getElementById("latestResultRound");

  if (!lastResultEl || !digitsContainer) return;

  const renderDigits = () => {
    const raw = (lastResultEl.textContent || "").trim();

    // แยกผลรางวัล กับ รหัสงวด
    // ตัวอย่าง raw: "50536329 (R12345)"
    const match = raw.match(/^(\d+)\s*\((.+)\)$/);

    let numbers = "";
    let roundId = "";

    if (match) {
      numbers = match[1];
      roundId = match[2];
    } else {
      numbers = raw.replace(/\D/g, "");
    }

    // ===== แสดงรหัสงวด =====
    if (roundEl) {
      roundEl.textContent = roundId ? `งวด ${roundId}` : "งวด -";
    }

    // ===== แสดงเลข 8 ตัว =====
    if (!numbers) {
      digitsContainer.innerHTML =
        '<span class="latest-result-empty">ยังไม่มีผลล่าสุด</span>';
      return;
    }

    const cleaned = numbers.slice(0, 8);
    const padded = cleaned.padEnd(8, "•");

    digitsContainer.innerHTML = "";
    padded.split("").forEach((ch) => {
      const d = document.createElement("div");
      d.className = "latest-result-digit";
      d.textContent = ch;
      digitsContainer.appendChild(d);
    });
  };

  renderDigits();

  const observer = new MutationObserver(renderDigits);
  observer.observe(lastResultEl, {
    characterData: true,
    childList: true,
    subtree: true,
  });
}


    document.addEventListener("DOMContentLoaded", () => {
      lottoLoadTicketCards();
      initLatestResultBanner();
    });
  // ===== Real-time events (เฉพาะ lottery.html) =====

// 🎟 บิลใหม่เมื่อซื้อสำเร็จ
socket.on("lottery:ticketCreated", (ticket) => {
  const pendingContainer = document.getElementById("ticketCardsPending");
  if (!pendingContainer) return;

  const empty = pendingContainer.querySelector(".bill-card-empty");
  if (empty) empty.remove();

  // ===== สร้างบิลใหม่ใบเดียว =====
  const temp = document.createElement("div");
  lottoRenderTicketList([ticket], temp, "pending");

  // ย้าย node ที่ renderer สร้างมา append
  while (temp.firstChild) {
    pendingContainer.prepend(temp.firstChild); // ใบใหม่อยู่บนสุด
  }
});


// 🏆 ผลหวยออก (REAL-TIME)
socket.on("lottery:resultAnnounced", (payload) => {
  console.log("🏆 RESULT ANNOUNCED:", payload);

  const lastResultEl = document.getElementById("lastResultText");
  const roundEl = document.getElementById("latestResultRound");
  const digitsContainer = document.getElementById("latestResultDigits");

  // 1️⃣ อัปเดตข้อความผลล่าสุด (แถวขวา)
  if (lastResultEl && payload.result8 && payload.roundId) {
    lastResultEl.textContent = `${payload.result8} (${payload.roundId})`;
  }

  // 2️⃣ อัปเดตแถบตัวเลข 8 ตัวด้านบน
  if (digitsContainer && payload.result8) {
    digitsContainer.innerHTML = "";
    payload.result8.split("").forEach((ch) => {
      const d = document.createElement("div");
      d.className = "latest-result-digit";
      d.textContent = ch;
      digitsContainer.appendChild(d);
    });
  }

  // 3️⃣ อัปเดตรหัสงวด
  if (roundEl && payload.roundId) {
    roundEl.textContent = `งวด ${payload.roundId}`;
  }

  if (window.lottoClient && typeof window.lottoClient.loadCurrentRound === "function") {
    window.lottoClient.loadCurrentRound();
  }

  // 4️⃣ รีโหลดบิลทั้งหมด → บิลที่รอผลจะหายไปอัตโนมัติ
  lottoLoadTicketCards();
});



// 🔔 เมื่อมีแจ้งเตือนใหม่แบบ realtime
socket.on("notification:new", (payload) => {
  console.log("🔔 new notification:", payload);

  const dot = document.getElementById("notif-dot");
  if (dot) {
    dot.classList.remove("hidden"); // 👉 เปิดจุดแดงทันที
  }
});

// 💰 เมื่อยอดเงินเปลี่ยน (ถูกรางวัล / คืนเงิน ฯลฯ)
socket.on("wallet:update", (data) => {
  console.log("💰 wallet:update", data);

  const balanceEl = document.getElementById("balanceText");
  const walletSpan = document.getElementById("wallet-balance");

  if (typeof data.balance === "number") {
    const formatted = data.balance.toLocaleString("th-TH");
    if (balanceEl) balanceEl.innerText = formatted;
    if (walletSpan) walletSpan.innerText = formatted;
  }
});



function openHistory() {
  window.location.href = "/lottery-history";
}


const buttons = document.querySelectorAll('.set-buttons button');
const numberInputs = document.getElementById('numberInputs');
const randomBtn = document.getElementById('randomBtn');

let currentCount = 2;

function renderInputs(count) {
  numberInputs.innerHTML = '';
  numberInputs.classList.toggle('eight-set', count === 8);

  for (let i = 0; i < count; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 1;
    input.inputMode = 'numeric';
    numberInputs.appendChild(input);
  }
}

buttons.forEach(btn => {
  btn.onclick = () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCount = parseInt(btn.dataset.count);
    renderInputs(currentCount);
  };
});

randomBtn.onclick = () => {
  numberInputs.querySelectorAll('input').forEach(i => {
    i.value = Math.floor(Math.random() * 10);
  });
};

/* init */
renderInputs(currentCount);

// 🔁 ฟังสัญญาณจากหน้า notifications ว่าอ่านแจ้งเตือนแล้ว
window.addEventListener("storage", (e) => {
  if (e.key === "notif_read_sync") {
    const dot = document.getElementById("notif-dot");
    if (dot) dot.classList.add("hidden");
  }
});

function openNotifications() {
  window.location.href = "/notifications";
}
