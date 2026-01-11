// public/js/admin-users/ui.js
import * as API from '/js/admin-users/api.js';
import * as SVC from '/js/admin-users/service.js';

let allUsers = [];
let filteredUsers = [];
let currentUser = null;
let quickFilterMode = 'all';
let sortField = 'createdAt';
let sortDir = 'desc';

function getToken() {
  const t =
    localStorage.getItem('adminToken') ||
    localStorage.getItem('token');

  // ป้องกัน token ว่าง / string แปลก
  if (!t || typeof t !== 'string' || t.length < 20) {
    return null;
  }
  return t;
}
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) {
    console[type === 'error' ? 'error' : 'log'](msg);
    return;
  }
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

/* ---------- HELPERS ---------- */
function normalizeOk(resp) {
  // resp might be: { ok: true, body: ... }, or raw body object with ok/success, or boolean true
  if (resp == null) return false;
  if (typeof resp === 'boolean') return resp === true;
  if (typeof resp === 'object') {
    if ('ok' in resp) return !!resp.ok;
    if ('success' in resp) return !!resp.success;
    if ('status' in resp && (resp.status === 'success' || resp.status === 'ok')) return true;
    if (resp.body && (resp.body.ok || resp.body.success || resp.body.status === 'success')) return true;
    // fallback: HTTP-level status might be in resp.status numeric when we normalized earlier — treat 200-299 as ok
    if (typeof resp.status === 'number') return resp.status >= 200 && resp.status < 300;
  }
  return false;
}
function extractMessage(resp) {
  if (!resp) return null;
  if (typeof resp === 'string') return resp;
  if (typeof resp === 'object') {
    return resp.body?.message || resp.message || resp.error || (resp.body && JSON.stringify(resp.body)) || null;
  }
  return null;
}

/* ---------- RENDER TABLE ---------- */
function renderUsersTable() {
  const tbody = document.getElementById('usersTbody');
  const summary = document.getElementById('usersSummary');
  const sortSelect = document.getElementById('sortSelect');
  const sortSelectVal = sortSelect ? sortSelect.value : '';
  let field = sortField, dir = sortDir;
  if (sortSelectVal === 'created_desc') { field='createdAt'; dir='desc'; }
  if (sortSelectVal === 'created_asc')  { field='createdAt'; dir='asc'; }
  if (sortSelectVal === 'balance_desc') { field='balance'; dir='desc'; }
  if (sortSelectVal === 'balance_asc')  { field='balance'; dir='asc'; }

  const users = SVC.sortUsers(filteredUsers, { field, dir });

  if (summary) summary.textContent = users.length ? `พบผู้ใช้ ${users.length} คน` : 'ไม่พบผู้ใช้';
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  users.forEach(u => {
    const bal = (u.wallet && u.wallet.balance) || 0;
    const createdAt = u.createdAt ? new Date(u.createdAt).toLocaleString('th-TH') : '-';
    const dep = u.depositEnabled !== false;
    const wit = u.withdrawEnabled !== false;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${u.uid || '-'}</td>
      <td>${u.email || '-'}</td>
      <td class="mono">${bal}</td>
      <td>
        <span class="status-pill ${dep ? 'good' : 'bad'}">
          <i class="fa-solid ${dep ? 'fa-check' : 'fa-ban'}"></i>
          ${dep ? 'เปิด' : 'ปิด'}
        </span>
      </td>
      <td>
        <span class="status-pill ${wit ? 'good' : 'bad'}">
          <i class="fa-solid ${wit ? 'fa-check' : 'fa-ban'}"></i>
          ${wit ? 'เปิด' : 'ปิด'}
        </span>
      </td>
      <td>${createdAt}</td>
      <td>
        <a class="btn-manage" href="/admin-user-detail?userId=${u._id}">จัดการ</a>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // attach listeners for select buttons
  tbody.querySelectorAll('.select-user-btn').forEach(btn => {
    btn.removeEventListener('click', __selectBtnHandler);
    btn.addEventListener('click', __selectBtnHandler);
  });
}
function __selectBtnHandler(e) { selectUser(e.currentTarget.dataset.id); }

/* ---------- FILTER / SORT ---------- */
function applyFilters() {
  const q = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';
  const statusFilter = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : '';
  filteredUsers = SVC.filterUsers(allUsers, { q, statusFilter, quickFilterMode });
  renderUsersTable();
}

/* ---------- LOADS ---------- */
export async function initUsersPage() {
  if (!getToken()) {
  console.warn('No token, redirect to login');
  window.location.href = '/index.html';
  return;
}
  await loadUsers();
  attachUiEvents();
}

async function loadUsers() {
  const tbody = document.getElementById('usersTbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="muted">กำลังโหลด.</td></tr>`;
  try {
    const data = await API.loadUsers();
    // support: API may return array, or { users: [...] }, or { ok: true, users: [...] }
    if (!data) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="muted">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
      return;
    }
    if (Array.isArray(data)) allUsers = data;
    else if (Array.isArray(data.users)) allUsers = data.users;
    else if (Array.isArray(data.data)) allUsers = data.data;
    else if (data.ok && Array.isArray(data.users)) allUsers = data.users;
    else {
      // try to discover first array field
      const arr = Object.keys(data).map(k=>data[k]).find(v=>Array.isArray(v));
      allUsers = Array.isArray(arr) ? arr : [];
    }
    applyFilters();
  } catch (err) {
    console.error(err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="muted">เกิดข้อผิดพลาดจากเซิร์ฟเวอร์</td></tr>`;
  }
}

/* ---------- SELECT USER & DETAIL ---------- */
function findUser(id) { return SVC.findUserById(allUsers, id); }

async function selectUser(id) {
  const u = findUser(id);
  if (!u) { showToast('ไม่พบผู้ใช้','error'); return; }
  currentUser = u;
  const emptyEl = document.getElementById('userDetailEmpty'); if (emptyEl) emptyEl.style.display = 'none';
  const panel = document.getElementById('userDetailPanel'); if (panel) panel.style.display = 'block';

  const wallet = u.wallet || {};
  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText('detailEmail', u.email || '-');
  setText('detailUid', u.uid || '-');
  setText('detailId', u._id || '-');
  setText('detailCreatedAt', u.createdAt ? new Date(u.createdAt).toLocaleString('th-TH') : '-');
  setText('detailTotalDeposits', wallet.totalDeposits ?? 0);
  setText('detailTotalWithdrawals', wallet.totalWithdrawals ?? 0);
  const balInput = document.getElementById('detailBalanceInput'); if (balInput) balInput.value = wallet.balance ?? 0;

  const dep = u.depositEnabled !== false, wit = u.withdrawEnabled !== false;
  const flagDeposit = document.getElementById('flagDeposit'); if (flagDeposit) flagDeposit.checked = dep;
  const flagWithdraw = document.getElementById('flagWithdraw'); if (flagWithdraw) flagWithdraw.checked = wit;
  setText('textDepositFlag', dep ? 'อนุญาตให้ฝาก' : 'ห้ามฝาก');
  setText('textWithdrawFlag', wit ? 'อนุญาตให้ถอน' : 'ห้ามถอน');

  const setUserLabel = id => { const e = document.getElementById(id); if (e) e.textContent = u.email || u.uid || u._id; };
  setUserLabel('userDepositsUserLabel');
  setUserLabel('userWithdrawUserLabel');

  clearNotifForm();
  await loadPayoutsForAdmin();
  await loadUserDepositsForAdmin();
  await loadUserWithdrawalsForAdmin();
}

/* ---------- BALANCE / TOPUP / FLAGS ---------- */
async function saveBalance() {
  if (!currentUser) { showToast('กรุณาเลือกผู้ใช้ก่อน','error'); return; }
  const val = parseFloat(document.getElementById('detailBalanceInput').value);
  if (isNaN(val) || val < 0) { showToast('ยอดต้องเป็นตัวเลข >= 0','error'); return; }
  if (!confirm(`ยืนยันเปลี่ยนยอดเงินของผู้ใช้เป็น ${val} บาท ?`)) return;
  try {
    const data = await API.patchBalance(currentUser._id, val);
    if (!data || (typeof data === 'object' && data.ok === false && !Array.isArray(data))) { showToast(data?.error || 'บันทึกยอดเงินไม่สำเร็จ','error'); return; }
    SVC.updateLocalBalance(allUsers, currentUser._id, val);
    currentUser.wallet = currentUser.wallet || {}; currentUser.wallet.balance = val;
    applyFilters();
    showToast('บันทึกยอดเงินสำเร็จ','success');
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

async function topupBalance() {
  if (!currentUser) { showToast('กรุณาเลือกผู้ใช้ก่อน','error'); return; }
  const val = parseFloat(document.getElementById('detailTopupInput').value);
  if (isNaN(val) || val <= 0) { showToast('จำนวนต้องมากกว่า 0','error'); return; }
  if (!confirm(`ยืนยันเติมเงิน +${val} บาท ให้ผู้ใช้ ?`)) return;
  try {
    const currentBal = Number(currentUser.wallet?.balance || 0);
    const newBalance = currentBal + val;
    const data = await API.topupBalance(currentUser._id, newBalance);
    // accept either { newBalance } or { ok:true, newBalance:.. } or raw number
    let updatedBalance = null;
    if (data == null) { showToast('เติมเงินไม่สำเร็จ','error'); return; }
    if (typeof data === 'number') updatedBalance = data;
    else if (data.newBalance != null) updatedBalance = data.newBalance;
    else if (data.balance != null) updatedBalance = data.balance;
    else if (data.ok && data.body && data.body.newBalance != null) updatedBalance = data.body.newBalance;
    else updatedBalance = newBalance;

    SVC.updateLocalBalance(allUsers, currentUser._id, updatedBalance);
    currentUser.wallet = currentUser.wallet || {}; currentUser.wallet.balance = updatedBalance;
    const bi = document.getElementById('detailBalanceInput'); if (bi) bi.value = updatedBalance;
    const ti = document.getElementById('detailTopupInput'); if (ti) ti.value = '';
    applyFilters();
    showToast('เติมเงินสำเร็จ','success');
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

async function saveFlags() {
  if (!currentUser) { showToast('กรุณาเลือกผู้ใช้ก่อน','error'); return; }
  const depositEnabled = document.getElementById('flagDeposit').checked;
  const withdrawEnabled = document.getElementById('flagWithdraw').checked;
  try {
    const data = await API.patchFlags(currentUser._id, { depositEnabled, withdrawEnabled });
    if (!data || (typeof data === 'object' && data.ok === false)) { showToast(data?.error || 'บันทึกสถานะไม่สำเร็จ','error'); return; }
    SVC.updateLocalFlags(allUsers, currentUser._id, { depositEnabled, withdrawEnabled });
    document.getElementById('textDepositFlag').textContent = depositEnabled ? 'อนุญาตให้ฝาก' : 'ห้ามฝาก';
    document.getElementById('textWithdrawFlag').textContent = withdrawEnabled ? 'อนุญาตให้ถอน' : 'ห้ามถอน';
    applyFilters();
    showToast('บันทึกสถานะฝาก/ถอน สำเร็จ','success');
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

/* ---------- DEPOSITS / WITHDRAWALS ---------- */

async function confirmDeposit(depositId, action) {
  if (!currentUser) { showToast('กรุณาเลือกผู้ใช้ก่อน','error'); return; }
  if (!depositId) { console.error('confirmDeposit called without id'); return; }
  const isApprove = action === 'approve';
  const msg = isApprove ? 'ยืนยันการอนุมัติคำขอฝากเงินนี้หรือไม่?' : 'ยืนยันการปฏิเสธคำขอฝากเงินนี้หรือไม่?';
  if (!confirm(msg)) return;
  try {
    const resp = await API.confirmDeposit(depositId, action, '');
    const ok = normalizeOk(resp);
    if (!ok) {
      console.error('confirmDeposit failed', resp);
      showToast(extractMessage(resp) || 'อัปเดตสถานะไม่สำเร็จ','error');
      return;
    }
    showToast(extractMessage(resp) || 'อัปเดตสถานะเรียบร้อย','success');
    await loadUserDepositsForAdmin();
    await loadUsers();
    if (currentUser) selectUser(currentUser._id);
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาดในการอัปเดตสถานะคำขอฝาก (ดูคอนโซล)','error'); }
}

async function confirmWithdrawal(withdrawalId, action) {
  if (!currentUser) { showToast('กรุณาเลือกผู้ใช้ก่อน','error'); return; }
  if (!withdrawalId) { console.error('confirmWithdrawal called without id'); return; }
  const isApprove = action === 'approve';
  const msg = isApprove ? 'ยืนยันการอนุมัติคำขอถอนเงินนี้หรือไม่?' : 'ยืนยันการปฏิเสธคำขอถอนเงินนี้หรือไม่?';
  if (!confirm(msg)) return;
  try {
    const resp = await API.confirmWithdrawal(withdrawalId, action, '');
    const ok = normalizeOk(resp);
    if (!ok) {
      console.error('confirmWithdrawal failed', resp);
      showToast(extractMessage(resp) || 'อัปเดตสถานะไม่สำเร็จ','error');
      return;
    }
    showToast(extractMessage(resp) || 'อัปเดตสถานะเรียบร้อย','success');
    await loadUserWithdrawalsForAdmin();
    await loadUsers();
    if (currentUser) selectUser(currentUser._id);
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาดในการอัปเดตสถานะการถอน (ดูคอนโซล)','error'); }
}

async function loadUserDepositsForAdmin() {
  const tbody = document.getElementById('admin-user-deposits-body');
  if (!tbody) return;
  if (!currentUser) { tbody.innerHTML = '<tr><td colspan="6" class="muted">ยังไม่ได้เลือกผู้ใช้</td></tr>'; return; }
  tbody.innerHTML = '<tr><td colspan="6" class="muted">กำลังโหลด.</td></tr>';
  try {
    const data = await API.loadDeposits(currentUser._id);
    if (!Array.isArray(data) || data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="muted">ยังไม่มีคำขอฝากเงิน</td></tr>'; return; }
    tbody.innerHTML = '';
    data.forEach(dep => {
      const createdAt = dep.createdAt ? new Date(dep.createdAt).toLocaleString('th-TH') : '-';
      const status = (dep.status || '').toString().toLowerCase();
      const isApproved = status === 'approved' || status === 'approved_by_admin' || dep.approved === true || dep.isApproved === true;
      const isRejected = status === 'rejected' || dep.rejected === true || dep.isRejected === true;
      const actionHtml = (isApproved || isRejected)
        ? `<span class="muted">${isApproved ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}</span>`
        : `<button class="btn-xs btn-xs-primary" onclick="confirmDeposit('${dep._id}', 'approve')">อนุมัติ</button>
           <button class="btn-xs btn-xs-danger" onclick="confirmDeposit('${dep._id}', 'reject')">ปฏิเสธ</button>`;
      const statusText = dep.status || (isApproved ? 'approved' : '');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${createdAt}</td><td>${dep.amount}</td><td>${statusText}</td><td><a href="${dep.slipUrl || '#'}" target="_blank">ดูสลิป</a></td><td>${dep.note || ''}</td><td>${actionHtml}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); tbody.innerHTML = '<tr><td colspan="6" class="muted">โหลดไม่สำเร็จ</td></tr>'; }
}

async function loadUserWithdrawalsForAdmin() {
  const tbody = document.getElementById('admin-user-withdrawals-body');
  if (!tbody) return;
  if (!currentUser) { tbody.innerHTML = '<tr><td colspan="7" class="muted">ยังไม่ได้เลือกผู้ใช้</td></tr>'; return; }
  tbody.innerHTML = '<tr><td colspan="7" class="muted">กำลังโหลด.</td></tr>';
  try {
    const data = await API.loadWithdrawals(currentUser._id);
    if (!Array.isArray(data) || data.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="muted">ยังไม่มีคำขอถอนเงิน</td></tr>'; return; }
    tbody.innerHTML = '';
    data.forEach(w => {
      const createdAt = w.createdAt ? new Date(w.createdAt).toLocaleString('th-TH') : '-';
      const status = (w.status || '').toString().toLowerCase();
      const isApproved = status === 'approved' || w.approved === true || w.isApproved === true;
      const isRejected = status === 'rejected' || w.rejected === true || w.isRejected === true;
      const actionHtml = (isApproved || isRejected)
        ? `<span class="muted">${isApproved ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว'}</span>`
        : `<button class="btn-xs btn-xs-primary" onclick="confirmWithdrawal('${w._id}', 'approve')">อนุมัติ</button>
           <button class="btn-xs btn-xs-danger" onclick="confirmWithdrawal('${w._id}', 'reject')">ปฏิเสธ</button>`;
      const statusText = w.status || (isApproved ? 'approved' : '');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${createdAt}</td><td>${w.amount}</td><td>${statusText}</td><td>${w.network || ''}</td><td class="mono">${w.walletAddress || ''}</td><td>${w.note || ''}</td><td>${actionHtml}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) { console.error(err); tbody.innerHTML = '<tr><td colspan="7" class="muted">โหลดไม่สำเร็จ</td></tr>'; }
}

/* ---------- TRANSACTIONS / TICKETS / PAYOUTS ---------- */
async function loadTransactions() {
  const box = document.getElementById('txBox');
  if (!box) return;
  if (!currentUser) { box.innerHTML = '<div class="muted">ยังไม่ได้เลือกผู้ใช้</div>'; return; }
  box.innerHTML = '<div class="muted">กำลังโหลด.</div>';
  try {
    const data = await API.userTransactions(currentUser._id);
    // support either { transactions: [...] } or direct object
    const txs = Array.isArray(data) ? data : (data && (data.transactions || data.data || [])) || [];
    if (!txs.length) { box.innerHTML = '<div class="muted">ยังไม่มีประวัติธุรกรรม</div>'; return; }
    box.innerHTML = '';
    txs.forEach(t => {
      const created = t.createdAt ? new Date(t.createdAt).toLocaleString('th-TH') : '-';
      const div = document.createElement('div'); div.className = 'mb-1';
      div.innerHTML = `<div class="mono">${t.type} · ${t.amount ?? 0} ฿</div><div class="muted text-xs">${created} · สถานะ: ${t.status || '-'}</div>`;
      box.appendChild(div);
    });
  } catch (err) { console.error(err); box.innerHTML = '<div class="muted">เกิดข้อผิดพลาดจากเซิร์ฟเวอร์</div>'; }
}

async function loadTickets() {
  const box = document.getElementById('ticketBox');
  if (!box) return;
  if (!currentUser) { box.innerHTML = '<div class="muted">ยังไม่ได้เลือกผู้ใช้</div>'; return; }
  box.innerHTML = '<div class="muted">กำลังโหลด.</div>';
  try {
    const data = await API.userTickets(currentUser._id);
    const tickets = Array.isArray(data) ? data : (data && (data.tickets || data.data || [])) || [];
    if (!tickets.length) { box.innerHTML = '<div class="muted">ยังไม่มีบิลหวย</div>'; return; }
    box.innerHTML = '';
    tickets.forEach(t => {
      const created = t.createdAt ? new Date(t.createdAt).toLocaleString('th-TH') : '-';
      const nums = (t.entries||[]).map(e => `${e.digitCount} ตัว: ${e.numbers} (${e.stake} ฿)`).join('<br>');
      const div = document.createElement('div'); div.className = 'mb-1';
      div.innerHTML = `<div class="mono">งวด ${t.roundId||'-'} · สถานะ: ${t.status||'-'}</div><div class="muted text-xs">${created}</div><div class="muted text-xs">ยอดแทง: ${t.totalStake ?? 0} ฿ · จ่ายแล้ว: ${t.totalPayout ?? 0} ฿</div><div class="muted text-xs mt-1">${nums}</div>`;
      box.appendChild(div);
    });
  } catch (err) { console.error(err); box.innerHTML = '<div class="muted">เกิดข้อผิดพลาดจากเซิร์ฟเวอร์</div>'; }
}

async function loadPayoutsForAdmin() {
  const info = document.getElementById('payoutInfoText'); if (!currentUser || !info) return;
  info.textContent = 'กำลังโหลด % .';
  try {
    const data = await API.getPayouts(currentUser._id);
    if (!data) { info.textContent = 'โหลด % ไม่สำเร็จ'; return; }
    // data may be { percents: {...} } or direct object
    const percents = data.percents || data || {};
    const p2 = document.getElementById('payout2Input'); if (p2) p2.value = percents?.p2 ?? '';
    const p3 = document.getElementById('payout3Input'); if (p3) p3.value = percents?.p3 ?? '';
    const p4 = document.getElementById('payout4Input'); if (p4) p4.value = percents?.p4 ?? '';
    const p8 = document.getElementById('payout8Input'); if (p8) p8.value = percents?.p8 ?? '';
    info.textContent = 'โหลด % สำเร็จ';
  } catch (err) { console.error(err); info.textContent = 'เกิดข้อผิดพลาด'; }
}

async function savePayouts() {
  if (!currentUser) { showToast('กรุณาเลือกผู้ใช้ก่อน','error'); return; }
  const percents = {
    p2: Number(document.getElementById('payout2Input').value) || null,
    p3: Number(document.getElementById('payout3Input').value) || null,
    p4: Number(document.getElementById('payout4Input').value) || null,
    p8: Number(document.getElementById('payout8Input').value) || null,
  };
  try {
    const data = await API.patchPayouts(currentUser._id, percents);
    if (!normalizeOk(data) && !(Array.isArray(data) || data?.ok || data?.percents)) { showToast(data?.error || 'บันทึก % ไม่สำเร็จ','error'); return; }
    showToast('บันทึก % การจ่ายสำเร็จ','success');
    await loadPayoutsForAdmin();
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

/* ---------- Notification form ---------- */
function clearNotifForm() {
  const t = document.getElementById('notifTypeInput'); if (t) t.value = 'system';
  const ti = document.getElementById('notifTitleInput'); if (ti) ti.value = '';
  const li = document.getElementById('notifLinkInput'); if (li) li.value = '';
  const mi = document.getElementById('notifMessageInput'); if (mi) mi.value = '';
}
async function sendNotificationToUser() {
  if (!currentUser) { showToast('กรุณาเลือกผู้ใช้ก่อน','error'); return; }
  const payload = {
    userId: currentUser._id,
    type: document.getElementById('notifTypeInput').value,
    title: document.getElementById('notifTitleInput').value,
    message: document.getElementById('notifMessageInput').value,
    link: document.getElementById('notifLinkInput').value
  };
  try {
    const data = await API.sendNotification(payload);
    if (!data || (typeof data === 'object' && data.ok === false)) { showToast(data?.error || 'ส่งไม่สำเร็จ','error'); return; }
    showToast('ส่งการแจ้งเตือนสำเร็จ','success'); clearNotifForm();
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด','error'); }
}

/* ---------- Backwards-compatible globals ---------- */
window.loadUsers = loadUsers;
window.selectUser = selectUser;
window.saveBalance = saveBalance;
window.topupBalance = topupBalance;
window.saveFlags = saveFlags;
window.savePayouts = savePayouts;
window.loadPayouts = loadPayoutsForAdmin;
window.loadUserDepositsForAdmin = loadUserDepositsForAdmin;
window.loadUserWithdrawalsForAdmin = loadUserWithdrawalsForAdmin;
window.loadTransactions = loadTransactions;
window.loadTickets = loadTickets;
window.sendNotificationToUser = sendNotificationToUser;
window.confirmDeposit = confirmDeposit;
window.confirmWithdrawal = confirmWithdrawal;
window.searchUser = window.searchUser || (async function(){ 
  const q = document.getElementById('searchInput')?.value || document.getElementById('userQuery')?.value || '';
  if (!q) { showToast('กรุณากรอก UID/Email', 'error'); return; }
  try {
    const res = await API.userLookup(q);
    if (!res || (!Array.isArray(res) && !res.user && !res.ok)) { showToast(res?.error || 'ไม่พบผู้ใช้', 'error'); return; }
    const user = res.user || (Array.isArray(res) ? res[0] : res);
    const local = SVC.findUserById(allUsers, user._id);
    if (local) selectUser(local._id);
    else {
      currentUser = user;
      const panel = document.getElementById('userDetailPanel'); if (panel) panel.style.display = 'block';
      document.getElementById('detailEmail').textContent = user.email || '-';
      document.getElementById('detailUid').textContent = user.uid || '-';
      document.getElementById('detailId').textContent = user._id || '-';
      const bi = document.getElementById('detailBalanceInput'); if (bi) bi.value = user.wallet?.balance ?? 0;
    }
  } catch (err) { console.error(err); showToast('เกิดข้อผิดพลาด', 'error'); }
});

/* ---------- UI events ---------- */
function attachUiEvents() {
  const si = document.getElementById('searchInput'); if (si) si.addEventListener('input', () => applyFilters());
  const sortSelect = document.getElementById('sortSelect'); if (sortSelect) sortSelect.addEventListener('change', () => renderUsersTable());
  const filterStatus = document.getElementById('filterStatus'); if (filterStatus) filterStatus.addEventListener('change', () => applyFilters());
  document.querySelectorAll('.chip-filter').forEach(el => el.addEventListener('click', () => {
    document.querySelectorAll('.chip-filter').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    quickFilterMode = el.dataset.filter || 'all';
    applyFilters();
  }));

  const balanceInput = document.getElementById('detailBalanceInput');
  if (balanceInput) balanceInput.addEventListener('keyup', (e)=>{ if (e.key === 'Enter') saveBalance(); });

  const saveBalanceBtn = document.querySelector('[onclick="saveBalance()"]'); if (saveBalanceBtn) saveBalanceBtn.addEventListener('click', saveBalance);
  const topupBtn = document.querySelector('[onclick="topupBalance()"]'); if (topupBtn) topupBtn.addEventListener('click', topupBalance);
  const saveFlagsBtn = document.querySelector('[onclick="saveFlags()"]'); if (saveFlagsBtn) saveFlagsBtn.addEventListener('click', saveFlags);
  const loadTxBtn = document.querySelector('[onclick="loadTransactions()"]'); if (loadTxBtn) loadTxBtn.addEventListener('click', loadTransactions);
  const loadTicketsBtn = document.querySelector('[onclick="loadTickets()"]'); if (loadTicketsBtn) loadTicketsBtn.addEventListener('click', loadTickets);
  const clearNotifBtn = document.querySelector('[onclick="clearNotifForm()"]'); if (clearNotifBtn) clearNotifBtn.addEventListener('click', clearNotifForm);
  const sendNotifBtn = document.querySelector('[onclick="sendNotificationToUser()"]'); if (sendNotifBtn) sendNotifBtn.addEventListener('click', sendNotificationToUser);
  const loadPayoutsBtn = document.querySelector('[onclick="loadPayouts()"]'); if (loadPayoutsBtn) loadPayoutsBtn.addEventListener('click', loadPayoutsForAdmin);
  const savePayoutsBtn = document.querySelector('[onclick="savePayouts()"]'); if (savePayoutsBtn) savePayoutsBtn.addEventListener('click', savePayouts);
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  try {
    attachUiEvents();
    initUsersPage();
  } catch (e) {
    console.error('initUsersPage error:', e);
  }
});
