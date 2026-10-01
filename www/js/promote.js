import { cfg, state } from './context.js';
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
