import { state } from './context.js';
import { esc } from './utils.js';

function youtubeEmbed(videoId){
  if(!videoId) return '';
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0&modestbranding=1`;
}

export function modeSwitch(){
  return `
    <div class="mode-switch" role="tablist" aria-label="Tipo de contenido">
      <button class="${state.contentMode==='short'?'active':''}" data-action="content-mode" data-mode="short">Cortos</button>
      <button class="${state.contentMode==='video'?'active':''}" data-action="content-mode" data-mode="video">Vídeos</button>
    </div>
  `;
}

export function videoCard(v,{followingOnly=false}={}){
  const short=state.contentMode==='short';
  const title=v.video_title||'Vídeo de VidioUp';
  const creator=v.creator_name||'Creador';
  const embed=youtubeEmbed(v.youtube_video_id);

  return `
    <article class="feed-item ${short?'short-item':'long-item'} ${v.is_promoted?'promoted-item':''}" data-video-id="${esc(v.video_id)}" ${v.campaign_id?`data-campaign-id="${esc(v.campaign_id)}"`:''}>
      ${v.is_promoted?`<span class="promoted-label">Promocionado</span>`:''}
      <div class="player-shell ${short?'vertical':'horizontal'}">
        ${embed
          ? `<iframe src="${esc(embed)}" title="${esc(title)}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
          : v.thumbnail_url
            ? `<img src="${esc(v.thumbnail_url)}" alt="Miniatura del vídeo" loading="lazy">`
            : `<div class="video-placeholder">▶</div>`
        }
      </div>

      <div class="feed-meta">
        <button class="creator-link" data-action="open-creator" data-creator-id="${esc(v.creator_id)}">
          <span class="mini-avatar">${esc((creator[0]||'C').toUpperCase())}</span>
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
        ${short?'':`<button class="ghost compact" data-action="open-youtube" data-youtube-url="${esc(v.youtube_url)}" data-video-id="${esc(v.video_id)}" ${v.campaign_id?`data-campaign-id="${esc(v.campaign_id)}"`:''}>Ver en YouTube</button>`}
        <button class="ghost compact more" data-action="feed-more" data-video-id="${esc(v.video_id)}" aria-expanded="false">⋮</button>
      </div>

      <div class="feed-more-menu" data-more-menu="${esc(v.video_id)}" hidden>
        <button data-action="not-interested" data-video-id="${esc(v.video_id)}">No me interesa</button>
        <button data-action="report-video" data-video-id="${esc(v.video_id)}">Denunciar</button>
      </div>
    </article>
  `;
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
  const content=rows.length
    ? rows.map(v=>videoCard(v)).join('')
    : `
      <section class="empty-state">
        <b>${state.contentMode==='short'?'Todavía no hay Cortos':'Todavía no hay vídeos'}</b>
        <p>En cuanto haya contenido disponible aparecerá aquí.</p>
        <button class="ghost" data-action="content-mode" data-mode="${state.contentMode==='short'?'video':'short'}">
          ${state.contentMode==='short'?'Ver vídeos':'Ver Cortos'}
        </button>
      </section>
    `;

  return `
    <div class="feed-head">
      ${modeSwitch()}
    </div>
    <div class="feed-stream ${state.contentMode==='short'?'snap-feed':''}">
      ${content}
    </div>
  `;
}
