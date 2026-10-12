/* =====================================================================
   engine.js — حساب النتائج والترتيب وتوليد خطة التحسين
   ===================================================================== */

const Store = (() => {
  const KEY = 'moe-improvement-plan-v1';

  const blank = () => ({
    school: {
      name: '', ministryNo: '', type: '', gender: '', stage: '',
      office: '', students: '', cycle: '', reportType: '', overall: '', note: ''
    },
    /* نتائج المؤشرات: { '1-1-1-1': 87, ... } */
    results: {},
    /* نتائج المعايير hand-entered: { '1-1': 92.5 } */
    critPct: {},
    /* نتائج المجالات hand-entered: { '1': 92.25 } */
    domainPct: {},
    /* تعديلات يدوية على نص الخطة: { '1': { target:'', need:'', actions:[], mechanisms:[], owner:'', duration:'' } } */
    planOverrides: {}
  });

  let state = blank();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = Object.assign(blank(), JSON.parse(raw));
    } catch (e) { state = blank(); }
    return state;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function reset() { state = blank(); save(); return state; }
  function get() { return state; }

  return { load, save, reset, get, KEY, blank };
})();

/* ---------------------------------------------------------------- */
/*  فهارس مساعدة                                                      */
/* ---------------------------------------------------------------- */
const ALL_INDICATORS = [];
const BY_CODE = {};
const DOMAIN_BY_ID = {};
const CRIT_BY_ID = {};

CATALOG.forEach(d => {
  DOMAIN_BY_ID[d.d] = d;
  d.criteria.forEach(c => {
    CRIT_BY_ID[`${d.d}-${c.c}`] = c;
    c.indicators.forEach(i => {
      ALL_INDICATORS.push(Object.assign({ domainId: d.d, critId: `${d.d}-${c.c}`,
        domainName: d.domain, critName: c.name }, i));
      BY_CODE[i.code] = Object.assign({}, i,
        { domainId: d.d, critId: `${d.d}-${c.c}`, domainName: d.domain, critName: c.name });
    });
  });
});

/* ---------------------------------------------------------------- */
/*  الحسابات                                                         */
/* ---------------------------------------------------------------- */
const mean = arr => {
  const v = arr.filter(x => typeof x === 'number' && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const round = (n, p = 2) => (n === null || n === undefined || isNaN(n)) ? null : Math.round(n * 10 ** p) / 10 ** p;
const pct = n => (n === null || n === undefined) ? '—' : `${round(n)}%`;

/** نسبة المعيار: متوسط مؤشراته، وإن لم تُدخَل مؤشراته نرجع لنسبة المجال */
function critScore(d, c) {
  const st = Store.get();
  const explicit = st.critPct[`${d}-${c}`];
  if (typeof explicit === 'number') return round(explicit);
  const scores = [];
  CATALOG.find(x => x.d === d).criteria.find(x => x.c === c).indicators
    .forEach(i => { if (typeof st.results[i.code] === 'number') scores.push(st.results[i.code]); });
  const m = mean(scores);
  return round(m);
}

/** نسبة المجال: اليدوية أولاً، وإلا متوسط مؤشراته، وإلا متوسط معاييره */
function domainScore(d) {
  const st = Store.get();
  const dom = CATALOG.find(x => x.d === d);
  const explicit = st.domainPct[`${d}`];
  if (typeof explicit === 'number') return round(explicit);

  const ind = [];
  dom.criteria.forEach(c => c.indicators.forEach(i => {
    if (typeof st.results[i.code] === 'number') ind.push(st.results[i.code]);
  }));
  const mInd = mean(ind);
  if (mInd !== null) return round(mInd);

  const cr = dom.criteria.map(c => critScore(d, c.c)).filter(v => v !== null);
  return round(mean(cr));
}

/** الأداء العام: متوسط نِسب المجالات */
function overallScore() {
  const st = Store.get();
  if (typeof st.school.overall === 'number' && st.school.overall !== '')
    return round(st.school.overall);
  const m = mean(CATALOG.map(d => domainScore(d.d)));
  return round(m);
}

/** ترتيب المجالات من الأدنى إلى الأعلى (الأولوية الأكثر إلحاحًا أولًا) */
function rankedDomains() {
  return CATALOG
    .map(d => ({
      ...d,
      score: domainScore(d.d),
      level: levelOf(domainScore(d.d)),
      criteria: d.criteria.map(c => ({
        ...c, score: critScore(d.d, c.c), level: levelOf(critScore(d.d, c.c))
      }))
    }))
    .sort((a, b) => {
      if (a.score === null && b.score === null) return a.d - b.d;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return a.score - b.score || a.d - b.d;
    });
}

/** مؤشرات مجال معيّن مرتبة من الأدنى إلى الأعلى */
function rankedIndicators(domainId, critId = null) {
  const st = Store.get();
  const dom = CATALOG.find(x => x.d === domainId);
  let list = [];
  dom.criteria.forEach(c => {
    if (critId !== null && `${domainId}-${c.c}` !== critId) return;
    c.indicators.forEach(i => {
      const v = typeof st.results[i.code] === 'number' ? st.results[i.code] : null;
      list.push({
        ...i,
        domainId, critId: `${domainId}-${c.c}`, critName: c.name,
        pct: v, level: levelOf(v),
        urgency: v === null ? 3 : LEVEL_ORDER.indexOf(levelOf(v))
      });
    });
  });
  return list.sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999) || a.code.localeCompare(b.code));
}

/** المؤشرات الأضعف في المجال (المستوى الأدنى) */
function weakestIndicators(domainId, limit = 3) {
  return rankedIndicators(domainId)
    .filter(i => i.pct !== null)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, limit);
}

/** المؤشرات الحرجة على مستوى المدرسة كلها (مستوى التهيئة) */
function criticalIndicators() {
  const st = Store.get();
  return ALL_INDICATORS
    .map(i => ({ ...i, pct: typeof st.results[i.code] === 'number' ? st.results[i.code] : null }))
    .filter(i => i.pct !== null && i.pct < 50)
    .sort((a, b) => a.pct - b.pct);
}

/* ---------------------------------------------------------------- */
/*  توليد خطة التحسين                                                 */
/* ---------------------------------------------------------------- */
const NEXT_LEVEL = { tahyea: 'الانطلاق', intilaq: 'التقدم', taqaddum: 'التميز', tamayyuz: null };
const NEXT_TARGET = { tahyea: 75, intilaq: 75, taqaddum: 90, tamayyuz: 90 };

function fmtList(items) {
  return items.filter(Boolean).join(' و ');
}

function buildPlan(domainId) {
  const dom = CATALOG.find(x => x.d === domainId);
  const st = Store.get();
  const score = domainScore(domainId);
  const lvl = levelOf(score);
  const weak = weakestIndicators(domainId, 3);
  const pb = DOMAIN_PLAYBOOKS[domainId] || { owner: 'إدارة المدرسة', actions: [], mechanism: '' };

  /* الدرجة المستهدفة */
  const targetPct = lvl ? NEXT_TARGET[lvl] : 75;
  const nextIdx = lvl ? Math.min(LEVEL_ORDER.indexOf(lvl) + 1, LEVEL_ORDER.length - 1) : 2;
  const nextLbl = LEVELS[LEVEL_ORDER[nextIdx]].label;
  const upTo = lvl && NEXT_LEVEL[lvl]
    ? `، وإخراج المؤشرات الأضعف من مستوى «${LEVELS[lvl].label}» إلى «${NEXT_LEVEL[lvl]}» فأعلى`
    : '';
  const target = score === null
    ? 'أدخل نسبة المجال من نتائج التقرير لتوليد الدرجة المستهدفة تلقائيًا.'
    : `رفع النسبة العامة للمجال من ${pct(score)} إلى ${targetPct}% فأكثر (مستوى ${nextLbl})${upTo} خلال العام الحالي.`;

  /* وصف الاحتياج */
  let need;
  if (score === null) {
    need = 'لم تُدخل نتائج هذا المجال بعد.';
  } else if (!weak.length) {
    need = `سجل المجال نسبة ${pct(score)} (مستوى ${LEVELS[lvl].label}) ولم تُدخل نسب مؤشراته بعد، فيتعذّر تحديد أضعف مؤشر بدقة.`;
  } else {
    const crits = dom.criteria.map(c => ({ name: c.name, score: critScore(domainId, c.c) }))
      .filter(c => c.score !== null).sort((a, b) => a.score - b.score);
    const critTxt = crits.length > 1
      ? ` كما أن الجانب الفرعي «${crits[0].name}» (${pct(crits[0].score)}) أضعف من «${crits[1].name}» (${pct(crits[1].score)}).`
      : crits.length
        ? ` كما أن الجانب الفرعي «${crits[0].name}» بلغ ${pct(crits[0].score)}.`
        : '';

    const urgent = weak.filter(i => i.level === 'tahyea');
    const rest = weak.filter(i => i.level !== 'tahyea');

    if (urgent.length) {
      const one = urgent.length === 1;
      const uTxt = urgent.map(i => `«${i.text}» (${i.code})`).join(one ? '' : '، و');
      const rTxt = rest.length
        ? ` ويليه ${rest.map(i => `المؤشر ${i.code} (${pct(i.pct)})`).join('، ')} بمستوى «${LEVELS[rest[0].level].label}».`
        : '';
      need = `يسجّل ${one ? 'المؤشر' : `المؤشرات (${urgent.length})`} ${uTxt} مستوى «التهيئة» (أقل من 50%)، وهو ${one ? 'الأضعف' : 'الأضعف'} في المجال ويمثل أولوية التدخل العاجل.${rTxt}${critTxt}`;
    } else {
      const list = weak.map(i => `«${i.text}» (${i.code} — ${pct(i.pct)})`).join('، ');
      need = `أضعف المؤشرات في المجال: ${list}، وجميعها دون مستوى «${nextLbl}».${critTxt}`;
    }
  }

  /* إجراءات التحسين */
  const actions = [...pb.actions];
  weak.slice(0, 2).forEach(i => {
    const mech = (INDICATOR_MECHANISMS[i.code] || [])[0];
    if (mech) actions.push(`معالجة المؤشر (${i.code}) عبر: ${mech}.`);
  });

  /* آليات التنفيذ */
  const mechanisms = [
    ...weak.slice(0, 2).flatMap(i => (INDICATOR_MECHANISMS[i.code] || []).slice(0, 2)
      .map(m => `${m} (المؤشر ${i.code}).`)),
    ...pb.actions.slice(0, 2).map((a, k) => `${k + 1}) ${a}`),
    pb.mechanism
  ].filter(Boolean);

  const plan = {
    target, need,
    actions,
    mechanisms,
    owner: pb.owner,
    duration: 'فصل دراسي كامل'
  };

  /* تطبيق التعديلات اليدوية */
  const ov = st.planOverrides[String(domainId)];
  return ov ? Object.assign(plan, ov) : plan;
}

function setPlanOverride(domainId, field, value) {
  const st = Store.get();
  const k = String(domainId);
  st.planOverrides[k] = st.planOverrides[k] || {};
  st.planOverrides[k][field] = value;
  Store.save();
}

/** أهم الملاحظات على مستوى المدرسة */
function keyNotes() {
  const ranked = rankedDomains().filter(d => d.score !== null);
  if (!ranked.length) return [];
  const out = [];
  const worst = ranked[0], best = ranked[ranked.length - 1];
  out.push(`أضعف المجالات هو «${worst.domain}» بنسبة ${pct(worst.score)} بمستوى «${LEVELS[worst.level].label}»، وهو أكثر المجالات حاجةً للتدخل.`);
  out.push(`أقوى المجالات هو «${best.domain}» بنسبة ${pct(best.score)} بمستوى «${LEVELS[best.level].label}»، ويمكن الاعتماد عليه في التعزيز والاستدامة.`);

  const crit = criticalIndicators();
  if (crit.length) {
    out.push(`مؤشرات عند مستوى «التهيئة» وتحتاج تدخلًا عاجلًا: ${fmtList(crit.map(i => `${i.text} (${i.code})`))}.`);
  }
  return out;
}

/* ---------------------------------------------------------------- */
/*  مساعدات العرض                                                     */
/* ---------------------------------------------------------------- */
function levelMeta(key) {
  return key ? LEVELS[key] : { label: 'لم يُحدد', color: '#64748B', soft: '#F1F5F9', range: '', icon: 'dot' };
}
function countByLevel(domainId) {
  const list = rankedIndicators(domainId).filter(i => i.pct !== null);
  const c = { tahyea: 0, intilaq: 0, taqaddum: 0, tamayyuz: 0 };
  list.forEach(i => c[i.level]++);
  return c;
}
function completion(domainId) {
  const list = rankedIndicators(domainId);
  const filled = list.filter(i => i.pct !== null).length;
  return { filled, total: list.length, pct: Math.round(filled / list.length * 100) };
}