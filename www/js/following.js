import { state } from './context.js';
import { modeSwitch, videoCard } from './feed.js';

export function following(){
  const rows=state.followingFeed||[];

  return `
    <div class="feed-head">${modeSwitch()}</div>
    ${rows.length
      ? `<div class="feed-stream ${state.contentMode==='short'?'snap-feed':''}">${rows.map(v=>videoCard(v,{followingOnly:true})).join('')}</div>`
      : `<section class="empty-state"><b>Estás al día</b><p>Cuando los creadores que sigues publiquen algo nuevo aparecerá aquí.</p><button class="btn" data-tab="inicio">Volver a Para ti</button></section>`
    }
  `;
}
