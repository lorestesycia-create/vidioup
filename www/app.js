import { state, setCfg } from './js/context.js';
import { refreshSession, saveSession } from './js/auth.js';
import { loadAppData } from './js/data.js';
import { render } from './js/ui.js';
import './js/auth-events.js';
import './js/events.js';

async function boot(){
  try{
    setCfg(
      await fetch('config.json').then(r=>r.json())
    );

    const raw=localStorage.getItem('vidioup_session');

    if(raw){
      try{
        let s=JSON.parse(raw);

        if(s.refresh_token){
          try{
            s=await refreshSession(s.refresh_token);
            saveSession(s);
          }catch{
            saveSession(null);
          }
        }

        if(state.session){
          await loadAppData();
        }
      }catch{
        saveSession(null);
      }
    }
  }finally{
    state.loading=false;
    render();
  }
}

boot();
