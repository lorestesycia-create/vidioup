import { state } from './context.js';
import { esc } from './utils.js';
import { videoCard } from './feed.js';
import { INTEREST_CATEGORIES } from './interests.js';

export function explore(){
  const q=(state.exploreQuery||'').trim().toLowerCase();
  const cat=(state.exploreCategory||'').toLowerCase();

  const rows=(state.organicFeed||[]).filter(v=>{
    const hay=[v.video_title,v.creator_name,v.category].filter(Boolean).join(' ').toLowerCase();
    const qOk=!q||hay.includes(q);
    const cOk=!cat||String(v.category||'').toLowerCase()===cat;
    return qOk&&cOk;
  });

  return `
    <section class="explore-tools">
      <input id="exploreSearch" type="search" placeholder="Buscar temas, creadores o vídeos" value="${esc(state.exploreQuery||'')}">
      <div class="chips">
        <button class="chip ${!state.exploreCategory?'active':''}" data-action="explore-category" data-category="">Todo</button>
        ${INTEREST_CATEGORIES.map(c=>`<button class="chip ${state.exploreCategory===c?'active':''}" data-action="explore-category" data-category="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
    </section>

    <section class="explore-results">
      ${rows.length
        ? rows.map(v=>videoCard(v)).join('')
        : `<div class="empty-state"><b>Sin resultados</b><p>Prueba otra búsqueda o categoría.</p></div>`
      }
    </section>
  `;
}
