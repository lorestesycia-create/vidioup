import { cfg, state } from './context.js';
import { esc, money, card } from './utils.js';
export function wallet(){

  const r=
    state.rewardStatus;

  const limit=
    Number(
      r.daily_limit ||
      cfg.economy.rewarded_daily_limit
    );

  const left=
    Number(
      r.remaining_today ??
      limit
    );

  const used=
    Number(
      r.used_today || 0
    );

  const pending=
    Number(
      r.pending_today || 0
    );

  return `

    <div class="balance">

      <span>
        Disponible
      </span>

      <strong>
        ${money(state.user.coins)}
      </strong>

      <small>
        Reservado:
        ${money(state.user.reserved)}
      </small>

    </div>

    ${
      card(`

        <h2>
          Conseguir monedas
        </h2>

        <p>
          <b>
            ${
              cfg.economy.rewarded_coin_reward
            }
          </b>
          monedas por anuncio recompensado.
        </p>

        <p class="muted">
          Hoy has recibido
          ${used}
          de
          ${limit}.
          Te quedan
          ${left}.
        </p>

        ${
          pending
            ? `
              <p class="notice">
                Recompensas pendientes
                de verificación:
                ${pending}
              </p>
            `
            : ''
        }

        <button
          class="btn wide"
          data-action="rewarded"
          ${
            left<=0
              ? 'disabled'
              : ''
          }
        >
          ${
            left>0
              ? 'Ver anuncio'
              : 'Límite diario alcanzado'
          }
        </button>

        <p class="notice">
          Las monedas se acreditan cuando
          AdMob confirma la recompensa.
        </p>

      `)
    }

    ${
      card(`

        <h2>
          Tienda
        </h2>

        <div class="shop">

          ${
            cfg.store.map(x=>`

              <button
                class="pack"
                data-sku="${x.sku}"
              >

                <b>
                  ${money(x.coins)}
                </b>

                <span>
                  monedas
                </span>

                <strong>
                  ${
                    x.price_eur
                      .toFixed(2)
                      .replace('.',',')
                  }
                  €
                </strong>

              </button>

            `).join('')
          }

        </div>

      `)
    }
  `;
}
