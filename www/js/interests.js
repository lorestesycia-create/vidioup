import { state } from './context.js';
import { esc, card } from './utils.js';

export const INTEREST_CATEGORIES=[
  'Historia',
  'Gaming',
  'Música',
  'Tecnología',
  'Humor',
  'Deportes',
  'Motor',
  'Cine',
  'Entretenimiento',
  'Educación'
];

export function interests(){
  const selected=new Set(state.interestDraft||[]);

  return `
    <div class="section-title">
      <button class="back-btn" data-tab="perfil">‹</button>
      <div>
        <h2>Tus intereses</h2>
        <p>Ayudan a ordenar Para ti, sin encerrarte siempre en lo mismo.</p>
      </div>
    </div>

    ${card(`
      <div class="interest-grid">
        ${INTEREST_CATEGORIES.map(c=>`
          <button
            class="interest-choice ${selected.has(c)?'active':''}"
            data-action="toggle-interest"
            data-interest="${esc(c)}"
            aria-pressed="${selected.has(c)?'true':'false'}"
          >${esc(c)}</button>
        `).join('')}
      </div>
      <p class="muted interest-note">Puedes cambiar esto cuando quieras.</p>
      <button class="btn wide" data-action="save-interests">Guardar intereses</button>
    `)}
  `;
}
