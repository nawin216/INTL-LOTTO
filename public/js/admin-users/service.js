// public/js/admin-users/service.js
export function copyUsers(users) {
  return Array.isArray(users) ? users.map(u => ({ ...u })) : [];
}

export function filterUsers(allUsers, { q = '', statusFilter = '', quickFilterMode = 'all' } = {}) {
  const ql = (q || '').trim().toLowerCase();
  return (allUsers || []).filter(u => {
    const email = (u.email||'').toLowerCase();
    const uid = (u.uid||'').toLowerCase();
    if (ql && !(email.includes(ql) || uid.includes(ql))) return false;

    if (statusFilter === 'deposit_disabled' && u.depositEnabled !== false) return false;
    if (statusFilter === 'withdraw_disabled' && u.withdrawEnabled !== false) return false;

    const bal = (u.wallet && u.wallet.balance) || 0;
    if (quickFilterMode === 'rich' && bal <= 10000) return false;
    if (quickFilterMode === 'zero' && bal !== 0) return false;

    return true;
  });
}

export function sortUsers(users, { field = 'createdAt', dir = 'desc' } = {}) {
  const arr = Array.isArray(users) ? users.slice() : [];
  arr.sort((a, b) => {
    let va, vb;
    if (field === 'balance') {
      va = (a.wallet && a.wallet.balance) || 0;
      vb = (b.wallet && b.wallet.balance) || 0;
    } else if (field === 'email') {
      va = (a.email||'').toLowerCase();
      vb = (b.email||'').toLowerCase();
    } else if (field === 'uid') {
      va = (a.uid||'').toLowerCase();
      vb = (b.uid||'').toLowerCase();
    } else {
      va = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      vb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return arr;
}

export function findUserById(allUsers, id) {
  return (allUsers || []).find(u => String(u._id) === String(id));
}

// local update helpers to keep UI in sync
export function updateLocalBalance(allUsers, userId, newBalance) {
  const idx = (allUsers || []).findIndex(u => String(u._id) === String(userId));
  if (idx >= 0) {
    allUsers[idx].wallet = allUsers[idx].wallet || {};
    allUsers[idx].wallet.balance = newBalance;
  }
}
export function updateLocalFlags(allUsers, userId, flags) {
  const idx = (allUsers || []).findIndex(u => String(u._id) === String(userId));
  if (idx >= 0) {
    allUsers[idx].depositEnabled = flags.depositEnabled;
    allUsers[idx].withdrawEnabled = flags.withdrawEnabled;
  }
}
