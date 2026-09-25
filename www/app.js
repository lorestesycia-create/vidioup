import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

const $ = s => document.querySelector(s);
let cfg = null;

const state = {
  tab: 'inicio',
  session: null,
  user: {
    name: 'Creador',
    email: '',
    coins: 0,
    reserved: 0
  },
  favorites: [],
  campaigns: [],
  feed: [],
  rewardStatus: {
    used_today: 0,
    pending_today: 0,
    daily_limit: 8,
    remaining_today: 8
  },
  loading: true,
  authMode: 'login'
};

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function money(n) {
  return Number(n || 0).toLocaleString('es-ES');
}

function apiHeaders(token) {
  return {
    apikey: cfg.services.supabase_publishable_key,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function sb(path, opts = {}, attempt = 0) {
  const r = await fetch(
    `${cfg.services.supabase_url}${path}`,
    opts
  );

  let data = null;

  try {
    data = await r.json();
  } catch {}

  if (!r.ok) {
    const message =
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      `Error ${r.status}`;

    if (
      attempt < 2 &&
      (
        /JWT issued at future/i.test(message) ||
        /PGRST303/i.test(message)
      )
    ) {
      await new Promise(resolve =>
        setTimeout(resolve, 700 * (attempt + 1))
      );

      return sb(path, opts, attempt + 1);
    }

    throw new Error(message);
  }

  return data;
}

function saveSession(s) {
  state.session = s;

  if (s) {
    localStorage.setItem(
      'vidioup_session',
      JSON.stringify(s)
    );
  } else {
    localStorage.removeItem('vidioup_session');
  }
}

async function signIn(email, password) {
  return sb('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      apikey: cfg.services.supabase_publishable_key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password
    })
  });
}

async function signUp(email, password) {
  return sb('/auth/v1/signup', {
    method: 'POST',
    headers: {
      apikey: cfg.services.supabase_publishable_key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password
    })
  });
}

async function refreshSession(refresh_token) {
  return sb(
    '/auth/v1/token?grant_type=refresh_token',
    {
      method: 'POST',
      headers: {
        apikey: cfg.services.supabase_publishable_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token
      })
    }
  );
}

async function rpc(name, body = {}) {
  return sb(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: apiHeaders(
      state.session.access_token
    ),
    body: JSON.stringify(body)
  });
}

async function loadAccount() {
  const t = state.session.access_token;
  const uid = state.session.user.id;

  const [profiles, wallets] =
    await Promise.all([
      sb(
        `/rest/v1/users?id=eq.${encodeURIComponent(uid)}&select=id,email,display_name,status`,
        {
          headers: apiHeaders(t)
        }
      ),
      sb(
        `/rest/v1/wallets?user_id=eq.${encodeURIComponent(uid)}&select=available_coins,reserved_coins`,
        {
          headers: apiHeaders(t)
        }
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
    email:
      p.email ||
      state.session.user.email ||
      '',
    coins: w.available_coins,
    reserved: w.reserved_coins
  };
}

async function loadCampaigns() {
  const rows =
    await rpc('get_my_campaigns_v2');

  state.campaigns =
    Array.isArray(rows) ? rows : [];
}

async function loadFeed() {
  const rows =
    await rpc('get_home_feed');

  state.feed =
    Array.isArray(rows) ? rows : [];
}

async function loadRewardStatus() {
  const status =
    await rpc('get_reward_status');

  state.rewardStatus = {
    used_today:
      Number(status?.used_today || 0),

    pending_today:
      Number(status?.pending_today || 0),

    daily_limit:
      Number(
        status?.daily_limit ||
        cfg.economy.rewarded_daily_limit
      ),

    remaining_today:
      Number(
        status?.remaining_today ??
        cfg.economy.rewarded_daily_limit
      )
  };
}

async function loadAppData() {
  await Promise.all([
    loadAccount(),
    loadCampaigns(),
    loadFeed(),
    loadRewardStatus()
  ]);
}

function authView() {
  const signup =
    state.authMode === 'signup';

  return `
    <div class="auth">
      <div class="authbox">

        <img
          src="icon.png"
          class="authicon"
        >

        <h1>VidioUp</h1>

        <p>
          ${
            signup
              ? 'Crea tu cuenta para continuar'
              : 'Inicia sesión para continuar'
          }
        </p>

        <form
          id="${
            signup
              ? 'signupForm'
              : 'loginForm'
          }"
        >

          <label>
            Correo electrónico
          </label>

          <input
            id="email"
            type="email"
            autocomplete="email"
            required
          >

          <label>
            Contraseña
          </label>

          <input
            id="password"
            type="password"
            minlength="6"
            autocomplete="${
              signup
                ? 'new-password'
                : 'current-password'
            }"
            required
          >

          ${
            signup
              ? `
                <label>
                  Repite la contraseña
                </label>

                <input
                  id="passwordConfirm"
                  type="password"
                  minlength="6"
                  autocomplete="new-password"
                  required
                >
              `
              : ''
          }

          <button
            class="btn wide"
            type="submit"
          >
            ${
              signup
                ? 'Crear cuenta'
                : 'Iniciar sesión'
            }
          </button>

        </form>

        <p
          id="authError"
          class="error"
        ></p>

        <p
          id="authSuccess"
          class="notice"
        ></p>

        <button
          class="ghost wide"
          type="button"
          data-action="${
            signup
              ? 'show-login'
              : 'show-signup'
          }"
        >
          ${
            signup
              ? 'Ya tengo cuenta · Iniciar sesión'
              : 'Crear una cuenta'
          }
        </button>

        <p class="notice">
          Tus campañas, monedas y actividad
          quedan vinculadas a tu cuenta.
        </p>

      </div>
    </div>
  `;
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

      <button
        class="coin"
        data-action="wallet"
      >
        ◉ ${money(state.user.coins)}
      </button>

    </header>
  `;
}

function card(x) {
  return `
    <section class="card">
      ${x}
    </section>
  `;
}

function render() {
  if (state.loading) {
    $('#app').innerHTML = `
      <div class="splash">
        <img src="icon.png">
        <b>VidioUp</b>
        <span>Cargando…</span>
      </div>
    `;

    document.querySelector('nav').hidden =
      true;

    return;
  }

  if (!state.session) {
    $('#app').innerHTML =
      authView();

    document.querySelector('nav').hidden =
      true;

    return;
  }

  document.querySelector('nav').hidden =
    false;

  let body = '';

  if (state.tab === 'inicio') {
    body = home();
  }

  if (state.tab === 'promocionar') {
    body = promote();
  }

  if (state.tab === 'monedas') {
    body = wallet();
  }

  if (state.tab === 'campanas') {
    body = campaigns();
  }

  if (state.tab === 'perfil') {
    body = profile();
  }

  $('#app').innerHTML =
    top({
      inicio: 'Descubre vídeos',
      promocionar: 'Promociona tu vídeo',
      monedas: 'Monedas',
      campanas: 'Campañas',
      perfil: 'Perfil'
    }[state.tab]) +
    `<main>${body}</main>`;

  document
    .querySelectorAll('nav button')
    .forEach(b =>
      b.classList.toggle(
        'active',
        b.dataset.tab === state.tab
      )
    );

  if (state.tab === 'inicio') {
    setupFeedImpressions();
  }
}

function home() {
  const items =
    state.feed.length
      ? state.feed.map(item => {

          const modeLabel = {
            basic: 'PROMOCIONADO',
            featured: 'DESTACADO',
            boost: 'IMPULSO'
          }[item.mode] || 'PROMOCIONADO';

          const title =
            item.video_title ||
            'Vídeo promocionado';

          const meta = [
            item.category,
            item.creator_name
          ]
            .filter(Boolean)
            .join(' · ');

          const thumb =
            item.thumbnail_url
              ? `
                <img
                  src="${esc(item.thumbnail_url)}"
                  alt="Miniatura del vídeo"
                  loading="lazy"
                  style="
                    width:100%;
                    height:190px;
                    object-fit:cover;
                    border-radius:16px;
                    margin:12px 0;
                    background:#0e111a;
                  "
                >
              `
              : `
                <div class="thumb">
                  ▶
                </div>
              `;

          return card(`
            <div
              class="feed-item"
              data-feed-impression
              data-campaign-id="${
                esc(item.campaign_id)
              }"
            >

              <span class="pill">
                ${esc(modeLabel)}
              </span>

              ${thumb}

              <h2>
                ${esc(title)}
              </h2>

              <p class="muted">
                ${
                  esc(
                    meta ||
                    'Creador de VidioUp'
                  )
                }
              </p>

              <div class="row">

                <button
                  class="btn"
                  data-action="open-youtube"
                  data-campaign-id="${
                    esc(item.campaign_id)
                  }"
                  data-video-id="${
                    esc(item.video_id)
                  }"
                  data-youtube-url="${
                    esc(item.youtube_url)
                  }"
                >
                  Abrir en YouTube
                </button>

                <button
                  class="ghost"
                  data-action="toggle-favorite"
                  data-video-id="${
                    esc(item.video_id)
                  }"
                >
                  ${
                    item.is_favorite
                      ? '★ Guardado'
                      : '☆ Guardar'
                  }
                </button>

              </div>

            </div>
          `);

        }).join('')

      : card(`
          <h2>
            Sin promociones disponibles
          </h2>

          <p>
            Ahora mismo no hay campañas activas
            de otros creadores disponibles
            para mostrarte.
          </p>
        `);

  return `
    <div class="hero">

      <b>
        Descubre. Promociona. Crece.
      </b>

      <p>
        Descubre vídeos de otros creadores
        y encuentra contenido nuevo.
      </p>

    </div>

    ${items}

    ${card(`
      <span class="pill soft">
        CÓMO FUNCIONA
      </span>

      <h2>
        Descubrimiento dentro de VidioUp
      </h2>

      <p>
        VidioUp muestra campañas de creadores
        dentro de la aplicación.
        Si un vídeo te interesa,
        puedes abrirlo directamente en YouTube.
      </p>

      <p class="muted">
        VidioUp no vende reproducciones,
        Me gusta ni suscripciones.
      </p>
    `)}
  `;
}

function setupFeedImpressions() {
  const nodes =
    document.querySelectorAll(
      '[data-feed-impression]'
    );

  if (!nodes.length) {
    return;
  }

  const observer =
    new IntersectionObserver(
      entries => {

        entries.forEach(
          async entry => {

            if (
              !entry.isIntersecting ||
              entry.intersectionRatio < 0.6
            ) {
              return;
            }

            const el = entry.target;

            if (
              el.dataset.impressionSent === '1'
            ) {
              observer.unobserve(el);
              return;
            }

            el.dataset.impressionSent = '1';

            observer.unobserve(el);

            try {
              await rpc(
                'record_campaign_impression',
                {
                  p_campaign_id:
                    el.dataset.campaignId
                }
              );
            } catch {}
          }
        );
      },
      {
        threshold: [0.6]
      }
    );

  nodes.forEach(node =>
    observer.observe(node)
  );
}

function promote() {
  return card(`
    <h2>
      Nueva campaña
    </h2>

    <label>
      Enlace público de YouTube
    </label>

    <input
      id="url"
      placeholder="https://youtu.be/..."
    >

    <label>
      Categoría
    </label>

    <select id="cat">
      <option>Historia</option>
      <option>Gaming</option>
      <option>Tecnología</option>
      <option>Entretenimiento</option>
      <option>Educación</option>
      <option>Otros</option>
    </select>

    <label>
      Modalidad
    </label>

    <select id="mode">

      <option value="basic">
        Básica · 1 moneda por impresión
      </option>

      <option value="featured">
        Destacada · 2 monedas por impresión
      </option>

      <option value="boost">
        Impulso · 4 monedas por impresión
      </option>

    </select>

    <label>
      Presupuesto
    </label>

    <input
      id="budget"
      type="number"
      min="${
        cfg.economy.campaign_min_budget
      }"
      max="${
        cfg.economy.campaign_max_budget
      }"
      value="${
        cfg.economy.campaign_min_budget
      }"
    >

    <p class="muted">

      El presupuesto mínimo es
      ${
        money(
          cfg.economy.campaign_min_budget
        )
      }
      monedas.

      La modalidad indica cuántas monedas
      consume cada impresión interna válida.

      No es el precio total de la campaña.

    </p>

    <button
      class="btn wide"
      data-action="campaign-preview"
    >
      Revisar campaña
    </button>

    <div id="preview"></div>
  `);
}

function wallet() {
  const reward =
    state.rewardStatus || {};

  const dailyLimit =
    Number(
      reward.daily_limit ||
      cfg.economy.rewarded_daily_limit
    );

  const remainingToday =
    Number(
      reward.remaining_today ??
      dailyLimit
    );

  const usedToday =
    Number(
      reward.used_today || 0
    );

  const pendingToday =
    Number(
      reward.pending_today || 0
    );

  return `
    <div class="balance">

      <span>
        Disponible
      </span>

      <strong>
        ${money(state.user.coins)}
      </strong>

      <small>
        Reservado:
        ${money(state.user.reserved)}
      </small>

    </div>

    ${card(`

      <h2>
        Conseguir monedas
      </h2>

      <p>
        <b>
          ${
            cfg.economy.rewarded_coin_reward
          }
        </b>
        monedas por anuncio recompensado.
      </p>

      <p class="muted">
        Hoy has recibido
        ${usedToday}
        de
        ${dailyLimit}.

        Te quedan
        ${remainingToday}.
      </p>

      ${
        pendingToday > 0
          ? `
            <p class="notice">
              Recompensas pendientes de
              verificación:
              ${pendingToday}
            </p>
          `
          : ''
      }

      <button
        class="btn wide"
        data-action="rewarded"
        ${
          remainingToday <= 0
            ? 'disabled'
            : ''
        }
      >
        ${
          remainingToday > 0
            ? 'Ver anuncio'
            : 'Límite diario alcanzado'
        }
      </button>

      <p class="notice">
        Las monedas se acreditan cuando
        AdMob confirma la recompensa.
      </p>

    `)}

    ${card(`

      <h2>
        Tienda
      </h2>

      <div class="shop">

        ${
          cfg.store.map(x => `
            <button
              class="pack"
              data-sku="${x.sku}"
            >

              <b>
                ${money(x.coins)}
              </b>

              <span>
                monedas
              </span>

              <strong>
                ${
                  x.price_eur
                    .toFixed(2)
                    .replace('.', ',')
                }
                €
              </strong>

            </button>
          `).join('')
        }

      </div>

    `)}
  `;
}

function campaigns() {
  if (!state.campaigns.length) {
    return card(`
      <h2>
        Sin campañas
      </h2>

      <p>
        Aquí verás tus campañas
        guardadas en VidioUp.
      </p>

      <button
        class="btn"
        data-action="go-promote"
      >
        Crear campaña
      </button>
    `);
  }

  return state.campaigns
    .map(c => {

      const id =
        esc(c.id || '');

      const status =
        String(c.status || '');

      let actions = '';

      if (status === 'active') {
        actions += `
          <button
            class="ghost"
            data-campaign-id="${id}"
            data-action="pause-campaign"
          >
            Pausar
          </button>
        `;
      }

      if (status === 'paused') {
        actions += `
          <button
            class="btn"
            data-campaign-id="${id}"
            data-action="resume-campaign"
          >
            Reanudar
          </button>
        `;
      }

      if (
        ![
          'cancelled',
          'completed'
        ].includes(status)
      ) {
        actions += `
          <button
            class="ghost"
            data-campaign-id="${id}"
            data-action="cancel-campaign"
          >
            Cancelar
          </button>
        `;
      }

      const modeName = {
        basic: 'Básica',
        featured: 'Destacada',
        boost: 'Impulso'
      }[c.mode] ||
      c.mode ||
      'Campaña';

      const statusName = {
        active: 'Activa',
        paused: 'Pausada',
        cancelled: 'Cancelada',
        completed: 'Completada',
        draft: 'Borrador',
        removed: 'Retirada'
      }[status] ||
      status ||
      '—';

      return card(`

        <span class="pill">
          ${esc(modeName)}
        </span>

        <h2>
          ${
            esc(
              c.video_title ||
              c.category ||
              'Campaña de YouTube'
            )
          }
        </h2>

        <p class="muted">
          ${esc(c.youtube_url || '')}
        </p>

        <p>
          Presupuesto:
          ${
            money(
              c.initial_budget ?? 0
            )
          }

          · Restante:

          ${
            money(
              c.remaining_budget ?? 0
            )
          }
        </p>

        <p class="muted">

          Coste por impresión:

          ${
            money(
              c.cost_per_impression || 0
            )
          }

          ${
            Number(
              c.
