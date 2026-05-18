const token = localStorage.getItem('token');
if (token) window.location.href = 'app.html';

let currentTab = 'login';

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    document.getElementById('submitBtn').textContent = currentTab === 'login' ? 'התחבר' : 'הירשם';
    document.getElementById('errorMsg').textContent = '';
  });
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = '';

  try {
    const res = await fetch(`/api/auth/${currentTab}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { errorMsg.textContent = data.message; return; }

    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    window.location.href = 'app.html';
  } catch (err) {
    errorMsg.textContent = 'שגיאה בהתחברות לשרת';
  }
});
