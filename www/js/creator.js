import { state } from './context.js';
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
