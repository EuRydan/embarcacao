const PW_HASH = 'e3bffe56e2a4ffba2864141be98e0dae32434b984ce0bdc3ad8b0d57882316b7';
const SESSION_KEY = 'site_auth';

async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildGate() {
  const style = document.createElement('style');
  style.textContent = `
    #pw-gate {
      position: fixed; inset: 0; z-index: 99999;
      background: #fff;
      display: flex; align-items: center; justify-content: center;
    }
    #pw-gate form {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
    }
    #pw-gate input {
      width: 260px; padding: 12px 16px;
      border: 1px solid #ccc; border-radius: 4px;
      font-size: 16px; outline: none;
    }
    #pw-gate input:focus { border-color: #222; }
    #pw-gate button {
      width: 260px; padding: 12px;
      background: #222; color: #fff;
      border: none; border-radius: 4px;
      font-size: 15px; cursor: pointer;
      letter-spacing: 0.05em;
    }
    #pw-gate button:hover { background: #444; }
    #pw-gate .error {
      color: #c00; font-size: 13px; min-height: 18px;
    }
  `;
  document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.id = 'pw-gate';
  gate.innerHTML = `
    <form id="pw-form">
      <input type="password" id="pw-input" placeholder="Senha de acesso" autocomplete="current-password">
      <button type="submit">Entrar</button>
      <span class="error" id="pw-error"></span>
    </form>
  `;
  document.body.prepend(gate);

  document.getElementById('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = document.getElementById('pw-input').value;
    const hash = await sha256(val);
    if (hash === PW_HASH) {
      sessionStorage.setItem(SESSION_KEY, '1');
      document.getElementById('pw-gate').remove();
    } else {
      document.getElementById('pw-error').textContent = 'Senha incorreta.';
      document.getElementById('pw-input').value = '';
      document.getElementById('pw-input').focus();
    }
  });
}

if (sessionStorage.getItem(SESSION_KEY) !== '1') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildGate);
  } else {
    buildGate();
  }
}
