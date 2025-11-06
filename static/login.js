(function () {
  const form = document.getElementById('login-form');
  const btn  = document.getElementById('btn-login');
  const msg  = document.getElementById('msg');

  const setMsg = (text, ok=false) => {
    if (!msg) return;
    msg.textContent = text || '';
    msg.style.color = ok ? '#6ae08e' : '#ff8aa8';
  };

  function redirectByRole(user) {
    const role = String(user?.role || '').toLowerCase().trim();
    let next = '/';
    switch (role) {
      case 'supervisor':  next = '/supervisor'; break;
      case 'gestor':      next = '/';           break;
      case 'funcionario': next = '/';           break;
      default:            next = '/';           break;
    }
    window.location.replace(next);
  }

  // Checa sessão sem cache (evita "auto-login" com resposta antiga)
  fetch('/me?ts=' + Date.now(), { credentials: 'include', cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      if (data && data.user) {
        localStorage.setItem('operatorName', data.user.name || data.user.email || '');
        localStorage.setItem('operatorEmail', data.user.email || '');
        redirectByRole(data.user);
      }
    })
    .catch(() => {});

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setMsg('');
      if (btn) btn.disabled = true;

      const email = (document.getElementById('email')?.value || '').trim();
      const password = document.getElementById('password')?.value || '';

      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Falha de autenticação');
        }
        const data = await res.json();
        const u = data.user || {};
        localStorage.setItem('operatorName', u.name || u.email || '');
        localStorage.setItem('operatorEmail', u.email || '');
        setMsg('Login realizado com sucesso!', true);
        redirectByRole(u);
      } catch (err) {
        setMsg(err.message || 'Erro ao conectar');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }
})();
