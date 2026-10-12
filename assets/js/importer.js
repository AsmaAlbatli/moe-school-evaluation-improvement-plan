/* =====================================================================
   importer.js — استيراد نتائج المدرسة من Excel / CSV / JSON / PDF
   ===================================================================== */

/* ---------------------------------------------------------------- */
/*  أدوات مساعدة                                                      */
/* ---------------------------------------------------------------- */
function normText(s) {
  return String(s ?? '')
    .replace(/[\u064B-\u0652\u0640]/g, '')            // تشكيل وتطويل
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')  // أ إ آ ٱ -> ا
    .replace(/\u0629/g, '\u0647')                      // ة -> ه
    .replace(/\u0649/g, '\u064A')                      // ى -> ي
    .replace(/\u0624/g, '\u0648')                      // ؤ -> و
    .replace(/\u0626/g, '\u064A')                      // ئ -> ي
    .replace(/\s+/g, ' ')
    .trim();
}

/** يبني تعبيرًا نمطيًا من كلمات عربية خام، بعد تطبيعها مثل النص —
 *  آمن لأن هذه الأنماط لا تحتوي رموزًا خاصة بتعبيرات النمط. */
function rx(...alts) {
  const src = alts.map(a => normText(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(src);
}
/** يختبر نصًا بعد تطبيقه مقابل كلمات عربية خام */
const has = (text, ...alts) => rx(...alts).test(normText(text));

/** يستخرج نسبة مئوية من نص: "87%" ، "87.25 %" ، "0.87" ، "٪٨٧" */
function parsePercent(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v > 0 && v <= 1 ? v * 100 : v;
  const s = normText(String(v)).replace(/[،,]/g, '.');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  let n = parseFloat(m[0]);
  if (n < 0) return null;
  /* 0.87 تعني 87% ، أما الرقم 1 المجرّد فيعني 1% */
  if (n < 1 && /^0\.\d+/.test(s)) n = n * 100;
  return n > 100 ? null : n;
}

/** يبحث عن رمز مؤشر داخل نص مثل "1-1-1-1" أو "1 - 1 - 1 - 1" */
const CODE_RE = /\b([1-4])\s*-\s*([1-5])\s*-\s*([1-9])\s*-\s*([1-9])\b/;

function findCode(text) {
  const m = normText(text).match(CODE_RE);
  return m ? `${m[1]}-${m[2]}-${m[3]}-${m[4]}` : null;
}

/** يبحث عن اسم مجال داخل نص */
function findDomain(text) {
  if (has(text, 'الإدارة المدرسية')) return 1;
  if (has(text, 'التعليم والتعلم')) return 2;
  if (has(text, 'نواتج التعلم')) return 3;
  if (has(text, 'البيئة المدرسية')) return 4;
  return null;
}

/** يبحث عن اسم معيار داخل نص */
function findCriterion(text) {
  const map = [
    [[1, 1], 'التخطيط'], [[1, 2], 'قيادة العملية التعليمية'], [[1, 3], 'المجتمع المدرسي'],
    [[1, 4], 'التطوير المهني'], [[1, 5], 'حماية الحقوق'],
    [[2, 1], 'بناء خبرات التعلم'], [[2, 2], 'تقويم التعلم'],
    [[3, 1], 'التحصيل التعليمي'], [[3, 2], 'التطور الشخصي والصحي والاجتماعي'],
    [[4, 1], 'المبنى المدرسي'], [[4, 2], 'الأمن والسلامة']
  ];
  for (const [[a, b], name] of map) {
    if (has(text, `${a}-${b}`) || has(text, name)) return `${a}-${b}`;
  }
  return null;
}

function findLevel(text) {
  if (has(text, 'التهيئة')) return 'tahyea';
  if (has(text, 'الانطلاق')) return 'intilaq';
  if (has(text, 'التقدم', 'متقدمة')) return 'taqaddum';
  if (has(text, 'التميز', 'متميزة')) return 'tamayyuz';
  return null;
}

/**
 * يستنتج مستوى الأداء من جملة التقرير:
 *   «تشير النتائج إلى أن المؤشر تحقق بدرجة متميزة» → التميز
 *   «... بدرجة متقدمة» → التقدم | «... بدرجة متوسطة» → الانطلاق | «... بدرجة ضعيفة» → التهيئة
 * هذه العبارة أطول وأكثر وضوحًا للقراءة البصرية من كلمة المستوى في العمود الجانبي،
 * كما أنها تتجنّب الالتباس مع كلمة «التميز» الواردة داخل نص المقترح نفسه.
 */
function findLevelByDegree(text) {
  const t = normText(text);
  if (!/بدرج[هة]/.test(t)) return null;
  /* خذ آخر فقرة صغيرة بعد "بدرجة" حتى لا تختلط بمقترح المؤشر التالي */
  const after = t.split(/بدرج[هة]/).slice(1, 2)[0] || '';
  const head = after.slice(0, 24);
  if (rx('متميزه', 'متميز').test(head)) return 'tamayyuz';
  if (rx('متقدمه', 'متقدم').test(head)) return 'taqaddum';
  if (rx('متوسمه', 'متوسط').test(head)) return 'intilaq';
  if (rx('ضعيفه', 'منخفضه', 'ضعيف', 'منخفض').test(head)) return 'tahyea';
  return null;
}

/** يبحث عن مستوى من نسبة */
function levelToPct(lv) {
  return { tahyea: 45, intilaq: 65, taqaddum: 82, tamayyuz: 95 }[lv] ?? null;
}

/* ---------------------------------------------------------------- */
/*  بناء النتائج من صفوف جدول                                        */
/* ---------------------------------------------------------------- */
/**
 * rows: مصفوفة من المصفوفات (كل صف = خلايا)
 * يستخرج: رمز المؤشر + النسبة، أو المجال/المعيار + النسبة، أو المستوى
 */
function harvestRows(rows) {
  const st = Store.get();
  const found = { indicators: 0, criteria: 0, domains: 0, levels: 0, school: {}, unmatched: [] };

  rows.forEach(row => {
    if (!row || !row.length) return;
    const cells = row.map(c => String(c ?? '').trim()).filter(c => c !== '');
    if (!cells.length) return;
    const joined = cells.join(' | ');

    /* --- بيانات المدرسة --- */
    const first = cells[0] || '';
    let handled = false;

    if (has(joined, 'الرقم الوزاري')) {
      const m = joined.match(/\d[\d\-]{3,}/);
      if (m) { found.school.ministryNo = m[0]; handled = true; }
    }
    if (has(first, 'عدد الطلبة', 'العدد الإجمالي', 'عدد الطلاب', 'عدد الطالبات')) {
      const n = cells.slice(1).map(parsePercent).find(v => v !== null && Number.isInteger(v));
      if (n !== null) { found.school.students = n; handled = true; }
    }
    if (has(first, 'اسم المدرسة')) { found.school.name = (cells[1] || '').trim(); handled = true; }
    if (has(first, 'المرحلة الدراسية')) { found.school.stage = (cells[1] || '').trim(); handled = true; }
    if (has(first, 'إدارة التعليم')) { found.school.office = (cells[1] || '').trim(); handled = true; }
    if (has(first, 'نوع المدرسة')) { found.school.type = (cells[1] || '').trim(); handled = true; }
    if (has(first, 'الجنس')) { found.school.gender = (cells[1] || '').trim(); handled = true; }
    if (has(first, 'دورة التقويم')) { found.school.cycle = (cells[1] || '').trim(); handled = true; }
    if (has(first, 'نوع التقرير')) { found.school.reportType = (cells[1] || '').trim(); handled = true; }
    if (has(first, 'الأداء العام')) {
      const p = cells.slice(1).map(parsePercent).find(v => v !== null);
      if (p !== null) { found.school.overall = p; handled = true; }
    }

    /* --- المؤشر: رمز + نسبة --- */
    const code = findCode(joined);
    const nums = cells.map(parsePercent).filter(v => v !== null);
    if (code && BY_CODE[code] && nums.length) {
      /* النسبة هي القيمة التالية لخلية الرمز، لا الرقم داخل الرمز نفسه */
      const ci = cells.findIndex(c => CODE_RE.test(normText(c)));
      const after = ci >= 0 ? cells.slice(ci + 1) : cells;
      const withSign = after.filter(c => /[%٪]/.test(c));
      let pick = withSign.length ? parsePercent(withSign[0]) : null;
      if (pick === null) {
        const an = after.map(parsePercent).filter(v => v !== null);
        pick = an.length ? an[an.length - 1] : null;
      }
      if (pick === null) pick = nums[nums.length - 1];
      st.results[code] = pick;
      found.indicators++;
      return;
    }

    /* --- المعيار --- */
    const crit = findCriterion(joined);
    if (crit && nums.length && !code) {
      st.critPct[crit] = nums[0];
      found.criteria++;
      return;
    }

    /* --- المجال --- */
    const dom = findDomain(joined);
    if (dom && nums.length && !code && !crit) {
      st.domainPct[dom] = nums[0];
      found.domains++;
      return;
    }

    /* --- مستوى أداء بدون نسبة --- */
    const lv = findLevel(joined);
    if (lv && code && BY_CODE[code]) {
      st.results[code] = levelToPct(lv);
      found.levels++;
      return;
    }

    if (nums.length || code) { if (!handled) found.unmatched.push(joined.slice(0, 120)); }
  });

  /* دمج بيانات المدرسة */
  Object.entries(found.school).forEach(([k, v]) => {
    if (st.school[k] === '' || st.school[k] == null) st.school[k] = v;
  });

  Store.save();
  return found;
}

/* ---------------------------------------------------------------- */
/*  JSON                                                             */
/* ---------------------------------------------------------------- */
function parseJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('ملف JSON غير صالح: ' + e.message); }
  const st = Store.get();

  /* صيغة المنصة نفسها */
  if (data && typeof data === 'object' && (data.results || data.school)) {
    if (data.school) Object.assign(st.school, data.school);
    if (data.results) Object.assign(st.results, data.results);
    if (data.critPct) Object.assign(st.critPct, data.critPct);
    if (data.domainPct) Object.assign(st.domainPct, data.domainPct);
    if (data.planOverrides) Object.assign(st.planOverrides, data.planOverrides);
    Store.save();
    return { indicators: Object.keys(data.results || {}).length, criteria: 0, domains: 0, levels: 0, school: data.school || {}, unmatched: [] };
  }

  /* مصفوفة مؤشر/نسبة */
  if (Array.isArray(data)) {
    const rows = data.map(o => Array.isArray(o) ? o : [o.code ?? o['الرمز'] ?? o['رقم المؤشر'], o.pct ?? o['النسبة'] ?? o.value ?? o.percentage]);
    return harvestRows(rows);
  }
  /* كائن { '1-1-1-1': 87, ... } */
  if (data && typeof data === 'object') {
    let n = 0;
    Object.entries(data).forEach(([k, v]) => {
      const c = findCode(k) || (BY_CODE[k] ? k : null);
      if (c && BY_CODE[c]) { st.results[c] = parsePercent(v); n++; }
    });
    Store.save();
    return { indicators: n, criteria: 0, domains: 0, levels: 0, school: {}, unmatched: [] };
  }
  throw new Error('بنية JSON غير معروفة.');
}

/* ---------------------------------------------------------------- */
/*  CSV                                                              */
/* ---------------------------------------------------------------- */
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return harvestRows(rows);
}

/* ---------------------------------------------------------------- */
/*  Excel                                                            */
/* ---------------------------------------------------------------- */
function parseXLSX(arrayBuffer) {
  if (typeof XLSX === 'undefined') throw new Error('مكتبة Excel غير محمّلة.');
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const merged = { indicators: 0, criteria: 0, domains: 0, levels: 0, school: {}, unmatched: [] };

  wb.SheetNames.forEach(name => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
    const r = harvestRows(rows);
    ['indicators', 'criteria', 'domains', 'levels'].forEach(k => merged[k] += r[k]);
    merged.unmatched.push(...r.unmatched);
    Object.assign(merged.school, r.school);
  });
  return merged;
}

/* ---------------------------------------------------------------- */
/*  PDF نصي، مع OCR تلقائي للملفات الممسوحة ضوئيًا                  */
/* ---------------------------------------------------------------- */
const assetUrl = p => new URL(p, document.baseURI).href;

function loadScriptOnce(src) {
  if (document.querySelector(`script[data-ocr-src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.dataset.ocrSrc = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('تعذّر تحميل محرك التحليل البصري (OCR)'));
    document.head.appendChild(s);
  });
}

/** يحوّل صفحة PDF إلى لوحة رسم (canvas) بدقة محددة */
async function pdfPageToCanvas(page, dpi = 150) {
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  /* لا نستخدم willReadFrequently لأنه يُبطئ رسم الصفحات الكبيرة بشكل كبير */
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, background: '#fff' }).promise;
  return canvas;
}

/** يستخرج النصوص من صفحة PDF كسطر لكل سطر */
async function pdfPageLines(page) {
  const tc = await page.getTextContent();
  const items = tc.items.map(it => ({ s: it.str, y: it.transform[5], x: it.transform[4] }));
  items.sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x));
  const lines = [];
  let cur = null, lastY = null;
  for (const it of items) {
    if (lastY === null || Math.abs(it.y - lastY) > 3) {
      if (cur) lines.push(cur);
      cur = it.s; lastY = it.y;
    } else {
      cur += ' ' + it.s;
    }
  }
  if (cur) lines.push(cur);
  return lines.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * محرك OCR مشترك: يُهيَّأ مرة واحدة في الخلفية عند فتح الصفحة
 * (تجميع WebAssembly يستغرق وقتًا طويلًا أول مرة) ثم يُعاد استخدامه لكل ملف.
 *
 * ملاحظة: في المرة الأولى قد لا تصل رسالة تأكيد التهيئة، فيعيد المحاولة
 * تلقائيًا — وفي المحاولة الثانية تكون الملفات مخزّنة في ذاكرة المتصفح فينجح الأمر.
 */
let ocrWorkerPromise = null;
let warmStatus = 'idle';

function ocrOptions(logger) {
  return {
    workerPath: assetUrl('assets/vendor/ocr/worker.min.js'),
    corePath: assetUrl('assets/vendor/ocr/'),
    langPath: assetUrl('assets/vendor/ocr/lang'),
    logger
  };
}

async function createOcrWorkerOnce(logger, timeoutMs) {
  return Promise.race([
    Tesseract.createWorker('ara', 1, ocrOptions(logger)),
    new Promise((_, rej) => setTimeout(
      () => rej(new Error('انتهت مهلة تهيئة محرك التحليل البصري')), timeoutMs))
  ]);
}

function getOcrWorker(onProgress) {
  const logger = m => {
    if (m.status && m.progress !== undefined)
      onProgress?.({ phase: m.status, progress: m.progress });
  };

  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      await loadScriptOnce(assetUrl('assets/vendor/ocr/tesseract.min.js'));
      if (typeof Tesseract === 'undefined') throw new Error('تعذّر تحميل محرك OCR.');
      let lastErr;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          return await createOcrWorkerOnce(logger, 25000);
        } catch (e) {
          lastErr = e;
          if (attempt < 4) {
            onProgress?.({ phase: 'ocr-retry', attempt });
            await new Promise(r => setTimeout(r, 800));
          }
        }
      }
      throw new Error('تعذّر تشغيل محرك التحليل البصري: ' + (lastErr?.message || ''));
    })().catch(err => { ocrWorkerPromise = null; warmStatus = 'failed'; throw err; });
  }
  return ocrWorkerPromise;
}

/** تهيئة المحرك في الخلفية — تُستدعى عند فتح المنصة */
function warmUpOcr() {
  if (ocrWorkerPromise) return ocrWorkerPromise;
  warmStatus = 'loading';
  return getOcrWorker()
    .then(w => { warmStatus = 'ready'; return w; })
    .catch(() => null);
}

/** يحلّل نصًا مُستخرجًا إلى صفوف: [سطر الرمز، سطر المستوى] */
function rowsFromLines(lines) {
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!CODE_RE.test(normText(l))) continue;
    const code = findCode(l);
    if (!code || !BY_CODE[code]) continue;
    const ctx = lines.slice(i, i + 3).join(' ');
    rows.push([code, ctx]);
  }
  return rows;
}

async function parsePDF(arrayBuffer, onProgress) {
  if (typeof pdfjsLib === 'undefined') throw new Error('مكتبة PDF غير محمّلة.');
  pdfjsLib.GlobalWorkerOptions.workerSrc = assetUrl('assets/vendor/pdf.worker.min.js');
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  onProgress?.({ phase: 'read', done: 0, total: doc.numPages });

  /* 1) محاولة القراءة النصية أولًا */
  const textPages = [];
  let chars = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const lines = await pdfPageLines(await doc.getPage(i));
    textPages.push(lines);
    chars += lines.join(' ').length;
    onProgress?.({ phase: 'read', done: i, total: doc.numPages });
  }

  if (chars > doc.numPages * 60) {
    const res = harvestRows(textPages.flatMap(rowsFromLines));
    res.note = `تمت القراءة من نص الملف (${doc.numPages} صفحة).`;
    res.mode = 'text';
    return res;
  }

  /* 2) الملف ممسوح ضوئيًا — تشغيل OCR */
  onProgress?.({ phase: 'ocr-start' });
  const worker = await getOcrWorker(onProgress);

  const ocrPages = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const canvas = await pdfPageToCanvas(await doc.getPage(i), 150);
      const { data } = await worker.recognize(canvas);
      ocrPages.push(String(data.text || '')
        .split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean));
      canvas.width = canvas.height = 0;
      onProgress?.({ phase: 'page', done: i, total: doc.numPages });
    }
  } finally {
    await doc.destroy();
  }

  const merged = await importWorkerFallback(ocrPages);
  merged.note = `الملف ممسوح ضوئيًا — تمت قراءته بالتحليل البصري (OCR) من ${doc.numPages} صفحة. `
    + 'راجع النسب المستخرجة قبل الاعتماد عليها.';
  merged.mode = 'ocr';
  return merged;
}

/** يحوّل نتائج OCR إلى نسب، مع تمييز ما استُنتج من مستوى الأداء */
function importWorkerFallback(ocrPages) {
  const st = Store.get();
  const res = { indicators: 0, criteria: 0, domains: 0, levels: 0, school: {}, unmatched: [], estimated: 0 };
  const seen = new Set();

  const flat = ocrPages.flat();
  /* بيانات المدرسة إن ظهرت في الصفحة الأولى */
  harvestSchoolOnly(flat, res);

  for (let i = 0; i < flat.length; i++) {
    const line = flat[i];
    const code = findCode(line);
    if (!code || !BY_CODE[code] || seen.has(code)) continue;
    /* النص الموصوف للمؤشر يمتد على السطر التالي مباشرة */
    const ctx = [line, flat[i + 1] || '', flat[i + 2] || ''].join(' ');
    const lv = findLevelByDegree(ctx);
    if (!lv) continue;

    /* إن وُجدت نسبة صريحة في سطر المؤشر فهي أدق من تقدير المستوى */
    const explicit = (line.match(/(\d{1,3}(?:[.,]\d+)?)\s*[%٪]/))?.[1];
    let v = explicit !== undefined ? parsePercent(explicit) : null;
    if (v === null) { v = levelToPct(lv); res.estimated++; }
    if (v === null) continue;

    st.results[code] = v;
    seen.add(code);
    res.indicators++;
  }
  Store.save();
  return res;
}

/** يلتقط بيانات المدرسة من الصفحة الأولى — بحذر، فلا يكتب إلا ما تيقّن منه */
function harvestSchoolOnly(lines, res) {
  const head = lines.slice(0, 60);
  const txt = head.join(' \n ');

  /* الجنس والمرحلة ودورة التقويم — كلمات مميزة وواضحة */
  if (txt.includes('بنات')) res.school.gender = 'بنات';
  else if (txt.includes('بنين')) res.school.gender = 'بنين';

  if (txt.includes('الابتدائية')) res.school.stage = 'الابتدائية';
  else if (txt.includes('الثانوية')) res.school.stage = 'الثانوية';
  else if (txt.includes('المتوسطة')) res.school.stage = 'المتوسطة';

  if (txt.includes('الثانية')) res.school.cycle = 'الدورة الثانية';
  else if (txt.includes('الأولى')) res.school.cycle = 'الدورة الأولى';

  if (txt.includes('تعليمي')) res.school.type = 'تعليمي';
  else if (txt.includes('حكومي')) res.school.type = 'حكومي';

  /* اسم المدرسة والرقم الوزاري: غالبًا في السطر نفسه من الصفحة الأولى */
  for (const line of head) {
    if (/(\d+\s*[-–]\s*\d{3,})/.test(line) || normText(line).includes('الرقم الوزاري')) {
      const mno = line.match(/(\d+\s*[-–]\s*\d{3,})/);
      if (mno) res.school.ministryNo = mno[1].replace(/\s+/g, '');
      const at = line.search(/الرقم|الرمز/);
      if (at > 0) {
        const cand = line.slice(0, at).trim();
        if (cand.length > 5 && /مدرسة|ابتدائي|متوسط|ثانوي|روضة/.test(cand))
          res.school.name = cand;
      }
      break;
    }
  }

  /* إدارة التعليم وعدد الطلبة: سطر «الإدارة العامة للتعليم بمنطقة … 453» */
  for (const line of head) {
    if (line.includes('الإدارة العامة للتعليم') || line.includes('إدارة التعليم')) {
      const cleaned = line.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
      res.school.office = cleaned;
      /* الرقم في نهاية السطر هو عدد الطلبة */
      const nums = line.match(/\d+/g);
      if (nums && nums.length) {
        const cand = Number(nums[nums.length - 1]);
        if (Number.isInteger(cand) && cand > 0 && cand < 5000) res.school.students = cand;
      }
      break;
    }
  }

  /* احتياطي: رقم مستقل في سطر «عدد الطلبة» */
  if (!res.school.students) {
    for (let i = 0; i < head.length; i++) {
      if (/عدد الطلبة|عدد الطلاب|عدد الطالبات/.test(head[i])) {
        const m = (head[i] + ' ' + (head[i + 1] || '')).match(/\b(\d{2,4})\b/);
        if (m) res.school.students = Number(m[1]);
        break;
      }
    }
  }

  const st = Store.get();
  Object.entries(res.school).forEach(([k, v]) => {
    if ((st.school[k] === '' || st.school[k] == null) && v) st.school[k] = v;
  });
}

/* ---------------------------------------------------------------- */
/*  الواجهة الموحدة                                                  */
/* ---------------------------------------------------------------- */
async function importFile(file, opts) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.json')) return parseJSON(await file.text());
  if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCSV(await file.text());
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    return parseXLSX(buf);
  }
  if (name.endsWith('.pdf')) {
    const buf = await file.arrayBuffer();
    return parsePDF(buf, opts?.onProgress);
  }
  throw new Error('صيغة غير مدعومة. الصيغ المدعومة: xlsx, xls, csv, txt, json, pdf');
}

/* قالب جاهز للتحميل */
function downloadTemplate(format) {
  const st = Store.get();
  let out, mime, ext;

  if (format === 'json') {
    out = JSON.stringify({
      school: st.school, results: st.results, critPct: st.critPct, domainPct: st.domainPct
    }, null, 2);
    mime = 'application/json;charset=utf-8'; ext = 'json';
  } else {
    const rows = [['رمز المؤشر', 'نص المؤشر', 'المجال', 'المعيار', 'النسبة %', 'مستوى الأداء']];
    ALL_INDICATORS.forEach(i => {
      rows.push([i.code, i.text, i.domainName, i.critName,
        st.results[i.code] ?? '',
        st.results[i.code] !== undefined ? (levelOf(st.results[i.code]) || {}).label ?? '' : '']);
    });
    if (format === 'csv') {
      out = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      mime = 'text/csv;charset=utf-8'; ext = 'csv';
    } else {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 20 }, { wch: 28 }, { wch: 10 }, { wch: 14 }];
      const bk = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(bk, ws, 'نتائج التقويم');
      out = XLSX.write(bk, { bookType: 'xlsx', type: 'array' });
      mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; ext = 'xlsx';
    }
  }

  const blob = new Blob([out], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `قالب_نتائج_التقويم_المدرسي.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}