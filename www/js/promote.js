import { cfg, state } from './context.js';
import { esc, money, card } from './utils.js';
export function promote(){

  return card(`

    <h2>
      Nueva campaña
    </h2>

    <label>
      Enlace público de YouTube
    </label>

    <input
      id="url"
      placeholder="https://youtu.be/..."
    >

    <label>
      Categoría
    </label>

    <select id="cat">
      <option>Historia</option>
      <option>Gaming</option>
      <option>Tecnología</option>
      <option>Entretenimiento</option>
      <option>Educación</option>
      <option>Otros</option>
    </select>

    <label>
      Modalidad
    </label>

    <select id="mode">

      <option value="basic">
        Básica · 1 moneda por exposición válida
      </option>

      <option value="featured">
        Destacada · 2 monedas por exposición válida
      </option>

      <option value="boost">
        Impulso · 4 monedas por exposición válida
      </option>

    </select>

    <label>
      Presupuesto
    </label>

    <input
      id="budget"
      type="number"
      min="${
        cfg.economy.campaign_min_budget
      }"
      max="${
        cfg.economy.campaign_max_budget
      }"
      value="${
        cfg.economy.campaign_min_budget
      }"
    >

    <p class="muted">

      El presupuesto mínimo es

      ${
        money(
          cfg.economy.campaign_min_budget
        )
      }

      monedas.

      La modalidad indica cuántas monedas
      consume cada exposición válida dentro de VidioUp.

      No es el precio total de la campaña.

    </p>

    <button
      class="btn wide"
      data-action="campaign-preview"
    >
      Revisar campaña
    </button>

    <div id="preview"></div>

  `);
}
