import { cfg, state } from './context.js';
import { esc, money, card } from './utils.js';
export function campaigns(){

  if(!state.campaigns.length){

    return card(`

      <h2>
        Sin campañas
      </h2>

      <p>
        Aquí verás tus campañas
        guardadas en VidioUp.
      </p>

      <button
        class="btn"
        data-action="go-promote"
      >
        Crear campaña
      </button>

    `);
  }

  return state.campaigns
    .map(c=>{

      const id=
        esc(c.id||'');

      const status=
        String(c.status||'');

      let actions='';

      if(status==='active'){

        actions+=`
          <button
            class="ghost"
            data-campaign-id="${id}"
            data-action="pause-campaign"
          >
            Pausar
          </button>
        `;
      }

      if(status==='paused'){

        actions+=`
          <button
            class="btn"
            data-campaign-id="${id}"
            data-action="resume-campaign"
          >
            Reanudar
          </button>
        `;
      }

      if(
        ![
          'cancelled',
          'completed'
        ].includes(status)
      ){

        actions+=`
          <button
            class="ghost"
            data-campaign-id="${id}"
            data-action="cancel-campaign"
          >
            Cancelar
          </button>
        `;
      }

      const mode={
        basic:'Básica',
        featured:'Destacada',
        boost:'Impulso'
      }[c.mode]||
      c.mode||
      'Campaña';

      const st={
        active:'Activa',
        paused:'Pausada',
        cancelled:'Cancelada',
        completed:'Completada',
        draft:'Borrador',
        removed:'Retirada'
      }[status]||
      status||
      '—';

      const cost=
        Number(
          c.cost_per_impression||0
        );

      return card(`

        <span class="pill">
          ${esc(mode)}
        </span>

        <h2>
          ${
            esc(
              c.video_title ||
              c.category ||
              'Campaña de YouTube'
            )
          }
        </h2>

        <p class="muted">
          ${esc(c.youtube_url||'')}
        </p>

        <p>
          Presupuesto:
          ${
            money(
              c.initial_budget??0
            )
          }

          · Restante:

          ${
            money(
              c.remaining_budget??0
            )
          }
        </p>

        <p class="muted">

          Coste por exposición válida:

          ${money(cost)}

          ${
            cost===1
              ? 'moneda'
              : 'monedas'
          }

          · Estado:

          ${esc(st)}

        </p>

        <div class="campaign-stats">
          <div><span>Exposiciones válidas</span><b>${money(c.valid_exposures??0)}</b></div>
          <div><span>Clics a YouTube</span><b>${money(c.youtube_clicks??0)}</b></div>
          <div><span>Nuevos seguidores</span><b>${money(c.new_followers??0)}</b></div>
          <div><span>Monedas gastadas</span><b>${money(c.coins_spent??0)}</b></div>
        </div>

        <div class="row">
          ${actions}
        </div>

      `);

    })
    .join('');
}
