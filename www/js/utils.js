
export const $ = s => document.querySelector(s);
export const esc = (s='') => String(s).replace(/[&<>"']/g,m=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[m]));

export const money = n => Number(n||0).toLocaleString('es-ES');
export const sleep = ms => new Promise(r=>setTimeout(r,ms));

export const card=x=>`
  <section class="card">
    ${x}
  </section>
`;
