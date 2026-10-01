import { state } from './context.js';
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
