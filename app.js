(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const form = $('#estimate-form');
  const home = $('#home-view');
  const estimator = $('#estimator-view');
  const result = $('#result-view');
  let currentStep = 1;
  let estimate = null;
  const config = window.CHAMS_CONFIG;
  const fmt = (n, digits = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
  const money = n => `${fmt(n)} MAD`;

  function showEstimator() {
    document.body.classList.add('in-app');
    home.classList.add('hidden'); result.classList.add('hidden'); estimator.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' }); showStep(1);
  }
  function showStep(n) {
    currentStep = n;
    $$('.form-step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === n));
    $('#progress-label').textContent = `ÉTAPE ${n} SUR 3`;
    $('#progress-percent').textContent = `${Math.round(n / 3 * 100)}%`;
    $('#progress-fill').style.width = `${n / 3 * 100}%`;
    $$('.form-error').forEach(el => el.textContent = '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function fieldError(step, message) {
    $(`.form-step[data-step="${step}"] .form-error`).textContent = message;
  }
  function validateStep(step) {
    const pane = $(`.form-step[data-step="${step}"]`);
    const fields = $$('[required]', pane).filter(el => el.type !== 'radio' && el.type !== 'checkbox');
    for (const field of fields) {
      if (!field.value.trim()) { field.focus(); fieldError(step, 'Merci de compléter les champs obligatoires.'); return false; }
      if (field.type === 'email' && !field.validity.valid) { field.focus(); fieldError(step, 'Vérifiez le format de votre adresse e-mail.'); return false; }
      if (field.type === 'number' && Number(field.value) <= 0) { field.focus(); fieldError(step, 'Saisissez un montant supérieur à zéro.'); return false; }
    }
    const group = step === 1 ? 'building' : step === 2 ? 'schedule' : null;
    if (group && !$(`input[name="${group}"]:checked`, pane)) { fieldError(step, 'Choisissez une option pour continuer.'); return false; }
    if (step === 3 && !$('#consent').checked) { fieldError(step, 'Votre accord est nécessaire pour afficher cette estimation de démonstration.'); return false; }
    return true;
  }
  function collect() {
    const d = Object.fromEntries(new FormData(form).entries());
    d.building = $('input[name="building"]:checked')?.value;
    d.schedule = $('input[name="schedule"]:checked')?.value || 'mixed';
    d.bill = Number(d.bill); d.kwh = Number(d.kwh) || null; d.roof = Number(d.roof) || null;
    return d;
  }
  function calculate(d) {
    const monthlyKwh = d.kwh || d.bill / config.madPerKwh;
    const annualKwh = monthlyKwh * 12;
    const selfUse = config.selfConsumption[d.schedule] ?? config.selfConsumption.mixed;
    const targetKwp = Math.min(config.maxSystemKwp, Math.max(config.minSystemKwp, annualKwh * config.designReserve / (config.annualKwhPerKwp * selfUse)));
    const roofCap = d.roof ? d.roof / config.roofAreaPerKwp : config.maxSystemKwp;
    const kwp = Math.max(config.minSystemKwp, Math.min(targetKwp, roofCap, config.maxSystemKwp));
    const annualSaving = Math.min(annualKwh, kwp * config.annualKwhPerKwp * selfUse) * config.madPerKwh;
    const totalCost = { low: kwp * config.installedMadPerKwp.low, high: kwp * config.installedMadPerKwp.high };
    const uncertainty = d.kwh ? config.uncertainty.normal : config.uncertainty.wide;
    return { kwp, kwpLow: kwp * (1 - uncertainty), kwpHigh: kwp * (1 + uncertainty), saving: annualSaving, savingLow: annualSaving * (1 - uncertainty), savingHigh: annualSaving * (1 + uncertainty), cost: totalCost, payback: { low: totalCost.low / annualSaving, high: totalCost.high / annualSaving }, annualKwh, monthlyKwh, selfUse, estimatedConsumption: !d.kwh, uncertainty };
  }
  function renderResult(d, e) {
    const homeName = d.company ? `pour ${escapeHtml(d.company)}` : `pour votre entreprise`;
    result.innerHTML = `<div class="result-nav"><button class="back-home" id="result-back">← Revenir au formulaire</button><a class="brand" href="#top"><span class="brand-mark">☼</span><span>chams<span class="brand-light">pme</span></span></a><a class="language-switch" href="index.html" lang="ar" dir="rtl">العربية</a><span class="prototype-pill">ESTIMATION DE DÉMONSTRATION</span></div>
      <div class="result-content"><div class="result-intro"><div class="eyebrow"><span class="eyebrow-dot"></span> VOTRE PREMIÈRE ESTIMATION</div><h1>Du soleil à l’horizon,<br><em>${homeName}.</em></h1><p>Voici un premier aperçu du potentiel de votre projet. Les chiffres sont indicatifs et basés sur les informations fournies.</p></div>
      <div class="result-grid"><article class="result-card result-feature"><span class="result-label">PUISSANCE SOLAIRE INDICATIVE <span class="info-tip" title="Le kWc mesure la puissance maximale théorique des panneaux dans des conditions normalisées.">i</span></span><div class="result-value range">${fmt(e.kwpLow, 1)} à ${fmt(e.kwpHigh, 1)} <small>kWc</small></div><p>Une fourchette indicative adaptée à votre profil.</p><div class="mini-panel"><span class="mini-sun">☼</span><span><b>Production annuelle estimée</b><small>Environ ${fmt(e.kwp * config.annualKwhPerKwp)} kWh / an</small></span></div></article>
      <article class="result-card"><span class="result-label">BUDGET INDICATIF</span><div class="result-value range">${money(e.cost.low)}<small> à </small><br>${money(e.cost.high)}</div><p>Fourchette d’investissement pour l’installation.</p><div class="card-footnote">Hors étude technique et éventuels travaux de toiture.</div></article>
      <article class="result-card"><span class="result-label">ÉCONOMIES ANNUELLES ESTIMÉES</span><div class="result-value range">${money(e.savingLow)}<small> à </small><br>${money(e.savingHigh)}<small> / an</small></div><p>Calculées sur la part d’énergie solaire consommée sur place.</p><div class="card-footnote">Selon votre profil d’activité et les hypothèses affichées ci-dessous.</div></article>
      <article class="result-card result-payback"><span class="result-label">RETOUR SUR INVESTISSEMENT INDICATIF</span><div class="result-value">${fmt(e.payback.low, 1)}<small> à </small>${fmt(e.payback.high, 1)}<small> ans</small></div><p>Ce délai peut varier selon votre consommation réelle, le matériel et le coût final.</p></article></div>
      <div class="estimate-warning"><span>!</span><p><b>À garder en tête</b>Estimation indicative, à confirmer après étude de votre facture, de votre toiture et de votre profil de consommation. Ce résultat ne constitue pas un devis.</p></div>
      <details class="assumptions" open><summary><span>Hypothèses de calcul</span><span class="details-arrow">⌄</span></summary><div class="assumption-grid"><div><b>Production solaire</b><span>${fmt(config.annualKwhPerKwp)} kWh / kWc / an</span></div><div><b>Tarif moyen utilisé</b><span>${fmt(config.madPerKwh, 2)} MAD / kWh</span></div><div><b>Part autoconsommée</b><span>${fmt(e.selfUse * 100)}% estimés selon votre rythme d’activité</span></div><div><b>Coût par kWc</b><span>${money(config.installedMadPerKwp.low)} à ${money(config.installedMadPerKwp.high)}</span></div><div class="assumptions-note">Hypothèses de démonstration, non officielles. ${e.estimatedConsumption ? 'Votre consommation a été approximée à partir du montant mensuel de votre facture.' : 'La consommation en kWh a été renseignée par vos soins.'} Une marge d’incertitude de ±${fmt(e.uncertainty * 100)}% est prise en compte dans l’estimation.</div></div></details>
      <div class="result-actions"><div><h2>Un projet vous intéresse ?</h2><p>Vous pouvez demander à être recontacté pour étudier votre besoin.</p></div><button class="button button-primary" id="quote-request">Demander un devis <span>→</span></button></div>
      <div class="privacy-note">Prototype de démonstration : aucune donnée ni demande n’est envoyée à un installateur.</div></div>`;
    home.classList.add('hidden'); estimator.classList.add('hidden'); result.classList.remove('hidden'); document.body.classList.add('in-app'); window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#result-back').addEventListener('click', () => { result.classList.add('hidden'); estimator.classList.remove('hidden'); showStep(3); });
    $('#quote-request').addEventListener('click', showConfirmation);
  }
  function showConfirmation() {
    result.innerHTML = `<div class="confirmation"><div class="confirm-icon">✓</div><a class="language-switch" href="index.html" lang="ar" dir="rtl">العربية</a><div class="eyebrow">DEMANDE DE DÉMONSTRATION</div><h1>C’est noté,<br><em>${escapeHtml(collect().fullname.split(' ')[0])}.</em></h1><p>Dans une version complète, un conseiller ou un installateur partenaire pourrait vous recontacter pour préciser le projet.</p><div class="confirm-box"><b>Pour ce prototype</b><span>Aucune demande n’a été envoyée et aucune coordonnée n’a été enregistrée.</span></div><button class="button button-primary" id="restart">Recommencer une estimation <span>↻</span></button><a href="#top" class="confirm-home" id="confirm-home">Retour à l’accueil</a></div>`;
    $('#restart').addEventListener('click', () => { form.reset(); result.classList.add('hidden'); showEstimator(); });
    $('#confirm-home').addEventListener('click', e => { e.preventDefault(); form.reset(); result.classList.add('hidden'); home.classList.remove('hidden'); document.body.classList.remove('in-app'); window.scrollTo({top:0, behavior:'smooth'}); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  $$('[data-start]').forEach(b => b.addEventListener('click', showEstimator));
  $('#exit-estimator').addEventListener('click', e => { e.preventDefault(); estimator.classList.add('hidden'); home.classList.remove('hidden'); document.body.classList.remove('in-app'); window.scrollTo({top:0,behavior:'smooth'}); });
  $$('.next-step').forEach(b => b.addEventListener('click', () => { if (validateStep(currentStep)) showStep(currentStep + 1); }));
  $$('.previous-step').forEach(b => b.addEventListener('click', () => showStep(currentStep - 1)));
  form.addEventListener('submit', e => { e.preventDefault(); if (!validateStep(3)) return; const data = collect(); estimate = calculate(data); renderResult(data, estimate); });
  $('#bill-file').addEventListener('change', e => { const file = e.target.files[0]; $('#file-name').textContent = file ? file.name : 'Choisir un fichier'; });
  $('#demo-fill').addEventListener('click', () => {
    form.reset();
    Object.entries({ company: 'Maison d’hôtes Dar Atlas', sector: 'Hôtel / maison d’hôtes', city: 'Marrakech', roof: '180', bill: '6200', kwh: '1450', fullname: 'Salma El Mansouri', phone: '06 12 34 56 78', email: 'salma@dar-atlas.example' }).forEach(([name, value]) => { const el = form.elements.namedItem(name); if (el) el.value = value; });
    $('input[name="building"][value="Propriétaire"]').checked = true;
    $('input[name="schedule"][value="day"]').checked = true;
    $('#consent').checked = true;
    const data = collect(); renderResult(data, calculate(data));
  });
  $('#menu-toggle')?.addEventListener('click', () => $('.header-nav').classList.toggle('open'));
  $$('.header-nav a').forEach(a => a.addEventListener('click', () => $('.header-nav').classList.remove('open')));
})();
