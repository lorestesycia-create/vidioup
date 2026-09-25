import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';

const $ = s => document.querySelector(s);
let cfg;

const state = {
  tab: 'inicio',
  session: null,
  user: { name: 'Creador', email: '', coins: 0, reserved: 0 },
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

const esc = (s='') => String(s).replace(/[&<>"']/g,m=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[m]));

const money = n => Number(n||0).toLocaleString('es-ES');
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const headers = token => ({
  apikey: cfg.services.supabase_publishable_key,
  Authorization: `Bearer ${token}`,
  'Content-Type':'application/json'
});

async function sb(path, opts={}, attempt=0){
  const r = await fetch(`${cfg.services.supabase_url}${path}`, opts);

  let data=null;
  try{
    data=await r.json();
  }catch{}

  if(!r.ok){
    const msg =
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      `Error ${r.status}`;

    if(
      attempt < 2 &&
      (
        /JWT issued at future/i.test(msg) ||
        /PGRST303/i.test(msg)
      )
    ){
      await sleep(700*(attempt+1));
      return sb(path,opts,attempt+1);
    }

    throw new Error(msg);
  }

  return data;
}

function saveSession(s){
  state.session=s;

  if(s){
    localStorage.setItem(
      'vidioup_session',
      JSON.stringify(s)
    );
  }else{
    localStorage.removeItem(
      'vidioup_session'
    );
  }
}

const signIn=(email,password)=>
  sb('/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{
      apikey:cfg.services.supabase_publishable_key,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({email,password})
  });

const signUp=(email,password)=>
  sb('/auth/v1/signup',{
    method:'POST',
    headers:{
      apikey:cfg.services.supabase_publishable_key,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({email,password})
  });

const refreshSession=refresh_token=>
  sb('/auth/v1/token?grant_type=refresh_token',{
    method:'POST',
    headers:{
      apikey:cfg.services.supabase_publishable_key,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({refresh_token})
  });

const rpc=(name,body={})=>
  sb(`/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:headers(state.session.access_token),
    body:JSON.stringify(body)
  });

async function loadAccount(){
  const t=state.session.access_token;
  const uid=state.session.user.id;

  const [p,w]=await Promise.all([
    sb(
      `/rest/v1/users?id=eq.${encodeURIComponent(uid)}&select=id,email,display_name,status`,
      {headers:headers(t)}
    ),
    sb(
      `/rest/v1/wallets?user_id=eq.${encodeURIComponent(uid)}&select=available_coins,reserved_coins`,
      {headers:headers(t)}
    )
  ]);

  if(!p?.[0]||!w?.[0]){
    throw new Error(
      'La cuenta existe, pero su perfil o monedero no está preparado.'
    );
  }

  state.user={
    name:p[0].display_name||'Usuario',
    email:p[0].email||state.session.user.email||'',
    coins:w[0].available_coins,
    reserved:w[0].reserved_coins
  };
}

async function loadCampaigns(){
  const rows=await rpc('get_my_campaigns_v2');
  state.campaigns=Array.isArray(rows)?rows:[];
}

async function loadFeed(){
  const rows=await rpc('get_home_feed');
  state.feed=Array.isArray(rows)?rows:[];
}

async function loadRewardStatus(){
  const s=await rpc('get_reward_status');

  state.rewardStatus={
    used_today:Number(s?.used_today||0),
    pending_today:Number(s?.pending_today||0),
    daily_limit:Number(
      s?.daily_limit||
      cfg.economy.rewarded_daily_limit
    ),
    remaining_today:Number(
      s?.remaining_today??
      cfg.economy.rewarded_daily_limit
    )
  };
}

const loadAppData=()=>
  Promise.all([
    loadAccount(),
    loadCampaigns(),
    loadFeed(),
    loadRewardStatus()
  ]);

function authView(){
  const signup=
    state.authMode==='signup';

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

function top(title){
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

const card=x=>`
  <section class="card">
    ${x}
  </section>
`;

function render(){

  if(state.loading){
    $('#app').innerHTML=`
      <div class="splash">
        <img src="icon.png">
        <b>VidioUp</b>
        <span>Cargando…</span>
      </div>
    `;

    document.querySelector('nav').hidden=true;
    return;
  }

  if(!state.session){
    $('#app').innerHTML=authView();
    document.querySelector('nav').hidden=true;
    return;
  }

  document.querySelector('nav').hidden=false;

  const views={
    inicio:home,
    promocionar:promote,
    monedas:wallet,
    campanas:campaigns,
    perfil:profile
  };

  const titles={
    inicio:'Descubre vídeos',
    promocionar:'Promociona tu vídeo',
    monedas:'Monedas',
    campanas:'Campañas',
    perfil:'Perfil'
  };

  $('#app').innerHTML=
    top(titles[state.tab])+
    `<main>${views[state.tab]()}</main>`;

  document
    .querySelectorAll('nav button')
    .forEach(b=>
      b.classList.toggle(
        'active',
        b.dataset.tab===state.tab
      )
    );

  if(state.tab==='inicio'){
    setupFeedImpressions();
  }
}

function home(){

  const items=
    state.feed.length

      ? state.feed.map(v=>{

          const label={
            basic:'PROMOCIONADO',
            featured:'DESTACADO',
            boost:'IMPULSO'
          }[v.mode]||'PROMOCIONADO';

          const thumb=
            v.thumbnail_url

              ? `
                <img
                  src="${esc(v.thumbnail_url)}"
                  alt="Miniatura del vídeo"
                  loading="lazy"
                  style="
                    width:100%;
                    height:190px;
                    object-fit:cover;
                    border-radius:16px;
                    margin:12px 0;
                    background:#0e111a
                  "
                >
              `

              : `
                <div class="thumb">
                  ▶
                </div>
              `;

          const meta=[
            v.category,
            v.creator_name
          ]
            .filter(Boolean)
            .join(' · ');

          return card(`

            <div
              data-feed-impression
              data-campaign-id="${
                esc(v.campaign_id)
              }"
            >

              <span class="pill">
                ${esc(label)}
              </span>

              ${thumb}

              <h2>
                ${
                  esc(
                    v.video_title ||
                    'Vídeo promocionado'
                  )
                }
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
                    esc(v.campaign_id)
                  }"
                  data-video-id="${
                    esc(v.video_id)
                  }"
                  data-youtube-url="${
                    esc(v.youtube_url)
                  }"
                >
                  Abrir en YouTube
                </button>

                <button
                  class="ghost"
                  data-action="toggle-favorite"
                  data-video-id="${
                    esc(v.video_id)
                  }"
                >
                  ${
                    v.is_favorite
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

    ${
      card(`
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
      `)
    }
  `;
}

function setupFeedImpressions(){

  const nodes=
    document.querySelectorAll(
      '[data-feed-impression]'
    );

  if(!nodes.length){
    return;
  }

  const obs=
    new IntersectionObserver(
      entries=>
        entries.forEach(async e=>{

          if(
            !e.isIntersecting ||
            e.intersectionRatio<0.6
          ){
            return;
          }

          const el=e.target;

          if(
            el.dataset.impressionSent==='1'
          ){
            obs.unobserve(el);
            return;
          }

          el.dataset.impressionSent='1';

          obs.unobserve(el);

          try{
            await rpc(
              'record_campaign_impression',
              {
                p_campaign_id:
                  el.dataset.campaignId
              }
            );
          }catch{}

        }),
      {
        threshold:[0.6]
      }
    );

  nodes.forEach(n=>
    obs.observe(n)
  );
}

function promote(){

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

function wallet(){

  const r=
    state.rewardStatus;

  const limit=
    Number(
      r.daily_limit ||
      cfg.economy.rewarded_daily_limit
    );

  const left=
    Number(
      r.remaining_today ??
      limit
    );

  const used=
    Number(
      r.used_today || 0
    );

  const pending=
    Number(
      r.pending_today || 0
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

    ${
      card(`

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
          ${used}
          de
          ${limit}.
          Te quedan
          ${left}.
        </p>

        ${
          pending
            ? `
              <p class="notice">
                Recompensas pendientes
                de verificación:
                ${pending}
              </p>
            `
            : ''
        }

        <button
          class="btn wide"
          data-action="rewarded"
          ${
            left<=0
              ? 'disabled'
              : ''
          }
        >
          ${
            left>0
              ? 'Ver anuncio'
              : 'Límite diario alcanzado'
          }
        </button>

        <p class="notice">
          Las monedas se acreditan cuando
          AdMob confirma la recompensa.
        </p>

      `)
    }

    ${
      card(`

        <h2>
          Tienda
        </h2>

        <div class="shop">

          ${
            cfg.store.map(x=>`

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
                      .replace('.',',')
                  }
                  €
                </strong>

              </button>

            `).join('')
          }

        </div>

      `)
    }
  `;
}

function campaigns(){

  if(!state.campaigns.length){

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
    .map(c=>{

      const id=
        esc(c.id||'');

      const status=
        String(c.status||'');

      let actions='';

      if(status==='active'){

        actions+=`
          <button
            class="ghost"
            data-campaign-id="${id}"
            data-action="pause-campaign"
          >
            Pausar
          </button>
        `;
      }

      if(status==='paused'){

        actions+=`
          <button
            class="btn"
            data-campaign-id="${id}"
            data-action="resume-campaign"
          >
            Reanudar
          </button>
        `;
      }

      if(
        ![
          'cancelled',
          'completed'
        ].includes(status)
      ){

        actions+=`
          <button
            class="ghost"
            data-campaign-id="${id}"
            data-action="cancel-campaign"
          >
            Cancelar
          </button>
        `;
      }

      const mode={
        basic:'Básica',
        featured:'Destacada',
        boost:'Impulso'
      }[c.mode]||
      c.mode||
      'Campaña';

      const st={
        active:'Activa',
        paused:'Pausada',
        cancelled:'Cancelada',
        completed:'Completada',
        draft:'Borrador',
        removed:'Retirada'
      }[status]||
      status||
      '—';

      const cost=
        Number(
          c.cost_per_impression||0
        );

      return card(`

        <span class="pill">
          ${esc(mode)}
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
          ${esc(c.youtube_url||'')}
        </p>

        <p>
          Presupuesto:
          ${
            money(
              c.initial_budget??0
            )
          }

          · Restante:

          ${
            money(
              c.remaining_budget??0
            )
          }
        </p>

        <p class="muted">

          Coste por impresión:

          ${money(cost)}

          ${
            cost===1
              ? 'moneda'
              : 'monedas'
          }

          · Estado:

          ${esc(st)}

        </p>

        <div class="row">
          ${actions}
        </div>

      `);

    })
    .join('');
}

function profile(){

  return `

    ${
      card(`

        <div class="profile">

          <div class="avatar">
            ${
              esc(
                (
                  state.user.name||
                  'V'
                )[0].toUpperCase()
              )
            }
          </div>

          <div>

            <h2>
              ${esc(state.user.name)}
            </h2>

            <p class="muted">
              ${esc(state.user.email)}
            </p>

          </div>

        </div>

      `)
    }

    ${
      card(`

        <div class="menu">

          <button>
            ♡ Favoritos
          </button>

          <button>
            🔔 Notificaciones
          </button>

          <button>
            🔐 Cuenta y seguridad
          </button>

          <button>
            ⊘  Usuarios bloqueados
          </button>

          <button>
            Ayuda y soporte
          </button>

          <button>
            ⚑ Denunciar contenido
          </button>

          <button>
            § Legal y privacidad
          </button>

          <button
            class="danger"
            data-action="logout"
          >
            Cerrar sesión
          </button>

        </div>

      `)
    }
  `;
}

let admobReady=false;

async function ensureAdMob(){
  if(admobReady) return true;

  if(Capacitor.getPlatform()==='web'){
    throw new Error(
      'Los anuncios solo están disponibles en la app Android.'
    );
  }

  await AdMob.initialize();

  let consent=
    await AdMob.requestConsentInfo();

  if(
    consent.isConsentFormAvailable &&
    consent.status===AdmobConsentStatus.REQUIRED
  ){
    consent=
      await AdMob.showConsentForm();
  }

  if(!consent.canRequestAds){
    throw new Error(
      'Todavía no se pueden solicitar anuncios.'
    );
  }

  admobReady=true;
  return true;
}

async function showRewarded(){
  if(!state.session?.user?.id){
    throw new Error(
      'Inicia sesión de nuevo.'
    );
  }

  if(
    (state.rewardStatus?.remaining_today??1)<=0
  ){
    throw new Error(
      'Has alcanzado el límite diario de anuncios.'
    );
  }

  await ensureAdMob();

  const eventId=crypto.randomUUID();
  const start=Number(state.user.coins||0);

  await AdMob.prepareRewardVideoAd({
    adId:cfg.services.rewarded_ad_unit_id,
    isTesting:false,
    ssv:{
      userId:state.session.user.id,
      customData:eventId
    }
  });

  const reward=
    await AdMob.showRewardVideoAd();

  if(
    !reward ||
    Number(reward.amount||0)<=0
  ){
    throw new Error(
      'El anuncio terminó sin generar una recompensa.'
    );
  }

  try{
    await rpc(
      'register_rewarded_pending',
      {
        p_external_event_id:eventId
      }
    );
  }catch(x){
    if(
      /DAILY_LIMIT_REACHED/i.test(
        x.message||''
      )
    ){
      throw new Error(
        'Has alcanzado el límite diario de anuncios.'
      );
    }

    throw x;
  }

  for(
    const ms of [1000,2000,3000,5000,8000]
  ){
    await sleep(ms);

    try{
      await Promise.all([
        loadAccount(),
        loadRewardStatus()
      ]);

      if(Number(state.user.coins)>start){
        render();

        toast(
          `+${cfg.economy.rewarded_coin_reward} monedas acreditadas.`
        );

        return;
      }
    }catch{}
  }

  try{
    await Promise.all([
      loadAccount(),
      loadRewardStatus()
    ]);
  }catch{}

  render();

  toast(
    'Anuncio completado. Recompensa pendiente de verificación.'
  );
}

function toast(msg){
  const t=document.createElement('div');

  t.className='toast';
  t.textContent=msg;

  document.body.appendChild(t);

  setTimeout(
    ()=>t.remove(),
    2600
  );
}

async function refreshTab(tab){
  if(tab==='inicio'){
    await loadFeed();
  }

  if(tab==='monedas'){
    await Promise.all([
      loadAccount(),
      loadRewardStatus()
    ]);
  }
}

document.addEventListener(
  'submit',
  async e=>{

    if(e.target.id==='signupForm'){
      e.preventDefault();

      const btn=
        e.target.querySelector(
          'button[type="submit"]'
        );

      const err=$('#authError');

      const email=
        $('#email').value.trim();

      const pass=
        $('#password').value;

      const confirm=
        $('#passwordConfirm').value;

      err.textContent='';

      if(pass.length<6){
        err.textContent=
          'La contraseña debe tener al menos 6 caracteres.';
        return;
      }

      if(pass!==confirm){
        err.textContent=
          'Las contraseñas no coinciden.';
        return;
      }

      btn.disabled=true;
      btn.textContent='Creando cuenta…';

      try{
        const s=
          await signUp(email,pass);

        if(
          s?.access_token &&
          s?.user
        ){
          saveSession(s);
          await loadAppData();
          render();
          return;
        }

        state.authMode='login';
        render();

        $('#authSuccess').textContent=
          'Cuenta creada. Revisa tu correo y confirma tu dirección. Después podrás iniciar sesión.';

      }catch(x){
        err.textContent=
          x.message==='User already registered'
            ? 'Ya existe una cuenta con ese correo.'
            : (
                x.message ||
                'No se pudo crear la cuenta.'
              );

        btn.disabled=false;
        btn.textContent='Crear cuenta';
      }

      return;
    }

    if(e.target.id!=='loginForm'){
      return;
    }

    e.preventDefault();

    const btn=
      e.target.querySelector('button');

    const err=$('#authError');

    btn.disabled=true;
    btn.textContent='Entrando…';
    err.textContent='';

    try{
      const s=
        await signIn(
          $('#email').value.trim(),
          $('#password').value
        );

      saveSession(s);
      await loadAppData();
      render();

    }catch(x){
      saveSession(null);

      err.textContent=
        x.message==='Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : x.message;

      btn.disabled=false;
      btn.textContent='Iniciar sesión';
    }
  }
);

document.addEventListener(
  'click',
  async e=>{

    const tab=
      e.target
        .closest('[data-tab]')
        ?.dataset.tab;

    if(tab){
      state.tab=tab;

      try{
        await refreshTab(tab);
      }catch{}

      render();
      return;
    }

    const target=
      e.target.closest('[data-action]');

    const a=
      target?.dataset.action;

    if(a==='show-signup'){
      state.authMode='signup';
      render();
      return;
    }

    if(a==='show-login'){
      state.authMode='login';
      render();
      return;
    }

    if(a==='wallet'){
      state.tab='monedas';

      try{
        await refreshTab('monedas');
      }catch{}

      render();
      return;
    }

    if(a==='go-promote'){
      state.tab='promocionar';
      render();
      return;
    }

    if(a==='logout'){
      saveSession(null);

      state.authMode='login';

      state.user={
        name:'Creador',
        email:'',
        coins:0,
        reserved:0
      };

      state.campaigns=[];
      state.feed=[];

      state.rewardStatus={
        used_today:0,
        pending_today:0,
        daily_limit:
          cfg?.economy?.rewarded_daily_limit||8,
        remaining_today:
          cfg?.economy?.rewarded_daily_limit||8
      };

      render();
      return;
    }

    if(a==='rewarded'){
      target.disabled=true;

      try{
        await showRewarded();
      }catch(x){
        toast(
          x.message ||
          'No se pudo mostrar el anuncio.'
        );
      }finally{
        target.disabled=false;
      }

      return;
    }

    if(a==='open-youtube'){
      const url=
        target.dataset.youtubeUrl;

      if(!url) return;

      rpc(
        'record_outbound_click',
        {
          p_campaign_id:
            target.dataset.campaignId,

          p_video_id:
            target.dataset.videoId
        }
      ).catch(()=>{});

      window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );

      return;
    }

    if(a==='toggle-favorite'){
      const id=
        target.dataset.videoId;

      const item=
        state.feed.find(
          x=>x.video_id===id
        );

      if(!id) return;

      const saved=
        Boolean(item?.is_favorite);

      target.disabled=true;

      try{
        await rpc(
          saved
            ? 'remove_favorite'
            : 'add_favorite',
          {
            p_video_id:id
          }
        );

        if(item){
          item.is_favorite=!saved;
        }

        render();

        toast(
          saved
            ? 'Eliminado de favoritos.'
            : 'Guardado en favoritos.'
        );

      }catch(x){
        toast(
          x.message ||
          'No se pudo actualizar favoritos.'
        );
      }

      return;
    }

    if(a==='campaign-preview'){
      const url=
        $('#url').value.trim();

      const budget=
        Number($('#budget').value);

      const mode=
        $('#mode').value;

      if(
        !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(
          url
        )
      ){
        toast(
          'Introduce un enlace válido de YouTube.'
        );
        return;
      }

      if(
        budget<
          cfg.economy.campaign_min_budget ||
        budget>
          cfg.economy.campaign_max_budget
      ){
        toast(
          'Presupuesto fuera de los límites.'
               );
        return;
      }

      const cost={
        basic:1,
        featured:2,
        boost:4
      }[mode]||1;

      const max=
        Math.floor(budget/cost);

      $('#preview').innerHTML=`
        <div class="review">

          <b>Resumen</b>

          <p>
            ${esc(url)}
          </p>

          <p>
            ${esc(cfg.campaign_modes[mode])}
          </p>

          <p>
            Presupuesto:
            ${money(budget)}
            monedas
          </p>

          <p class="muted">
            Coste:
            ${cost}
            ${
              cost===1
                ? 'moneda'
                : 'monedas'
            }
            por impresión válida.
          </p>

          <p class="muted">
            Hasta
            ${money(max)}
            impresiones internas
            con ese presupuesto.
          </p>

          <button
            class="btn"
            data-action="save-draft"
          >
            Crear campaña
          </button>

        </div>
      `;

      return;
    }

    if(a==='save-draft'){
      target.disabled=true;

      try{
        await rpc(
          'create_campaign',
          {
            p_youtube_url:
              $('#url').value.trim(),

            p_category:
              $('#cat').value,

            p_mode:
              $('#mode').value,

            p_budget:
              Number($('#budget').value)
          }
        );

        await loadAppData();

        toast(
          'Campaña creada correctamente.'
        );

        state.tab='campanas';
        render();

      }catch(x){
        toast(
          x.message ||
          'No se pudo crear la campaña.'
        );
      }

      return;
    }

    if(
      [
        'pause-campaign',
        'resume-campaign',
        'cancel-campaign'
      ].includes(a)
    ){
      const id=
        target.dataset.campaignId;

      const fn={
        'pause-campaign':'pause_campaign',
        'resume-campaign':'resume_campaign',
        'cancel-campaign':'cancel_campaign'
      }[a];

      if(!id) return;

      target.disabled=true;

      try{
        await rpc(
          fn,
          {
            p_campaign_id:id
          }
        );

        await loadAppData();

        toast(
          'Campaña actualizada.'
        );

        render();

      }catch(x){
        toast(
          x.message ||
          'No se pudo actualizar la campaña.'
        );
      }

      return;
    }

    if(
      e.target.closest('[data-sku]')
    ){
      toast(
        'Las compras se activarán antes de publicar.'
      );
    }
  }
);

async function boot(){
  try{
    cfg=
      await fetch(
        'config.json'
      ).then(
        r=>r.json()
      );

    const raw=
      localStorage.getItem(
        'vidioup_session'
      );

    if(raw){
      try{
        let s=
          JSON.parse(raw);

        if(s.refresh_token){
          try{
            s=
              await refreshSession(
                s.refresh_token
              );

            saveSession(s);

          }catch{
            saveSession(null);
          }
        }

        if(state.session){
          await loadAppData();
        }

      }catch{
        saveSession(null);
      }
    }

  }finally{
    state.loading=false;
    render();
  }
}

boot();
