import { state } from './context.js';
import { esc, card } from './utils.js';

export function profile(){
  return `
    ${card(`
      <div class="profile">
        <div class="avatar">${esc((state.user.name||'V')[0].toUpperCase())}</div>
        <div><h2>${esc(state.user.name)}</h2><p class="muted">Tu perfil de VidioUp</p></div>
      </div>
    `)}

    ${card(`
      <div class="menu">
        <button data-action="saved">♡ Guardados</button>
        <button data-action="my-following">◎ Creadores seguidos</button>
        <button data-action="interests"># Tus intereses</button>
        <button data-action="creator-studio">Creator Studio</button>
        <button data-action="settings">⚙ Ajustes</button>
      </div>
    `)}
  `;
}

export function settings(){
  return `
    <div class="section-title"><button class="back-btn" data-tab="perfil">‹</button><div><h2>Ajustes</h2></div></div>
    ${card(`
      <div class="menu">
        <button data-action="account-security">🔐 Cuenta y seguridad</button>
        <button>🔔 Notificaciones</button>
        <button data-action="blocked-users">⊘ Usuarios bloqueados</button>
        <button>Ayuda y soporte</button>
        <button>⚑ Denunciar contenido</button>
        <button data-action="legal-privacy">§ Legal y privacidad</button>
        <button class="danger" data-action="logout">Cerrar sesión</button>
      </div>
    `)}
  `;
}
