import { cfg, state } from './context.js';
import { sb } from './supabase.js';
export function saveSession(s){
  state.session=s;

  if(s){
    localStorage.setItem(
      'vidioup_session',
      JSON.stringify(s)
    );
  }else{
    localStorage.removeItem(
      'vidioup_session'
    );
  }
}

export const signIn=(email,password)=>
  sb('/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{
      apikey:cfg.services.supabase_publishable_key,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({email,password})
  });

export const signUp=(email,password)=>
  sb('/auth/v1/signup',{
    method:'POST',
    headers:{
      apikey:cfg.services.supabase_publishable_key,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({email,password})
  });

export const refreshSession=refresh_token=>
  sb('/auth/v1/token?grant_type=refresh_token',{
    method:'POST',
    headers:{
      apikey:cfg.services.supabase_publishable_key,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({refresh_token})
  });
