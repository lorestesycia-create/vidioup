import { state } from './context.js';
import { $ } from './utils.js';
import { saveSession, signIn, signUp } from './auth.js';
import { loadAppData } from './data.js';
import { render } from './ui.js';

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
          saveSession(s);
          await loadAppData();
          state.tab=state.authReturnTab||'inicio';
          state.authReturnTab='inicio';
          render();
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

      saveSession(s);
      await loadAppData();
      state.tab=state.authReturnTab||'inicio';
      state.authReturnTab='inicio';
      render();

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
