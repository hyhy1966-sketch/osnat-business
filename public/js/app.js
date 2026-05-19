const token = localStorage.getItem('token');
const username = localStorage.getItem('username');
if (!token) window.location.href = 'index.html';

const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
const methodNames = { bit: 'ביט', paybox: 'פייבוקס', credit: 'כרטיס אשראי', transfer: 'העברה בנקאית', cash: 'מזומן' };

document.getElementById('welcomeMsg').textContent = `שלום, ${username}`;
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = 'index.html';
});

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('sec-' + btn.dataset.section).classList.add('active');
    if (btn.dataset.section === 'dashboard') loadDashboard();
    if (btn.dataset.section === 'transactions') loadTransactions();
    if (btn.dataset.section === 'receipts') loadReceipts();
    if (btn.dataset.section === 'clients') loadClients();
  });
});

// Year dropdowns
const currentYear = new Date().getFullYear();
['dashYear', 'filterYear'].forEach(id => {
  const sel = document.getElementById(id);
  for (let y = currentYear; y >= currentYear - 3; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    sel.appendChild(opt);
  }
});

// Set today's date as default
const today = new Date().toISOString().split('T')[0];
document.getElementById('addDate').value = today;
document.getElementById('rcptDate').value = today;
document.getElementById('addServiceDate').value = today;
document.getElementById('rcptServiceDate').value = today;

// Set current month in dashboard
document.getElementById('dashMonth').value = String(new Date().getMonth() + 1).padStart(2, '0');

// ---- DASHBOARD ----
async function loadDashboard() {
  const month = document.getElementById('dashMonth').value;
  const year = document.getElementById('dashYear').value;
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (year) params.set('year', year);

  const res = await fetch(`/api/transactions/summary?${params}`, { headers });
  const data = await res.json();

  document.getElementById('totalIncome').textContent = `₪${data.totalIncome.toLocaleString()}`;
  document.getElementById('totalExpense').textContent = `₪${data.totalExpense.toLocaleString()}`;
  document.getElementById('totalProfit').textContent = `₪${data.profit.toLocaleString()}`;

  const breakdown = document.getElementById('methodBreakdown');
  if (Object.keys(data.byMethod).length === 0) {
    breakdown.innerHTML = '<p style="color:#888;text-align:center">אין נתונים לתקופה זו</p>';
  } else {
    let html = '<table><thead><tr><th>אמצעי</th><th>הכנסות</th><th>הוצאות</th></tr></thead><tbody>';
    for (const [method, vals] of Object.entries(data.byMethod)) {
      html += `<tr><td>${methodNames[method] || method}</td>
        <td class="type-income">₪${vals.income.toLocaleString()}</td>
        <td class="type-expense">₪${vals.expense.toLocaleString()}</td></tr>`;
    }
    html += '</tbody></table>';
    breakdown.innerHTML = html;
  }
}

document.getElementById('dashMonth').addEventListener('change', loadDashboard);
document.getElementById('dashYear').addEventListener('change', loadDashboard);

// ---- ADD TRANSACTION ----
document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    type: document.getElementById('addType').value,
    amount: document.getElementById('addAmount').value,
    method: document.getElementById('addMethod').value,
    date: document.getElementById('addDate').value,
    clientName: document.getElementById('addClient').value,
    description: document.getElementById('addDesc').value,
    serviceDate: document.getElementById('addServiceDate').value
  };

  const res = await fetch('/api/transactions', { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.ok) {
    document.getElementById('addMsg').textContent = 'נשמר בהצלחה!';
    document.getElementById('addAmount').value = '';
    document.getElementById('addClient').value = '';
    document.getElementById('addDesc').value = '';
    setTimeout(() => document.getElementById('addMsg').textContent = '', 2000);
  }
});

// ---- TRANSACTIONS LIST ----
async function loadTransactions() {
  const type = document.getElementById('filterType').value;
  const month = document.getElementById('filterMonth').value;
  const year = document.getElementById('filterYear').value;
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (month) params.set('month', month);
  if (year) params.set('year', year);

  const res = await fetch(`/api/transactions?${params}`, { headers });
  const data = await res.json();
  const tbody = document.getElementById('transBody');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888">אין תנועות</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(t => {
    const d = t.date.split('-');
    return `<tr>
      <td>${d[2]}/${d[1]}/${d[0]}</td>
      <td class="type-${t.type}">${t.type === 'income' ? 'הכנסה' : 'הוצאה'}</td>
      <td>₪${t.amount.toLocaleString()}</td>
      <td>${methodNames[t.method] || t.method}</td>
      <td>${t.clientName || '-'}</td>
      <td>${t.description || '-'}</td>
      <td><button class="btn btn-danger" onclick="deleteTransaction('${t._id}')">מחק</button></td>
    </tr>`;
  }).join('');
}

document.getElementById('filterType').addEventListener('change', loadTransactions);
document.getElementById('filterMonth').addEventListener('change', loadTransactions);
document.getElementById('filterYear').addEventListener('change', loadTransactions);

async function deleteTransaction(id) {
  if (!confirm('למחוק את התנועה?')) return;
  await fetch(`/api/transactions/${id}`, { method: 'DELETE', headers });
  loadTransactions();
}

// ---- RECEIPTS ----
document.getElementById('receiptForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    clientName: document.getElementById('rcptClient').value,
    amount: document.getElementById('rcptAmount').value,
    method: document.getElementById('rcptMethod').value,
    date: document.getElementById('rcptDate').value,
    description: document.getElementById('rcptDesc').value,
    serviceDate: document.getElementById('rcptServiceDate').value
  };

  const res = await fetch('/api/receipts', { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.ok) {
    const receipt = await res.json();
    document.getElementById('rcptMsg').textContent = `קבלה מספר ${receipt.number} נוצרה בהצלחה!`;
    document.getElementById('rcptClient').value = '';
    document.getElementById('rcptAmount').value = '';
    setTimeout(() => document.getElementById('rcptMsg').textContent = '', 3000);
    loadReceipts();
  }
});

async function loadReceipts() {
  const res = await fetch('/api/receipts', { headers });
  const data = await res.json();
  const tbody = document.getElementById('receiptsBody');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888">אין קבלות</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(r => {
    const d = r.date.split('-');
    return `<tr>
      <td>${r.number}</td>
      <td>${d[2]}/${d[1]}/${d[0]}</td>
      <td>${r.clientName}</td>
      <td>₪${r.amount.toLocaleString()}</td>
      <td><a href="/api/receipts/${r._id}/pdf?token=${token}" target="_blank" class="btn btn-info">📄 PDF</a></td>
    </tr>`;
  }).join('');
}

// ---- CLIENTS ----
document.getElementById('clientForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: document.getElementById('clientName').value,
    phone: document.getElementById('clientPhone').value,
    email: document.getElementById('clientEmail').value
  };

  const res = await fetch('/api/clients', { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.ok) {
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientEmail').value = '';
    loadClients();
  }
});

async function loadClients() {
  const res = await fetch('/api/clients', { headers });
  const data = await res.json();
  const tbody = document.getElementById('clientsBody');

  tbody.innerHTML = data.map(c => `<tr>
    <td>${c.name}</td>
    <td>${c.phone || '-'}</td>
    <td>${c.email || '-'}</td>
    <td><button class="btn btn-danger" onclick="deleteClient('${c._id}')">מחק</button></td>
  </tr>`).join('');

  // Update datalists
  const options = data.map(c => `<option value="${c.name}">`).join('');
  document.getElementById('clientList').innerHTML = options;
  const cl2 = document.getElementById('clientList2');
  if (cl2) cl2.innerHTML = options;
}

async function deleteClient(id) {
  if (!confirm('למחוק את הלקוח?')) return;
  await fetch(`/api/clients/${id}`, { method: 'DELETE', headers });
  loadClients();
}

// Initial load
loadDashboard();
loadClients();
