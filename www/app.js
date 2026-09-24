import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

const $ = s => document.querySelector(s);
let cfg = null;

const state = {
  tab: 'inicio',
  session: null,
  user: { name: 'Creador', email: '', coins: 0, reserved: 0 },
  favorites: [],
  campaigns: [],
  loading: true
};

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;'
  }[m]));
}

function money(n) {
  return Number(n || 0).toLocaleString('es-ES');
}

function apiHeaders(token) {
  return {
    'apikey': cfg.services.supabase_publishable_key,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function sb(path, opts = {}) {
  const r = await fetch(`${cfg.services.supabase_url}${path}`, opts);
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    throw new Error(
      data?.msg ||
      data?.message ||
      data?.error_description ||
      `Error ${r.status}`
    );
  }
  return data;
}

function saveSession(s) {
  state.session = s;
  if (s) localStorage.setItem('vidioup_session', JSON.stringify(s));
  else localStorage.removeItem('vidioup_session');
}

async function signIn(email, password) {
  return sb('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'apikey': cfg.services.supabase_publishable_key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
}

async function refreshSession(refresh_token) {
  return sb('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: {
      'apikey': cfg.services.supabase_publishable_key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token })
  });
}

async function rpc(name, body = {}) {
  return sb(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: apiHeaders(state.session.access_token),
    body: JSON.stringify(body)
  });
}

async function loadAccount() {
  const t = state.session.access_token;
  const uid = state.session.user.id;

  const [profiles, wallets] = await Promise.all([
    sb(
      `/rest/v1/users?id=eq.${encodeURIComponent(uid)}&select=id,email,display_name,status`,
      { headers: apiHeaders(t) }
    ),
    sb(
      `/rest/v1/wallets?user_id=eq.${encodeURIComponent(uid)}&select=available_coins,reserved_coins`,
      { headers: apiHeaders(t) }
    )
  ]);

  const p = profiles?.[0];
  const w = wallets?.[0];

  if (!p || !w) {
    throw new Error(
      'La cuenta existe, pero su perfil o monedero no está preparado.'
    );
  }

  state.user = {
    name: p.display_name || 'Usuario',
    email: p.email || state.session.user.email || '',
    coins: w.available_coins,
    reserved: w.reserved_coins
  };
}

async function loadCampaigns() {
  const rows = await rpc('get_my_campaigns');
  state.campaigns = Array.isArray(rows) ? rows : [];
}

async function loadAppData() {
  await Promise.all([
    loadAccount(),
    loadCampaigns()
  ]);
}

function loginView() {
  return `
    <div class="auth">
      <div class="authbox">
        <img src="icon.png" class="authicon">
        <h1>VidioUp</h1>
        <p>Inicia sesión para continuar</p>

        <form id="loginForm">
          <label>Correo electrónico</label>
          <input id="email" type="email" autocomplete="email" required>

          <label>Contraseña</label>
          <input id="password" type="password" autocomplete="current-password" required>

          <button class="btn wide" type="submit">Iniciar sesión</button>
        </form>

        <p id="authError" class="error"></p>
        <p class="notice">
          Tus campañas, monedas y actividad quedan vinculadas a tu cuenta.
        </p>
      </div>
    </div>`;
}

function top(title) {
  return `
    <header class="top">
      <div class="brand">
        <img src="icon.png">
        <div>
          <h1>VidioUp</h1>
          <span>${esc(title)}</span>
        </div>
      </div>

      <button class="coin" data-action="wallet">
        ◉ ${money(state.user.coins)}
      </button>
    </header>`;
}

function card(x) {
  return `<section class="card">${x}</section>`;
}

function render() {
  if (state.loading) {
    $('#app').innerHTML =
      '<div class="splash"><img src="icon.png"><b>VidioUp</b><span>Cargando…</span></div>';
    document.querySelector('nav').hidden = true;
    return;
  }

  if (!state.session) {
    $('#app').innerHTML = loginView();
    document.querySelector('nav').hidden = true;
    return;
  }

  document.querySelector('nav').hidden = false;

  let body = '';

  if (state.tab === 'inicio') body = home();
  if (state.tab === 'promocionar') body = promote();
  if (state.tab === 'monedas') body = wallet();
  if (state.tab === 'campanas') body = campaigns();
  if (state.tab === 'perfil') body = profile();

  $('#app').innerHTML =
    top({
      inicio: 'Descubre vídeos',
      promocionar: 'Promociona tu vídeo',
      monedas: 'Monedas',
      campanas: 'Campañas',
      perfil: 'Perfil'
    }[state.tab]) +
    `<main>${body}</main>`;

  document.querySelectorAll('nav button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === state.tab)
  );
}

function home() {
  return `
    <div class="hero">
      <b>Descubre. Promociona. Crece.</b>
      <p>Contenido de creadores, con promociones claramente identificadas.</p>
    </div>

    ${card(`
      <span class="pill">PROMOCIONADO</span>
      <div class="thumb">▶</div>
      <h2>Vídeo promocionado</h2>
      <p class="muted">Categoría · Creador</p>

      <div class="row">
        <button class="btn">Abrir en YouTube</button>
        <button class="ghost">☆ Guardar</button>
      </div>
    `)}

    ${card(`
      <span class="pill soft">DESCUBRIMIENTO</span>
      <div class="thumb alt">▶</div>
      <h2>Encuentra nuevos creadores</h2>
      <p>
        Sin autoplay. VidioUp mide impresiones internas y aperturas hacia
        YouTube, no vende reproducciones.
      </p>
    `)}
  `;
}

function promote() {
  return card(`
    <h2>Nueva campaña</h2>

    <label>Enlace público de YouTube</label>
    <input id="url" placeholder="https://youtu.be/...">

    <label>Categoría</label>
    <select id="cat">
      <option>Historia</option>
      <option>Gaming</option>
      <option>Tecnología</option>
      <option>Entretenimiento</option>
      <option>Educación</option>
      <option>Otros</option>
    </select>

    <label>Modalidad</label>
    <select id="mode">
      <option value="basic">Básica · 1 moneda</option>
      <option value="featured">Destacada · 2 monedas</option>
      <option value="boost">Impulso · 4 monedas</option>
    </select>

    <label>Presupuesto</label>
    <input
      id="budget"
      type="number"
      min="${cfg.economy.campaign_min_budget}"
      max="${cfg.economy.campaign_max_budget}"
      value="${cfg.economy.campaign_min_budget}"
    >

    <p class="muted">
      El presupuesto solo se consumirá por distribución interna válida.
    </p>

    <button class="btn wide" data-action="campaign-preview">
      Revisar campaña
    </button>

    <div id="preview"></div>
  `);
}

function wallet() {
  return `
    <div class="balance">
      <span>Disponible</span>
      <strong>${money(state.user.coins)}</strong>
      <small>Reservado: ${money(state.user.reserved)}</small>
    </div>

    ${card(`
      <h2>Conseguir monedas</h2>

      <p>
        <b>${cfg.economy.rewarded_coin_reward}</b>
        monedas por anuncio recompensado.
      </p>

      <p class="muted">
        Máximo ${cfg.economy.rewarded_daily_limit} al día ·
        espera ${cfg.economy.rewarded_cooldown_minutes} min.
      </p>

      <button class="btn wide" data-action="rewarded">
        Ver anuncio
      </button>

      <p class="notice">
        La recompensa se acreditará tras validación.
      </p>
    `)}

    ${card(`
      <h2>Tienda</h2>

      <div class="shop">
        ${cfg.store.map(x => `
          <button class="pack" data-sku="${x.sku}">
            <b>${money(x.coins)}</b>
            <span>monedas</span>
            <strong>${x.price_eur.toFixed(2).replace('.', ',')} €</strong>
          </button>
        `).join('')}
      </div>
    `)}
  `;
}

function campaigns() {
  if (!state.campaigns.length) {
    return card(`
      <h2>Sin campañas</h2>
      <p>Aquí verás tus campañas guardadas en VidioUp.</p>
      <button class="btn" data-action="go-promote">
        Crear campaña
      </button>
    `);
  }

  return state.campaigns.map(c => {
    const id = esc(c.id || '');
    const status = String(c.status || '');

    let actions = '';

    if (status === 'active') {
      actions += `
        <button
          class="ghost"
          data-campaign-id="${id}"
          data-action="pause-campaign"
        >
          Pausar
        </button>`;
    }

    if (status === 'paused') {
      actions += `
        <button
          class="btn"
          data-campaign-id="${id}"
          data-action="resume-campaign"
        >
          Reanudar
        </button>`;
    }

    if (!['cancelled', 'completed'].includes(status)) {
      actions += `
        <button
          class="ghost"
          data-campaign-id="${id}"
          data-action="cancel-campaign"
        >
          Cancelar
        </button>`;
    }

    return card(`
      <span class="pill">${esc(c.mode || '')}</span>

      <h2>
        ${esc(
          c.youtube_url ||
          c.url ||
          c.video_title ||
          'Campaña'
        )}
      </h2>

      <p>
        Presupuesto:
        ${money(c.initial_budget ?? c.budget ?? 0)}
        · Restante:
        ${money(c.remaining_budget ?? 0)}
      </p>

      <p class="muted">
        Estado: ${esc(status || '—')}
      </p>

      <div class="row">${actions}</div>
    `);
  }).join('');
}

function profile() {
  return `
    ${card(`
      <div class="profile">
        <div class="avatar">
          ${esc((state.user.name || 'V')[0].toUpperCase())}
        </div>

        <div>
          <h2>${esc(state.user.name)}</h2>
          <p class="muted">${esc(state.user.email)}</p>
        </div>
      </div>
    `)}

    ${card(`
      <div class="menu">
        <button>♡ Favoritos</button>
        <button>🔔 Notificaciones</button>
        <button>🔐 Cuenta y seguridad</button>
        <button>⊘ Usuarios bloqueados</button>
        <button>Ayuda y soporte</button>
        <button>⚑ Denunciar contenido</button>
        <button>§ Legal y privacidad</button>
        <button class="danger" data-action="logout">
          Cerrar sesión
        </button>
      </div>
    `)}
  `;
}

let admobReady = false;

async function ensureAdMob() {
  if (admobReady) return true;

  if (Capacitor.getPlatform() === 'web') {
    throw new Error(
      'Los anuncios solo están disponibles en la app Android.'
    );
  }

  await AdMob.initialize();

  let consent = await AdMob.requestConsentInfo();

  if (
    consent.isConsentFormAvailable &&
    consent.status === AdmobConsentStatus.REQUIRED
  ) {
    consent = await AdMob.showConsentForm();
  }

  if (!consent.canRequestAds) {
    throw new Error(
      'Todavía no se pueden solicitar anuncios.'
    );
  }

  admobReady = true;
  return true;
}

async function showRewarded() {
  if (!state.session?.user?.id) {
    throw new Error('Inicia sesión de nuevo.');
  }

  await ensureAdMob();

  await AdMob.prepareRewardVideoAd({
    adId: cfg.services.rewarded_ad_unit_id,
    isTesting: false,
    ssv: {
      userId: state.session.user.id
    }
  });

  await AdMob.showRewardVideoAd();

  toast('Recompensa enviada para verificación.');

  for (const wait of [1500, 3000, 5000]) {
    await new Promise(r => setTimeout(r, wait));

    try {
      await loadAccount();
      render();
      break;
    } catch {}
  }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

document.addEventListener('submit', async e => {
  if (e.target.id !== 'loginForm') return;

  e.preventDefault();

  const btn = e.target.querySelector('button');
  const err = $('#authError');

  btn.disabled = true;
  btn.textContent = 'Entrando…';
  err.textContent = '';

  try {
    const s = await signIn(
      $('#email').value.trim(),
      $('#password').value
    );

    saveSession(s);
    await loadAppData();
    render();

  } catch (x) {
    saveSession(null);

    err.textContent =
      x.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : x.message;

    btn.disabled = false;
    btn.textContent = 'Iniciar sesión';
  }
});

document.addEventListener('click', async e => {
  const tab = e.target.closest('[data-tab]')?.dataset.tab;

  if (tab) {
    state.tab = tab;
    render();
    return;
  }

  const target = e.target.closest('[data-action]');
  const a = target?.dataset.action;

  if (a === 'wallet') {
    state.tab = 'monedas';
    render();
  }

  if (a === 'go-promote') {
    state.tab = 'promocionar';
    render();
  }

  if (a === 'logout') {
    saveSession(null);

    state.user = {
      name: 'Creador',
      email: '',
      coins: 0,
      reserved: 0
    };

    state.campaigns = [];
    render();
  }

  if (a === 'rewarded') {
    if (target) target.disabled = true;

    try {
      await showRewarded();
    } catch (x) {
      toast(x.message || 'No se pudo mostrar el anuncio.');
    } finally {
      if (target) target.disabled = false;
    }
  }

  if (a === 'campaign-preview') {
    const url = $('#url').value.trim();
    const budget = Number($('#budget').value);
    const mode = $('#mode').value;

    if (
      !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)
    ) {
      toast('Introduce un enlace válido de YouTube.');
      return;
    }

    if (
      budget < cfg.economy.campaign_min_budget ||
      budget > cfg.economy.campaign_max_budget
    ) {
      toast('Presupuesto fuera de los límites.');
      return;
    }

    $('#preview').innerHTML = `
      <div class="review">
        <b>Resumen</b>
        <p>${esc(url)}</p>
        <p>
          ${esc(cfg.campaign_modes[mode])}
          · ${money(budget)} monedas
        </p>
        <button class="btn" data-action="save-draft">
          Guardar campaña
        </button>
      </div>`;

    return;
  }

  if (a === 'save-draft') {
    const url = $('#url').value.trim();
    const budget = Number($('#budget').value);
    const mode = $('#mode').value;
    const category = $('#cat').value;

    if (target) target.disabled = true;

    try {
      await rpc('create_campaign', {
        p_youtube_url: url,
        p_category: category,
        p_mode: mode,
        p_budget: budget
      });

      await loadAppData();

      toast('Campaña creada correctamente.');
      state.tab = 'campanas';
      render();

    } catch (x) {
      toast(x.message || 'No se pudo crear la campaña.');
    } finally {
      if (target) target.disabled = false;
    }

    return;
  }

  if (
    a === 'pause-campaign' ||
    a === 'resume-campaign' ||
    a === 'cancel-campaign'
  ) {
    const id = target?.dataset.campaignId;

    if (!id) return;

    const fn = {
      'pause-campaign': 'pause_campaign',
      'resume-campaign': 'resume_campaign',
      'cancel-campaign': 'cancel_campaign'
    }[a];

    if (target) target.disabled = true;

    try {
      await rpc(fn, {
        p_campaign_id: id
      });

      await loadAppData();

      toast('Campaña actualizada.');
      render();

    } catch (x) {
      toast(x.message || 'No se pudo actualizar la campaña.');
    } finally {
      if (target) target.disabled = false;
    }

    return;
  }

  if (e.target.closest('[data-sku]')) {
    toast('Las compras se activarán antes de publicar.');
  }
});

async function boot() {
  try {
    cfg = await fetch('config.json').then(r => r.json());

    const raw = localStorage.getItem('vidioup_session');

    if (raw) {
      try {
        let s = JSON.parse(raw);

        if (s.refresh_token) {
          try {
            s = await refreshSession(s.refresh_token);
            saveSession(s);
          } catch {
            saveSession(null);
          }
        }

        if (state.session) {
          await loadAppData();
        }

      } catch {
        saveSession(null);
      }
    }

  } finally {
    state.loading = false;
    render();
  }
}

boot();
