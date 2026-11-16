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
  const money = n => `${fmt(n)} درهم`;

  function showEstimator() {
    document.body.classList.add('in-app');
    home.classList.add('hidden'); result.classList.add('hidden'); estimator.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' }); showStep(1);
  }
  function showStep(n) {
    currentStep = n;
    $$('.form-step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === n));
    $('#progress-label').textContent = `المرحلة ${n} من ٣`;
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
      if (!field.value.trim()) { field.focus(); fieldError(step, 'يرجى ملء الحقول المطلوبة.'); return false; }
      if (field.type === 'email' && !field.validity.valid) { field.focus(); fieldError(step, 'يرجى التحقق من صيغة البريد الإلكتروني.'); return false; }
      if (field.type === 'number' && Number(field.value) <= 0) { field.focus(); fieldError(step, 'يرجى إدخال قيمة أكبر من صفر.'); return false; }
    }
    const group = step === 1 ? 'building' : step === 2 ? 'schedule' : null;
    if (group && !$(`input[name="${group}"]:checked`, pane)) { fieldError(step, 'يرجى اختيار أحد الخيارات للمتابعة.'); return false; }
    if (step === 3 && !$('#consent').checked) { fieldError(step, 'يلزم موافقتكم لعرض هذا التقدير التجريبي.'); return false; }
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
    const homeName = d.company ? `لمقاولة ${escapeHtml(d.company)}` : `لمقاولتكم`;
    result.innerHTML = `<div class="result-nav"><button class="back-home" id="result-back">→ العودة إلى الاستمارة</button><a class="brand" href="#top"><span class="brand-mark">☼</span><span>chams<span class="brand-light">pme</span></span></a><a class="language-switch" href="fr.html" lang="fr">Français</a><span class="prototype-pill">تقدير تجريبي</span></div>
      <div class="result-content"><div class="result-intro"><div class="eyebrow"><span class="eyebrow-dot"></span> تقديركم الأولي</div><h1>آفاق واعدة<br><em>${homeName}.</em></h1><p>إليكم لمحة أولية عن إمكانات مشروعكم. الأرقام تقديرية ومبنية على المعلومات التي قدمتموها.</p></div>
      <div class="result-grid"><article class="result-card result-feature"><span class="result-label">القدرة الشمسية التقديرية <span class="info-tip" title="كيلوواط الذروة هو مقياس للقدرة القصوى النظرية للألواح الشمسية في ظروف معيارية.">i</span></span><div class="result-value range">${fmt(e.kwpLow, 1)} إلى ${fmt(e.kwpHigh, 1)} <small>كيلوواط ذروة</small></div><p>نطاق تقديري يناسب نمط استهلاككم.</p><div class="mini-panel"><span class="mini-sun">☼</span><span><b>الإنتاج السنوي التقديري</b><small>نحو ${fmt(e.kwp * config.annualKwhPerKwp)} كيلوواط ساعة سنوياً</small></span></div></article>
      <article class="result-card"><span class="result-label">التكلفة التقديرية</span><div class="result-value range">${money(e.cost.low)}<small> إلى </small><br>${money(e.cost.high)}</div><p>نطاق تقديري لتكلفة التركيب.</p><div class="card-footnote">لا يشمل الدراسة التقنية أو أي أعمال محتملة على السطح.</div></article>
      <article class="result-card"><span class="result-label">الوفورات السنوية التقديرية</span><div class="result-value range">${money(e.savingLow)}<small> إلى </small><br>${money(e.savingHigh)}<small> سنوياً</small></div><p>تُحسب بناءً على نسبة الطاقة الشمسية المستهلكة في الموقع.</p><div class="card-footnote">وفقاً لنمط نشاطكم والافتراضات الموضحة أدناه.</div></article>
      <article class="result-card result-payback"><span class="result-label">فترة استرداد التكلفة التقديرية</span><div class="result-value">${fmt(e.payback.low, 1)}<small> إلى </small>${fmt(e.payback.high, 1)}<small> سنوات</small></div><p>قد تختلف هذه المدة بحسب استهلاككم الفعلي والمعدات والتكلفة النهائية.</p></article></div>
      <div class="estimate-warning"><span>!</span><p><b>يرجى الانتباه</b>هذا تقدير أولي يحتاج إلى تأكيد بعد دراسة فاتورتكم وسطح المبنى ونمط استهلاككم. لا تُعد هذه النتيجة عرض سعر.</p></div>
      <details class="assumptions" open><summary><span>افتراضات الحساب</span><span class="details-arrow">⌄</span></summary><div class="assumption-grid"><div><b>إنتاج الطاقة الشمسية</b><span>${fmt(config.annualKwhPerKwp)} كيلوواط ساعة / كيلوواط ذروة سنوياً</span></div><div><b>متوسط السعر المستخدم</b><span>${fmt(config.madPerKwh, 2)} درهم / كيلوواط ساعة</span></div><div><b>نسبة الاستهلاك الذاتي</b><span>${fmt(e.selfUse * 100)}% تقديرية وفقاً لساعات نشاطكم</span></div><div><b>التكلفة لكل كيلوواط ذروة</b><span>${money(config.installedMadPerKwp.low)} إلى ${money(config.installedMadPerKwp.high)}</span></div><div class="assumptions-note">افتراضات تجريبية غير رسمية. ${e.estimatedConsumption ? 'تم تقدير استهلاككم انطلاقاً من قيمة فاتورتكم الشهرية.' : 'أدخلتم قيمة استهلاككم بالكيلوواط ساعة.'} هامش عدم يقين قدره ±${fmt(e.uncertainty * 100)}% مأخوذ في الحسبان ضمن التقدير.</div></div></details>
      <div class="result-actions"><div><h2>هل ترغبون في متابعة المشروع؟</h2><p>يمكنكم طلب التواصل معكم لدراسة احتياجاتكم.</p></div><button class="button button-primary" id="quote-request">طلب عرض سعر <span>→</span></button></div>
      <div class="privacy-note">نموذج تجريبي: لا تُرسل أي بيانات أو طلب إلى شركات التركيب.</div></div>`;
    home.classList.add('hidden'); estimator.classList.add('hidden'); result.classList.remove('hidden'); document.body.classList.add('in-app'); window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#result-back').addEventListener('click', () => { result.classList.add('hidden'); estimator.classList.remove('hidden'); showStep(3); });
    $('#quote-request').addEventListener('click', showConfirmation);
  }
  function showConfirmation() {
    result.innerHTML = `<div class="confirmation"><div class="confirm-icon">✓</div><a class="language-switch" href="fr.html" lang="fr">Français</a><div class="eyebrow">طلب تجريبي</div><h1>تم تسجيل طلبكم،<br><em>${escapeHtml(collect().fullname.split(' ')[0])}.</em></h1><p>في النسخة الكاملة، يمكن لمستشار أو شركة تركيب شريكة التواصل معكم لتوضيح تفاصيل المشروع.</p><div class="confirm-box"><b>في هذا النموذج التجريبي</b><span>لم يتم إرسال أي طلب أو حفظ أي بيانات تواصل.</span></div><button class="button button-primary" id="restart">بدء تقدير جديد <span>↻</span></button><a href="#top" class="confirm-home" id="confirm-home">العودة إلى الصفحة الرئيسية</a></div>`;
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
  $('#bill-file').addEventListener('change', e => { const file = e.target.files[0]; $('#file-name').textContent = file ? file.name : 'اختيار ملف'; });
  $('#demo-fill').addEventListener('click', () => {
    form.reset();
    Object.entries({ company: 'دار أطلس للضيافة', sector: 'فندق / دار ضيافة', city: 'مراكش', roof: '180', bill: '6200', kwh: '1450', fullname: 'سلمى المنصوري', phone: '06 12 34 56 78', email: 'salma@dar-atlas.example' }).forEach(([name, value]) => { const el = form.elements.namedItem(name); if (el) el.value = value; });
    $('input[name="building"][value="مالك"]').checked = true;
    $('input[name="schedule"][value="day"]').checked = true;
    $('#consent').checked = true;
    const data = collect(); renderResult(data, calculate(data));
  });
  $('#menu-toggle')?.addEventListener('click', () => $('.header-nav').classList.toggle('open'));
  $$('.header-nav a').forEach(a => a.addEventListener('click', () => $('.header-nav').classList.remove('open')));
})();
