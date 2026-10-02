import { cfg, state, getGuestId, setPendingAuthAction, clearPendingAuthAction } from './context.js';
import { $, esc, money } from './utils.js';
import { saveSession } from './auth.js';
import { rpc, edge } from './supabase.js';
import { loadAppData, loadPublicData, loadPromotedFeed, loadOrganicFeed, loadFollowingFeed, loadFollowing, loadCreator, loadAccount, loadRewardStatus, loadInterests, loadSavedVideos, loadBlockedUsers, loadMyChannel } from './data.js';
import { render, toast } from './ui.js';
import { showRewarded, showAdPrivacyOptions } from './ads.js';
import { stopFeedTracking } from './signals.js';
import { buyPack } from './purchases.js';

const AUTH_ONLY_TABS=new Set(['siguiendo','perfil']);
const AUTH_ONLY_ACTIONS=new Set([
  'wallet','go-promote','creator-studio','settings','go-campaigns',
  'studio-channel','view-my-public-profile','youtube-link-channel',
  'youtube-sync-channel','youtube-import-video','youtube-verify-channel','youtube-restart-verification','youtube-toggle-hidden',
  'youtube-change-kind','youtube-unlink','toggle-follow','block-creator','report-creator',
  'not-interested','report-video','my-following','saved','interests',
  'toggle-interest','save-interests','account-security','blocked-users','accept-creator-terms',
  'unblock-user','rewarded','toggle-favorite','campaign-preview','save-draft',
  'pause-campaign','resume-campaign','cancel-campaign'
]);

function showAuthGate(returnTab='inicio'){
  state.authReturnTab=returnTab&&returnTab!=='auth'?returnTab:'inicio';
  state.authMode='login';
  state.tab='auth';
  render();
}

async function refreshTab(tab){
  if(tab==='inicio'){
    await Promise.all([
      loadOrganicFeed(),
      loadPromotedFeed()
    ]);
  }

  if(tab==='explorar'){
    await loadOrganicFeed();
  }

  if(tab==='siguiendo'){
    await Promise.all([
      loadFollowingFeed(),
      loadFollowing()
    ]);
  }

  if(tab==='monedas'){
    await Promise.all([
      loadAccount(),
      loadRewardStatus()
    ]);
  }
}

document.addEventListener(
  'click',
  async e=>{

    const tab=
      e.target
        .closest('[data-tab]')
        ?.dataset.tab;

    if(tab){
      stopFeedTracking({record:true});

      if(!state.session&&AUTH_ONLY_TABS.has(tab)){
        showAuthGate(tab);
        return;
      }

      state.tab=tab;

      try{
        await refreshTab(tab);
      }catch{}

      render();
      return;
    }

    const target=
      e.target.closest('[data-action]');

    const a=
      target?.dataset.action;

    if(!state.session&&AUTH_ONLY_ACTIONS.has(a)){
      stopFeedTracking({record:true});

      if(a==='toggle-follow'||a==='toggle-favorite'){
        const item=target.closest('.feed-item');
        setPendingAuthAction({
          action:a,
          creatorId:target.dataset.creatorId||null,
          following:target.dataset.following==='1',
          campaignId:target.dataset.campaignId||null,
          videoId:target.dataset.videoId||item?.dataset.videoId||null,
          returnTab:state.tab
        });
      }else{
        clearPendingAuthAction();
      }

      showAuthGate(state.tab);
      return;
    }

    if(a==='show-signup'){
      state.authMode='signup';
      render();
      return;
    }

    if(a==='show-login'){
      state.authMode='login';
      render();
      return;
    }

    if(a==='guest-back'){
      clearPendingAuthAction();
      state.tab='inicio';
      state.authReturnTab='inicio';
      render();
      return;
    }

    if(a==='wallet'){
      state.tab='monedas';

      try{
        await refreshTab('monedas');
      }catch{}

      render();
      return;
    }

    if(a==='go-promote'){
      try{
        await loadMyChannel();
      }catch(x){
        toast(x.message||'No se pudo cargar tu canal.');
      }
      state.tab='promocionar';
      render();
      return;
    }

    if(a==='logout'){
      clearPendingAuthAction();
      saveSession(null);

      state.authMode='login';

      state.user={
        name:'Creador',
        email:'',
        coins:0,
        reserved:0
      };

      state.campaigns=[];
      state.promotedFeed=[];
      state.organicFeed=[];
      state.followingFeed=[];
      state.following=[];
      state.savedVideos=[];
      state.blockedUsers=[];
      state.interests=[];
      state.interestDraft=[];
      state.selectedCreator=null;
      state.selectedCreatorVideos=[];
      state.myCreatorChannel=null;
      state.myVideos=[];

      state.rewardStatus={
        used_today:0,
        pending_today:0,
        daily_limit:
          cfg?.economy?.rewarded_daily_limit||8,
        remaining_today:
          cfg?.economy?.rewarded_daily_limit||8
      };

      state.tab='inicio';
      state.authReturnTab='inicio';

      try{
        await loadPublicData();
      }catch{}

      render();
      return;
    }

    if(a==='creator-studio'){
      state.tab='creator';
      render();
      return;
    }

    if(a==='settings'){
      state.tab='settings';
      render();
      return;
    }

    if(a==='go-campaigns'){
      state.tab='campanas';
      render();
      return;
    }

    if(a==='content-mode'){
      stopFeedTracking({record:true});
      const mode=target.dataset.mode;
      if(!['short','video'].includes(mode)) return;
      state.contentMode=mode;
      try{
        await Promise.all([
          loadOrganicFeed(mode),
          loadPromotedFeed(mode),
          state.session?loadFollowingFeed(mode):Promise.resolve(),
          state.session&&state.tab==='saved'?loadSavedVideos(mode):Promise.resolve()
        ]);
      }catch(x){
        toast(x.message||'No se pudo cargar el contenido.');
      }
      render();
      return;
    }

    if(a==='open-creator'){
      stopFeedTracking({record:true});
      const id=target.dataset.creatorId;
      if(!id) return;
      target.disabled=true;
      try{
        await loadCreator(id);
        state.tab='creator-profile';
        render();
      }catch(x){
        toast(x.message||'No se pudo abrir el creador.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='studio-channel'){
      try{
        await loadMyChannel();
        state.tab='youtube-channel';
        render();
      }catch(x){
        toast(x.message||'No se pudo cargar Mi canal.');
      }
      return;
    }

    if(a==='view-my-public-profile'){
      const id=state.session?.user?.id;
      if(!id) return;
      try{
        await loadCreator(id);
        state.tab='creator-profile';
        render();
      }catch(x){
        toast(x.message||'No se pudo abrir tu perfil público.');
      }
      return;
    }

    if(a==='youtube-link-channel'){
      const input=$('#ytChannelInput')?.value?.trim()||'';
      const category=$('#ytDefaultCategory')?.value||'Entretenimiento';
      if(!input){
        toast('Introduce el enlace, @handle o ID del canal.');
        return;
      }
      target.disabled=true;
      try{
        await edge('youtube-ownership',{
          action:'start_verification',
          channel_input:input,
          category
        });
        await loadMyChannel();
        render();
        toast('Código temporal generado. Ponlo en la descripción pública de tu canal.');
      }catch(x){
        toast(x.message||'No se pudo iniciar la verificación.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-restart-verification'){
      const channelInput=state.myCreatorChannel?.youtube_channel_id||'';
      const category=$('#ytLinkedCategory')?.value||state.myCreatorChannel?.youtube_default_category||'Entretenimiento';
      if(!channelInput){
        toast('No hay un canal enlazado.');
        return;
      }
      target.disabled=true;
      try{
        await edge('youtube-ownership',{
          action:'start_verification',
          channel_input:channelInput,
          category
        });
        await loadMyChannel();
        render();
        toast('Nuevo código temporal generado.');
      }catch(x){
        toast(x.message||'No se pudo generar otro código.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-verify-channel'){
      const category=$('#ytLinkedCategory')?.value||state.myCreatorChannel?.youtube_default_category||'Entretenimiento';
      target.disabled=true;
      try{
        const result=await edge('youtube-ownership',{
          action:'verify_channel'
        });

        let syncWarning=false;
        if(result?.verified){
          try{
            await edge('youtube-ownership',{
              action:'sync_verified_channel',
              category,
              limit:20
            });
          }catch{
            syncWarning=true;
          }
        }

        await Promise.all([
          loadMyChannel(),
          loadOrganicFeed(),
          loadPromotedFeed(),
          loadFollowingFeed()
        ]);
        render();
        toast(syncWarning?'Canal verificado. La sincronización de vídeos queda pendiente.':'Canal verificado correctamente.');
      }catch(x){
        toast(x.message||'El código aún no se ha podido comprobar.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-sync-channel'){
      const category=$('#ytLinkedCategory')?.value||state.myCreatorChannel?.youtube_default_category||'Entretenimiento';
      target.disabled=true;
      try{
        const result=await edge('youtube-ownership',{
          action:'sync_verified_channel',
          category,
          limit:20
        });
        await Promise.all([
          loadMyChannel(),
          loadOrganicFeed(),
          loadPromotedFeed(),
          loadFollowingFeed()
        ]);
        render();
        toast(`Canal actualizado · ${Number(result?.imported||0)} nuevos y ${Number(result?.updated||0)} actualizados.`);
      }catch(x){
        toast(x.message||'No se pudo actualizar el canal.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-import-video'){
      const url=$('#ytVideoInput')?.value?.trim()||'';
      const category=$('#ytVideoCategory')?.value||'Entretenimiento';
      if(!url){
        toast('Introduce un enlace de vídeo de YouTube.');
        return;
      }
      target.disabled=true;
      try{
        await edge('youtube-ownership',{
          action:'import_verified_video',
          video_url:url,
          category
        });
        await Promise.all([
          loadMyChannel(),
          loadOrganicFeed(),
          loadFollowingFeed()
        ]);
        render();
        toast('Vídeo añadido a VidioUp.');
      }catch(x){
        toast(x.message||'No se pudo añadir el vídeo.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-toggle-hidden'){
      const id=target.dataset.videoId;
      const hidden=target.dataset.hidden==='1';
      if(!id) return;
      target.disabled=true;
      try{
        await rpc('set_my_video_hidden',{
          p_video_id:id,
          p_hidden:!hidden
        });
        await Promise.all([
          loadMyChannel(),
          loadOrganicFeed(),
          loadPromotedFeed(),
          loadFollowingFeed()
        ]);
        render();
        toast(hidden?'Vídeo visible de nuevo.':'Vídeo ocultado de VidioUp.');
      }catch(x){
        toast(x.message||'No se pudo actualizar el vídeo.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-change-kind'){
      const id=target.dataset.videoId;
      const current=target.dataset.kind;
      const next=current==='short'?'video':'short';
      if(!id) return;
      target.disabled=true;
      try{
        await rpc('set_my_video_content_kind',{
          p_video_id:id,
          p_content_kind:next
        });
        await Promise.all([
          loadMyChannel(),
          loadOrganicFeed(),
          loadPromotedFeed(),
          loadFollowingFeed()
        ]);
        render();
        toast(next==='short'?'Marcado como Corto.':'Marcado como Vídeo.');
      }catch(x){
        toast(x.message||'No se pudo cambiar el tipo de contenido.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='youtube-unlink'){
      const ok=window.confirm('¿Desenlazar el canal? Los vídeos ya importados se conservarán y podrás ocultarlos individualmente.');
      if(!ok) return;
      target.disabled=true;
      try{
        await rpc('unlink_my_youtube_channel');
        await loadMyChannel();
        render();
        toast('Canal desenlazado.');
      }catch(x){
        toast(x.message||'No se pudo desenlazar el canal.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='toggle-follow'){
      stopFeedTracking({record:true});
      const id=target.dataset.creatorId;
      const following=target.dataset.following==='1';
      const campaignId=target.dataset.campaignId||null;
      if(!id) return;
      target.disabled=true;
      try{
        if(following){
          await rpc('unfollow_creator',{p_creator_id:id});
        }else if(campaignId){
          await rpc('follow_creator_from_campaign',{
            p_creator_id:id,
            p_campaign_id:campaignId
          });
        }else{
          await rpc('follow_creator',{p_creator_id:id});
        }
        await Promise.all([
          loadOrganicFeed(),
          loadPromotedFeed(),
          loadFollowingFeed(),
          loadFollowing()
        ]);
        if(state.selectedCreator?.user_id===id){
          await loadCreator(id);
        }
        render();
        toast(following?'Has dejado de seguir al creador.':'Ahora sigues a este creador.');
      }catch(x){
        toast(x.message||'No se pudo actualizar el seguimiento.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='block-creator'){
      const id=target.dataset.creatorId;
      if(!id) return;

      const ok=window.confirm('¿Bloquear a este creador? Dejarás de seguirlo y su contenido no aparecerá en tus feeds.');
      if(!ok) return;

      target.disabled=true;
      try{
        await rpc('block_user',{p_blocked_id:id});
        await Promise.all([
          loadOrganicFeed(),
          loadPromotedFeed(),
          loadFollowingFeed(),
          loadFollowing()
        ]);
        state.selectedCreator=null;
        state.selectedCreatorVideos=[];
      state.myCreatorChannel=null;
      state.myVideos=[];
        state.tab='inicio';
        render();
        toast('Creador bloqueado.');
      }catch(x){
        toast(x.message||'No se pudo bloquear al creador.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='report-creator'){
      const id=target.dataset.creatorId;
      if(!id) return;

      const ok=window.confirm('¿Quieres denunciar este creador para revisión?');
      if(!ok) return;

      target.disabled=true;
      try{
        await rpc('create_report',{
          p_target_type:'creator',
          p_target_id:id,
          p_reason:'other'
        });
        toast('Denuncia enviada. Gracias.');
      }catch(x){
        toast(x.message||'No se pudo enviar la denuncia.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='share-video'){
      const url=target.dataset.youtubeUrl;
      if(!url) return;
      try{
        if(navigator.share){
          await navigator.share({title:'VidioUp',url});
        }else{
          await navigator.clipboard.writeText(url);
          toast('Enlace copiado.');
        }
      }catch{}
      return;
    }

    if(a==='feed-more'){
      const id=target.dataset.videoId;
      const menu=document.querySelector(`[data-more-menu="${CSS.escape(id||'')}"]`);
      if(!menu) return;

      document.querySelectorAll('[data-more-menu]').forEach(x=>{
        if(x!==menu) x.hidden=true;
      });

      menu.hidden=!menu.hidden;
      target.setAttribute('aria-expanded',menu.hidden?'false':'true');
      return;
    }

    if(a==='not-interested'){
      stopFeedTracking({record:true});
      const id=target.dataset.videoId;
      if(!id) return;
      target.disabled=true;

      try{
        await rpc('set_not_interested',{
          p_video_id:id,
          p_value:true
        });

        state.organicFeed=(state.organicFeed||[]).filter(v=>v.video_id!==id);
        state.promotedFeed=(state.promotedFeed||[]).filter(v=>v.video_id!==id);
        state.followingFeed=(state.followingFeed||[]).filter(v=>v.video_id!==id);
        render();
        toast('Verás menos contenido como este.');
      }catch(x){
        toast(x.message||'No se pudo guardar tu preferencia.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='report-video'){
      stopFeedTracking({record:true});
      const id=target.dataset.videoId;
      if(!id) return;

      const ok=window.confirm('¿Quieres denunciar este vídeo para revisión?');
      if(!ok) return;

      target.disabled=true;
      try{
        await rpc('create_report',{
          p_target_type:'video',
          p_target_id:id,
          p_reason:'other'
        });
        toast('Denuncia enviada. Gracias.');
      }catch(x){
        toast(x.message||'No se pudo enviar la denuncia.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='open-channel'||a==='open-youtube-simple'){
      const url=target.dataset.url;
      if(url) window.open(url,'_blank','noopener,noreferrer');
      return;
    }

    if(a==='explore-category'){
      state.exploreCategory=target.dataset.category||'';
      render();
      return;
    }

    if(a==='my-following'){
      state.tab='siguiendo';
      try{ await refreshTab('siguiendo'); }catch{}
      render();
      return;
    }

    if(a==='saved'){
      state.tab='saved';
      try{
        await loadSavedVideos();
      }catch(x){
        toast(x.message||'No se pudieron cargar tus guardados.');
      }
      render();
      return;
    }

    if(a==='interests'){
      state.interestDraft=[...(state.interests||[])];
      state.tab='interests';
      render();
      return;
    }

    if(a==='toggle-interest'){
      const interest=target.dataset.interest;
      if(!interest) return;

      const set=new Set(state.interestDraft||[]);
      if(set.has(interest)) set.delete(interest);
      else set.add(interest);
      state.interestDraft=[...set];
      render();
      return;
    }

    if(a==='save-interests'){
      target.disabled=true;
      try{
        await rpc('set_my_interests',{
          p_interests:state.interestDraft||[]
        });
        await Promise.all([
          loadInterests(),
          loadOrganicFeed(),
          loadPromotedFeed()
        ]);
        state.tab='perfil';
        render();
        toast('Intereses guardados.');
      }catch(x){
        toast(x.message||'No se pudieron guardar los intereses.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='account-security'){
      state.tab='account-security';
      render();
      return;
    }

    if(a==='blocked-users'){
      state.tab='blocked-users';
      try{
        await loadBlockedUsers();
      }catch(x){
        toast(x.message||'No se pudo cargar la lista de bloqueados.');
      }
      render();
      return;
    }

    if(a==='unblock-user'){
      const id=target.dataset.userId;
      if(!id) return;
      target.disabled=true;
      try{
        await rpc('unblock_user',{p_blocked_id:id});
        await Promise.all([
          loadBlockedUsers(),
          loadOrganicFeed(),
          loadPromotedFeed(),
          loadFollowingFeed()
        ]);
        render();
        toast('Usuario desbloqueado.');
      }catch(x){
        toast(x.message||'No se pudo desbloquear al usuario.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='ad-privacy'){
      target.disabled=true;
      try{
        const result=await showAdPrivacyOptions();
        toast(
          result?.shown
            ? 'Opciones de privacidad actualizadas.'
            : 'No se requieren opciones adicionales de privacidad de anuncios para tu región.'
        );
      }catch(x){
        toast(x.message||'No se pudieron abrir las opciones de privacidad de anuncios.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='legal-privacy'){
      window.open('https://vidioup-privacy.floot.app','_blank','noopener,noreferrer');
      return;
    }

    if(a==='open-delete-account'){
      window.open('https://vidioup-privacy.floot.app/eliminar-cuenta','_blank','noopener,noreferrer');
      return;
    }

    if(a==='rewarded'){
      target.disabled=true;

      try{
        await showRewarded(render, toast);
      }catch(x){
        toast(
          x.message ||
          'No se pudo mostrar el anuncio.'
        );
      }finally{
        target.disabled=false;
      }

      return;
    }

    if(a==='open-youtube'){
      const url=
        target.dataset.youtubeUrl;

      if(!url) return;

      const campaignId=target.dataset.campaignId||null;
      if(campaignId){
        rpc(
          'record_outbound_click_v2',
          {
            p_campaign_id:campaignId,
            p_video_id:target.dataset.videoId,
            p_guest_id:getGuestId()
          }
        ).catch(()=>{});
      }

      window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );

      return;
    }

    if(a==='toggle-favorite'){
      stopFeedTracking({record:true});
      const id=
        target.dataset.videoId;

      const item=[
        ...(state.organicFeed||[]),
        ...(state.followingFeed||[]),
        ...(state.savedVideos||[]),
        ...(state.promotedFeed||[])
      ].find(x=>x.video_id===id);

      if(!id) return;

      const saved=
        Boolean(item?.is_favorite);

      target.disabled=true;

      try{
        await rpc(
          saved
            ? 'remove_favorite'
            : 'add_favorite',
          {
            p_video_id:id
          }
        );

        if(item){
          item.is_favorite=!saved;
        }

        if(state.tab==='saved'&&saved){
          state.savedVideos=(state.savedVideos||[]).filter(v=>v.video_id!==id);
        }

        render();

        toast(
          saved
            ? 'Eliminado de favoritos.'
            : 'Guardado en favoritos.'
        );

      }catch(x){
        toast(
          x.message ||
          'No se pudo actualizar favoritos.'
        );
      }

      return;
    }

    if(a==='accept-creator-terms'){
      target.disabled=true;
      try{
        await rpc('accept_creator_terms',{
          p_version:'2026-10-01'
        });
        await loadMyChannel();
        render();
        toast('Condiciones aceptadas.');
      }catch(x){
        toast(x.message||'No se pudieron aceptar las condiciones.');
      }finally{
        target.disabled=false;
      }
      return;
    }

    if(a==='campaign-preview'){
      const videoId=$('#campaignVideo')?.value||'';
      const budget=Number($('#budget')?.value);
      const mode=$('#mode')?.value;
      const video=(state.myVideos||[]).find(v=>v.id===videoId);

      if(!video){
        toast('Selecciona un vídeo válido de tu canal.');
        return;
      }

      if(
        budget<cfg.economy.campaign_min_budget ||
        budget>cfg.economy.campaign_max_budget
      ){
        toast('Presupuesto fuera de los límites.');
        return;
      }

      const cost={
        basic:1,
        featured:2,
        boost:4
      }[mode]||1;

      const max=Math.floor(budget/cost);

      $('#preview').innerHTML=`
        <div class="review">
          <b>Resumen</b>
          <p>${esc(video.title||'Vídeo')}</p>
          <p class="muted">${esc(video.youtube_url||'')}</p>
          <p>${esc(cfg.campaign_modes[mode])}</p>
          <p>Presupuesto: ${money(budget)} monedas</p>
          <p class="muted">
            Coste: ${cost} ${cost===1?'moneda':'monedas'} por exposición válida.
          </p>
          <p class="muted">
            Hasta ${money(max)} exposiciones válidas dentro de VidioUp con ese presupuesto.
          </p>
          <button class="btn" data-action="save-draft">Crear campaña</button>
        </div>
      `;

      return;
    }

    if(a==='save-draft'){
      target.disabled=true;

      try{
        await rpc(
          'create_verified_campaign',
          {
            p_video_id:$('#campaignVideo').value,
            p_mode:$('#mode').value,
            p_budget:Number($('#budget').value)
          }
        );

        await loadAppData();

        toast('Campaña creada correctamente.');

        state.tab='campanas';
        render();

      }catch(x){
        toast(x.message||'No se pudo crear la campaña.');
      }finally{
        target.disabled=false;
      }

      return;
    }

    if(
      [
        'pause-campaign',
        'resume-campaign',
        'cancel-campaign'
      ].includes(a)
    ){
      const id=
        target.dataset.campaignId;

      const fn={
        'pause-campaign':'pause_campaign',
        'resume-campaign':'resume_campaign',
        'cancel-campaign':'cancel_campaign'
      }[a];

      if(!id) return;

      target.disabled=true;

      try{
        await rpc(
          fn,
          {
            p_campaign_id:id
          }
        );

        await loadAppData();

        toast(
          'Campaña actualizada.'
        );

        render();

      }catch(x){
        toast(
          x.message ||
          'No se pudo actualizar la campaña.'
        );
      }

      return;
    }

    const packTarget=e.target.closest('[data-sku]');

    if(packTarget){
      packTarget.disabled=true;

      try{
        const result=await buyPack(
          packTarget.dataset.sku,
          render,
          toast
        );

        if(result?.cancelled){
          return;
        }
      }catch(x){
        toast(
          x.message ||
          'No se pudo iniciar la compra.'
        );
      }finally{
        packTarget.disabled=false;
      }

      return;
    }
  }
);


document.addEventListener('input',e=>{
  if(e.target?.id!=='exploreSearch') return;
  state.exploreQuery=e.target.value||'';
  render();
  const input=document.querySelector('#exploreSearch');
  if(input){
    input.focus();
    input.setSelectionRange(input.value.length,input.value.length);
  }
});
