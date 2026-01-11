// public/js/lottery-client.js
(() => {
  const API_BASE = "/api";

  // --------- auth helpers ---------
  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function ensureLoggedIn() {
    const token = getToken();
    if (!token) {
      window.location.href = "/";
    }
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  function goWallet() {
    window.location.href = "/wallet";
  }

  // --------- global state สำหรับหน้าซื้อหวย ---------
  let currentRoundId = null;
  let currentEntries = []; // { digitCount, numbers, stake }

  // --------- helper แสดงเงิน ---------
  function formatBaht(value) {
    const num = Number(value || 0);
    return num.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // --------- โหลดยอดเงิน ---------
  async function loadWallet() {
  try {
    const token = getToken();
    if (!token) return;

    const res = await fetch(`${API_BASE}/wallet`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      console.error("wallet error:", data);
      return;
    }

    // ✅ โครงสร้าง API ของคุณคือ data.wallet.balance
    const balance = data.wallet?.balance ?? 0;
    const balanceText = formatBaht(balance);

    const balanceDiv = document.getElementById("balanceText");
    const walletSpan = document.getElementById("wallet-balance");

    if (balanceDiv) balanceDiv.textContent = balanceText;
    if (walletSpan) walletSpan.textContent = balanceText;

  } catch (err) {
    console.error("loadWallet error:", err);
  }
}


  // --------- โหลดงวดที่เปิดรับแทง ---------
  async function loadCurrentRound() {
    try {
      const res = await fetch(`${API_BASE}/lottery/rounds?status=open`);
      const data = await res.json();

      if (!res.ok || !data.ok || !data.rounds.length) {
        console.warn("ไม่มีงวดที่เปิดรับแทง");
        const rId = document.getElementById("roundIdText");
        const rDraw = document.getElementById("roundDrawAtText");
        if (rId) rId.textContent = "-";
        if (rDraw) rDraw.textContent = "-";
        currentRoundId = null;
        return;
      }

      const round = data.rounds[0];
      currentRoundId = round.roundId;

      const roundIdText = document.getElementById("roundIdText");
      const roundDrawAtText = document.getElementById("roundDrawAtText");

      if (roundIdText) roundIdText.textContent = round.roundId;

      if (roundDrawAtText && round.drawAt) {
        const d = new Date(round.drawAt);
        roundDrawAtText.textContent = d.toLocaleString("th-TH");
        startNextDrawCountdown(round.drawAt);
      }
    } catch (err) {
      console.error("loadCurrentRound error:", err);
    }
  }

  // --------- โหลดผลล่าสุด (งวดที่เคลียร์แล้ว) ---------
async function loadLastResult() {
  try {
    const res = await fetch(`${API_BASE}/lottery/rounds?status=settled`);

    console.log("loadLastResult status =", res.status); // debug
    const data = await res.json();
    console.log("loadLastResult data =", data);         // debug

    const el = document.getElementById("lastResultText");

    if (!res.ok || !data.ok || !Array.isArray(data.rounds) || !data.rounds.length) {
      if (el) el.textContent = "-";
      return;
    }

    // เลือก "งวดล่าสุด" จากเวลาที่มี: settledAt > drawAt > createdAt
    const rounds = data.rounds.slice().sort((a, b) => {
  // วันที่ใหม่ก่อน
  if (a.date !== b.date) {
    return a.date > b.date ? -1 : 1;
  }
  // รอบมากกว่าคือใหม่กว่า (R12 > R1)
  return (b.roundNo || 0) - (a.roundNo || 0);
});

    const last = rounds[0];

    const txt = `${last.result8 || "-"} (${last.roundId || "-"})`;
    if (el) el.textContent = txt;
  } catch (err) {
    console.error("loadLastResult error:", err);
    const el = document.getElementById("lastResultText");
    if (el) el.textContent = "-";
  }
}


  // --------- จัดการตะกร้าเลข ---------
  function renderEntries() {
    const box = document.getElementById("entryList");
    const totalEl = document.getElementById("totalStakeText");

    if (!currentEntries.length) {
      box.innerHTML = "ยังไม่มีเลขในตะกร้า";
      totalEl.textContent = "0 บาท";
      return;
    }

    let html = "<ul style='padding-left:18px; margin:0;'>";
    let total = 0;
    currentEntries.forEach((e, idx) => {
      total += e.stake;
      html += `<li>
          เลขท้าย ${e.digitCount} ตัว : <strong>${e.numbers}</strong>
          × ${e.stake} บาท
          <a href="javascript:void(0)" onclick="window.lottoClient.removeEntry(${idx})" style="color:#ef5350; margin-left:6px; font-size:11px;">ลบ</a>
        </li>`;
    });
    html += "</ul>";
    box.innerHTML = html;
    totalEl.textContent = `${formatBaht(total)} บาท`;
  }

  function addEntry({ digitCount, numbers, stake }) {
  stake = Number(stake);

  if (!numbers || !stake || stake <= 0) {
    alert("กรุณากรอกเลขและจำนวนเงินให้ครบ");
    return;
  }

  if (!/^\d+$/.test(numbers) || numbers.length !== digitCount) {
    alert(`เลขต้องเป็นตัวเลข ${digitCount} หลักเท่านั้น`);
    return;
  }

  currentEntries.push({
    digitCount,
    numbers,
    stake,
  });

  renderEntries();
}

// ✅ เพิ่มฟังก์ชันนี้เข้าไป
function removeEntry(index) {
  currentEntries.splice(index, 1);
  renderEntries();
}


function addEntryFromForm() {
  const inputs = document.querySelectorAll("#numberInputs input");
  const nums = [...inputs].map(i => i.value).join("");
  const stake = document.getElementById("stakeInput")?.value;

  if (!nums || !stake) {
    alert("กรุณากรอกเลขและจำนวนเงินให้ครบ");
    return;
  }

  addEntry({
    digitCount: nums.length,
    numbers: nums,
    stake: Number(stake),
  });
}


  // --------- ส่งซื้อหวย ---------
  async function submitTicket() {
    try {
      ensureLoggedIn();

      if (!currentRoundId) {
        alert("ยังไม่มีงวดที่เปิดรับแทง");
        return;
      }

      if (!currentEntries.length) {
        alert("กรุณาเพิ่มเลขในตะกร้าก่อน");
        return;
      }

      const token = getToken();

      const body = {
        entries: currentEntries.map((e) => ({
          digitCount: e.digitCount,
          numbers: e.numbers,
          stake: e.stake,
        })),
      };

      const res = await fetch(
        `${API_BASE}/lottery/rounds/${encodeURIComponent(
          currentRoundId
        )}/tickets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        console.error("submitTicket error:", data);
        alert(data.error || data.message || "ไม่สามารถซื้อหวยได้");
        return;
      }

      alert("ซื้อหวยสำเร็จ!");
      currentEntries = [];
      renderEntries();
       await loadWallet();
      await loadMyTickets();
    } catch (err) {
      console.error("submitTicket error:", err);
      alert("เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ");
    }
  }

  // --------- โหลดบิลหวยของฉัน ---------
  async function loadMyTickets() {
    try {
      const token = getToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/lottery/tickets`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        console.error("loadMyTickets error:", data);
        return;
      }

      const all = data.tickets || [];

      const pending = all.filter((t) => t.status === "pending");
      const history = all.filter((t) => t.status !== "pending");

      renderTicketTable("ticketTablePendingBody", pending, false);
      renderTicketTable("ticketTableHistoryBody", history, true);
    } catch (err) {
      console.error("loadMyTickets error:", err);
    }
  }

  function renderTicketTable(tbodyId, tickets, showPayout) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!tickets.length) {
      const colSpan = showPayout ? 6 : 5;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="${colSpan}" class="text-center small">ยังไม่มีข้อมูล</td>`;
      tbody.appendChild(tr);
      return;
    }

    tickets.forEach((t) => {
      const tr = document.createElement("tr");

      const entriesText = (t.entries || [])
        .map(
          (e) =>
            `${e.numbers} (${e.digitCount} ตัว) × ${formatBaht(e.stake)}`
        )
        .join("<br>");

      const created = t.createdAt
        ? new Date(t.createdAt).toLocaleString("th-TH")
        : "-";

      const statusClass =
        t.status === "won"
          ? "status-won"
          : t.status === "lost"
          ? "status-lost"
          : "status-pending";

      const payoutText =
        typeof t.totalPayout === "number" ? formatBaht(t.totalPayout) : "-";

      if (showPayout) {
  tr.innerHTML = `
    <td class="small">${created}</td>
    <td>${t.roundId || "-"}</td>
    <td class="small">${entriesText}</td>
    <td class="text-right">${formatBaht(t.totalStake || 0)}</td>
    <td class="text-center">
      <span class="status-pill ${statusClass}">
        ${t.status || "-"}
      </span>
    </td>
    <td class="text-right">${payoutText}</td>
    <td class="text-center">
      <a href="/lottery/bill/${t.ticketId}">
        ดูบิล
      </a>
    </td>
  `;
    } else {
  tr.innerHTML = `
    <td class="small">${created}</td>
    <td>${t.roundId || "-"}</td>
    <td class="small">${entriesText}</td>
    <td class="text-right">${formatBaht(t.totalStake || 0)}</td>
    <td class="text-center">
      <span class="status-pill ${statusClass}">
        ${t.status || "-"}
      </span>
    </td>
    <td class="text-center">
      <a href="/lottery/bill/${t.ticketId}">
        ดูบิล
      </a>
    </td>
  `;
}


      tbody.appendChild(tr);
    });
  }

  // --------- tab สลับตาราง ---------
  function switchTab(which) {
    const pendingBox = document.getElementById("pendingBox");
    const historyBox = document.getElementById("historyBox");
    const tabPending = document.getElementById("tabPending");
    const tabHistory = document.getElementById("tabHistory");

    if (which === "pending") {
      pendingBox.style.display = "";
      historyBox.style.display = "none";
      tabPending.classList.add("active");
      tabHistory.classList.remove("active");
    } else {
      pendingBox.style.display = "none";
      historyBox.style.display = "";
      tabPending.classList.remove("active");
      tabHistory.classList.add("active");
    }
  }

  // --------- onload ---------
  document.addEventListener("DOMContentLoaded", async () => {
    ensureLoggedIn();
    renderEntries(); // แสดงข้อความ "ยังไม่มีเลขในตะกร้า"
    await loadWallet();
    await loadCurrentRound();
    await loadLastResult();
    await loadMyTickets();
  });

let nextDrawTimer = null; // ✅ เก็บ timer ไว้นอกฟังก์ชัน

function startNextDrawCountdown(drawAtISO) {
  const el = document.getElementById("nextDrawCountdown");
  if (!el || !drawAtISO) return;

  // 🔁 เคลียร์ timer เก่าก่อน
  if (nextDrawTimer) {
    clearInterval(nextDrawTimer);
    nextDrawTimer = null;
  }

  const target = new Date(drawAtISO).getTime();

  function tick() {
    const now = Date.now();
    let diff = Math.max(0, target - now);

    const h = Math.floor(diff / 3600000);
    diff %= 3600000;
    const m = Math.floor(diff / 60000);
    diff %= 60000;
    const s = Math.floor(diff / 1000);

    if (target - now <= 0) {
      el.textContent = "กำลังออกรางวัล";
      if (nextDrawTimer) {
        clearInterval(nextDrawTimer);
        nextDrawTimer = null;
      }
      return;
    }

    el.textContent =
      `${String(h).padStart(2,"0")}:` +
      `${String(m).padStart(2,"0")}:` +
      `${String(s).padStart(2,"0")}`;
  }

  tick();
  nextDrawTimer = setInterval(tick, 1000); // ✅ เก็บ timer ไว้
}



window.lottoClient = Object.assign(window.lottoClient || {}, {
  addEntry,
  removeEntry,
  addEntryFromForm,
  submitTicket,
  switchTab,
  loadCurrentRound, 
});

})();


