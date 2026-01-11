// public/js/admin-users/detail.js
import * as API from '/js/admin-users/api.js';
import * as SVC from '/js/admin-users/service.js';

let currentUser = null;

/* ---------- small UI helpers ---------- */
function $id(id) { return document.getElementById(id); }
function showToast(msg, type = 'info') {
  const el = $id('toast');
  if (!el) {
    console[type === 'error' ? 'error' : 'log'](msg);
    return;
  }
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}
function formatDate(d) { return d ? new Date(d).toLocaleString('th-TH') : '-'; }

/* ---------- url helper ---------- */
function getUserIdFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('userId');
  } catch (e) { return null; }
}

/* ---------- render user detail ---------- */
function renderUserDetail(user) {
  if (!user) return;
  currentUser = user;
  $id('detailEmail') && ($id('detailEmail').textContent = user.email || '-');
  $id('detailUid') && ($id('detailUid').textContent = user.uid || '-');
  $id('detailId') && ($id('detailId').textContent = user._id || '-');
  $id('detailCreatedAt') && ($id('detailCreatedAt').textContent = formatDate(user.createdAt));
  const bal = user.wallet?.balance ?? 0;
  $id('detailBalanceInput') && ($id('detailBalanceInput').value = bal);
  $id('detailTotalDeposits') && ($id('detailTotalDeposits').textContent = user.wallet?.totalDeposits ?? 0);
  $id('detailTotalWithdrawals') && ($id('detailTotalWithdrawals').textContent = user.wallet?.totalWithdrawals ?? 0);

  const dep = user.depositEnabled !== false;
  const wit = user.withdrawEnabled !== false;
  if ($id('flagDeposit')) $id('flagDeposit').checked = dep;
  if ($id('flagWithdraw')) $id('flagWithdraw').checked = wit;
  if ($id('textDepositFlag')) $id('textDepositFlag').textContent = dep ? 'อนุญาตให้ฝาก' : 'ห้ามฝาก';
  if ($id('textWithdrawFlag')) $id('textWithdrawFlag').textContent = wit ? 'อนุญาตให้ถอน' : 'ห้ามถอน';

  if ($id('userDepositsUserLabel')) $id('userDepositsUserLabel').textContent = user.email || user.uid || user._id;
  if ($id('userWithdrawUserLabel')) $id('userWithdrawUserLabel').textContent = user.email || user.uid || user._id;
}

/* -------- load functions (deposits/withdrawals/tx/tickets/payouts) ---------- */

async function loadUserDepositsForAdmin() {
  const tbody = $id('admin-user-deposits-body');
  if (!tbody) return;
  if (!currentUser) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">ยังไม่ได้เลือกผู้ใช้</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" class="muted">กำลังโหลด...</td></tr>';

  try {
    const data = await API.loadDeposits(currentUser._id);
    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">ยังไม่มีคำขอฝากเงิน</td></tr>';
      return;
    }

    tbody.innerHTML = '';

    data.forEach(dep => {
      const createdAt = dep.createdAt ? formatDate(dep.createdAt) : '-';
      const status = (dep.status || '').toString().toLowerCase();

      let statusClass = 'status-pending';
      let statusLabel = 'รออนุมัติ';

      if (status === 'approved' || status === 'approved_by_admin' || dep.approved || dep.isApproved) {
        statusClass = 'status-approved';
        statusLabel = 'สำเร็จ';
      } else if (status === 'rejected' || dep.rejected || dep.isRejected) {
        statusClass = 'status-rejected';
        statusLabel = 'ปฏิเสธ';
      }

      const actionHtml =
        statusClass !== 'status-pending'
          ? `<span class="muted">${statusClass === 'status-approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}</span>`
          : `
            <button class="btn-xs btn-success" onclick="confirmDeposit('${dep._id}','approve')">อนุมัติ</button>
            <button class="btn-xs btn-danger-strong" onclick="confirmDeposit('${dep._id}','reject')">ปฏิเสธ</button>
          `;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${createdAt}</td>
        <td>${dep.amount}</td>
        <td class="status-text ${statusClass}">${statusLabel}</td>
        <td><a href="${dep.slipUrl || '#'}" target="_blank">ดูสลิป</a></td>
        <td>${dep.note || ''}</td>
        <td>${actionHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="6" class="muted">โหลดไม่สำเร็จ</td></tr>';
  }
}

async function loadUserWithdrawalsForAdmin() {
  const tbody = $id('admin-user-withdrawals-body');
  if (!tbody) return;
  if (!currentUser) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">ยังไม่ได้เลือกผู้ใช้</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="7" class="muted">กำลังโหลด...</td></tr>';

  try {
    const data = await API.loadWithdrawals(currentUser._id);
    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">ยังไม่มีคำขอถอนเงิน</td></tr>';
      return;
    }

    tbody.innerHTML = '';

    data.forEach(w => {
      const createdAt = w.createdAt ? formatDate(w.createdAt) : '-';
      const status = (w.status || '').toString().toLowerCase();

      let statusClass = 'status-pending';
      let statusLabel = 'รออนุมัติ';

      if (status === 'approved' || w.approved || w.isApproved) {
        statusClass = 'status-approved';
        statusLabel = 'สำเร็จ';
      } else if (status === 'rejected' || w.rejected || w.isRejected) {
        statusClass = 'status-rejected';
        statusLabel = 'ปฏิเสธ';
      }

      const actionHtml =
        statusClass !== 'status-pending'
          ? `<span class="muted">${statusClass === 'status-approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}</span>`
          : `
            <button class="btn-xs btn-success" onclick="confirmWithdrawal('${w._id}','approve')">อนุมัติ</button>
            <button class="btn-xs btn-danger-strong" onclick="confirmWithdrawal('${w._id}','reject')">ปฏิเสธ</button>
          `;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${createdAt}</td>
        <td>${w.amount}</td>
        <td class="status-text ${statusClass}">${statusLabel}</td>
        <td>${w.network || ''}</td>
        <td class="mono">${w.walletAddress || ''}</td>
        <td>${w.note || ''}</td>
        <td>${actionHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" class="muted">โหลดไม่สำเร็จ</td></tr>';
  }
}


async function loadTransactions() {
  const box = $id('txBox');
  if (!box) return;
  if (!currentUser) { box.innerHTML = '<div class="muted">ยังไม่ได้เลือกผู้ใช้</div>'; return; }
  box.innerHTML = '<div class="muted">กำลังโหลด.</div>';
  try {
    const data = await API.userTransactions(currentUser._id);
    const txs = Array.isArray(data) ? data : (data && (data.transactions || data.data || [])) || [];
    if (!txs.length) { box.innerHTML = '<div class="muted">ยังไม่มีประวัติธุรกรรม</div>'; return; }
    box.innerHTML = '';
    txs.forEach(t => {
      const created = t.createdAt ? formatDate(t.createdAt) : '-';
      const div = document.createElement('div'); div.className = 'mb-1';
      div.innerHTML = `<div class="mono">${t.type} · ${t.amount ?? 0} ฿</div><div class="muted text-xs">${created} · สถานะ: ${t.status || '-'}</div>`;
      box.appendChild(div);
    });
  } catch (err) { console.error(err); box.innerHTML = '<div class="muted">เกิดข้อผิดพลาดจากเซิร์ฟเวอร์</div>'; }
}

async function loadTickets() {
  const box = $id('ticketBox');
  if (!box) return;
  if (!currentUser) { box.innerHTML = '<div class="muted">ยังไม่ได้เลือกผู้ใช้</div>'; return; }
  box.innerHTML = '<div class="muted">กำลังโหลด.</div>';
  try {
    const data = await API.userTickets(currentUser._id);
    const tickets = Array.isArray(data) ? data : (data && (data.tickets || data.data || [])) || [];
    if (!tickets.length) { box.innerHTML = '<div class="muted">ยังไม่มีบิลหวย</div>'; return; }
    box.innerHTML = '';
    tickets.forEach(t => {
      const created = t.createdAt ? formatDate(t.createdAt) : '-';
      const nums = (t.entries||[]).map(e => `${e.digitCount} ตัว: ${e.numbers} (${e.stake} ฿)`).join('<br>');
      const div = document.createElement('div'); div.className = 'mb-1';
      div.innerHTML = `<div class="mono">งวด ${t.roundId||'-'} · สถานะ: ${t.status||'-'}</div><div class="muted text-xs">${created}</div><div class="muted text-xs">ยอดแทง: ${t.totalStake ?? 0} ฿ · จ่ายแล้ว: ${t.totalPayout ?? 0} ฿</div><div class="muted text-xs mt-1">${nums}</div>`;
      box.appendChild(div);
    });
  } catch (err) { console.error(err); box.innerHTML = '<div class="muted">เกิดข้อผิดพลาดจากเซิร์ฟเวอร์</div>'; }
}

async function loadPayoutsForAdmin() {
  const info = $id('payoutInfoText');
  if (!currentUser || !info) return;
  info.textContent = 'กำลังโหลด % .';
  try {
    const data = await API.getPayouts(currentUser._id);
    if (!data) { info.textContent = 'โหลด % ไม่สำเร็จ'; return; }
    const percents = data.percents || data || {};
    const p2 = $id('payout2Input'); if (p2) p2.value = percents?.p2 ?? '';
    const p3 = $id('payout3Input'); if (p3) p3.value = percents?.p3 ?? '';
    const p4 = $id('payout4Input'); if (p4) p4.value = percents?.p4 ?? '';
    const p8 = $id('payout8Input'); if (p8) p8.value = percents?.p8 ?? '';
    info.textContent = 'โหลด % สำเร็จ';
  } catch (err) { console.error(err); info.textContent = 'เกิดข้อผิดพลาด'; }
}

/* ---------- actions: balance/topup/flags/payouts/notification ---------- */
async function saveBalance() {
  if (!currentUser) { showToast('กรุณาโหลดผู้ใช้ก่อน','error'); return; }
  const el = $id('detailBalanceInput');
  if (!el) return;
  const val = Number(el.value);
  if (isNaN(val) || val < 0) { showToast('ยอดต้องเป็นตัวเลข >= 0','error'); return; }
  if (!confirm(`ยืนยันเปลี่ยนยอดเงินของผู้ใช้เป็น ${val} บาท ?`)) return;
  try {
    const data = await API.patchBalance(currentUser._id, val);
    if (!data || (typeof data === 'object' && data.ok === false)) { showToast(data?.error || 'บันทึกยอดเงินไม่สำเร็จ','error'); return; }
    showToast('บันทึกยอดเงินสำเร็จ','success');
    // update local view
    currentUser.wallet = currentUser.wallet || {}; currentUser.wallet.balance = val;
    $id('detailBalanceInput').value = val;
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

async function topupBalance() {
  if (!currentUser) { showToast('กรุณาโหลดผู้ใช้ก่อน','error'); return; }
  const el = $id('detailTopupInput');
  if (!el) return;
  const val = Number(el.value);
  if (isNaN(val) || val <= 0) { showToast('จำนวนต้องมากกว่า 0','error'); return; }
  if (!confirm(`ยืนยันเติมเงิน +${val} บาท ให้ผู้ใช้ ?`)) return;
  try {
    const currentBal = Number(currentUser.wallet?.balance || 0);
    const newBalance = currentBal + val;
    const data = await API.topupBalance(currentUser._id, newBalance);
    // accept different response shapes
    const updatedBalance = (data && (data.newBalance ?? data.balance)) ?? newBalance;
    currentUser.wallet = currentUser.wallet || {}; currentUser.wallet.balance = updatedBalance;
    $id('detailBalanceInput').value = updatedBalance;
    el.value = '';
    showToast('เติมเงินสำเร็จ','success');
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

async function saveFlags() {
  if (!currentUser) { showToast('กรุณาโหลดผู้ใช้ก่อน','error'); return; }
  const depositEnabled = $id('flagDeposit') ? $id('flagDeposit').checked : true;
  const withdrawEnabled = $id('flagWithdraw') ? $id('flagWithdraw').checked : true;
  try {
    const data = await API.patchFlags(currentUser._id, { depositEnabled, withdrawEnabled });
    if (!data || (typeof data === 'object' && data.ok === false)) { showToast(data?.error || 'บันทึกสถานะไม่สำเร็จ','error'); return; }
    $id('textDepositFlag') && ($id('textDepositFlag').textContent = depositEnabled ? 'อนุญาตให้ฝาก' : 'ห้ามฝาก');
    $id('textWithdrawFlag') && ($id('textWithdrawFlag').textContent = withdrawEnabled ? 'อนุญาตให้ถอน' : 'ห้ามถอน');
    showToast('บันทึกสถานะฝาก/ถอน สำเร็จ','success');
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

async function savePayouts() {
  if (!currentUser) { showToast('กรุณาโหลดผู้ใช้ก่อน','error'); return; }
  const percents = {
    p2: Number($id('payout2Input')?.value) || null,
    p3: Number($id('payout3Input')?.value) || null,
    p4: Number($id('payout4Input')?.value) || null,
    p8: Number($id('payout8Input')?.value) || null,
  };
  try {
    const data = await API.patchPayouts(currentUser._id, percents);
    if (!data || (typeof data === 'object' && data.ok === false)) { showToast(data?.error || 'บันทึก % ไม่สำเร็จ','error'); return; }
    showToast('บันทึก % การจ่ายสำเร็จ','success');
    await loadPayoutsForAdmin();
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

function clearNotifForm() {
  if ($id('notifTypeInput')) $id('notifTypeInput').value = 'system';
  if ($id('notifTitleInput')) $id('notifTitleInput').value = '';
  if ($id('notifLinkInput')) $id('notifLinkInput').value = '';
  if ($id('notifMessageInput')) $id('notifMessageInput').value = '';
}

// client-side: sendNotificationToUser (replace existing)
let _sendingNotification = false;

async function sendNotificationToUser() {
  if (_sendingNotification) return;
  if (!currentUser || !currentUser._id) { showToast('กรุณาเลือก/โหลดผู้ใช้ก่อน','error'); return; }

  // ตรวจ token ใน localStorage
  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
  if (!token) {
    showToast('ไม่มีสิทธิ์ (ไม่พบ admin token) — กรุณาเข้าสู่ระบบใหม่', 'error');
    console.warn('sendNotification blocked: missing adminToken in localStorage');
    return;
  }

  const type = document.getElementById('notifTypeInput')?.value || 'system';
  const title = (document.getElementById('notifTitleInput')?.value || '').trim();
  const message = (document.getElementById('notifMessageInput')?.value || '').trim();
  const link = (document.getElementById('notifLinkInput')?.value || '').trim() || null;

  if (!title || !message) { showToast('กรุณากรอกหัวข้อและข้อความ', 'error'); return; }

  const payload = { userId: currentUser._id, type, title, message, link };

  _sendingNotification = true;
  const btn = document.getElementById('sendNotifBtn');
  if (btn) { btn.disabled = true; btn.classList.add('opacity-50'); }

  try {
    // ใช้ API helper ถ้ามี (api.js) — ถ้าไม่มี ให้ใช้ fetch ที่ใส่ Authorization header
    let res;
    if (typeof API !== 'undefined' && API.sendNotification) {
      res = await API.sendNotification(payload);
    } else {
      const r = await fetch('/api/notifications/admin-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(payload),
      });
      res = await r.json().catch(()=>({ ok:false, message: 'invalid server response' }));
    }

    console.log('sendNotification response:', res);

    if (!res || res.ok === false) {
      showToast(res?.message || res?.error || 'sendNotification failed', 'error');
      return;
    }

    showToast(res.message || 'ส่งการแจ้งเตือนสำเร็จ', 'success');

    // reset form
    const t = document.getElementById('notifTitleInput'); if (t) t.value = '';
    const m = document.getElementById('notifMessageInput'); if (m) m.value = '';
    const l = document.getElementById('notifLinkInput'); if (l) l.value = '';
    const ty = document.getElementById('notifTypeInput'); if (ty) ty.value = 'system';
  } catch (err) {
    console.error('sendNotification failed ►', err);
    showToast('เกิดข้อผิดพลาดขณะส่ง (ดูคอนโซล)', 'error');
  } finally {
    _sendingNotification = false;
    if (btn) { btn.disabled = false; btn.classList.remove('opacity-50'); }
  }
}


// attach listener (เรียกครั้งเดียว)
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('sendNotifBtn');
  if (btn) {
    btn.removeEventListener('click', sendNotificationToUser);
    btn.addEventListener('click', sendNotificationToUser);
  }
});


/* ---------- confirm handlers (exposed for inline onclick) ---------- */
async function confirmDeposit(depositId, action) {
  if (!currentUser) { showToast('โหลดผู้ใช้ก่อน','error'); return; }
  if (!depositId) return;
  const isApprove = action === 'approve';
  const msg = isApprove ? 'ยืนยันการอนุมัติคำขอฝากเงินนี้หรือไม่? ระบบจะเพิ่มยอดเข้ากระเป๋าผู้ใช้โดยอัตโนมัติ' : 'ยืนยันการปฏิเสธคำขอฝากเงินนี้หรือไม่?';
  if (!confirm(msg)) return;
  const adminNote = prompt('หมายเหตุ (ใส่หรือไม่ใส่ก็ได้):', '') || '';
  try {
    const data = await API.confirmDeposit(depositId, action, adminNote);
    const ok = (data && (data.ok === true || data.success === true || data.status === 'success')) || false;
    if (!ok) { showToast(data?.message || 'อัปเดตสถานะไม่สำเร็จ','error'); console.error('confirmDeposit failed', data); return; }
    showToast(data.message || 'อัปเดตสถานะเรียบร้อย','success');
    await loadUserDepositsForAdmin();
    await loadUserWithdrawalsForAdmin();
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

async function confirmWithdrawal(withdrawalId, action) {
  if (!currentUser) { showToast('โหลดผู้ใช้ก่อน','error'); return; }
  if (!withdrawalId) return;
  const isApprove = action === 'approve';
  const msg = isApprove ? 'ยืนยันการอนุมัติคำขอถอนเงินนี้หรือไม่? ระบบจะตัดยอดจากกระเป๋าผู้ใช้อัตโนมัติ' : 'ยืนยันการปฏิเสธคำขอถอนเงินนี้หรือไม่?';
  if (!confirm(msg)) return;
  const adminNote = prompt('หมายเหตุ (ใส่หรือไม่ใส่ก็ได้):', '') || '';
  try {
    const data = await API.confirmWithdrawal(withdrawalId, action, adminNote);
    const ok = (data && (data.ok === true || data.success === true || data.status === 'success')) || false;
    if (!ok) { showToast(data?.message || 'อัปเดตสถานะไม่สำเร็จ','error'); console.error('confirmWithdrawal failed', data); return; }
    showToast(data.message || 'อัปเดตสถานะเรียบร้อย','success');
    await loadUserWithdrawalsForAdmin();
    await loadUserDepositsForAdmin();
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

/* ---------- expose globals (for inline onclick in markup) ---------- */
window.confirmDeposit = confirmDeposit;
window.confirmWithdrawal = confirmWithdrawal;
window.savePayouts = savePayouts;
window.saveBalance = saveBalance;
window.topupBalance = topupBalance;
window.saveFlags = saveFlags;
window.sendNotificationToUser = sendNotificationToUser;
window.loadPayouts = loadPayoutsForAdmin;
window.loadUserDeposits = loadUserDepositsForAdmin;
window.loadUserWithdrawals = loadUserWithdrawalsForAdmin;
window.loadTransactions = loadTransactions;
window.loadTickets = loadTickets;

/* ---------- attach events on page ---------- */
function attachDetailUi() {
  $id('saveBalanceBtn') && $id('saveBalanceBtn').addEventListener('click', saveBalance);
  $id('topupBtn') && $id('topupBtn').addEventListener('click', topupBalance);
  $id('saveFlagsBtn') && $id('saveFlagsBtn').addEventListener('click', saveFlags);
  $id('savePayoutsBtn') && $id('savePayoutsBtn').addEventListener('click', savePayouts);
  $id('sendNotifBtn') && $id('sendNotifBtn').addEventListener('click', sendNotificationToUser);
  $id('clearNotifBtn') && $id('clearNotifBtn').addEventListener('click', clearNotifForm);
  $id('loadTxBtn') && $id('loadTxBtn').addEventListener('click', loadTransactions);
  $id('loadTicketsBtn') && $id('loadTicketsBtn').addEventListener('click', loadTickets);
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  attachDetailUi();
  const userId = getUserIdFromUrl();
  if (!userId) {
    showToast('ไม่พบ userId ใน URL', 'error');
    return;
  }

  try {
    const res = await API.loadUserById(userId);
    let user = null;
    if (!res) { showToast('โหลดข้อมูลไม่สำเร็จ', 'error'); return; }
    // res may be { ok:true, user: {...} } or direct user
    if (res.user) user = res.user;
    else if (res.ok && (res.user || res.data)) user = res.user || res.data;
    else if (res._id) user = res;
    if (!user) { showToast('ไม่พบผู้ใช้', 'error'); return; }

    renderUserDetail(user);
    await loadPayoutsForAdmin();
    await loadUserDepositsForAdmin();
    await loadUserWithdrawalsForAdmin();
    // do not auto-load transactions/tickets to save time; user can click buttons
  } catch (err) {
    console.error(err); showToast('เกิดข้อผิดพลาดขณะโหลดข้อมูล', 'error');
  }
});
