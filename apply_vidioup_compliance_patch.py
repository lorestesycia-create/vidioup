#!/usr/bin/env python3
from pathlib import Path
import subprocess, sys, tempfile, shutil, textwrap

ROOT = Path.cwd()
EXPECTED_BRANCH = "vidioup-next"
EXPECTED_HEAD = "22ef8d5df00ef6bb62b63cef541d90f03f019ca9"

FILES = [
    "www/js/youtube.js",
    "www/js/promote.js",
    "www/js/creator.js",
    "www/js/feed.js",
    "www/js/signals.js",
    "www/js/events.js",
    "www/shorts.css",
]

def run(*args, check=True):
    p = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if check and p.returncode != 0:
        print(p.stdout)
        print(p.stderr, file=sys.stderr)
        raise SystemExit(f"Fallo ejecutando: {' '.join(args)}")
    return p

def replace_between(text, start, end, replacement, label):
    i = text.find(start)
    if i < 0:
        raise SystemExit(f"No encuentro inicio para {label}. No se ha aplicado el parche.")
    j = text.find(end, i)
    if j < 0:
        raise SystemExit(f"No encuentro final para {label}. No se ha aplicado el parche.")
    return text[:i] + replacement + text[j:]

branch = run("git", "branch", "--show-current").stdout.strip()
head = run("git", "rev-parse", "HEAD").stdout.strip()
status_lines = run("git", "status", "--porcelain").stdout.splitlines()
tracked_changes = [line for line in status_lines if not line.startswith("??")]

if branch != EXPECTED_BRANCH:
    raise SystemExit(f"ABORTADO: estás en la rama {branch!r}, no en {EXPECTED_BRANCH!r}.")
if head != EXPECTED_HEAD:
    raise SystemExit(f"ABORTADO: HEAD es {head}, esperaba {EXPECTED_HEAD}.")
if tracked_changes:
    print("Cambios reales detectados:")
    for line in tracked_changes:
        print(" ", line)
    raise SystemExit("ABORTADO: hay cambios reales en archivos ya controlados por Git. No toco nada para no mezclar trabajo.")

for rel in FILES:
    if not (ROOT / rel).exists():
        raise SystemExit(f"ABORTADO: falta {rel}.")

backup = Path(tempfile.mkdtemp(prefix="vidioup_before_compliance_"))
for rel in FILES:
    dst = backup / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / rel, dst)

youtube_js = r"""import { state } from './context.js';
import { esc, card } from './utils.js';

const CATEGORIES=[
  'Historia','Gaming','Música','Tecnología','Humor',
  'Deportes','Motor','Cine','Entretenimiento','Educación'
];

function options(selected='Entretenimiento'){
  return CATEGORIES.map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join('');
}

function niceDate(value){
  if(!value) return 'Todavía no sincronizado';
  try{
    return new Intl.DateTimeFormat('es-ES',{
      dateStyle:'medium',
      timeStyle:'short'
    }).format(new Date(value));
  }catch{
    return String(value);
  }
}

function kindLabel(kind){
  return kind==='short'?'Corto':'Vídeo';
}

export function youtubeChannel(){
  const p=state.myCreatorChannel||{};
  const linked=Boolean(p.youtube_channel_id);
  const verified=Boolean(p.youtube_verified);
  const verificationCode=p.youtube_verification_code||'';
  const rows=state.myVideos||[];
  const title=p.youtube_channel_title||'Canal de YouTube';
  const channelThumb=p.youtube_channel_thumbnail_url||'';
  const selected=p.youtube_default_category||'Entretenimiento';

  const linkedCard=linked?card(`
    <div class="yt-channel-head">
      ${channelThumb
        ? `<img src="${esc(channelThumb)}" alt="" class="yt-channel-avatar">`
        : `<div class="avatar">${esc((title[0]||'Y').toUpperCase())}</div>`
      }
      <div class="yt-channel-copy">
        <h2>${esc(title)}</h2>
        <p class="muted">${esc(p.youtube_handle||'Canal enlazado')}</p>
      </div>
    </div>

    <div class="yt-status-row">
      <span class="pill">${verified?'Canal verificado':'Verificación pendiente'}</span>
      <span class="muted">Última sincronización: ${esc(niceDate(p.youtube_last_synced_at))}</span>
    </div>

    ${p.youtube_sync_status==='error'&&p.youtube_sync_error
      ? `<p class="yt-error">${esc(p.youtube_sync_error)}</p>`
      : ''
    }

    ${!verified?`
      <div class="review">
        <b>Verifica que este canal es tuyo</b>
        <p class="muted">VidioUp no pide acceso a tu cuenta de Google. Pon temporalmente el código en la descripción pública de tu canal, guarda el cambio y vuelve aquí.</p>
        ${verificationCode
          ? `<p><code>${esc(verificationCode)}</code></p>
             <p class="muted">El código caduca: ${esc(niceDate(p.youtube_verification_expires_at))}</p>`
          : `<p class="muted">Genera un código temporal para iniciar la comprobación.</p>`
        }
        <div class="row wrap">
          ${verificationCode
            ? `<button class="btn" data-action="youtube-verify-channel">Ya lo he puesto · Verificar</button>`
            : ''
          }
          <button class="ghost" data-action="youtube-restart-verification">${verificationCode?'Generar otro código':'Generar código'}</button>
        </div>
      </div>
    `:''}

    <label>Categoría principal</label>
    <select id="ytLinkedCategory">${options(selected)}</select>

    <div class="row wrap yt-actions">
      ${verified?`<button class="btn" data-action="youtube-sync-channel">Actualizar últimos 20</button>`:''}
      <button class="ghost" data-action="view-my-public-profile">Ver perfil público</button>
      <button class="ghost danger-outline" data-action="youtube-unlink">Desenlazar</button>
    </div>

    <p class="muted yt-note">${verified
      ? 'Canal verificado. VidioUp solo permitirá importar y promocionar contenido público elegible de este canal.'
      : 'Hasta completar la verificación no se podrán añadir ni promocionar vídeos nuevos.'
    }</p>
  `):card(`
    <h2>Verifica tu canal</h2>
    <p class="muted">Añade el enlace del canal, su @handle o su ID. VidioUp generará un código temporal para comprobar que controlas el canal sin pedir acceso a tu cuenta de Google.</p>

    <label>Canal de YouTube</label>
    <input id="ytChannelInput" placeholder="https://youtube.com/@tu-canal o @tu-canal">

    <label>Categoría principal</label>
    <select id="ytDefaultCategory">${options(selected)}</select>

    <button class="btn wide" data-action="youtube-link-channel">Generar código de verificación</button>

    <p class="muted yt-note">Después de verificarlo, VidioUp podrá importar como máximo los 20 vídeos públicos más recientes y mantener sus datos actualizados.</p>
  `);

  const singleVideo=verified?card(`
    <h2>Añadir un vídeo de tu canal</h2>
    <p class="muted">Solo se aceptan vídeos públicos, reproducibles y pertenecientes al canal verificado.</p>
    <label>Enlace del vídeo</label>
    <input id="ytVideoInput" placeholder="https://youtu.be/…">
    <label>Categoría</label>
    <select id="ytVideoCategory">${options(selected)}</select>
    <button class="ghost wide" data-action="youtube-import-video">Añadir vídeo</button>
  `):'';

  const videos=rows.length
    ? `<div class="yt-video-list">${rows.map(v=>`
        <section class="card yt-video-row ${v.is_hidden?'is-hidden':''}">
          ${v.thumbnail_url
            ? `<img class="yt-video-thumb" src="${esc(v.thumbnail_url)}" alt="">`
            : `<div class="yt-video-thumb placeholder">▶</div>`
          }
          <div class="yt-video-main">
            <b>${esc(v.title||'Vídeo')}</b>
            <div class="yt-video-badges">
              <span class="pill">${esc(kindLabel(v.content_kind==='unknown'?'video':v.content_kind))}</span>
              ${v.is_hidden?'<span class="pill muted-pill">Oculto</span>':'<span class="pill">Visible</span>'}
            </div>
            <p class="muted">${esc(v.category||'Sin categoría')}</p>
            <div class="row wrap">
              <button class="ghost compact" data-action="youtube-toggle-hidden" data-video-id="${esc(v.id)}" data-hidden="${v.is_hidden?'1':'0'}">${v.is_hidden?'Mostrar':'Ocultar'}</button>
              <button class="ghost compact" data-action="youtube-change-kind" data-video-id="${esc(v.id)}" data-kind="${esc(v.content_kind==='unknown'?'video':v.content_kind)}">Cambiar a ${v.content_kind==='short'?'Vídeo':'Corto'}</button>
              <button class="ghost compact" data-action="open-youtube-simple" data-url="${esc(v.youtube_url)}">YouTube</button>
            </div>
          </div>
        </section>
      `).join('')}</div>`
    : `<section class="empty-state"><b>Aún no tienes vídeos importados</b><p>${verified?'Actualiza el canal o añade un vídeo concreto.':'Primero verifica el canal.'}</p></section>`;

  return `
    <div class="section-title">
      <button class="back-btn" data-tab="creator">‹</button>
      <div><h2>Mi canal</h2><p>Contenido que aparecerá en VidioUp.</p></div>
    </div>
    ${linkedCard}
    ${singleVideo}
    <div class="section-title yt-list-title"><div><h2>Mis vídeos</h2><p>${rows.length} en VidioUp</p></div></div>
    ${videos}
  `;
}
"""

promote_js = r"""import { cfg, state } from './context.js';
import { esc, money, card } from './utils.js';

export function promote(){
  const p=state.myCreatorChannel||{};
  const verified=Boolean(p.youtube_verified);
  const termsAccepted=Boolean(
    p.creator_terms_accepted_at &&
    p.creator_terms_version==='2026-10-01'
  );

  const videos=(state.myVideos||[]).filter(v=>
    !v.is_hidden &&
    v.status==='active' &&
    v.source==='youtube_import' &&
    v.youtube_video_id &&
    v.youtube_channel_id===p.youtube_channel_id
  );

  if(!verified){
    return card(`
      <h2>Verifica tu canal primero</h2>
      <p class="muted">Para crear campañas, VidioUp debe comprobar que el canal de YouTube te pertenece.</p>
      <button class="btn wide" data-action="studio-channel">Ir a Mi canal</button>
    `);
  }

  if(!termsAccepted){
    return card(`
      <h2>Condiciones para creadores</h2>
      <p>Antes de añadir o promocionar contenido debes aceptar las condiciones de VidioUp para creadores.</p>
      <p class="muted">Solo puedes promocionar contenido propio de tu canal verificado. Las campañas compran distribución dentro de VidioUp y no compran ni garantizan reproducciones, Me gusta, comentarios, suscripciones ni tiempo de visualización en YouTube.</p>
      <p><a href="https://vidioup-privacy.floot.app/terminos" target="_blank" rel="noopener">Leer condiciones de uso</a></p>
      <button class="btn wide" data-action="accept-creator-terms">Aceptar y continuar</button>
    `);
  }

  if(!videos.length){
    return card(`
      <h2>No hay vídeos elegibles</h2>
      <p class="muted">Actualiza tu canal verificado para importar contenido público elegible antes de crear una campaña.</p>
      <button class="btn wide" data-action="studio-channel">Ir a Mi canal</button>
    `);
  }

  return card(`
    <h2>Nueva campaña</h2>

    <label>Vídeo de tu canal verificado</label>
    <select id="campaignVideo">
      ${videos.map(v=>`<option value="${esc(v.id)}">${esc(v.title||'Vídeo')}</option>`).join('')}
    </select>

    <label>Modalidad</label>
    <select id="mode">
      <option value="basic">Básica · 1 moneda por exposición válida</option>
      <option value="featured">Destacada · 2 monedas por exposición válida</option>
      <option value="boost">Impulso · 4 monedas por exposición válida</option>
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
      El presupuesto mínimo es ${money(cfg.economy.campaign_min_budget)} monedas.
      La modalidad indica cuántas monedas consume cada exposición válida dentro de VidioUp.
      No es el precio total de la campaña.
    </p>

    <button class="btn wide" data-action="campaign-preview">Revisar campaña</button>
    <div id="preview"></div>
  `);
}
"""

creator_js = r"""import { state } from './context.js';
import { esc, money, card } from './utils.js';

function creatorAvatar(url,name){
  const initial=(name||'C')[0].toUpperCase();
  return `
    <div class="avatar large creator-avatar profile-avatar">
      <span class="creator-avatar-fallback">${esc(initial)}</span>
      ${url?`<img src="${esc(url)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}
    </div>
  `;
}

export function creatorStudio(){
  return `
    <div class="section-title"><button class="back-btn" data-tab="perfil">‹</button><div><h2>Creator Studio</h2><p>Herramientas para tu canal y promociones.</p></div></div>
    ${card(`
      <div class="studio-balance"><span>Monedas disponibles</span><strong>${money(state.user.coins)}</strong></div>
      <div class="studio-grid">
        <button class="studio-btn" data-action="studio-channel"><b>Mi canal</b><span>Perfil y vídeos</span></button>
        <button class="studio-btn" data-action="go-promote"><b>Promocionar</b><span>Crear campaña</span></button>
        <button class="studio-btn" data-action="go-campaigns"><b>Campañas</b><span>Gestionar campañas</span></button>
        <button class="studio-btn" data-action="wallet"><b>Monedas</b><span>Anuncios y saldo</span></button>
      </div>
    `)}
  `;
}

export function creatorProfile(){
  const p=state.selectedCreator;
  if(!p){
    return `<section class="empty-state"><b>No se pudo cargar el creador.</b></section>`;
  }

  const own=p.user_id===state.session?.user?.id;
  return `
    <div class="section-title"><button class="back-btn" data-tab="inicio">‹</button><div><h2>${esc(p.display_name||'Creador')}</h2><p>${Number(p.follower_count||0).toLocaleString('es-ES')} seguidores · ${Number(p.video_count||0).toLocaleString('es-ES')} vídeos</p></div></div>
    ${card(`
      <div class="public-profile">
        ${creatorAvatar(p.avatar_url,p.display_name)}
        <div class="public-profile-main">
          <h2>${esc(p.display_name||'Creador')}</h2>
          <p class="muted">${esc(p.bio||'')}</p>
          <div class="row wrap">
            ${own
              ? ''
              : `<button class="btn" data-action="toggle-follow" data-creator-id="${esc(p.user_id)}" data-following="${p.is_following?'1':'0'}">${p.is_following?'Siguiendo':'Seguir'}</button>`
            }
            ${p.youtube_channel_url?`<button class="ghost" data-action="open-channel" data-url="${esc(p.youtube_channel_url)}">Ver canal en YouTube</button>`:''}
            ${own?'':`<button class="ghost danger-outline" data-action="report-creator" data-creator-id="${esc(p.user_id)}">Denunciar creador</button>`}
            ${own?'':`<button class="ghost danger-outline" data-action="block-creator" data-creator-id="${esc(p.user_id)}">Bloquear creador</button>`}
          </div>
        </div>
      </div>
    `)}
    <div class="creator-videos">
      ${(state.selectedCreatorVideos||[]).length
        ? state.selectedCreatorVideos.map(v=>`<section class="card compact-card"><img class="creator-thumb" src="${esc(v.thumbnail_url||'')}" alt=""><div><b>${esc(v.video_title||'Vídeo')}</b><p class="muted">${esc(v.category||'')}</p><button class="ghost compact" data-action="open-youtube-simple" data-url="${esc(v.youtube_url)}">Ver en YouTube</button></div></section>`).join('')
        : `<section class="empty-state"><p>Este creador todavía no tiene vídeos visibles.</p></section>`
      }
    </div>
  `;
}
"""

feed_js = r"""import { state } from './context.js';
import { esc } from './utils.js';

function youtubeEmbed(videoId,{muted=false}={}){
  if(!videoId) return '';
  const origin=globalThis.location?.origin||'https://localhost';
  const params=new URLSearchParams({
    playsinline:'1',
    rel:'0',
    enablejsapi:'1',
    origin
  });
  if(muted) params.set('mute','1');
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

function creatorAvatar(url,creator){
  const initial=(creator?.[0]||'C').toUpperCase();
  return `
    <span class="mini-avatar creator-avatar">
      <span class="creator-avatar-fallback">${esc(initial)}</span>
      ${url?`<img src="${esc(url)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}
    </span>
  `;
}

export function modeSwitch(){
  return `
    <div class="mode-switch" role="tablist" aria-label="Tipo de contenido">
      <button class="${state.contentMode==='short'?'active':''}" data-action="content-mode" data-mode="short">Cortos</button>
      <button class="${state.contentMode==='video'?'active':''}" data-action="content-mode" data-mode="video">Vídeos</button>
    </div>
  `;
}

function shortCard(v,{followingOnly=false}={}){
  const title=v.video_title||'Vídeo de VidioUp';
  const creator=v.creator_name||'Creador';
  const embed=youtubeEmbed(v.youtube_video_id,{muted:true});

  return `
    <article class="feed-item short-item ${v.is_promoted?'promoted-item':''}" data-video-id="${esc(v.video_id)}" ${v.campaign_id?`data-campaign-id="${esc(v.campaign_id)}"`:''}>
      <div class="player-shell vertical">
        ${embed
          ? `<iframe src="${esc(embed)}" title="${esc(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
          : v.thumbnail_url
            ? `<img src="${esc(v.thumbnail_url)}" alt="Miniatura del vídeo" loading="lazy">`
            : `<div class="video-placeholder">▶</div>`
        }
      </div>

      <div class="short-meta-panel">
        <div class="short-info-panel">
          <div class="short-creator-row">
            <button class="creator-link" data-action="open-creator" data-creator-id="${esc(v.creator_id)}">
              ${creatorAvatar(v.creator_avatar_url,creator)}
              <span>${esc(creator)}</span>
            </button>
            ${followingOnly||v.is_following
              ? `<button class="follow-btn following" data-action="toggle-follow" data-creator-id="${esc(v.creator_id)}" data-following="1" ${v.campaign_id?`data-campaign-id="${esc(v.campaign_id)}"`:''}>Siguiendo</button>`
              : `<button class="follow-btn" data-action="toggle-follow" data-creator-id="${esc(v.creator_id)}" data-following="0" ${v.campaign_id?`data-campaign-id="${esc(v.campaign_id)}"`:''}>Seguir</button>`
            }
          </div>
          <h2 class="feed-title short-title">${esc(title)}</h2>
          ${v.is_promoted?`<span class="promoted-label">Promocionado</span>`:''}
        </div>

        <div class="short-actions">
          <button class="ghost compact" data-action="toggle-favorite" data-video-id="${esc(v.video_id)}">${v.is_favorite?'★ Guardado':'☆ Guardar'}</button>
          <button class="ghost compact" data-action="share-video" data-youtube-url="${esc(v.youtube_url)}">Compartir</button>
          <button class="ghost compact more" data-action="feed-more" data-video-id="${esc(v.video_id)}" aria-expanded="false">⋮</button>
        </div>
      </div>

      <div class="feed-more-menu short-more-menu" data-more-menu="${esc(v.video_id)}" hidden>
        <button data-action="not-interested" data-video-id="${esc(v.video_id)}">No me interesa</button>
        <button data-action="report-video" data-video-id="${esc(v.video_id)}">Denunciar</button>
      </div>
    </article>
  `;
}

function longCard(v,{followingOnly=false}={}){
  const title=v.video_title||'Vídeo de VidioUp';
  const creator=v.creator_name||'Creador';
  const embed=youtubeEmbed(v.youtube_video_id);

  return `
    <article class="feed-item long-item ${v.is_promoted?'promoted-item':''}" data-video-id="${esc(v.video_id)}" ${v.campaign_id?`data-campaign-id="${esc(v.campaign_id)}"`:''}>
      ${v.is_promoted?`<span class="promoted-label">Promocionado</span>`:''}
      <div class="player-shell horizontal">
        ${embed
          ? `<iframe src="${esc(embed)}" title="${esc(title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
          : v.thumbnail_url
            ? `<img src="${esc(v.thumbnail_url)}" alt="Miniatura del vídeo" loading="lazy">`
            : `<div class="video-placeholder">▶</div>`
        }
      </div>

      <div class="feed-meta">
        <button class="creator-link" data-action="open-creator" data-creator-id="${esc(v.creator_id)}">
          ${creatorAvatar(v.creator_avatar_url,creator)}
          <span>${esc(creator)}</span>
        </button>

        ${followingOnly||v.is_following
          ? `<button class="follow-btn following" data-action="toggle-follow" data-creator-id="${esc(v.creator_id)}" data-following="1" ${v.campaign_id?`data-campaign-id="${esc(v.campaign_id)}"`:''}>Siguiendo</button>`
          : `<button class="follow-btn" data-action="toggle-follow" data-creator-id="${esc(v.creator_id)}" data-following="0" ${v.campaign_id?`data-campaign-id="${esc(v.campaign_id)}"`:''}>Seguir</button>`
        }
      </div>

      <h2 class="feed-title">${esc(title)}</h2>

      <div class="feed-actions">
        <button class="ghost compact" data-action="toggle-favorite" data-video-id="${esc(v.video_id)}">
          ${v.is_favorite?'★ Guardado':'☆ Guardar'}
        </button>
        <button class="ghost compact" data-action="share-video" data-youtube-url="${esc(v.youtube_url)}">Compartir</button>
        <button class="ghost compact" data-action="open-youtube" data-youtube-url="${esc(v.youtube_url)}" data-video-id="${esc(v.video_id)}" ${v.campaign_id?`data-campaign-id="${esc(v.campaign_id)}"`:''}>Ver en YouTube</button>
        <button class="ghost compact more" data-action="feed-more" data-video-id="${esc(v.video_id)}" aria-expanded="false">⋮</button>
      </div>

      <div class="feed-more-menu" data-more-menu="${esc(v.video_id)}" hidden>
        <button data-action="not-interested" data-video-id="${esc(v.video_id)}">No me interesa</button>
        <button data-action="report-video" data-video-id="${esc(v.video_id)}">Denunciar</button>
      </div>
    </article>
  `;
}

export function videoCard(v,options={}){
  return state.contentMode==='short'
    ? shortCard(v,options)
    : longCard(v,options);
}

function mixedHomeRows(){
  const original=[...(state.organicFeed||[])];
  const promos=[...(state.promotedFeed||[])];
  if(!original.length||!promos.length) return original;

  const promoIds=new Set(promos.map(x=>x.video_id));
  const organic=original.filter(x=>!promoIds.has(x.video_id));

  if(organic.length<5) return original;

  const mixed=[];
  let promoIndex=0;

  organic.forEach((item,index)=>{
    mixed.push(item);
    if((index+1)%5===0&&promoIndex<promos.length){
      mixed.push(promos[promoIndex++]);
    }
  });

  return mixed;
}

export function home(){
  const rows=mixedHomeRows();
  const short=state.contentMode==='short';
  const content=rows.length
    ? rows.map(v=>videoCard(v)).join('')
    : `
      <section class="empty-state">
        <b>${short?'Todavía no hay Cortos':'Todavía no hay vídeos'}</b>
        <p>En cuanto haya contenido disponible aparecerá aquí.</p>
        <button class="ghost" data-action="content-mode" data-mode="${short?'video':'short'}">
          ${short?'Ver vídeos':'Ver Cortos'}
        </button>
      </section>
    `;

  return `
    <div class="feed-head">
      ${modeSwitch()}
    </div>
    <div class="feed-stream ${short?'snap-feed immersive-short-feed':''}">
      ${content}
    </div>
  `;
}
"""

signals_js = r"""import { state, getGuestId } from './context.js';
import { rpc } from './supabase.js';

let observer=null;
const activeSessions=new Map();

function youtubeCommand(iframe,func){
  if(!iframe?.contentWindow) return;
  try{
    iframe.contentWindow.postMessage(JSON.stringify({
      event:'command',
      func,
      args:[]
    }),'*');
  }catch{}
}

function pauseShortItem(el){
  if(!el) return;
  const iframe=el.querySelector('.player-shell iframe');
  youtubeCommand(iframe,'pauseVideo');
  el.classList.remove('is-playing');
}

function pauseOtherShorts(active){
  document.querySelectorAll('.short-item').forEach(item=>{
    if(item!==active) pauseShortItem(item);
  });
}

function playMutedShortItem(el){
  if(!el) return;
  pauseOtherShorts(el);
  const iframe=el.querySelector('.player-shell iframe');
  if(!iframe) return;

  const attempt=()=>{
    if(!activeSessions.has(el)||!el.isConnected) return;
    youtubeCommand(iframe,'mute');
    youtubeCommand(iframe,'playVideo');
    el.classList.add('is-playing');
  };

  attempt();

  if(!iframe.dataset.vidioupAutoplayHook){
    iframe.dataset.vidioupAutoplayHook='1';
    iframe.addEventListener('load',()=>setTimeout(attempt,120),{once:true});
  }

  setTimeout(attempt,450);
  setTimeout(attempt,1000);
}

function stopAllShorts(){
  document.querySelectorAll('.short-item').forEach(pauseShortItem);
}

function stopSession(el){
  const started=activeSessions.get(el);
  if(!started) return;

  activeSessions.delete(el);

  const seconds=(performance.now()-started)/1000;
  if(seconds<0.6) return;

  const videoId=el.dataset.videoId;
  if(!videoId) return;

  const visibleSeconds=Number(seconds.toFixed(1));

  if(state.session){
    rpc('record_video_signal',{
      p_video_id:videoId,
      p_visible_seconds:visibleSeconds,
      p_quick_swipe:seconds<2.5
    }).catch(()=>{});
  }

  const campaignId=el.dataset.campaignId;
  if(campaignId){
    rpc('record_campaign_exposure_v2',{
      p_campaign_id:campaignId,
      p_visible_seconds:visibleSeconds,
      p_guest_id:getGuestId()
    }).catch(()=>{});
  }
}

export function stopFeedTracking({record=false}={}){
  if(observer){
    observer.disconnect();
    observer=null;
  }

  if(record){
    [...activeSessions.keys()].forEach(stopSession);
  }else{
    activeSessions.clear();
  }

  stopAllShorts();
}

export function initFeedTracking(){
  stopFeedTracking();

  if(!('IntersectionObserver' in window)) return;

  const items=[...document.querySelectorAll('.feed-item[data-video-id]')];
  if(!items.length) return;

  observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      const el=entry.target;

      if(entry.isIntersecting&&entry.intersectionRatio>=0.65){
        if(!activeSessions.has(el)){
          activeSessions.set(el,performance.now());
        }
        if(el.classList.contains('short-item')&&entry.intersectionRatio>=0.75&&!el.classList.contains('is-playing')){
          playMutedShortItem(el);
        }
      }else{
        if(activeSessions.has(el)) stopSession(el);
        if(el.classList.contains('short-item')) pauseShortItem(el);
      }
    });
  },{threshold:[0,0.25,0.65,0.75,0.9]});

  items.forEach(el=>observer.observe(el));
}

window.addEventListener('pagehide',()=>stopFeedTracking({record:true}));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    stopFeedTracking({record:true});
  }else{
    initFeedTracking();
  }
});
"""

shorts_css = r"""/* Immersive short-video feed: YouTube player remains fully interactive and unobscured. */
.short-item{position:relative}
.short-item .short-meta-panel{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 14px 12px;background:#000;color:#fff}
.short-item .short-info-panel{min-width:0;flex:1}
.short-item .short-creator-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.short-item .short-creator-row .creator-link{max-width:calc(100% - 92px);color:#fff}
.short-item .short-creator-row .creator-link>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.short-item .short-creator-row .follow-btn{padding:7px 12px}
.short-item .short-title{margin:8px 0 4px;font-size:15px;line-height:1.3;color:#fff;max-width:100%;-webkit-line-clamp:2}
.short-item .short-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.short-item .short-actions .ghost{color:#fff;border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.08)}
.short-item .promoted-label{position:static;display:inline-block;margin-top:2px}
.short-item .short-more-menu{z-index:12;right:14px;bottom:70px}

body:has(.immersive-short-feed){padding-bottom:0;overflow:hidden;background:#000}
body:has(.immersive-short-feed) .top{display:none}
body:has(.immersive-short-feed) main{max-width:none!important;height:calc(100svh - 66px);overflow:hidden;margin:0}
body:has(.immersive-short-feed) .feed-head{position:fixed;top:calc(env(safe-area-inset-top) + 8px);left:50%;transform:translateX(-50%);z-index:30;width:max-content;padding:0;background:none}
body:has(.immersive-short-feed) .mode-switch{background:rgba(10,10,14,.48);border-color:rgba(255,255,255,.22);backdrop-filter:blur(10px);box-shadow:0 3px 14px rgba(0,0,0,.24)}
body:has(.immersive-short-feed) .mode-switch button{color:rgba(255,255,255,.78)}
body:has(.immersive-short-feed) .mode-switch button.active{background:rgba(255,255,255,.94);color:#11131a}

.immersive-short-feed{height:calc(100svh - 66px);overflow-y:auto;overflow-x:hidden;padding:0;background:#000;scroll-snap-type:y mandatory;scrollbar-width:none;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch}
.immersive-short-feed::-webkit-scrollbar{display:none}
.immersive-short-feed .short-item{height:calc(100svh - 66px);min-height:calc(100svh - 66px);width:100%;margin:0;padding:0;border:0;border-radius:0;background:#000;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;display:flex;flex-direction:column}
.immersive-short-feed .short-item .player-shell.vertical{width:100%;flex:1;min-height:240px;max-height:none;aspect-ratio:auto;margin:0;border-radius:0;background:#000}
.immersive-short-feed .short-item .player-shell iframe,.immersive-short-feed .short-item .player-shell img{width:100%;height:100%;object-fit:cover;border-radius:0;pointer-events:auto}
.immersive-short-feed .short-item .video-placeholder{height:100%;width:100%;display:grid;place-items:center}

@media (min-width:720px){
  body:has(.immersive-short-feed) main{max-width:520px!important;margin:0 auto;background:#000}
  .immersive-short-feed{max-width:520px;margin:0 auto}
}
"""

(ROOT / "www/js/youtube.js").write_text(youtube_js, encoding="utf-8")
(ROOT / "www/js/promote.js").write_text(promote_js, encoding="utf-8")
(ROOT / "www/js/creator.js").write_text(creator_js, encoding="utf-8")
(ROOT / "www/js/feed.js").write_text(feed_js, encoding="utf-8")
(ROOT / "www/js/signals.js").write_text(signals_js, encoding="utf-8")
(ROOT / "www/shorts.css").write_text(shorts_css, encoding="utf-8")

events_path = ROOT / "www/js/events.js"
events = events_path.read_text(encoding="utf-8")

events = events.replace(
    "'youtube-sync-channel','youtube-import-video','youtube-toggle-hidden',",
    "'youtube-sync-channel','youtube-import-video','youtube-verify-channel','youtube-restart-verification','youtube-toggle-hidden',"
)
events = events.replace(
    "'youtube-change-kind','youtube-unlink','toggle-follow','block-creator',",
    "'youtube-change-kind','youtube-unlink','toggle-follow','block-creator','report-creator',"
)
events = events.replace(
    "'toggle-interest','save-interests','account-security','blocked-users',",
    "'toggle-interest','save-interests','account-security','blocked-users','accept-creator-terms',"
)

old_go_promote = """    if(a==='go-promote'){
      state.tab='promocionar';
      render();
      return;
    }
"""
new_go_promote = """    if(a==='go-promote'){
      try{
        await loadMyChannel();
      }catch(x){
        toast(x.message||'No se pudo cargar tu canal.');
      }
      state.tab='promocionar';
      render();
      return;
    }
"""
if old_go_promote not in events:
    raise SystemExit("No encuentro el bloque go-promote esperado.")
events = events.replace(old_go_promote, new_go_promote, 1)

youtube_start = "    if(a==='youtube-link-channel'){"
youtube_end = "    if(a==='youtube-toggle-hidden'){"
youtube_handlers = r"""    if(a==='youtube-link-channel'){
      const input=$('#ytChannelInput')?.value?.trim()||'';
      const category=$('#ytDefaultCategory')?.value||'Entretenimiento';
      if(!input){
        toast('Introduce el enlace, @handle o ID del canal.');
        return;
      }
      target.disabled=true;
      try{
        await edge('youtube-ownership',{
          action:'start_verification',
          channel_input:input,
          category
        });
        await loadMyChannel();
        render();
        toast('Código temporal generado. Ponlo en la descripción pública de tu canal.');
      }catch(x){
        toast(x.message||'No se pudo iniciar la verificación.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-restart-verification'){
      const channelInput=state.myCreatorChannel?.youtube_channel_id||'';
      const category=$('#ytLinkedCategory')?.value||state.myCreatorChannel?.youtube_default_category||'Entretenimiento';
      if(!channelInput){
        toast('No hay un canal enlazado.');
        return;
      }
      target.disabled=true;
      try{
        await edge('youtube-ownership',{
          action:'start_verification',
          channel_input:channelInput,
          category
        });
        await loadMyChannel();
        render();
        toast('Nuevo código temporal generado.');
      }catch(x){
        toast(x.message||'No se pudo generar otro código.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-verify-channel'){
      const category=$('#ytLinkedCategory')?.value||state.myCreatorChannel?.youtube_default_category||'Entretenimiento';
      target.disabled=true;
      try{
        const result=await edge('youtube-ownership',{
          action:'verify_channel'
        });

        if(result?.verified){
          await edge('youtube-ownership',{
            action:'sync_verified_channel',
            category,
            limit:20
          });
        }

        await Promise.all([
          loadMyChannel(),
          loadOrganicFeed(),
          loadPromotedFeed(),
          loadFollowingFeed()
        ]);
        render();
        toast('Canal verificado correctamente.');
      }catch(x){
        toast(x.message||'El código aún no se ha podido comprobar.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-sync-channel'){
      const category=$('#ytLinkedCategory')?.value||state.myCreatorChannel?.youtube_default_category||'Entretenimiento';
      target.disabled=true;
      try{
        const result=await edge('youtube-ownership',{
          action:'sync_verified_channel',
          category,
          limit:20
        });
        await Promise.all([
          loadMyChannel(),
          loadOrganicFeed(),
          loadPromotedFeed(),
          loadFollowingFeed()
        ]);
        render();
        toast(`Canal actualizado · ${Number(result?.imported||0)} nuevos y ${Number(result?.updated||0)} actualizados.`);
      }catch(x){
        toast(x.message||'No se pudo actualizar el canal.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-import-video'){
      const url=$('#ytVideoInput')?.value?.trim()||'';
      const category=$('#ytVideoCategory')?.value||'Entretenimiento';
      if(!url){
        toast('Introduce un enlace de vídeo de YouTube.');
        return;
      }
      target.disabled=true;
      try{
        await edge('youtube-ownership',{
          action:'import_verified_video',
          video_url:url,
          category
        });
        await Promise.all([
          loadMyChannel(),
          loadOrganicFeed(),
          loadFollowingFeed()
        ]);
        render();
        toast('Vídeo añadido a VidioUp.');
      }catch(x){
        toast(x.message||'No se pudo añadir el vídeo.');
      }finally{
        target.disabled=false;
      }
      return;
    }

"""
events = replace_between(events, youtube_start, youtube_end, youtube_handlers, "handlers YouTube")

block_end_marker = "    if(a==='share-video'){"
insert_report = r"""    if(a==='report-creator'){
      const id=target.dataset.creatorId;
      if(!id) return;

      const ok=window.confirm('¿Quieres denunciar este creador para revisión?');
      if(!ok) return;

      target.disabled=true;
      try{
        await rpc('create_report',{
          p_target_type:'creator',
          p_target_id:id,
          p_reason:'other'
        });
        toast('Denuncia enviada. Gracias.');
      }catch(x){
        toast(x.message||'No se pudo enviar la denuncia.');
      }finally{
        target.disabled=false;
      }
      return;
    }

"""
idx = events.find(block_end_marker)
if idx < 0:
    raise SystemExit("No encuentro el punto para insertar report-creator.")
events = events[:idx] + insert_report + events[idx:]

campaign_start = "    if(a==='campaign-preview'){"
campaign_end = "    if(\n      [\n        'pause-campaign',"
campaign_handlers = r"""    if(a==='accept-creator-terms'){
      target.disabled=true;
      try{
        await rpc('accept_creator_terms',{
          p_version:'2026-10-01'
        });
        await loadMyChannel();
        render();
        toast('Condiciones aceptadas.');
      }catch(x){
        toast(x.message||'No se pudieron aceptar las condiciones.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='campaign-preview'){
      const videoId=$('#campaignVideo')?.value||'';
      const budget=Number($('#budget')?.value);
      const mode=$('#mode')?.value;
      const video=(state.myVideos||[]).find(v=>v.id===videoId);

      if(!video){
        toast('Selecciona un vídeo válido de tu canal.');
        return;
      }

      if(
        budget<cfg.economy.campaign_min_budget ||
        budget>cfg.economy.campaign_max_budget
      ){
        toast('Presupuesto fuera de los límites.');
        return;
      }

      const cost={
        basic:1,
        featured:2,
        boost:4
      }[mode]||1;

      const max=Math.floor(budget/cost);

      $('#preview').innerHTML=`
        <div class="review">
          <b>Resumen</b>
          <p>${esc(video.title||'Vídeo')}</p>
          <p class="muted">${esc(video.youtube_url||'')}</p>
          <p>${esc(cfg.campaign_modes[mode])}</p>
          <p>Presupuesto: ${money(budget)} monedas</p>
          <p class="muted">
            Coste: ${cost} ${cost===1?'moneda':'monedas'} por exposición válida.
          </p>
          <p class="muted">
            Hasta ${money(max)} exposiciones válidas dentro de VidioUp con ese presupuesto.
          </p>
          <button class="btn" data-action="save-draft">Crear campaña</button>
        </div>
      `;

      return;
    }

    if(a==='save-draft'){
      target.disabled=true;

      try{
        await rpc(
          'create_verified_campaign',
          {
            p_video_id:$('#campaignVideo').value,
            p_mode:$('#mode').value,
            p_budget:Number($('#budget').value)
          }
        );

        await loadAppData();

        toast('Campaña creada correctamente.');

        state.tab='campanas';
        render();

      }catch(x){
        toast(x.message||'No se pudo crear la campaña.');
      }finally{
        target.disabled=false;
      }

      return;
    }

"""
events = replace_between(events, campaign_start, campaign_end, campaign_handlers, "campañas verificadas")

events_path.write_text(events, encoding="utf-8")

# Basic syntax/content validation
run("git", "diff", "--check")

# Bundle the app exactly as Codemagic does, but only as a validation file in /tmp.
bundle = run(
    "npx", "esbuild", "www/app.js",
    "--bundle",
    "--platform=browser",
    "--format=iife",
    "--outfile=/tmp/vidioup-compliance-check.js",
    check=False
)
if bundle.returncode != 0:
    print(bundle.stdout)
    print(bundle.stderr, file=sys.stderr)
    raise SystemExit("ABORTADO: el bundle de prueba ha fallado. Los archivos originales están guardados en " + str(backup))

changed = run("git", "diff", "--name-only").stdout.strip().splitlines()
expected = sorted(FILES)
if sorted(changed) != expected:
    raise SystemExit(
        "ABORTADO: el conjunto de archivos modificados no es el esperado.\n"
        f"Esperaba: {expected}\n"
        f"Hay: {sorted(changed)}\n"
        f"Backup: {backup}"
    )

print("\nPARCHE APLICADO Y VALIDADO.")
print("Rama:", branch)
print("HEAD base:", head)
print("Archivos modificados:")
for x in changed:
    print(" -", x)
print("\nBackup temporal:", backup)
print("\nNO se ha hecho commit, push, merge, publicación ni cambio de versión.")
print("Ahora revisa el panel Git de Replit; deben aparecer solo estos 7 archivos.")
