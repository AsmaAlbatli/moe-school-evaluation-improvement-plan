/* =====================================================================
   app.js — واجهة المنصة
   ===================================================================== */

/* ---------------------------------------------------------------- */
/*  الأيقونات (SVG مضمّنة)                                           */
/* ---------------------------------------------------------------- */
const P = {
  crown:'M3 7l4 4 5-7 5 7 4-4v11H3z',
  book:'M4 4h11a3 3 0 013 3v13H7a3 3 0 01-3-3z M18 7h2v13H7',
  target:'M12 21a9 9 0 100-18 9 9 0 000 18z M12 16a4 4 0 100-8 4 4 0 000 8z M12 13a1 1 0 100-2 1 1 0 000 2z',
  building:'M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16 M14 10h4a2 2 0 012 2v9 M3 21h18 M7 7h1 M7 11h1 M7 15h1 M17 14h1 M17 18h1 M10 7h1 M10 11h1 M10 15h1',
  alert:'M12 3l9.5 17H2.5z M12 9v5 M12 17.5v.5',
  rocket:'M5 15c-1.5 1.5-2 6-2 6s4.5-.5 6-2a2.8 2.8 0 00-4-4z M9 13l-2-2 6-6 2 2z M15 5l4 4 M14 4l6 6',
  chart:'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  trophy:'M7 4h10v5a5 5 0 01-10 0z M7 6H4v2a3 3 0 003 3 M17 6h3v2a3 3 0 01-3 3 M9 20h6 M12 14v6',
  dot:'M12 17a5 5 0 100-10 5 5 0 000 10z',
  compass:'M12 21a9 9 0 100-18 9 9 0 000 18z M15.5 8.5l-2 5-5 2 2-5z',
  leadership:'M12 3l2.5 5.5L20 10l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1.5z',
  users:'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2 M9.5 11a4 4 0 100-8 4 4 0 000 8z M21 20v-2a4 4 0 00-3-3.9 M16 3.1a4 4 0 010 7.8',
  growth:'M3 20h18 M6 16l4-4 3 3 5-6 M15 9h4v4',
  shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  shieldcheck:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  lightbulb:'M9 18h6 M10 21h4 M12 3a6 6 0 00-3.5 10.9V16h7v-2.1A6 6 0 0012 3z',
  check:'M20 6L9 17l-5-5',
  graduation:'M2 9l10-5 10 5-10 5z M6 11.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-5.5',
  heart:'M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 10-7.1 7.1L12 21l8.8-8.3a5 5 0 000-7.1z',
  home:'M3 10l9-7 9 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  upload:'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 9l5-5 5 5 M12 4v12',
  download:'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 11l5 5 5-5 M12 16V4',
  printer:'M6 9V3h12v6 M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2 M6 14h12v7H6z',
  save:'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M7 3v5h7 M7 14h10v7H7z',
  refresh:'M21 12a9 9 0 11-2.6-6.4 M21 3v6h-6',
  trash:'M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14 M10 11v6 M14 11v6',
  info:'M12 21a9 9 0 100-18 9 9 0 000 18z M12 16v-5 M12 8v.5',
  file:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6',
  school:'M12 3l10 5-10 5L2 8z M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5',
  x:'M18 6L6 18 M6 6l12 12',
  sparkle:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
  list:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  flag:'M4 22V4h11l-1 4 1 4H4',
  clock:'M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2',
  user:'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  clipboard:'M9 4h6v3H9z M8 5H6a2 2 0 00-2 2v13a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2',
  tools:'M14.7 6.3a4 4 0 015.3 5.3l-1.4-1.4-2.5.7.7-2.5z M13.5 8.5L4 18v2h2l9.5-9.5',
  link:'M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1 M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1'
};
const ico = (n, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"><path d="${P[n] || P.dot}"/></svg>`;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (v === null || v === undefined || v === '') ? '' : round(v);
const el = id => document.getElementById(id);
const chipColors = ['c1', 'c2', 'c3', 'c4', 'c5'];

/* ---------------------------------------------------------------- */
/*  تنبيهات                                                          */
/* ---------------------------------------------------------------- */
function toast(msg, kind = '') {
  const host = el('toast-host');
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  d.innerHTML = `${ico(kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : kind === 'warn' ? 'alert' : 'info')}<span>${esc(msg)}</span>`;
  host.appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; }, 3200);
  setTimeout(() => d.remove(), 3600);
}

/* ---------------------------------------------------------------- */
/*  الحالة                                                           */
/* ---------------------------------------------------------------- */
let state = Store.load();
let selectedDomain = null;
let filterLevel = 'all';
let sortAsc = true;

function save() { Store.save(); }

/* ================================================================== */
/*  1) بيانات المدرسة                                                 */
/* ================================================================== */
const SCHOOL_FIELDS = [
  { k: 'name', l: 'اسم المدرسة', ph: 'مثال: الابتدائية السادسة عشرة بعد المائة 116', span: 2 },
  { k: 'ministryNo', l: 'الرقم الوزاري', ph: 'مثال: 5-95194' },
  { k: 'type', l: 'نوع المدرسة', ph: 'تعليمي / حكومي', type: 'select', opts: ['تعليمي', 'حكومي', 'أهلي'] },
  { k: 'gender', l: 'الجنس', type: 'select', opts: ['بنات', 'بنين'] },
  { k: 'stage', l: 'المرحلة الدراسية', type: 'select', opts: ['الابتدائية', 'المتوسطة', 'الثانوية', 'رياض الأطفال'] },
  { k: 'office', l: 'إدارة التعليم', ph: 'مثال: الإدارة العامة للتعليم بمنطقة الرياض' },
  { k: 'students', l: 'عدد الطلبة الإجمالي', type: 'number', ph: 'مثال: 453' },
  { k: 'cycle', l: 'دورة التقويم', type: 'select', opts: ['الدورة الأولى', 'الدورة الثانية'] },
  { k: 'reportType', l: 'نوع التقرير', type: 'select', opts: ['تقرير التقويم الذاتي', 'تقرير التقويم الخارجي'] }
];

function renderSchoolForm() {
  const host = el('school-fields');
  host.innerHTML = SCHOOL_FIELDS.map(f => {
    const v = state.school[f.k] ?? '';
    const attrs = `id="sf-${f.k}" data-k="${f.k}"`;
    let ctrl;
    if (f.type === 'select') {
      const opts = (f.opts || []).map(o =>
        `<option value="${esc(o)}"${String(v).trim() === o ? ' selected' : ''}>${esc(o)}</option>`).join('');
      ctrl = `<select ${attrs}><option value="">— اختر —</option>${opts}</select>`;
    } else if (f.type === 'number') {
      ctrl = `<input type="number" step="any" min="0" ${attrs} value="${esc(v)}" placeholder="${esc(f.ph || '')}">`;
    } else {
      ctrl = `<input type="text" ${attrs} value="${esc(v)}" placeholder="${esc(f.ph || '')}">`;
    }
    return `<div class="field"${f.span ? ' style="grid-column:span ' + f.span + '"' : ''}>
      <label for="sf-${f.k}">${esc(f.l)}</label>${ctrl}</div>`;
  }).join('');

  host.querySelectorAll('[data-k]').forEach(inp => {
    inp.addEventListener('input', () => {
      const k = inp.dataset.k;
      state.school[k] = inp.type === 'number' ? (inp.value === '' ? '' : Number(inp.value)) : inp.value;
      save();
      renderSummary();
    });
  });
}

/* ================================================================== */
/*  2) الملخص العام + أعمدة المجالات                                 */
/* ================================================================== */
function renderSummary() {
  const overall = overallScore();
  const lv = levelOf(overall);
  const meta = levelMeta(lv);
  const R = 78, C = 2 * Math.PI * R;
  const off = C - (overall === null ? 0 : Math.min(overall, 100) / 100) * C;

  el('ring').innerHTML = `
    <svg viewBox="0 0 180 180">
      <circle class="track" cx="90" cy="90" r="${R}" fill="none" stroke-width="15"/>
      <circle class="fill" cx="90" cy="90" r="${R}" fill="none" stroke-width="15"
        stroke="${meta.color}" stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
    </svg>
    <div class="center">
      <div class="val" style="color:${meta.color}">${overall === null ? '—' : pct(overall)}</div>
      <div class="cap">الأداء العام</div>
      <div class="badge" style="color:${meta.color};border-color:${meta.color};background:${meta.soft}">
        ${ico(meta.icon)}${meta.label}
      </div>
    </div>`;

  el('lvl-strip').innerHTML = LEVEL_ORDER.map(k => {
    const L = LEVELS[k];
    return `<span class="lvl-pill" style="color:${L.color};border-color:${L.color};background:${L.soft}">
      <i style="background:${L.color}"></i>${L.label} — ${L.range}</span>`;
  }).join('');

  /* أعمدة المجالات مرتبة من الأدنى إلى الأعلى */
  const ranked = rankedDomains();
  el('domain-bars').innerHTML = ranked.map((d, i) => {
    const m = levelMeta(d.level);
    const w = d.score === null ? 0 : Math.max(d.score, 4);
    return `<div class="dbar">
      <div class="dbar-top">
        <span class="dbar-rank">${i + 1}</span>
        <span class="dbar-ico" style="color:${d.accent}">${ico(d.icon)}</span>
        <span class="dbar-name">${esc(d.domain)}</span>
        <span class="dbar-val" style="color:${m.color}">${pct(d.score)}</span>
        <span class="badge" style="color:${m.color};border-color:${m.color};background:${m.soft};font-size:11px;padding:2px 10px">
          ${ico(m.icon)}${m.label}</span>
      </div>
      <div class="dbar-track">
        <div class="dbar-fill" style="width:${w}%;background:${m.color}"></div>
      </div>
    </div>`;
  }).join('');

  renderNotes();
  buildDomainSelect();
}

function renderNotes() {
  const host = el('notes');
  const notes = keyNotes();
  const crit = criticalIndicators();
  let html = notes.map(n => `<div class="note">${ico('info')}<span>${esc(n)}</span></div>`).join('');

  if (crit.length) {
    html += `<div class="note warn">${ico('alert')}<span>
      <strong>مؤشرات ذات أولوية عاجلة (مستوى التهيئة — أقل من 50%):</strong><br>
      ${crit.map(i => `• ${esc(i.text)} (${esc(i.code)})`).join('<br>')}
    </span></div>`;
  }
  const ranked = rankedDomains();
  const filled = ALL_INDICATORS.filter(i => typeof state.results[i.code] === 'number').length;
  if (!filled) {
    html += `<div class="note">${ico('info')}<span>
      لم تُدخل أي نسب بعد. استخدم زر <strong>«استيراد ملف»</strong> لتحليل تقرير المدرسة،
      أو أدخل النسب يدويًا من قائمة المؤشرات أدناه.
    </span></div>`;
  } else if (filled < ALL_INDICATORS.length) {
    html += `<div class="note warn">${ico('alert')}<span>
      تم إدخال ${filled} من أصل ${ALL_INDICATORS.length} مؤشرًا. نسبة تغطية البيانات ${Math.round(filled / ALL_INDICATORS.length * 100)}%.
    </span></div>`;
  }
  host.innerHTML = html;
}

/* ================================================================== */
/*  3) القائمة المنسدلة للمجالات                                     */
/* ================================================================== */
function buildDomainSelect() {
  const ranked = rankedDomains();
  const sel = el('domain-select');
  const prev = selectedDomain;
  sel.innerHTML = `<option value="">— اختر المجال لعرض مؤشراته —</option>` +
    ranked.map((d, i) => {
      const m = levelMeta(d.level);
      return `<option value="${d.d}"${String(prev) === String(d.d) ? ' selected' : ''}>
        ${i + 1}. ${esc(d.domain)} — ${pct(d.score)} (${m.label})</option>`;
    }).join('');
  if (prev && !ranked.some(d => String(d.d) === String(prev))) selectedDomain = null;
}

function renderIndicators() {
  const host = el('domain-panel');
  if (!selectedDomain) {
    host.innerHTML = `<div class="empty">${ico('school')}
      <h3>اختر المجال من القائمة المنسدلة أعلاه</h3>
      <p>عند اختيار المجال ستظهر مؤشراته مرتبةً من الأضعف إلى الأقوى،
         مع مستوى الأداء وأساليب التحسين المقترحة لكل مؤشر.</p></div>`;
    el('plan-host').innerHTML = '';
    return;
  }

  const dom = CATALOG.find(d => d.d === Number(selectedDomain));
  const m = levelMeta(levelOf(domainScore(dom.d)));
  const comp = completion(dom.d);
  const critBar = dom.criteria.map(c => {
    const s = critScore(dom.d, c.c);
    const cm = levelMeta(levelOf(s));
    return `<option value="${c.c}"${String(filterLevel) === 'c' + c.c ? ' selected' : ''}>
      ${esc(c.name)} — ${pct(s)} (${cm.label})</option>`;
  }).join('');

  const crits = dom.criteria.map(c => ({ c, score: critScore(dom.d, c.c) }))
    .filter(x => x.score !== null).sort((a, b) => a.score - b.score);

  const cs2 = el('crit-select');
  if (cs2) {
    cs2.innerHTML = `<option value="all">كل المعايير</option>` + critBar;
    cs2.value = filterLevel;
  }

  let html = `<div class="card-head" style="border-radius:0">
    <h2 style="color:${dom.accent}">${ico(dom.icon)} ${esc(dom.domain)}</h2>
    <span class="chip-count">${pct(domainScore(dom.d))}</span>
    <span class="badge" style="color:${m.color};border-color:${m.color};background:${m.soft}">${ico(m.icon)}${m.label}</span>
    <span class="spacer"></span>
    <span class="chip-count">اكتمال البيانات ${comp.pct}%</span>
  </div>`;

  if (crits.length > 1) {
    html += `<div class="note" style="margin-bottom:14px">${ico('info')}<span>
      أضعف جانب فرعي: <strong>${esc(crits[0].c.name)}</strong> (${pct(crits[0].score)})،
      وأقواه: <strong>${esc(crits[crits.length - 1].c.name)}</strong> (${pct(crits[crits.length - 1].score)}).
    </span></div>`;
  }

  html += '<div class="ind-list">';
  dom.criteria.forEach(c => {
    if (filterLevel !== 'all' && filterLevel !== 'c' + c.c) return;
    const cs = critScore(dom.d, c.c);
    const cm = levelMeta(levelOf(cs));
    const list = rankedIndicators(dom.d, `${dom.d}-${c.c}`);

    html += `<div class="crit-group">
      <div class="crit-head">
        <span class="code">${dom.d}-${c.c}</span>
        ${ico(c.icon)} ${esc(c.name)}
        <span class="spacer"></span>
        <span class="score">${pct(cs)} — ${cm.label}</span>
      </div>
      <div class="ind-list">${list.map(indCard).join('')}</div>
    </div>`;
  });
  html += '</div>';
  host.innerHTML = html;

  bindIndicatorInputs(host);
  renderPlan();
}

function indCard(i) {
  const m = levelMeta(i.level);
  const mechs = INDICATOR_MECHANISMS[i.code] || [];
  const width = i.pct === null ? 0 : Math.min(i.pct, 100);

  return `<div class="ind" data-lv="${i.level || 'none'}" data-code="${i.code}">
    <div class="ind-top">
      <span class="ind-code">${i.code}</span>
      <span class="ind-text">${esc(i.text)}</span>
      <span class="ind-badges">
        <span class="badge ${i.level ? '' : 'gray'}" style="${i.level ? `color:${m.color};border-color:${m.color};background:${m.soft}` : ''}">
          ${ico(m.icon)}${m.label}
        </span>
      </span>
      <span class="ind-edit">
        <input type="number" step="0.01" min="0" max="100" value="${num(i.pct)}"
               data-code="${i.code}" placeholder="—">
        <span>%</span>
      </span>
    </div>

    <div class="ind-meter"><span style="width:${width}%;background:${m.color}"></span></div>

    ${i.advice ? `<div class="ind-adv">
      <strong>مقترح التحسين الوارد في التقرير:</strong> ${esc(i.advice)}
    </div>` : ''}

    ${mechs.length ? `<div class="mech-label">${ico('tools')} أساليب التحسين المقترحة</div>
      <div class="mech-chips">${mechs.map((m2, k) =>
        `<span class="chip ${chipColors[k % chipColors.length]}">${esc(m2)}</span>`).join('')}</div>` : ''}
  </div>`;
}

function bindIndicatorInputs(root) {
  root.querySelectorAll('input[data-code]').forEach(inp => {
    inp.addEventListener('input', () => {
      const v = inp.value === '' ? undefined : Number(inp.value);
      if (v === undefined || isNaN(v)) delete state.results[inp.dataset.code];
      else state.results[inp.dataset.code] = Math.max(0, Math.min(100, v));
      save();
      clearTimeout(inp._t);
      inp._t = setTimeout(() => { renderSummary(); renderIndicators(); }, 320);
    });
    inp.addEventListener('blur', () => { renderSummary(); renderIndicators(); });
  });
}

/* ================================================================== */
/*  4) بطاقة خطة التحسين                                             */
/* ================================================================== */
const PLAN_ROWS = [
  { k: 'target', icon: 'target', label: 'الدرجة المستهدفة' },
  { k: 'need', icon: 'alert', label: 'وصف الاحتياج' },
  { k: 'actions', icon: 'tools', label: 'إجراءات التحسين', list: true },
  { k: 'mechanisms', icon: 'list', label: 'آليات تنفيذ إجراءات التحسين', list: true },
  { k: 'owner', icon: 'user', label: 'مسؤولية التنفيذ' },
  { k: 'duration', icon: 'clock', label: 'مدة الإنجاز' }
];

function renderPlan() {
  const host = el('plan-host');
  if (!selectedDomain) { host.innerHTML = ''; return; }
  const dom = CATALOG.find(d => d.d === Number(selectedDomain));
  const plan = buildPlan(dom.d);
  const m = levelMeta(levelOf(domainScore(dom.d)));

  let rows = PLAN_ROWS.map(r => {
    let val;
    if (r.list) {
      const items = (plan[r.k] || []).filter(Boolean);
      val = items.length
        ? `<ul class="clean" contenteditable="true" data-d="${dom.d}" data-f="${r.k}">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
        : `<span class="badge gray">${ico('info')} لم يُحدَّد</span>`;
    } else {
      val = `<div class="plan-val" contenteditable="true" data-d="${dom.d}" data-f="${r.k}">${esc(plan[r.k] || '')}</div>`;
    }
    return `<div class="plan-row">
      <div class="plan-key">${ico(r.icon)} ${esc(r.label)}</div>
      <div>${val}</div>
    </div>`;
  }).join('');

  host.innerHTML = `<div class="card plan-card">
    <div class="card-head" style="background:linear-gradient(90deg,${dom.accent},${dom.accent}cc)">
      <h2 style="color:#fff">${ico('clipboard')} خطة تحسين مجال: ${esc(dom.domain)}</h2>
      <span class="spacer"></span>
      <span class="badge" style="color:#fff;border-color:rgba(255,255,255,.5);background:rgba(255,255,255,.18)">
        ${pct(domainScore(dom.d))} — ${m.label}</span>
    </div>
    <div class="card-body">
      <p class="plan-hint">${ico('edit')} يمكنك تعديل نصوص الخطة مباشرة داخل الصفحة — تُحفظ تلقائيًا.</p>
      ${rows}
    </div>
  </div>`;

  host.querySelectorAll('[contenteditable="true"]').forEach(node => {
    node.addEventListener('blur', () => {
      const d = node.dataset.d, f = node.dataset.f;
      if (f === 'actions' || f === 'mechanisms') {
        const items = [...node.querySelectorAll('li')].map(li => li.textContent.trim()).filter(Boolean);
        setPlanOverride(d, f, items);
      } else {
        setPlanOverride(d, f, node.textContent.trim());
      }
      toast('تم حفظ تعديل الخطة', 'ok');
    });
  });
}

/* ================================================================== */
/*  5) بيانات المدرسة في الطباعة + عرض كل المجالات                   */
/* ================================================================== */
function buildPrintView() {
  const st = state;
  const overall = overallScore();
  const m = levelMeta(levelOf(overall));
  const ranked = rankedDomains();

  const info = [
    ['اسم المدرسة', st.school.name], ['الرقم الوزاري', st.school.ministryNo],
    ['إدارة التعليم', st.school.office], ['نوع المدرسة', st.school.type],
    ['الجنس', st.school.gender], ['المرحلة الدراسية', st.school.stage],
    ['عدد الطلبة', st.school.students], ['دورة التقويم', st.school.cycle],
    ['نوع التقرير', st.school.reportType]
  ].filter(x => x[1] !== '' && x[1] != null);

  let h = `<div class="card" style="margin-bottom:12px">
    <div class="card-head"><h2>${ico('info')} ملخص بيانات المدرسة والأداء العام</h2></div>
    <div class="card-body">
      <div class="grid grid-4" style="font-size:11pt">
        ${info.map(x => `<div><div style="font-size:8.5pt;color:var(--muted);font-weight:700">${x[0]}</div>
          <div style="font-weight:700">${esc(x[1])}</div></div>`).join('')}
        <div><div style="font-size:8.5pt;color:var(--muted);font-weight:700">الأداء العام</div>
          <div style="font-weight:800;color:${m.color};font-size:13pt">${pct(overall)} — ${m.label}</div></div>
      </div>
      <div class="dom-bars" style="margin-top:12px;gap:10px">
        ${ranked.map((d, i) => {
          const dm = levelMeta(d.level);
          return `<div class="dbar">
            <div class="dbar-top">
              <span class="dbar-rank">${i + 1}</span>
              <span class="dbar-name">${esc(d.domain)}</span>
              <span class="dbar-val" style="color:${dm.color};font-size:11pt">${pct(d.score)}</span>
              <span class="badge" style="color:${dm.color};border-color:${dm.color};background:${dm.soft};font-size:8pt;padding:1px 8px">${dm.label}</span>
            </div>
            <div class="dbar-track" style="height:13px"><div class="dbar-fill" style="width:${d.score ?? 0}%;background:${dm.color};min-width:16px"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;

  const crit = criticalIndicators();
  if (crit.length) {
    h += `<div class="card" style="margin-bottom:12px">
      <div class="card-head"><h2>${ico('alert')} مؤشرات ذات الأولوية العاجلة (التهيئة)</h2></div>
      <div class="card-body" style="font-size:10.5pt">
        ${crit.map(i => `<div class="print-ind"><span class="pc">${i.code}</span>
          <span>${esc(i.text)}</span><b>${pct(i.pct)}</b></div>`).join('')}
      </div></div>`;
  }

  ranked.forEach((d, i) => {
    const dm = levelMeta(d.level);
    const plan = buildPlan(d.d);
    h += `<div class="domain-print">
      <div class="dp-head">
        <span class="dbar-rank">${i + 1}</span>
        <h3 style="margin:0">${esc(d.domain)}</h3>
        <b style="color:${dm.color};font-size:12pt">${pct(d.score)}</b>
        <span class="badge" style="color:${dm.color};border-color:${dm.color};background:${dm.soft};font-size:8pt;padding:1px 8px">${dm.label}</span>
        <span style="font-size:8.5pt;color:var(--muted);margin-right:auto">${dm.range}</span>
      </div>
      <div style="font-size:9pt;margin-bottom:7px;color:var(--muted)">
        ${d.criteria.map(c => `${esc(c.name)}: ${pct(c.score)}`).join(' • ')}
      </div>
      ${rankedIndicators(d.d).map(ind => `
        <div class="print-ind">
          <span class="pc">${ind.code}</span>
          <span>${esc(ind.text)}
            <span class="print-mech">${(INDICATOR_MECHANISMS[ind.code] || []).join(' • ')}</span>
          </span>
          <b style="color:${levelMeta(ind.level).color}">${ind.pct === null ? '—' : pct(ind.pct)}</b>
        </div>`).join('')}
      <div style="margin-top:9px;padding-top:7px;border-top:1.5px solid var(--navy-200);font-size:9.5pt">
        <div style="margin-bottom:4px"><b style="color:var(--navy-700)">الدرجة المستهدفة:</b> ${esc(plan.target)}</div>
        <div style="margin-bottom:4px"><b style="color:var(--navy-700)">وصف الاحتياج:</b> ${esc(plan.need)}</div>
        <div style="margin-bottom:4px"><b style="color:var(--navy-700)">إجراءات التحسين:</b>
          ${(plan.actions || []).map((a, k) => `${k + 1}) ${esc(a)}`).join(' ')}</div>
        <div style="margin-bottom:4px"><b style="color:var(--navy-700)">آليات التنفيذ:</b>
          ${(plan.mechanisms || []).map((m2, k) => `${k + 1}) ${esc(m2)}`).join(' ')}</div>
        <div><b style="color:var(--navy-700)">المسؤولية:</b> ${esc(plan.owner)} &nbsp;•&nbsp;
             <b style="color:var(--navy-700)">المدة:</b> ${esc(plan.duration)}</div>
      </div>
    </div>`;
  });

  h += `<div style="margin-top:22px;padding-top:10px;border-top:1.5px solid var(--navy-700);
        display:grid;grid-template-columns:1fr 1fr;gap:26px;font-size:10.5pt">
      <div>مُعد الخطة: .............................................. &nbsp;&nbsp; التوقيع: ..................</div>
      <div>مدير المدرسة: .............................................. &nbsp;&nbsp; التوقيع: ..................</div>
      <div>التاريخ: ..............................................</div>
    </div>`;

  el('print-all').innerHTML = h;
}

function doPrint() {
  buildPrintView();
  document.body.classList.add('printing');
  const screen = el('screen-view');
  const old = screen.style.display;
  screen.style.display = 'none';
  setTimeout(() => {
    window.print();
    screen.style.display = old;
    document.body.classList.remove('printing');
  }, 120);
}

/* ================================================================== */
/*  6) الاستيراد والتصدير                                            */
/* ================================================================== */
const OCR_LABELS = {
  'loading tesseract core': 'تحميل محرك التحليل البصري',
  'initializing tesseract': 'تهيئة المحرك',
  'loading language traineddata': 'تحميل بيانات اللغة العربية',
  'initializing api': 'تجهيز واجهة التحليل',
  'recognizing text': 'قراءة نص الصفحة'
};

function showProgress(on) {
  const box = el('ocr-progress');
  box.style.display = on ? 'block' : 'none';
  if (!on) { el('ocr-bar').style.width = '0%'; el('ocr-text').textContent = ''; }
}
function setProgress(label, pct) {
  el('ocr-bar').style.width = Math.round(pct * 100) + '%';
  el('ocr-text').textContent = label;
}

async function handleFile(file) {
  if (!file) return;
  const isPDF = file.name.toLowerCase().endsWith('.pdf');
  toast(isPDF ? `جارٍ تحليل: ${file.name}` : `جارٍ قراءة: ${file.name}`, '');

  const onProgress = e => {
    if (!e) return;
    if (e.phase === 'read') {
      showProgress(true);
      setProgress(`قراءة نص الملف — صفحة ${e.done} من ${e.total}`, e.total ? e.done / e.total : 0);
    } else if (e.phase === 'page') {
      showProgress(true);
      setProgress(`التحليل البصري (OCR) — صفحة ${e.done} من ${e.total}`, e.total ? e.done / e.total : 0);
    } else if (e.phase === 'ocr-start') {
      showProgress(true);
      setProgress('الملف ممسوح ضوئيًا — تشغيل محرك التحليل البصري…', 0.02);
    } else if (e.phase === 'ocr-retry') {
      setProgress(`إعادة تهيئة محرك التحليل البصري (محاولة ${e.attempt})…`, 0.02);
    } else if (OCR_LABELS[e.phase]) {
      showProgress(true);
      setProgress(OCR_LABELS[e.phase], 0.03 + (e.progress || 0) * 0.12);
    }
  };

  try {
    const res = await importFile(file, { onProgress });
    state = Store.get();
    renderAll();
    showProgress(false);

    const parts = [];
    if (res.indicators) parts.push(`${res.indicators} مؤشرًا`);
    if (res.criteria) parts.push(`${res.criteria} معيارًا`);
    if (res.domains) parts.push(`${res.domains} مجالًا`);
    toast(parts.length ? `تم استيراد ${parts.join(' و ')} بنجاح` : 'تمت قراءة الملف — لم يُعثر على نسب', parts.length ? 'ok' : 'warn');

    if (res.estimated)
      setTimeout(() => toast(`${res.estimated} نسبة استُنتجت من مستوى الأداء المذكور في التقرير — يُنصح بمراجعتها`, 'warn'), 900);
    if (res.note) setTimeout(() => toast(res.note, res.mode === 'ocr' ? 'warn' : ''), 1600);
    if (res.unmatched && res.unmatched.length)
      setTimeout(() => toast(`تعذّر تصنيف ${res.unmatched.length} صف — راجع الملف`, 'warn'), 2300);
  } catch (e) {
    showProgress(false);
    toast('خطأ: ' + e.message, 'err');
    console.error(e);
  }
}

function exportJSON() {
  const blob = new Blob([JSON.stringify({
    school: state.school, results: state.results,
    critPct: state.critPct, domainPct: state.domainPct,
    planOverrides: state.planOverrides
  }, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `خطة_التحسين_${(state.school.name || 'المدرسة').replace(/[\\/:*?"<>|]/g, '')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('تم تصدير الملف', 'ok');
}

function confirmReset() {
  el('modal-reset').classList.add('show');
}
function doReset() {
  state = Store.reset();
  selectedDomain = null;
  el('modal-reset').classList.remove('show');
  renderAll();
  toast('تم مسح جميع البيانات', 'ok');
}

/* ================================================================== */
/*  7) التهيئة                                                       */
/* ================================================================== */
function renderAll() {
  renderSchoolForm();
  renderSummary();
  renderIndicators();
}

function init() {
  state = Store.load();

  /* نصوص ثابتة: تعبئة كل خانات الأيقونات */
  document.querySelectorAll('[data-ico]').forEach(node => {
    node.innerHTML = ico(node.dataset.ico);
  });

  /* القائمة المنسدلة */
  const sel = el('domain-select');
  sel.addEventListener('change', () => {
    selectedDomain = sel.value ? Number(sel.value) : null;
    filterLevel = 'all';
    renderIndicators();
  });

  el('crit-select').addEventListener('change', e => {
    filterLevel = e.target.value;
    renderIndicators();
  });

  el('btn-print').addEventListener('click', doPrint);
  el('btn-save').addEventListener('click', () => {
    Store.save(); toast('تم الحفظ في المتصفح', 'ok');
  });
  el('btn-reset').addEventListener('click', confirmReset);
  el('btn-export').addEventListener('click', exportJSON);
  el('btn-import').addEventListener('click', () => el('file-input').click());
  el('modal-reset').addEventListener('click', e => {
    if (e.target.id === 'modal-reset') e.currentTarget.classList.remove('show');
  });
  el('btn-yes-reset').addEventListener('click', doReset);
  el('btn-no-reset').addEventListener('click', () => el('modal-reset').classList.remove('show'));

  ['xlsx', 'csv', 'json'].forEach(fmt => {
    el('tpl-' + fmt).addEventListener('click', () => downloadTemplate(fmt));
  });

  /* استيراد الملفات */
  const drop = el('drop');
  const input = el('file-input');
  input.addEventListener('change', e => { handleFile(e.target.files[0]); e.target.value = ''; });
  drop.addEventListener('click', () => input.click());
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault(); drop.classList.remove('over');
  }));
  drop.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));

  renderAll();

  /* فتح مجال محدد من الرابط: index.html#d=3 */
  const hash = (location.hash || '').match(/d=(\d)/);
  if (hash) {
    const want = Number(hash[1]);
    if (rankedDomains().some(x => x.d === want)) {
      selectedDomain = want;
      buildDomainSelect();
      renderIndicators();
    }
  }

  /* تهيئة محرك التحليل البصري مسبقًا في الخلفية حتى يكون استيراد PDF سريعًا */
  if (typeof warmUpOcr === 'function') {
    setTimeout(() => { warmUpOcr().catch(() => { /* يُحمَّل عند الطلب إن فشل */ }); }, 1500);
  }

  /* ربط القرص بالمجلد لتفعيل النسخ واللصق */
  document.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.files;
    if (items && items.length) handleFile(items[0]);
  });
}

document.addEventListener('DOMContentLoaded', init);