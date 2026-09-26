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
      <span class="pill">${p.youtube_verified?'Canal verificado':'Conexión provisional'}</span>
      <span class="muted">Última sincronización: ${esc(niceDate(p.youtube_last_synced_at))}</span>
    </div>

    ${p.youtube_sync_status==='error'&&p.youtube_sync_error
      ? `<p class="yt-error">${esc(p.youtube_sync_error)}</p>`
      : ''
    }

    <label>Categoría principal</label>
    <select id="ytLinkedCategory">${options(selected)}</select>

    <div class="row wrap yt-actions">
      <button class="btn" data-action="youtube-sync-channel">Actualizar últimos 20</button>
      <button class="ghost" data-action="view-my-public-profile">Ver perfil público</button>
      <button class="ghost danger-outline" data-action="youtube-unlink">Desenlazar</button>
    </div>

    <p class="muted yt-note">La vinculación mediante Google/YouTube se añadirá antes del lanzamiento para verificar la propiedad del canal. La importación actual usa únicamente datos públicos.</p>
  `):card(`
    <h2>Enlazar tu canal</h2>
    <p class="muted">Añade el enlace del canal, su @handle o su ID. VidioUp importará como máximo los 20 vídeos públicos más recientes.</p>

    <label>Canal de YouTube</label>
    <input id="ytChannelInput" placeholder="https://youtube.com/@tu-canal o @tu-canal">

    <label>Categoría principal</label>
    <select id="ytDefaultCategory">${options(selected)}</select>

    <button class="btn wide" data-action="youtube-link-channel">Enlazar e importar</button>

    <p class="muted yt-note">Esto no descarga ni vuelve a alojar tus vídeos: VidioUp guarda metadatos públicos y reproduce mediante YouTube.</p>
  `);

  const singleVideo=card(`
    <h2>Añadir solo un vídeo</h2>
    <p class="muted">Si no quieres enlazar un canal completo, puedes añadir un vídeo público concreto.</p>
    <label>Enlace del vídeo</label>
    <input id="ytVideoInput" placeholder="https://youtu.be/…">
    <label>Categoría</label>
    <select id="ytVideoCategory">${options(selected)}</select>
    <button class="ghost wide" data-action="youtube-import-video">Añadir vídeo</button>
  `);

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
    : `<section class="empty-state"><b>Aún no tienes vídeos importados</b><p>Enlaza el canal o añade un vídeo concreto.</p></section>`;

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
