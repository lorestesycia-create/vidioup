import { state } from './context.js';
import { modeSwitch, videoCard } from './feed.js';

export function saved(){
  const rows=state.savedVideos||[];

  return `
    <div class="section-title">
      <button class="back-btn" data-tab="perfil">‹</button>
      <div><h2>Guardados</h2><p>Contenido que quieres volver a ver.</p></div>
    </div>
    <div class="feed-head saved-head">${modeSwitch()}</div>
    ${rows.length
      ? `<div class="feed-stream ${state.contentMode==='short'?'snap-feed':''}">${rows.map(v=>videoCard(v)).join('')}</div>`
      : `<section class="empty-state"><b>No tienes nada guardado aquí</b><p>Cuando guardes un vídeo aparecerá en esta sección.</p><button class="ghost" data-tab="inicio">Ir a Inicio</button></section>`
    }
  `;
}
