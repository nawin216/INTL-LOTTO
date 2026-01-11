// public/js/state-poller.js
(() => {
  let lastState = {};

  async function pollState() {
    try {
      const res = await fetch("/api/state", {
        credentials: "include"
      });
      if (!res.ok) return;

      const state = await res.json();

      /* =====================
         💰 BALANCE
      ===================== */
      if (state.balance !== lastState.balance) {
        const el = document.getElementById("balanceText");
        if (el && typeof state.balance === "number") {
          el.textContent = state.balance.toLocaleString("th-TH");
        }
      }

      /* =====================
         🔔 NOTIFICATION DOT
      ===================== */
      if (state.hasNotification !== lastState.hasNotification) {
        const dot = document.getElementById("notif-dot");
        if (dot) {
          dot.classList.toggle("hidden", !state.hasNotification);
        }
      }

      /* =====================
         🎟 LAST RESULT (ถ้ามี)
      ===================== */
      if (
        state.lotteryResult &&
        state.lotteryResult !== lastState.lotteryResult
      ) {
        const el = document.getElementById("lastResultText");
        if (el) {
          el.textContent = state.lotteryResult;
        }
      }

      lastState = state;
    } catch (err) {
      console.error("state poll error:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    pollState();
    setInterval(pollState, 2000);
  });
})();
