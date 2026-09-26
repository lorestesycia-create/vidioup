import { state } from './context.js';
import { esc, card } from './utils.js';

export function accountSecurity(){
  return `
    <div class="section-title">
      <button class="back-btn" data-tab="settings">‹</button>
      <div><h2>Cuenta y seguridad</h2><p>Datos privados de tu cuenta.</p></div>
    </div>
    ${card(`
      <div class="account-row">
        <span>Correo electrónico</span>
        <strong>${esc(state.user.email||'')}</strong>
      </div>
      <p class="muted">Tu correo no aparece en tu perfil público.</p>
      <button class="ghost wide" data-action="open-delete-account">Eliminar cuenta</button>
    `)}
  `;
}

export function blockedUsers(){
  const rows=state.blockedUsers||[];

  return `
    <div class="section-title">
      <button class="back-btn" data-tab="settings">‹</button>
      <div><h2>Usuarios bloqueados</h2><p>No aparecerán en tus feeds.</p></div>
    </div>
    ${rows.length
      ? rows.map(x=>card(`
          <div class="blocked-row">
            <div class="mini-avatar">${esc((x.display_name||'U')[0].toUpperCase())}</div>
            <div class="blocked-main"><b>${esc(x.display_name||'Usuario')}</b></div>
            <button class="ghost compact" data-action="unblock-user" data-user-id="${esc(x.blocked_id)}">Desbloquear</button>
          </div>
        `)).join('')
      : `<section class="empty-state"><b>No tienes usuarios bloqueados</b><p>Los creadores que bloquees aparecerán aquí.</p></section>`
    }
  `;
}
