import { cfg, state } from './context.js';
import { sleep } from './utils.js';
export const headers = token => ({
  apikey: cfg.services.supabase_publishable_key,
  Authorization: `Bearer ${token}`,
  'Content-Type':'application/json'
});

export async function sb(path, opts={}, attempt=0){
  const r = await fetch(`${cfg.services.supabase_url}${path}`, opts);

  let data=null;
  try{
    data=await r.json();
  }catch{}

  if(!r.ok){
    const msg =
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      `Error ${r.status}`;

    if(
      attempt < 2 &&
      (
        /JWT issued at future/i.test(msg) ||
        /PGRST303/i.test(msg)
      )
    ){
      await sleep(700*(attempt+1));
      return sb(path,opts,attempt+1);
    }

    throw new Error(msg);
  }

  return data;
}

export const rpc=(name,body={})=>
  sb(`/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:headers(state.session.access_token),
    body:JSON.stringify(body)
  });

export async function edge(name,body={}){
  const r=await fetch(`${cfg.services.supabase_url}/functions/v1/${name}`,{
    method:'POST',
    headers:headers(state.session.access_token),
    body:JSON.stringify(body)
  });

  let data=null;
  try{ data=await r.json(); }catch{}

  if(!r.ok){
    const msg=data?.message||data?.error||`Error ${r.status}`;
    throw new Error(msg);
  }

  return data;
}
