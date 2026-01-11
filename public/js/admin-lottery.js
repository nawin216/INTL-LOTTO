const API = '/api/lottery';

/* =========================
 * Auth Header
 * ========================= */
function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };
}

/* =========================
 * Utils
 * ========================= */
function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function handleUnauthorized(res) {
  if (res.status === 401 || res.status === 403) {
    alert('สิทธิ์ไม่ถูกต้อง หรือ session หมดอายุ');
    localStorage.removeItem('token');
    location.href = '/';
    return true;
  }
  return false;
}

/* =========================
 * Init
 * ========================= */
document.addEventListener('DOMContentLoaded', () => {
  loadDailyRounds();
  loadPreGenerated();
});

/* =========================
 * Load Daily Rounds
 * ========================= */
async function loadDailyRounds() {
  const tbody = document.getElementById('dailyRounds');
  tbody.innerHTML = `<tr><td colspan="5">กำลังโหลด…</td></tr>`;

  try {
    const res = await fetch(`${API}/rounds`, {
      headers: authHeaders()
    });

    if (handleUnauthorized(res)) return;

    const data = await res.json();

    if (!data.ok || !Array.isArray(data.rounds) || data.rounds.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">ไม่มีงวด</td></tr>`;
      return;
    }

    tbody.innerHTML = '';

    data.rounds.forEach((r, i) => {
      tbody.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${r.roundId}</td>
          <td>${formatTime(r.drawAt)}</td>
          <td>${r.result8 || '-'}</td>
          <td>
            <span class="badge ${r.status}">
              ${r.status}
            </span>
          </td>
        </tr>
      `;
    });

  } catch (err) {
    console.error('loadDailyRounds error:', err);
    tbody.innerHTML = `<tr><td colspan="5">เกิดข้อผิดพลาด</td></tr>`;
  }
}

/* =========================
 * Load PreGenerated Numbers
 * ========================= */
async function loadPreGenerated() {
  const tbody = document.getElementById('preGenTable');
  tbody.innerHTML = `<tr><td colspan="5">กำลังโหลด…</td></tr>`;

  try {
    const res = await fetch(
      `${API}/admin/pre-generated?date=${today()}`,
      { headers: authHeaders() }
    );

    if (handleUnauthorized(res)) return;

    const data = await res.json();

    if (!data.ok || !Array.isArray(data.draws) || data.draws.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">ไม่มีข้อมูล</td></tr>`;
      return;
    }

    tbody.innerHTML = '';

    data.draws.forEach((d, i) => {
      tbody.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${d.date}</td>
          <td>${d.drawIndex}</td>
          <td>${d.number8}</td>
          <td>${d.status}</td>
        </tr>
      `;
    });

  } catch (err) {
    console.error('loadPreGenerated error:', err);
    tbody.innerHTML = `<tr><td colspan="5">เกิดข้อผิดพลาด</td></tr>`;
  }
}
