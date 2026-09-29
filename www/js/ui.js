import { state } from './context.js';
import { $, esc } from './utils.js';
import { home } from './feed.js';
import { explore } from './explore.js';
import { following } from './following.js';
import { promote } from './promote.js';
import { wallet } from './wallet.js';
import { campaigns } from './campaigns.js';
import { profile, settings } from './profile.js';
import { creatorStudio, creatorProfile } from './creator.js';
import { interests } from './interests.js';
import { saved } from './saved.js';
import { accountSecurity, blockedUsers } from './settings.js';
import { youtubeChannel } from './youtube.js';
import { initFeedTracking } from './signals.js';

function authView(){
  const signup=state.authMode==='signup';
  return `
    <div class="auth"><div class="authbox">
      <img src="icon.png" class="authicon">
      <h1>VidioUp</h1>
      <p>${signup?'Crea tu cuenta para continuar':'Inicia sesión para continuar'}</p>
      <form id="${signup?'signupForm':'loginForm'}">
        <label>Correo electrónico</label>
        <input id="email" type="email" autocomplete="email" required>
        <label>Contraseña</label>
        <input id="password" type="password" minlength="6" autocomplete="${signup?'new-password':'current-password'}" required>
        ${signup?`<label>Repite la contraseña</label><input id="passwordConfirm" type="password" minlength="6" autocomplete="new-password" required>`:''}
        <button class="btn wide" type="submit">${signup?'Crear cuenta':'Iniciar sesión'}</button>
      </form>
      <p id="authError" class="error"></p>
      <p id="authSuccess" class="notice"></p>
      <button class="ghost wide" type="button" data-action="${signup?'show-login':'show-signup'}">${signup?'Ya tengo cuenta · Iniciar sesión':'Crear una cuenta'}</button>
      <button class="ghost wide" type="button" data-action="guest-back">Seguir viendo sin cuenta</button>
    </div></div>
  `;
}

function top(title){
  return `
    <header class="top">
      <div class="brand"><img src="icon.png"><div><h1>VidioUp</h1><span>${esc(title)}</span></div></div>
    </header>
  `;
}

export function render(){
  if(state.loading){
    $('#app').innerHTML=`<div class="splash"><img src="icon.png"><b>VidioUp</b><span>Cargando…</span></div>`;
    document.querySelector('nav').hidden=true;
    return;
  }

  if(state.tab==='auth'){
    $('#app').innerHTML=authView();
    document.querySelector('nav').hidden=true;
    return;
  }

  const views={
    inicio:home,
    explorar:explore,
    siguiendo:following,
    perfil:profile,
    creator:creatorStudio,
    'creator-profile':creatorProfile,
    settings,
    interests,
    saved,
    'account-security':accountSecurity,
    'blocked-users':blockedUsers,
    'youtube-channel':youtubeChannel,
    promocionar:promote,
    monedas:wallet,
    campanas:campaigns
  };

  const titles={
    inicio:'Para ti',
    explorar:'Explorar',
    siguiendo:'Siguiendo',
    perfil:'Perfil',
    creator:'Creator Studio',
    'creator-profile':'Creador',
    settings:'Ajustes',
    interests:'Tus intereses',
    saved:'Guardados',
    'account-security':'Cuenta y seguridad',
    'blocked-users':'Usuarios bloqueados',
    'youtube-channel':'Mi canal',
    promocionar:'Promocionar',
    monedas:'Monedas',
    campanas:'Campañas'
  };

  const view=views[state.tab]||home;
  const mainTabs=['inicio','explorar','siguiendo','perfil'];
  document.querySelector('nav').hidden=false;

  $('#app').innerHTML=top(titles[state.tab]||'VidioUp')+`<main>${view()}</main>`;

  document.querySelectorAll('nav button').forEach(b=>{
    b.classList.toggle('active',b.dataset.tab===state.tab);
  });

  if(!mainTabs.includes(state.tab)){
    document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  }

  initFeedTracking();
}

export function toast(msg){
  const t=document.createElement('div');
  t.className='toast';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2600);
}
