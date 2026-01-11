// public/js/admin-users/api.js
const API_ADMIN = '/api/admin';
function getAuthHeaders() {
  const t = localStorage.getItem('adminToken') || localStorage.getItem('token');
  return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function safeJson(res) {
  try { return await res.json(); } catch (e) { return null; }
}

export async function loadUsers() {
  const res = await fetch(`${API_ADMIN}/users`, { headers: getAuthHeaders() });
  return safeJson(res);
}

export async function patchBalance(userId, balance) {
  const res = await fetch(`${API_ADMIN}/users/${encodeURIComponent(userId)}/balance`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ balance })
  });
  return safeJson(res);
}

export async function patchFlags(userId, flags) {
  const res = await fetch(`${API_ADMIN}/users/${encodeURIComponent(userId)}/flags`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(flags)
  });
  return safeJson(res);
}

export async function userTransactions(userId) {
  const res = await fetch(`${API_ADMIN}/users/${encodeURIComponent(userId)}/transactions`, { headers: getAuthHeaders() });
  return safeJson(res);
}

export async function userTickets(userId) {
  const res = await fetch(`${API_ADMIN}/users/${encodeURIComponent(userId)}/tickets`, { headers: getAuthHeaders() });
  return safeJson(res);
}

export async function topupBalance(userId, newBalance) {
  return patchBalance(userId, newBalance);
}

export async function getPayouts(userId) {
  const res = await fetch(`${API_ADMIN}/users/${encodeURIComponent(userId)}/payouts`, { headers: getAuthHeaders() });
  return safeJson(res);
}
export async function patchPayouts(userId, percents) {
  const res = await fetch(`${API_ADMIN}/users/${encodeURIComponent(userId)}/payouts`, {
    method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ percents })
  });
  return safeJson(res);
}

export async function loadDeposits(userId) {
  const res = await fetch(`${API_ADMIN}/deposits?userId=${encodeURIComponent(userId)}`, { headers: getAuthHeaders() });
  const data = await safeJson(res);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.deposits)) return data.deposits;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  // try to find first array field
  for (const k of Object.keys(data)) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

export async function loadWithdrawals(userId) {
  const res = await fetch(`${API_ADMIN}/withdrawals?userId=${encodeURIComponent(userId)}`, { headers: getAuthHeaders() });
  const data = await safeJson(res);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.withdrawals)) return data.withdrawals;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.items)) return data.items;
  for (const k of Object.keys(data)) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

export async function sendNotification(payload) {
  const res = await fetch(`/api/notifications/admin-send`, {
    method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload)
  });
  return safeJson(res);
}

export async function userLookup(query) {
  const res = await fetch(`${API_ADMIN}/user-lookup?query=${encodeURIComponent(query)}`, { headers: getAuthHeaders() });
  return safeJson(res);
}

// --- confirm deposit / withdrawal endpoints (normalized return)
export async function confirmDeposit(depositId, action, adminNote = '') {
  const res = await fetch(`${API_ADMIN}/deposits/${encodeURIComponent(depositId)}/confirm`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action, adminNote })
  });
  const body = await safeJson(res);
  const ok = res.ok || (body && (body.ok === true || body.success === true || body.status === 'success' || body.result === 'ok' || body.message === 'ok'));
  return { ok, body, status: res.status };
}

export async function confirmWithdrawal(withdrawalId, action, adminNote = '') {
  const res = await fetch(`${API_ADMIN}/withdrawals/${encodeURIComponent(withdrawalId)}/confirm`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action, adminNote })
  });
  const body = await safeJson(res);
  const ok = res.ok || (body && (body.ok === true || body.success === true || body.status === 'success' || body.result === 'ok' || body.message === 'ok'));
  return { ok, body, status: res.status };
}

export async function loadUserById(userId) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    headers: getAuthHeaders()
  });
  return res.json();
}
