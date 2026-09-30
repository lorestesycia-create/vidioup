import { state, takePendingAuthAction } from './context.js';
import { $ } from './utils.js';
import { saveSession, signIn, signUp } from './auth.js';
import { rpc } from './supabase.js';
import { loadAppData, loadCreator } from './data.js';
import { render, toast } from './ui.js';

async function completePendingAction(pending){
  if(!pending) return {completed:false};

  try{
    if(pending.action==='toggle-follow'&&pending.creatorId){
      if(pending.following){
        await rpc('unfollow_creator',{p_creator_id:pending.creatorId});
      }else if(pending.campaignId){
        await rpc('follow_creator_from_campaign',{
          p_creator_id:pending.creatorId,
          p_campaign_id:pending.campaignId
        });
      }else{
        await rpc('follow_creator',{p_creator_id:pending.creatorId});
      }
      return {completed:true};
    }

    if(pending.action==='toggle-favorite'&&pending.videoId){
      await rpc('add_favorite',{p_video_id:pending.videoId});
      return {completed:true};
    }

    return {completed:false};
  }catch(x){
    return {
      completed:false,
      error:x.message||'No se pudo completar la acción pendiente.'
    };
  }
}

function restorePendingVideo(pending){
  if(!pending?.videoId) return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const item=document.querySelector(`[data-video-id="${CSS.escape(pending.videoId)}"]`);
    item?.scrollIntoView({block:'start'});
  }));
}

async function finishAuthentication(session){
  saveSession(session);

  const pending=takePendingAuthAction();
  const result=await completePendingAction(pending);

  await loadAppData();

  if(
    pending?.action==='toggle-follow' &&
    pending?.creatorId &&
    pending?.returnTab==='creator-profile'
  ){
    try{ await loadCreator(pending.creatorId); }catch{}
  }

  state.tab=pending?.returnTab||state.authReturnTab||'inicio';
  state.authReturnTab='inicio';
  render();
  restorePendingVideo(pending);

  if(pending){
    if(result.completed){
      toast(
        pending.action==='toggle-follow'
          ? 'Ahora sigues a este creador.'
          : 'Guardado en favoritos.'
      );
    }else if(result.error){
      toast(result.error);
    }
  }
}


document.addEventListener(
  'submit',
  async e=>{

    if(e.target.id==='signupForm'){
      e.preventDefault();

      const btn=
        e.target.querySelector(
          'button[type="submit"]'
        );

      const err=$('#authError');

      const email=
        $('#email').value.trim();

      const pass=
        $('#password').value;

      const confirm=
        $('#passwordConfirm').value;

      err.textContent='';

      if(pass.length<6){
        err.textContent=
          'La contraseña debe tener al menos 6 caracteres.';
        return;
      }

      if(pass!==confirm){
        err.textContent=
          'Las contraseñas no coinciden.';
        return;
      }

      btn.disabled=true;
      btn.textContent='Creando cuenta…';

      try{
        const s=
          await signUp(email,pass);

        if(
          s?.access_token &&
          s?.user
        ){
          await finishAuthentication(s);
          return;
        }

        state.authMode='login';
        render();

        $('#authSuccess').textContent=
          'Cuenta creada. Revisa tu correo y confirma tu dirección. Después podrás iniciar sesión.';

      }catch(x){
        err.textContent=
          x.message==='User already registered'
            ? 'Ya existe una cuenta con ese correo.'
            : (
                x.message ||
                'No se pudo crear la cuenta.'
              );

        btn.disabled=false;
        btn.textContent='Crear cuenta';
      }

      return;
    }

    if(e.target.id!=='loginForm'){
      return;
    }

    e.preventDefault();

    const btn=
      e.target.querySelector('button');

    const err=$('#authError');

    btn.disabled=true;
    btn.textContent='Entrando…';
    err.textContent='';

    try{
      const s=
        await signIn(
          $('#email').value.trim(),
          $('#password').value
        );

      await finishAuthentication(s);

    }catch(x){
      saveSession(null);

      err.textContent=
        x.message==='Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : x.message;

      btn.disabled=false;
      btn.textContent='Iniciar sesión';
    }
  }
);
