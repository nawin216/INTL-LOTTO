(() => {
  const token = localStorage.getItem("token");
  const ticketId = location.pathname.split("/").pop();
  const $ = (id) => document.getElementById(id);

  /* back */
  $("backBtn").onclick = () => {
  window.location.href = "/lottery";
};

  async function loadBill() {
    if (!token) return;

    const res = await fetch("/api/lottery/tickets", {
      headers:{ Authorization:`Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.ok) return;

    const ticket = data.tickets.find(t => t.ticketId === ticketId);
    if (!ticket) return;

    renderBill(ticket);
  }

  function renderBill(t){
    const stake = Number(t.totalStake||0);
    const payout = Number(t.totalPayout||0);
    const profit = payout - stake;

    const prize = $("prizeBox");
    const result = $("resultText");

    prize.className = "prize";

    if (t.status === "pending") {
      prize.classList.add("pending");
      prize.textContent = "-";
      result.textContent = "รอผลหวย";
    } else if (profit > 0) {
      prize.classList.add("win");
      prize.textContent = `+${profit.toLocaleString()} บาท`;
      result.textContent = "Congrats! You won!";
    } else {
      prize.classList.add("lose");
      prize.textContent = `-${stake.toLocaleString()} บาท`;
      result.textContent = "ไม่ถูกรางวัล";
    }

    $("orderTitle").textContent = `Order ${t.ticketId}`;
    $("orderDate").textContent = new Date(t.createdAt).toLocaleDateString("th-TH");
    $("ticketCount").textContent = t.entries.length;
    $("playCount").textContent = t.entries.length;
    $("totalStake").textContent = stake.toLocaleString();

    renderNumbers(t);
  }

  function renderNumbers(t){
    const box = $("winningNumbers");
    box.innerHTML = "";

    const winNums = (t.winningNumbers||[]).map(String);

    t.entries.forEach(e=>{
      const el = document.createElement("div");
      el.className = "ball";
      el.textContent = e.numbers;

      if (t.status === "pending") {
        el.classList.add("pending");
      } else if (winNums.includes(String(e.numbers))) {
        el.classList.add("win");
      } else {
        el.classList.add("lose");
      }

      box.appendChild(el);
    });

    if (!t.entries.length) box.innerHTML = "-";
  }

  loadBill();
})();
