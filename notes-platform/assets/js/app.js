/* =============================================================================
   منصة الملاحظات والمتابعة — منطق التطبيق
   -----------------------------------------------------------------------------
   • Supabase Auth (بريد/كلمة مرور) + جدول notes واحد للفريق.
   • قراءة/إضافة/تعديل/حذف عبر Supabase فقط، بدون LocalStorage.
   • وضع معاينة اختياري عبر ?demo=1 يعمل في الذاكرة فقط.
   • لا يحتوي هذا الملف أي مفاتيح. الإعدادات العامة في supabase-config.js.
   ========================================================================== */
(function () {
  'use strict';

  const TABLE = 'notes';
  const DEMO_PARAM = new URLSearchParams(location.search).get('demo') === '1';
  const CFG = window.NOTES_SUPABASE || {};
  const URL_BASE = String(CFG.url || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  const KEY = String(CFG.anonKey || '').trim();
  const ALLOW_SIGNUP = CFG.allowSignup !== false;

  const STATUS = { NEW: 'جديدة', PROGRESS: 'قيد المعالجة', CLOSED: 'مغلقة' };
  const STATUS_LIST = [STATUS.NEW, STATUS.PROGRESS, STATUS.CLOSED];
  const PRIORITIES = ['منخفضة', 'متوسطة', 'عالية', 'حرجة'];
  const DOMAINS = [
    'الشؤون الأكاديمية',
    'السلوك والمواظبة',
    'الشؤون الإدارية',
    'التقنية والدعم',
    'الأنشطة الطلابية',
    'الأمن والسلامة',
    'الشراكة المجتمعية',
    'أخرى'
  ];
  const PRIORITY_ORDER = { 'حرجة': 0, 'عالية': 1, 'متوسطة': 2, 'منخفضة': 3 };
  const SORT_LABELS = {
    updated_desc: 'آخر تحديث',
    created_desc: 'الأحدث إنشاءً',
    priority_desc: 'الأولوية الأعلى',
    target_asc: 'أقرب تاريخ استهداف',
    title_asc: 'العنوان أبجديًا'
  };
  const DUE_LABELS = { all: 'كل الاستحقاقات', overdue: 'متأخرة', soon: 'خلال ٧ أيام' };
  const MISSING_LABELS = { all: 'كل الملاحظات', no_action: 'بدون إجراء تصحيحي', no_owner: 'بدون مسؤول' };

  const ui = {};
  const state = {
    mode: 'cloud',
    user: null,
    userName: '',
    appVisible: false,
    notes: [],
    loading: false,
    loadingNotes: false,
    loadError: '',
    saving: false,
    deleting: false,
    authMode: 'login',
    authBusy: false,
    authEpoch: 0,
    filters: defaultFilters(),
    editingId: null,
    pendingDeleteId: null,
    busyId: null,
    channel: null,
    reloadTimer: null,
    lastFocus: null,
    booted: false
  };

  let sb = null;

  /* ══════════════════════════ أدوات مساعدة ══════════════════════════ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function icon(name) { return `<svg class="ico" aria-hidden="true"><use href="#${name}"></use></svg>`; }
  function toggleHidden(node, hidden) { if (node) node.classList.toggle('hidden', !!hidden); }
  function show(node) { if (node) node.classList.remove('hidden'); }
  function hide(node) { if (node) node.classList.add('hidden'); }
  function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parseDateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [y, m, d] = String(value).split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }
  function diffDays(value) {
    const date = parseDateOnly(value);
    const today = parseDateOnly(todayStr());
    if (!date || !today) return null;
    return Math.round((date - today) / 86400000);
  }
  function datePart(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch (e) { return d.toLocaleString('ar'); }
  }
  function formatDateOnly(value) {
    const d = parseDateOnly(value);
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
        day: 'numeric', month: 'short', year: 'numeric'
      }).format(d);
    } catch (e) { return value; }
  }
  function daysPhrase(n) {
    if (n === 1) return 'يومًا واحدًا';
    if (n === 2) return 'يومين';
    if (n >= 3 && n <= 10) return `${n} أيام`;
    return `${n} يومًا`;
  }
  function minutesPhrase(n) {
    if (n === 1) return 'دقيقة';
    if (n === 2) return 'دقيقتين';
    if (n >= 3 && n <= 10) return `${n} دقائق`;
    return `${n} دقيقة`;
  }
  function hoursPhrase(n) {
    if (n === 1) return 'ساعة';
    if (n === 2) return 'ساعتين';
    if (n >= 3 && n <= 10) return `${n} ساعات`;
    return `${n} ساعة`;
  }
  function timeAgo(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 45) return 'الآن';
    const min = Math.floor(sec / 60);
    if (min < 60) return `منذ ${minutesPhrase(min)}`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `منذ ${hoursPhrase(hr)}`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `منذ ${day === 1 ? 'يوم' : day === 2 ? 'يومين' : day <= 10 ? `${day} أيام` : `${day} يومًا`}`;
    return formatDateOnly(datePart(iso));
  }
  function normalizeText(value) {
    return String(value || '').toLowerCase()
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function statusClass(status) {
    if (status === STATUS.CLOSED) return 'closed';
    if (status === STATUS.PROGRESS) return 'progress';
    return 'new';
  }
  function priorityClass(priority) {
    if (priority === 'حرجة') return 'critical';
    if (priority === 'عالية') return 'high';
    if (priority === 'متوسطة') return 'medium';
    return 'low';
  }
  function isOverdue(note) {
    if (!note || note.status === STATUS.CLOSED || !note.target_date) return false;
    const d = diffDays(note.target_date);
    return d !== null && d < 0;
  }
  function isDueSoon(note) {
    if (!note || note.status === STATUS.CLOSED || !note.target_date) return false;
    const d = diffDays(note.target_date);
    return d !== null && d >= 0 && d <= 7;
  }
  function targetPhrase(note) {
    const d = diffDays(note.target_date);
    if (d === null) return 'بدون تاريخ استهداف';
    if (d < 0) return `متأخرة ${daysPhrase(Math.abs(d))}`;
    if (d === 0) return 'تستحق اليوم';
    if (d === 1) return 'تستحق غدًا';
    if (d === 2) return 'تستحق بعد يومين';
    return `تستحق بعد ${daysPhrase(d)}`;
  }
  function defaultFilters() {
    return {
      q: '', status: 'all', priority: 'all', domain: 'all', owner: 'all',
      due: 'all', missing: 'all', from: '', to: '', sort: 'updated_desc'
    };
  }
  function displayName(user) {
    const meta = (user && user.user_metadata) || {};
    return text(meta.full_name || meta.name || meta.display_name || (user && user.email ? user.email.split('@')[0] : 'مستخدم')) || 'مستخدم';
  }
  function initial(name) {
    const chars = Array.from(text(name) || '؟');
    return chars[0] || '؟';
  }
  function firstWords(name) {
    return text(name).split(/\s+/).slice(0, 2).join(' ') || 'عضو الفريق';
  }
  function normalizeNote(row) {
    if (!row) return null;
    const status = STATUS_LIST.includes(row.status) ? row.status : STATUS.NEW;
    const priority = PRIORITIES.includes(row.priority) ? row.priority : 'متوسطة';
    return {
      ...row,
      title: text(row.title),
      description: text(row.description),
      domain: text(row.domain) || 'أخرى',
      priority,
      status,
      recommendation: text(row.recommendation),
      corrective_action: text(row.corrective_action),
      owner_name: text(row.owner_name),
      target_date: row.target_date || null,
      created_by_name: text(row.created_by_name),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || row.created_at || new Date().toISOString(),
      closed_at: row.closed_at || null
    };
  }

  /* ══════════════════════════ الإعدادات والأخطاء ══════════════════════════ */
  function isSecretKey(key) {
    if (!key) return false;
    if (/^sb_secret_/i.test(key)) return true;
    if (/^sbp_/i.test(key)) return true;
    if (/service_role/i.test(key)) return true;
    const parts = key.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload && payload.role === 'service_role') return true;
      } catch (e) { /* ليس JWT */ }
    }
    return false;
  }

  function configIssue() {
    if (location.protocol === 'file:') {
      return 'المنصة تحتاج إلى تشغيل عبر رابط http(s) وليس بالفتح المباشر لملف index.html. شغّل سيرفرًا محليًا أو ارفعها على GitHub Pages.';
    }
    if (!URL_BASE || !KEY) {
      return 'لم تُضبط إعدادات Supabase بعد. افتح الملف notes-platform/assets/js/supabase-config.js وأضف Project URL و anon / publishable key.';
    }
    if (!/^https?:\/\/[^\s]+$/i.test(URL_BASE)) {
      return 'Project URL غير صالح. يجب أن يبدأ بـ https:// وينتهي بـ .supabase.co (أو نطاقك المخصص).';
    }
    if (isSecretKey(KEY)) {
      return '⚠️ المفتاح الموضوع في الإعدادات مفتاح سري (service_role / sb_secret). أزله فورًا واستخدم anon / publishable key فقط.';
    }
    return '';
  }

  function errText(error) {
    const raw = (error && (error.message || error.error_description || error.details || error.hint)) || String(error || '');
    if (/relation .*does not exist|could not find the table|PGRST205|42P01|schema cache/i.test(raw)) {
      return 'جدول notes غير موجود في Supabase. نفّذ ملف notes-platform/supabase/schema.sql في SQL Editor أولًا.';
    }
    if (/Invalid login credentials/i.test(raw)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    if (/Email not confirmed/i.test(raw)) return 'لم يتم تأكيد البريد بعد. افتح رابط التأكيد المرسل إلى بريدك ثم سجّل الدخول.';
    if (/Email link is invalid or has expired|otp_expired/i.test(raw)) return 'رابط التأكيد غير صالح أو منتهي. اطلب رابطًا جديدًا ثم حاول مجددًا.';
    if (/Signups not allowed|signup.*disabled/i.test(raw)) return 'التسجيل العام مغلق حاليًا. اطلب من مدير المنصة إنشاء حسابك.';
    if (/Auth session missing|session_not_found/i.test(raw)) return 'انتهت الجلسة. سجّل الدخول من جديد.';
    if (/User already registered|already been registered/i.test(raw)) return 'هذا البريد مسجّل مسبقًا. سجّل الدخول بدلًا من إنشاء حساب جديد.';
    if (/Password should be at least|password.*at least.*characters/i.test(raw)) return 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل.';
    if (/For security purposes|rate limit|too many requests/i.test(raw)) return 'محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم أعد المحاولة.';
    if (/JWT expired|invalid JWT|token.*expired/i.test(raw)) return 'انتهت صلاحية الجلسة. سجّل الدخول من جديد.';
    if (/row-level security|42501|permission denied/i.test(raw)) return 'ليس لديك صلاحية لهذا الإجراء. تأكد من تسجيل الدخول.';
    if (/Failed to fetch|NetworkError|Load failed|fetch failed|ERR_NETWORK/i.test(raw)) return 'تعذّر الاتصال بالإنترنت أو بخادم Supabase.';
    if (/Invalid API key|No API key|apikey/i.test(raw)) return 'إعدادات Supabase غير صحيحة. تحقق من Project URL و anon key.';
    if (/duplicate key value/i.test(raw)) return 'هذا العنصر موجود مسبقًا.';
    if (/PGRST116|multiple \(or no\) rows|JSON object requested/i.test(raw)) return 'الملاحظة غير موجودة أو حُذفت من قِبل مستخدم آخر.';
    if (/23514|violates check constraint/i.test(raw)) return 'إحدى القيم غير مسموحة. تحقق من الحالة والأولوية والمجال.';
    if (/22007|invalid input syntax for type date/i.test(raw)) return 'تاريخ الاستهداف غير صالح.';
    if (/23503|foreign key/i.test(raw)) return 'تعذّر ربط الملاحظة بحسابك. أعد تسجيل الدخول وحاول مجددًا.';
    return raw || 'حدث خطأ غير متوقع.';
  }

  function toast(message, type, duration) {
    if (!ui.toastHost) return;
    const kind = type || 'info';
    const node = document.createElement('div');
    node.className = `toast toast-${kind}`;
    node.innerHTML = `<span class="toast-icon">${icon(kind === 'success' ? 'i-check' : kind === 'error' ? 'i-alert' : 'i-info')}</span>
      <div class="toast-body">${esc(message)}</div>
      <button type="button" class="toast-close" aria-label="إغلاق التنبيه">${icon('i-close')}</button>`;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      node.classList.remove('show');
      setTimeout(() => node.remove(), 260);
    };
    node.querySelector('.toast-close').addEventListener('click', close);
    ui.toastHost.appendChild(node);
    while (ui.toastHost.children.length > 4) ui.toastHost.firstElementChild.remove();
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(close, duration || 4200);
  }

  function setBtnLoading(btn, busy, label) {
    if (!btn) return;
    if (busy) {
      if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span><span>${esc(label || 'جارٍ التنفيذ…')}</span>`;
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }
  }

  function showAuthMsg(message, kind) {
    ui.authMsg.className = `form-msg show ${kind || 'error'}`;
    ui.authMsg.textContent = message;
  }
  function clearAuthMsg() {
    ui.authMsg.className = 'form-msg';
    ui.authMsg.textContent = '';
  }
  function showFormError(message) {
    ui.formError.className = 'form-msg show error';
    ui.formError.textContent = message;
  }
  function clearFormError() {
    ui.formError.className = 'form-msg';
    ui.formError.textContent = '';
  }
  function showDeleteMsg(message) {
    ui.deleteModalMsg.className = 'form-msg show error';
    ui.deleteModalMsg.textContent = message;
  }
  function clearDeleteMsg() {
    ui.deleteModalMsg.className = 'form-msg';
    ui.deleteModalMsg.textContent = '';
  }

  /* ══════════════════════════ التهيئة ══════════════════════════ */
  function cacheEls() {
    const ids = [
      'boot-overlay', 'mode-badge', 'live-status', 'live-text', 'btn-refresh',
      'user-box', 'user-avatar', 'user-name', 'user-email', 'btn-logout',
      'setup-screen', 'setup-reason', 'btn-setup-demo', 'btn-setup-retry',
      'auth-screen', 'signup-tab', 'auth-title', 'auth-subtitle', 'auth-form',
      'signup-name-field', 'auth-fullname', 'auth-email', 'auth-password',
      'toggle-password', 'signup-confirm-field', 'auth-confirm', 'auth-msg',
      'auth-submit', 'btn-auth-demo', 'main-screen', 'demo-banner', 'btn-exit-demo',
      'greet-name', 'btn-new-note', 'stats-grid', 'stat-total', 'stat-total-sub',
      'stat-total-bar', 'stat-new', 'stat-new-sub', 'stat-new-bar', 'stat-progress',
      'stat-progress-sub', 'stat-progress-bar', 'stat-closed', 'stat-closed-sub',
      'stat-closed-bar', 'form-card', 'form-title', 'form-subtitle', 'btn-close-form',
      'edit-meta', 'note-form', 'note-title', 'title-counter', 'note-domain',
      'note-priority', 'note-status', 'note-description', 'desc-counter',
      'note-recommendation', 'note-corrective', 'note-owner', 'note-target',
      'form-error', 'btn-save-note', 'btn-cancel-edit', 'filter-q',
      'btn-clear-search', 'filter-status', 'filter-priority', 'filter-domain',
      'filter-owner', 'filter-due', 'filter-missing', 'filter-from', 'filter-to',
      'filter-sort', 'btn-reset-filters', 'filter-summary',
      'btn-clear-filters-inline', 'notes-subtitle', 'notes-count',
      'btn-refresh-notes', 'notes-list', 'recommendations', 'activity-list',
      'delete-modal', 'delete-note-title', 'delete-modal-msg', 'btn-confirm-delete',
      'btn-cancel-delete', 'toast-host', 'footer-mode'
    ];
    ids.forEach((id) => {
      const key = id.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      ui[key] = document.getElementById(id);
    });
    ui.notesCard = $('.notes-card');
  }

  function fillSelect(select, options) {
    if (!select) return;
    select.replaceChildren(...options.map((option) => {
      const node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      return node;
    }));
  }

  function populateSelects() {
    const statusOptions = STATUS_LIST.map((s) => ({ value: s, label: s }));
    fillSelect(ui.noteDomain, DOMAINS.map((d) => ({ value: d, label: d })));
    fillSelect(ui.notePriority, PRIORITIES.map((p) => ({ value: p, label: p })));
    fillSelect(ui.noteStatus, statusOptions);

    fillSelect(ui.filterStatus, [
      { value: 'all', label: 'كل الحالات' },
      { value: 'open', label: 'مفتوحة (جديدة + قيد المعالجة)' },
      ...statusOptions
    ]);
    fillSelect(ui.filterPriority, [{ value: 'all', label: 'كل الأولويات' }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]);
    fillSelect(ui.filterDomain, [{ value: 'all', label: 'كل المجالات' }, ...DOMAINS.map((d) => ({ value: d, label: d }))]);
    fillSelect(ui.filterOwner, [{ value: 'all', label: 'كل المسؤولين' }]);
    fillSelect(ui.filterDue, [
      { value: 'all', label: 'كل الاستحقاقات' },
      { value: 'overdue', label: 'متأخرة' },
      { value: 'soon', label: 'خلال ٧ أيام' }
    ]);
    fillSelect(ui.filterMissing, [
      { value: 'all', label: 'كل الملاحظات' },
      { value: 'no_action', label: 'بدون إجراء تصحيحي' },
      { value: 'no_owner', label: 'بدون مسؤول' }
    ]);
    fillSelect(ui.filterSort, Object.entries(SORT_LABELS).map(([value, label]) => ({ value, label })));
    syncFilterControls();
  }

  function initCounters() {
    updateCounters();
  }
  function updateCounters() {
    if (!ui.noteTitle || !ui.noteDescription) return;
    ui.titleCounter.textContent = `${ui.noteTitle.value.length} / 160`;
    ui.descCounter.textContent = `${ui.noteDescription.value.length} / 5000`;
  }

  async function init() {
    try {
      cacheEls();
      populateSelects();
      bindEvents();
      initCounters();
      if (!ALLOW_SIGNUP) ui.signupTab.classList.add('hidden');

      if (DEMO_PARAM) {
        enterDemo();
        return;
      }

      const issue = configIssue();
      if (issue) {
        showSetup(issue);
        return;
      }

      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        const loaded = await loadSupabaseFallback();
        if (!loaded) {
          showSetup('تعذّر تحميل مكتبة Supabase من الشبكة. تحقق من الاتصال بالإنترنت ثم أعد المحاولة.');
          return;
        }
      }

      sb = window.supabase.createClient(URL_BASE, KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'notes-platform-auth'
        }
      });

      sb.auth.onAuthStateChange(handleAuthEvent);
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      if (data && data.session && data.session.user) await enterApp(data.session.user);
      else showAuth();
    } catch (error) {
      console.error(error);
      showSetup(errText(error));
    } finally {
      hideBoot();
    }
  }

  function loadSupabaseFallback() {
    return new Promise((resolve) => {
      if (window.supabase && typeof window.supabase.createClient === 'function') return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js';
      script.async = true;
      script.onload = () => resolve(!!(window.supabase && window.supabase.createClient));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
      setTimeout(() => resolve(!!(window.supabase && window.supabase.createClient)), 9000);
    });
  }

  function hideBoot() {
    if (state.booted || !ui.bootOverlay) return;
    state.booted = true;
    ui.bootOverlay.classList.add('hidden');
    setTimeout(() => ui.bootOverlay.remove(), 400);
  }

  /* ══════════════════════════ الشاشات والحساب ══════════════════════════ */
  function setHeaderActive(active) {
    [ui.modeBadge, ui.liveStatus, ui.btnRefresh, ui.userBox].forEach((node) => toggleHidden(node, !active));
  }

  function showSetup(reason) {
    state.appVisible = false;
    hide(ui.authScreen);
    hide(ui.mainScreen);
    show(ui.setupScreen);
    setHeaderActive(false);
    ui.setupReason.className = 'notice notice-warn';
    ui.setupReason.innerHTML = `${icon('i-alert')}<div>${esc(reason || 'لم تُضبط إعدادات الاتصال بعد.')}</div>`;
    ui.footerMode.textContent = 'بانتظار الإعداد';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showAuth() {
    state.appVisible = false;
    hide(ui.setupScreen);
    hide(ui.mainScreen);
    show(ui.authScreen);
    setHeaderActive(false);
    ui.footerMode.textContent = '—';
    applyAuthMode('login');
    ui.authPassword.value = '';
    ui.authConfirm.value = '';
    setTimeout(() => ui.authEmail.focus(), 120);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function applyAuthMode(mode) {
    const signup = mode === 'signup' && ALLOW_SIGNUP;
    state.authMode = signup ? 'signup' : 'login';
    $$('.auth-tab').forEach((tab) => {
      const active = tab.dataset.authTab === state.authMode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    toggleHidden(ui.signupNameField, !signup);
    toggleHidden(ui.signupConfirmField, !signup);
    ui.authTitle.textContent = signup ? 'أنشئ حسابًا للفريق' : 'مرحبًا بعودتك';
    ui.authSubtitle.textContent = signup
      ? 'سجّل بياناتك للانضمام إلى مساحة متابعة الفريق.'
      : 'سجّل الدخول للوصول إلى ملاحظات فريقك.';
    ui.authSubmit.querySelector('span').textContent = signup ? 'إنشاء الحساب' : 'دخول إلى المنصة';
    ui.authPassword.autocomplete = signup ? 'new-password' : 'current-password';
    clearAuthMsg();
  }

  function updateUserBox(user) {
    const name = displayName(user);
    state.userName = name;
    ui.userName.textContent = name;
    ui.userEmail.textContent = (user && user.email) || '—';
    ui.userAvatar.textContent = initial(name);
    ui.greetName.textContent = firstWords(name);
  }

  async function enterApp(user) {
    if (state.appVisible && state.user && state.user.id === user.id) {
      state.user = user;
      updateUserBox(user);
      return;
    }
    state.mode = 'cloud';
    state.user = user;
    state.appVisible = true;
    hide(ui.setupScreen);
    hide(ui.authScreen);
    show(ui.mainScreen);
    ui.demoBanner.classList.add('hidden');
    ui.modeBadge.classList.remove('demo');
    ui.modeBadge.innerHTML = `${icon('i-cloud')}<span>سحابي</span>`;
    ui.btnLogout.querySelector('span').textContent = 'خروج';
    ui.btnLogout.title = 'تسجيل الخروج';
    ui.btnLogout.setAttribute('aria-label', 'تسجيل الخروج');
    ui.footerMode.textContent = 'سحابي · Supabase';
    setHeaderActive(true);
    updateUserBox(user);
    state.filters = defaultFilters();
    syncFilterControls();
    resetFormFields();
    ui.formCard.classList.add('hidden');
    setLiveStatus('connecting');
    await loadNotes({ skeleton: true });
    subscribeRealtime();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function leaveApp() {
    state.appVisible = false;
    state.user = null;
    state.userName = '';
    state.notes = [];
    state.filters = defaultFilters();
    state.editingId = null;
    state.busyId = null;
    state.pendingDeleteId = null;
    unsubscribeRealtime();
    hide(ui.mainScreen);
    ui.demoBanner.classList.add('hidden');
    ui.formCard.classList.add('hidden');
    closeDeleteModal();
  }

  function handleAuthEvent(event, session) {
    if (state.mode === 'demo') return;
    if (event === 'SIGNED_OUT') {
      state.authEpoch += 1;
      leaveApp();
      showAuth();
      return;
    }
    if (session && session.user) {
      // لا نستدعي Supabase من داخل callback المصادقة مباشرةً (تفاديًا لقفل auth).
      const epoch = state.authEpoch;
      setTimeout(() => {
        if (epoch !== state.authEpoch || state.mode === 'demo') return;
        if (!state.appVisible || !state.user || state.user.id !== session.user.id) {
          enterApp(session.user).catch((error) => {
            console.error(error);
            toast(errText(error), 'error');
          });
        } else {
          state.user = session.user;
          updateUserBox(session.user);
        }
      }, 0);
    }
  }

  async function handleLogout() {
    if (state.mode === 'demo') { exitDemo(); return; }
    if (!sb || state.authBusy) return;
    state.authBusy = true;
    setBtnLoading(ui.btnLogout, true, 'جارٍ الخروج…');
    try {
      const { error } = await sb.auth.signOut();
      if (error) throw error;
      toast('تم تسجيل الخروج بنجاح.', 'info');
      leaveApp();
      showAuth();
    } catch (error) {
      toast(errText(error), 'error');
    } finally {
      state.authBusy = false;
      setBtnLoading(ui.btnLogout, false);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (state.authBusy) return;
    clearAuthMsg();
    const email = ui.authEmail.value.trim();
    const password = ui.authPassword.value;
    const fullName = ui.authFullname.value.trim();
    const confirm = ui.authConfirm.value;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAuthMsg('أدخل بريدًا إلكترونيًا صحيحًا.', 'error');
      ui.authEmail.focus();
      return;
    }
    if (password.length < 6) {
      showAuthMsg('كلمة المرور يجب أن تكون ٦ أحرف على الأقل.', 'error');
      ui.authPassword.focus();
      return;
    }
    if (state.authMode === 'signup') {
      if (!ALLOW_SIGNUP) { showAuthMsg('التسجيل العام مغلق. اطلب من مدير المنصة إنشاء حسابك.', 'error'); return; }
      if (fullName.length < 2) { showAuthMsg('أدخل الاسم الكامل.', 'error'); ui.authFullname.focus(); return; }
      if (password !== confirm) { showAuthMsg('كلمتا المرور غير متطابقتين.', 'error'); ui.authConfirm.focus(); return; }
    }

    state.authBusy = true;
    setBtnLoading(ui.authSubmit, true, state.authMode === 'signup' ? 'جارٍ إنشاء الحساب…' : 'جارٍ تسجيل الدخول…');
    try {
      if (state.authMode === 'signup') {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: location.origin + location.pathname
          }
        });
        if (error) throw error;
        if (data && data.session && data.session.user) {
          toast('تم إنشاء الحساب وتسجيل الدخول.', 'success');
          await enterApp(data.session.user);
        } else {
          // نؤجل تغيير التبويب حتى يُستعاد زر الإرسال من حالة التحميل أولًا.
          setTimeout(() => {
            applyAuthMode('login');
            ui.authEmail.value = email;
            showAuthMsg('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.', 'success');
          }, 0);
        }
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data || !data.user) throw new Error('تعذّر إكمال تسجيل الدخول.');
        toast('تم تسجيل الدخول بنجاح.', 'success');
        await enterApp(data.user);
      }
    } catch (error) {
      showAuthMsg(errText(error), 'error');
    } finally {
      state.authBusy = false;
      setBtnLoading(ui.authSubmit, false);
    }
  }

  /* ══════════════════════════ تحميل الملاحظات ══════════════════════════ */
  async function loadNotes(options) {
    const opts = options || {};
    if (state.loadingNotes) return false;
    state.loadingNotes = true;
    if (opts.skeleton) {
      state.loading = true;
      state.loadError = '';
      renderAll();
    }
    let ok = false;
    try {
      if (state.mode === 'demo') {
        await delay(180);
      } else {
        if (!sb) throw new Error('لم يتم تهيئة الاتصال بـ Supabase.');
        const { data, error } = await sb.from(TABLE).select('*').order('created_at', { ascending: false });
        if (error) throw error;
        state.notes = (Array.isArray(data) ? data : []).map(normalizeNote).filter(Boolean);
      }
      state.loadError = '';
      ok = true;
    } catch (error) {
      state.loadError = errText(error);
      if (!opts.silent) toast(state.loadError, 'error');
    } finally {
      state.loading = false;
      state.loadingNotes = false;
      renderAll();
    }
    return ok;
  }

  async function refreshNotes() {
    if (state.loadingNotes) return;
    ui.btnRefresh.classList.add('spin');
    ui.btnRefreshNotes.classList.add('spin');
    const ok = await loadNotes({ skeleton: false });
    ui.btnRefresh.classList.remove('spin');
    ui.btnRefreshNotes.classList.remove('spin');
    if (ok) toast(state.mode === 'demo' ? 'تم تحديث بيانات المعاينة.' : 'تم تحديث البيانات.', 'success');
  }

  /* ══════════════════════════ عمليات CRUD ══════════════════════════ */
  function collectPayload() {
    return {
      title: ui.noteTitle.value.trim(),
      description: ui.noteDescription.value.trim(),
      domain: ui.noteDomain.value,
      priority: ui.notePriority.value,
      status: ui.noteStatus.value,
      recommendation: ui.noteRecommendation.value.trim(),
      corrective_action: ui.noteCorrective.value.trim(),
      owner_name: ui.noteOwner.value.trim(),
      target_date: ui.noteTarget.value || null
    };
  }

  function validatePayload(payload) {
    let message = '';
    let field = null;
    if (payload.title.length < 3) { message = 'أدخل عنوانًا واضحًا (٣ أحرف على الأقل).'; field = ui.noteTitle; }
    else if (payload.description.length < 3) { message = 'أدخل وصفًا للملاحظة (٣ أحرف على الأقل).'; field = ui.noteDescription; }
    else if (!DOMAINS.includes(payload.domain)) { message = 'اختر مجالًا صحيحًا.'; field = ui.noteDomain; }
    else if (!PRIORITIES.includes(payload.priority)) { message = 'اختر أولوية صحيحة.'; field = ui.notePriority; }
    else if (!STATUS_LIST.includes(payload.status)) { message = 'اختر حالة صحيحة.'; field = ui.noteStatus; }
    else if (payload.target_date && !parseDateOnly(payload.target_date)) { message = 'تاريخ الاستهداف غير صالح.'; field = ui.noteTarget; }
    if (message) {
      showFormError(message);
      if (field) field.focus();
      return false;
    }
    return true;
  }

  async function createNote(payload) {
    if (state.mode === 'demo') {
      await delay(220);
      const now = new Date().toISOString();
      return normalizeNote({
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...payload,
        created_by: 'demo-user',
        created_by_name: state.userName,
        created_at: now,
        updated_at: now,
        closed_at: payload.status === STATUS.CLOSED ? now : null
      });
    }
    if (!sb || !state.user) throw new Error('يجب تسجيل الدخول أولًا.');
    const { data, error } = await sb.from(TABLE).insert({
      ...payload,
      created_by: state.user.id,
      created_by_name: state.userName
    }).select().single();
    if (error) throw error;
    if (!data) throw new Error('لم تُرجع قاعدة البيانات بيانات الملاحظة.');
    return normalizeNote(data);
  }

  async function updateNote(id, payload) {
    if (state.mode === 'demo') {
      await delay(220);
      const old = state.notes.find((n) => n.id === id);
      if (!old) throw new Error('الملاحظة غير موجودة.');
      const now = new Date().toISOString();
      const row = { ...old, ...payload, updated_at: now };
      if (payload.status === STATUS.CLOSED && old.status !== STATUS.CLOSED) row.closed_at = now;
      if (payload.status !== STATUS.CLOSED) row.closed_at = null;
      return normalizeNote(row);
    }
    if (!sb) throw new Error('لم يتم تهيئة الاتصال بـ Supabase.');
    const { data, error } = await sb.from(TABLE).update(payload).eq('id', id).select().single();
    if (error) throw error;
    if (!data) throw new Error('لم تُرجع قاعدة البيانات بيانات الملاحظة.');
    return normalizeNote(data);
  }

  async function deleteNote(id) {
    if (state.mode === 'demo') {
      await delay(200);
      return true;
    }
    if (!sb) throw new Error('لم يتم تهيئة الاتصال بـ Supabase.');
    const { error } = await sb.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async function handleNoteSubmit(event) {
    event.preventDefault();
    if (state.saving) return;
    clearFormError();
    const payload = collectPayload();
    if (!validatePayload(payload)) return;
    const editingId = state.editingId;
    state.saving = true;
    setBtnLoading(ui.btnSaveNote, true, editingId ? 'جارٍ حفظ التعديلات…' : 'جارٍ إضافة الملاحظة…');
    try {
      const row = editingId ? await updateNote(editingId, payload) : await createNote(payload);
      if (editingId) {
        state.notes = state.notes.map((n) => (n.id === editingId ? row : n));
      } else {
        state.notes = [row, ...state.notes];
      }
      closeForm();
      renderAll();
      toast(editingId ? 'تم تحديث الملاحظة بنجاح.' : 'تمت إضافة الملاحظة بنجاح.', 'success');
      await loadNotes({ skeleton: false, silent: true });
    } catch (error) {
      const message = errText(error);
      showFormError(message);
      toast(message, 'error');
    } finally {
      state.saving = false;
      setBtnLoading(ui.btnSaveNote, false);
    }
  }

  async function quickStatus(id) {
    if (state.busyId) return;
    const note = state.notes.find((n) => n.id === id);
    if (!note) return;
    const oldStatus = note.status;
    const next = oldStatus === STATUS.NEW ? STATUS.PROGRESS : oldStatus === STATUS.PROGRESS ? STATUS.CLOSED : STATUS.PROGRESS;
    state.busyId = id;
    renderNotes();
    try {
      const row = await updateNote(id, { status: next });
      state.notes = state.notes.map((n) => (n.id === id ? row : n));
      renderAll();
      const message = next === STATUS.CLOSED
        ? 'تم إغلاق الملاحظة.'
        : oldStatus === STATUS.CLOSED
          ? 'تمت إعادة فتح الملاحظة.'
          : 'تم بدء معالجة الملاحظة.';
      toast(message, 'success');
      await loadNotes({ skeleton: false, silent: true });
    } catch (error) {
      toast(errText(error), 'error');
    } finally {
      state.busyId = null;
      renderNotes();
    }
  }

  /* ══════════════════════════ النموذج ══════════════════════════ */
  function resetFormFields() {
    if (!ui.noteForm) return;
    ui.noteForm.reset();
    ui.noteDomain.value = DOMAINS[0];
    ui.notePriority.value = 'متوسطة';
    ui.noteStatus.value = STATUS.NEW;
    clearFormError();
    updateCounters();
  }

  function openForm(note) {
    clearFormError();
    if (note) {
      state.editingId = note.id;
      ui.formTitle.textContent = 'تعديل الملاحظة';
      ui.formSubtitle.textContent = 'حدّث بيانات الملاحظة ثم احفظ التغييرات.';
      ui.editMeta.classList.remove('hidden');
      ui.editMeta.innerHTML = `${icon('i-info')}<span>أُنشئت بواسطة <strong>${esc(note.created_by_name || 'غير محدد')}</strong> في ${esc(formatDateTime(note.created_at))}</span><span>آخر تحديث: ${esc(formatDateTime(note.updated_at))}</span>`;
      ui.btnCancelEdit.classList.remove('hidden');
      ui.btnSaveNote.querySelector('span').textContent = 'حفظ التعديلات';
      ui.noteTitle.value = note.title;
      ui.noteDescription.value = note.description;
      ui.noteDomain.value = DOMAINS.includes(note.domain) ? note.domain : DOMAINS[0];
      ui.notePriority.value = PRIORITIES.includes(note.priority) ? note.priority : 'متوسطة';
      ui.noteStatus.value = STATUS_LIST.includes(note.status) ? note.status : STATUS.NEW;
      ui.noteRecommendation.value = note.recommendation || '';
      ui.noteCorrective.value = note.corrective_action || '';
      ui.noteOwner.value = note.owner_name || '';
      ui.noteTarget.value = note.target_date || '';
      updateCounters();
    } else {
      state.editingId = null;
      resetFormFields();
      ui.formTitle.textContent = 'ملاحظة جديدة';
      ui.formSubtitle.textContent = 'سجّل الملاحظة مع التوصية والإجراء التصحيحي والمسؤول.';
      ui.editMeta.classList.add('hidden');
      ui.btnCancelEdit.classList.add('hidden');
      ui.btnSaveNote.querySelector('span').textContent = 'حفظ الملاحظة';
    }
    ui.formCard.classList.remove('hidden');
    ui.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => ui.noteTitle.focus(), 320);
  }

  function closeForm() {
    state.editingId = null;
    resetFormFields();
    ui.formCard.classList.add('hidden');
  }

  function startEdit(id) {
    const note = state.notes.find((n) => n.id === id);
    if (!note) { toast('الملاحظة غير موجودة.', 'error'); return; }
    openForm(note);
  }

  /* ══════════════════════════ الحذف ══════════════════════════ */
  function askDelete(id) {
    const note = state.notes.find((n) => n.id === id);
    if (!note) return;
    state.pendingDeleteId = id;
    state.lastFocus = document.activeElement;
    ui.deleteNoteTitle.textContent = note.title;
    clearDeleteMsg();
    ui.deleteModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    ui.btnCancelDelete.focus();
  }

  function closeDeleteModal() {
    if (!ui.deleteModal || ui.deleteModal.classList.contains('hidden')) return;
    ui.deleteModal.classList.add('hidden');
    state.pendingDeleteId = null;
    clearDeleteMsg();
    document.body.classList.remove('modal-open');
    if (state.lastFocus && document.contains(state.lastFocus)) {
      try { state.lastFocus.focus(); } catch (e) { /* تجاهل */ }
    }
    state.lastFocus = null;
  }

  async function confirmDelete() {
    if (!state.pendingDeleteId || state.deleting) return;
    const id = state.pendingDeleteId;
    state.deleting = true;
    setBtnLoading(ui.btnConfirmDelete, true, 'جارٍ الحذف…');
    try {
      await deleteNote(id);
      state.notes = state.notes.filter((n) => n.id !== id);
      closeDeleteModal();
      renderAll();
      toast('تم حذف الملاحظة.', 'success');
      await loadNotes({ skeleton: false, silent: true });
    } catch (error) {
      const message = errText(error);
      showDeleteMsg(message);
      toast(message, 'error');
    } finally {
      state.deleting = false;
      setBtnLoading(ui.btnConfirmDelete, false);
    }
  }

  /* ══════════════════════════ الفلاتر ══════════════════════════ */
  function renderOwnerOptions() {
    const owners = Array.from(new Set(state.notes.map((n) => text(n.owner_name)).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'ar'));
    const current = state.filters.owner;
    fillSelect(ui.filterOwner, [
      { value: 'all', label: 'كل المسؤولين' },
      ...owners.map((owner) => ({ value: owner, label: owner }))
    ]);
    if (current !== 'all' && !owners.includes(current)) state.filters.owner = 'all';
    ui.filterOwner.value = state.filters.owner;
  }

  function syncFilterControls() {
    renderOwnerOptions();
    ui.filterQ.value = state.filters.q;
    ui.filterStatus.value = state.filters.status;
    ui.filterPriority.value = state.filters.priority;
    ui.filterDomain.value = state.filters.domain;
    ui.filterOwner.value = state.filters.owner;
    ui.filterDue.value = state.filters.due;
    ui.filterMissing.value = state.filters.missing;
    ui.filterFrom.value = state.filters.from;
    ui.filterTo.value = state.filters.to;
    ui.filterSort.value = state.filters.sort;
    toggleHidden(ui.btnClearSearch, !state.filters.q);
  }

  function onFilterChange() {
    state.filters.q = ui.filterQ.value.trim();
    state.filters.status = ui.filterStatus.value;
    state.filters.priority = ui.filterPriority.value;
    state.filters.domain = ui.filterDomain.value;
    state.filters.owner = ui.filterOwner.value;
    state.filters.due = ui.filterDue.value;
    state.filters.missing = ui.filterMissing.value;
    state.filters.from = ui.filterFrom.value;
    state.filters.to = ui.filterTo.value;
    state.filters.sort = ui.filterSort.value;
    toggleHidden(ui.btnClearSearch, !state.filters.q);
    if (state.filters.from && state.filters.to && state.filters.from > state.filters.to) {
      toast('تاريخ البداية بعد تاريخ النهاية؛ قد لا تظهر نتائج.', 'error');
    }
    renderNotes();
    renderFilterSummary();
    updateStatsActive();
  }

  function resetFilters() {
    state.filters = defaultFilters();
    syncFilterControls();
    renderNotes();
    renderFilterSummary();
    updateStatsActive();
  }

  function applyRecommendation(type) {
    const base = defaultFilters();
    const patches = {
      overdue: { ...base, status: 'open', due: 'overdue', sort: 'target_asc' },
      critical: { ...base, status: 'open', priority: 'حرجة', sort: 'priority_desc' },
      high: { ...base, status: 'open', priority: 'عالية', sort: 'priority_desc' },
      no_action: { ...base, status: 'open', missing: 'no_action' },
      no_owner: { ...base, status: 'open', missing: 'no_owner' },
      soon: { ...base, status: 'open', due: 'soon', sort: 'target_asc' }
    };
    state.filters = patches[type] || base;
    syncFilterControls();
    renderNotes();
    renderFilterSummary();
    updateStatsActive();
    scrollToNotes();
  }

  function scrollToNotes() {
    if (ui.notesCard) ui.notesCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function getFilteredNotes() {
    const f = state.filters;
    const q = normalizeText(f.q);
    const result = state.notes.filter((note) => {
      if (f.status === 'open' && note.status === STATUS.CLOSED) return false;
      if (f.status !== 'all' && f.status !== 'open' && note.status !== f.status) return false;
      if (f.priority !== 'all' && note.priority !== f.priority) return false;
      if (f.domain !== 'all' && note.domain !== f.domain) return false;
      if (f.owner !== 'all' && text(note.owner_name) !== f.owner) return false;
      if (f.due === 'overdue' && !isOverdue(note)) return false;
      if (f.due === 'soon' && !isDueSoon(note)) return false;
      if (f.missing === 'no_action' && (note.status === STATUS.CLOSED || text(note.corrective_action))) return false;
      if (f.missing === 'no_owner' && (note.status === STATUS.CLOSED || text(note.owner_name))) return false;
      if (f.from && datePart(note.created_at) && datePart(note.created_at) < f.from) return false;
      if (f.to && datePart(note.created_at) && datePart(note.created_at) > f.to) return false;
      if (q) {
        const haystack = normalizeText([
          note.title, note.description, note.recommendation, note.corrective_action,
          note.owner_name, note.created_by_name, note.domain, note.status, note.priority
        ].join(' '));
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sort = f.sort;
    result.sort((a, b) => {
      if (sort === 'created_desc') return new Date(b.created_at) - new Date(a.created_at);
      if (sort === 'priority_desc') {
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
          || new Date(b.updated_at) - new Date(a.updated_at);
      }
      if (sort === 'target_asc') {
        const av = a.target_date || '9999-12-31';
        const bv = b.target_date || '9999-12-31';
        return av.localeCompare(bv) || new Date(b.updated_at) - new Date(a.updated_at);
      }
      if (sort === 'title_asc') return text(a.title).localeCompare(text(b.title), 'ar');
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    return result;
  }

  /* ══════════════════════════ العرض ══════════════════════════ */
  function renderAll() {
    renderOwnerOptions();
    renderStats();
    renderNotes();
    renderRecommendations();
    renderActivity();
    renderFilterSummary();
    updateStatsActive();
  }

  function renderStats() {
    const total = state.notes.length;
    const counts = {
      total,
      new: state.notes.filter((n) => n.status === STATUS.NEW).length,
      progress: state.notes.filter((n) => n.status === STATUS.PROGRESS).length,
      closed: state.notes.filter((n) => n.status === STATUS.CLOSED).length
    };
    ui.statTotal.textContent = counts.total;
    ui.statNew.textContent = counts.new;
    ui.statProgress.textContent = counts.progress;
    ui.statClosed.textContent = counts.closed;
    ui.statTotalSub.textContent = total ? `${counts.new + counts.progress} مفتوحة` : 'لا توجد ملاحظات';
    const pct = (value) => (total ? Math.round((value / total) * 100) : 0);
    ui.statNewSub.textContent = `${pct(counts.new)}% من الإجمالي`;
    ui.statProgressSub.textContent = `${pct(counts.progress)}% من الإجمالي`;
    ui.statClosedSub.textContent = `${pct(counts.closed)}% من الإجمالي`;
    ui.statTotalBar.style.width = total ? '100%' : '0%';
    ui.statNewBar.style.width = `${pct(counts.new)}%`;
    ui.statProgressBar.style.width = `${pct(counts.progress)}%`;
    ui.statClosedBar.style.width = `${pct(counts.closed)}%`;
  }

  function updateStatsActive() {
    $$('.stat-card', ui.statsGrid).forEach((card) => {
      card.classList.toggle('active', card.dataset.statusFilter === state.filters.status);
    });
  }

  function detailBlock(label, iconName, value, options) {
    const opts = options || {};
    const missing = !!opts.missing;
    const body = value ? esc(value) : esc(opts.empty || 'لم يُسجَّل بعد.');
    return `<div class="note-detail${missing ? ' is-missing' : ''}">
      <div class="note-detail-label">${icon(iconName)} ${esc(label)}</div>
      <p>${body}</p>
    </div>`;
  }

  function targetMeta(note) {
    if (!note.target_date) return `<span class="meta-item">${icon('i-calendar')}بدون تاريخ استهداف</span>`;
    const date = formatDateOnly(note.target_date);
    if (note.status === STATUS.CLOSED) return `<span class="meta-item">${icon('i-calendar')}الاستهداف: <strong>${esc(date)}</strong></span>`;
    const d = diffDays(note.target_date);
    if (d !== null && d < 0) return `<span class="meta-item overdue">${icon('i-alert')}${esc(targetPhrase(note))} · <strong>${esc(date)}</strong></span>`;
    if (d !== null && d <= 7) return `<span class="meta-item due-soon">${icon('i-clock')}${esc(targetPhrase(note))} · <strong>${esc(date)}</strong></span>`;
    return `<span class="meta-item">${icon('i-calendar')}الاستهداف: <strong>${esc(date)}</strong></span>`;
  }

  function noteCardHTML(note) {
    const status = note.status;
    const priority = note.priority;
    const closed = status === STATUS.CLOSED;
    const overdue = isOverdue(note);
    const soon = !overdue && isDueSoon(note);
    const busy = state.busyId === note.id;
    const quick = status === STATUS.NEW
      ? { label: 'بدء المعالجة', icon: 'i-play' }
      : status === STATUS.PROGRESS
        ? { label: 'إغلاق', icon: 'i-check' }
        : { label: 'إعادة فتح', icon: 'i-refresh' };
    const createdBy = note.created_by_name || 'غير محدد';
    return `<article class="note-card priority-${priorityClass(priority)} status-${statusClass(status)}${busy ? ' is-busy' : ''}" data-note-id="${esc(note.id)}">
      <div class="note-top">
        <div class="note-badges">
          <span class="badge status-${statusClass(status)}">${esc(status)}</span>
          <span class="badge priority-${priorityClass(priority)}">${esc(priority)}</span>
          <span class="badge domain">${esc(note.domain)}</span>
          ${overdue ? '<span class="badge overdue">متأخرة</span>' : ''}
          ${soon ? '<span class="badge due-soon">تستحق قريبًا</span>' : ''}
        </div>
        <div class="note-actions">
          <button type="button" class="action-btn quick" data-action="toggle" data-id="${esc(note.id)}" title="${esc(quick.label)}" aria-label="${esc(quick.label)}">
            ${busy ? '<span class="spinner"></span>' : icon(quick.icon)}<span>${esc(quick.label)}</span>
          </button>
          <button type="button" class="action-btn" data-action="edit" data-id="${esc(note.id)}" title="تعديل الملاحظة" aria-label="تعديل الملاحظة">${icon('i-edit')}</button>
          <button type="button" class="action-btn danger" data-action="delete" data-id="${esc(note.id)}" title="حذف الملاحظة" aria-label="حذف الملاحظة">${icon('i-trash')}</button>
        </div>
      </div>
      <h3 class="note-title">${esc(note.title)}</h3>
      <p class="note-desc">${esc(note.description)}</p>
      <div class="note-detail-grid">
        ${detailBlock('التوصية', 'i-spark', note.recommendation, { empty: 'لم تُسجَّل توصية بعد.' })}
        ${detailBlock('الإجراء التصحيحي', 'i-check', note.corrective_action, {
          missing: !closed && !note.corrective_action,
          empty: closed ? '—' : 'لم يُسجَّل إجراء تصحيحي بعد. أضف خطوة تنفيذية واضحة.'
        })}
      </div>
      <div class="note-meta">
        <span class="meta-item">${icon('i-user')}المسؤول: <strong>${esc(note.owner_name || 'غير محدد')}</strong></span>
        ${targetMeta(note)}
      </div>
      <div class="note-log">
        <span>${icon('i-calendar')}أُنشئت: ${esc(formatDateTime(note.created_at))} · ${esc(createdBy)}</span>
        <span>${icon('i-refresh')}آخر تحديث: ${esc(formatDateTime(note.updated_at))}</span>
        ${closed && note.closed_at ? `<span>${icon('i-check')}أُغلقت: ${esc(formatDateTime(note.closed_at))}</span>` : ''}
      </div>
    </article>`;
  }

  function renderNotes() {
    if (!ui.notesList) return;
    if (state.loading) {
      ui.notesCount.textContent = '—';
      ui.notesSubtitle.textContent = 'جارٍ تحميل الملاحظات…';
      ui.notesList.innerHTML = Array.from({ length: 3 }, () => `
        <div class="skeleton-card">
          <div class="skeleton-line w40"></div>
          <div class="skeleton-line h18 w70"></div>
          <div class="skeleton-line w90"></div>
          <div class="skeleton-line w90"></div>
        </div>`).join('');
      return;
    }
    if (state.loadError) {
      ui.notesCount.textContent = '0';
      ui.notesSubtitle.textContent = 'تعذّر تحميل السجل';
      ui.notesList.innerHTML = `<div class="error-state">
        <div class="error-icon">${icon('i-alert')}</div>
        <h3>تعذّر تحميل الملاحظات</h3>
        <p>${esc(state.loadError)}</p>
        <button type="button" class="btn btn-primary btn-sm" data-action="retry">${icon('i-refresh')} إعادة المحاولة</button>
      </div>`;
      return;
    }
    const filtered = getFilteredNotes();
    ui.notesCount.textContent = String(filtered.length);
    if (!state.notes.length) {
      ui.notesSubtitle.textContent = 'لم تُضف أي ملاحظة بعد';
      ui.notesList.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${icon('i-notes')}</div>
        <h3>لا توجد ملاحظات بعد</h3>
        <p>أضف أول ملاحظة لتبدأ متابعة الفريق: العنوان، المجال، الأولوية، المسؤول، وتاريخ الاستهداف.</p>
        <button type="button" class="btn btn-primary btn-sm" data-action="new">${icon('i-plus')} إضافة أول ملاحظة</button>
      </div>`;
      return;
    }
    if (!filtered.length) {
      ui.notesSubtitle.textContent = `عرض 0 من أصل ${state.notes.length} ملاحظة`;
      ui.notesList.innerHTML = `<div class="empty-state">
        <div class="empty-icon">${icon('i-search')}</div>
        <h3>لا توجد نتائج مطابقة</h3>
        <p>جرّب تعديل كلمات البحث أو مسح الفلاتر لعرض جميع الملاحظات.</p>
        <button type="button" class="btn btn-ghost btn-sm" data-action="reset-filters">${icon('i-refresh')} مسح الفلاتر</button>
      </div>`;
      return;
    }
    ui.notesSubtitle.textContent = filtered.length === state.notes.length
      ? `${state.notes.length} ملاحظة`
      : `عرض ${filtered.length} من أصل ${state.notes.length} ملاحظة`;
    ui.notesList.innerHTML = filtered.map(noteCardHTML).join('');
  }

  function renderRecommendations() {
    if (!ui.recommendations) return;
    if (state.loading) {
      ui.recommendations.innerHTML = '<div class="reco-empty">جارٍ تحليل الملاحظات…</div>';
      return;
    }
    if (state.loadError) {
      ui.recommendations.innerHTML = '<div class="reco-empty">تعذّر تحميل التوصيات.</div>';
      return;
    }
    if (!state.notes.length) {
      ui.recommendations.innerHTML = '<div class="reco-empty">أضف أول ملاحظة لتبدأ التوصيات الذكية بالظهور.</div>';
      return;
    }
    const open = state.notes.filter((n) => n.status !== STATUS.CLOSED);
    const overdue = open.filter(isOverdue);
    const critical = open.filter((n) => n.priority === 'حرجة');
    const high = open.filter((n) => n.priority === 'عالية');
    const noAction = open.filter((n) => !text(n.corrective_action));
    const noOwner = open.filter((n) => !text(n.owner_name));
    const soon = open.filter(isDueSoon);
    const items = [];
    const add = (type, tone, iconName, title, desc, count) => {
      if (count > 0) items.push({ type, tone, iconName, title, desc, count });
    };
    add('overdue', 'danger', 'i-alert', 'ملاحظات متأخرة', 'تجاوزت تاريخ الاستهداف وما زالت مفتوحة.', overdue.length);
    add('critical', 'danger', 'i-alert', 'أولوية حرجة مفتوحة', 'تحتاج تدخلًا عاجلًا ومتابعة قريبة.', critical.length);
    add('high', 'warn', 'i-flame', 'أولوية عالية مفتوحة', 'راجع خطة المعالجة والمسؤول.', high.length);
    add('no_action', 'warn', 'i-check', 'بدون إجراء تصحيحي', 'ملاحظات مفتوحة لم تُسجَّل لها خطوة تنفيذية.', noAction.length);
    add('no_owner', 'info', 'i-user', 'بدون مسؤول محدد', 'عيّن مسؤولًا واضحًا لكل ملاحظة.', noOwner.length);
    add('soon', 'info', 'i-clock', 'تستحق خلال ٧ أيام', 'اقترب موعد الاستهداف؛ تابع التنفيذ.', soon.length);

    if (!items.length) {
      ui.recommendations.innerHTML = `<div class="reco-success">${icon('i-shield')}<div><strong>المتابعة منتظمة</strong><span>لا توجد ملاحظات متأخرة أو نواقص حالية.</span></div></div>`;
      return;
    }
    ui.recommendations.innerHTML = items.map((item) => `
      <button type="button" class="reco-item reco-${item.tone}" data-reco="${item.type}">
        <span class="reco-icon">${icon(item.iconName)}</span>
        <span class="reco-body"><strong>${esc(item.title)}</strong><span>${esc(item.desc)}</span></span>
        <span class="reco-count">${item.count}</span>
      </button>`).join('');
  }

  function renderActivity() {
    if (!ui.activityList) return;
    if (state.loading) {
      ui.activityList.innerHTML = '<div class="activity-empty">جارٍ التحميل…</div>';
      return;
    }
    if (state.loadError) {
      ui.activityList.innerHTML = '<div class="activity-empty">تعذّر تحميل النشاط.</div>';
      return;
    }
    const items = state.notes.slice()
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 5);
    if (!items.length) {
      ui.activityList.innerHTML = '<div class="activity-empty">لا يوجد نشاط بعد.</div>';
      return;
    }
    ui.activityList.innerHTML = items.map((note) => `
      <button type="button" class="activity-item" data-note-id="${esc(note.id)}" title="عرض الملاحظة">
        <span class="activity-dot ${statusClass(note.status)}"></span>
        <span class="activity-body">
          <strong>${esc(note.title)}</strong>
          <span>${esc(note.status)} · ${esc(note.owner_name || 'بدون مسؤول')}</span>
        </span>
        <span class="activity-time">${esc(timeAgo(note.updated_at))}</span>
      </button>`).join('');
  }

  function renderFilterSummary() {
    const f = state.filters;
    const parts = [];
    if (f.q) parts.push(`بحث: «${f.q}»`);
    if (f.status !== 'all') parts.push(`الحالة: ${f.status === 'open' ? 'مفتوحة' : f.status}`);
    if (f.priority !== 'all') parts.push(`الأولوية: ${f.priority}`);
    if (f.domain !== 'all') parts.push(`المجال: ${f.domain}`);
    if (f.owner !== 'all') parts.push(`المسؤول: ${f.owner}`);
    if (f.due !== 'all') parts.push(`الاستحقاق: ${DUE_LABELS[f.due] || f.due}`);
    if (f.missing !== 'all') parts.push(MISSING_LABELS[f.missing] || f.missing);
    if (f.from) parts.push(`من: ${formatDateOnly(f.from)}`);
    if (f.to) parts.push(`إلى: ${formatDateOnly(f.to)}`);
    if (f.sort !== 'updated_desc') parts.push(`الترتيب: ${SORT_LABELS[f.sort] || f.sort}`);
    const active = parts.length > 0;
    ui.filterSummary.textContent = active ? parts.join(' · ') : 'جميع الملاحظات';
    toggleHidden(ui.btnClearFiltersInline, !active);
  }

  function focusNote(id) {
    if (!state.notes.some((n) => n.id === id)) {
      toast('الملاحظة غير موجودة أو حُذفت.', 'error');
      return;
    }
    state.filters = defaultFilters();
    syncFilterControls();
    renderNotes();
    renderFilterSummary();
    updateStatsActive();
    setTimeout(() => {
      const safe = window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, '\\$&');
      const card = ui.notesList.querySelector(`[data-note-id="${safe}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('flash');
        setTimeout(() => card.classList.remove('flash'), 2300);
      }
    }, 80);
  }

  /* ══════════════════════════ المزامنة ══════════════════════════ */
  function setLiveStatus(mode) {
    if (!ui.liveStatus) return;
    ui.liveStatus.classList.remove('manual', 'offline');
    let label = 'غير متصل';
    if (mode === 'live') label = 'مزامنة مباشرة';
    else if (mode === 'manual') { label = 'تحديث يدوي'; ui.liveStatus.classList.add('manual'); }
    else if (mode === 'offline') { label = 'غير متصل'; ui.liveStatus.classList.add('offline'); }
    else if (mode === 'demo') { label = 'معاينة محلية'; ui.liveStatus.classList.add('manual'); }
    else { label = 'جارٍ الاتصال…'; ui.liveStatus.classList.add('manual'); }
    ui.liveText.textContent = label;
  }

  function unsubscribeRealtime() {
    if (state.reloadTimer) {
      clearTimeout(state.reloadTimer);
      state.reloadTimer = null;
    }
    if (state.channel && sb) {
      try { sb.removeChannel(state.channel); } catch (e) { /* تجاهل */ }
    }
    state.channel = null;
  }

  function subscribeRealtime() {
    if (state.mode !== 'cloud' || !sb) return;
    unsubscribeRealtime();
    setLiveStatus('connecting');
    try {
      state.channel = sb.channel('notes-platform-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
          if (state.reloadTimer) clearTimeout(state.reloadTimer);
          state.reloadTimer = setTimeout(() => {
            loadNotes({ skeleton: false, silent: true });
          }, 450);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setLiveStatus('live');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setLiveStatus('manual');
        });
    } catch (e) {
      setLiveStatus('manual');
    }
  }

  /* ══════════════════════════ وضع المعاينة ══════════════════════════ */
  function demoDay(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function demoTimestamp(hoursAgo) {
    return new Date(Date.now() - hoursAgo * 3600000).toISOString();
  }

  function createDemoNotes() {
    return [
      {
        id: 'demo-1',
        title: 'ضعف حضور الطلاب في الحصص الصباحية',
        description: 'رُصد انخفاض حضور بعض الصفوف في الحصة الأولى خلال الأسبوعين الماضيين، مع تكرار التأخر في الطابور الصباحي.',
        domain: 'الشؤون الأكاديمية',
        priority: 'عالية',
        status: STATUS.PROGRESS,
        recommendation: 'تفعيل تواصل مبكر مع أولياء الأمور، وإرسال تنبيهات يومية للحالات المتكررة.',
        corrective_action: 'إعداد تقرير حضور أسبوعي ومشاركته مع المرشد الطلابي ورؤساء الصفوف.',
        owner_name: 'أ. سارة العتيبي',
        target_date: demoDay(-2),
        created_by: 'demo-user',
        created_by_name: 'سارة العتيبي',
        created_at: demoTimestamp(72),
        updated_at: demoTimestamp(5),
        closed_at: null
      },
      {
        id: 'demo-2',
        title: 'ازدحام المدخل الشمالي وقت الانصراف',
        description: 'لوحظ ازدحام شديد عند بوابة الانصراف الشمالية، ما يرفع احتمالية التدافع ويؤثر على سلامة الطلاب.',
        domain: 'الأمن والسلامة',
        priority: 'حرجة',
        status: STATUS.NEW,
        recommendation: 'توزيع الانصراف على بوابتين، وتكليف مشرفين إضافيين في الفترة الانتقالية.',
        corrective_action: 'اعتماد خطة انصراف جديدة تبدأ من يوم الأحد القادم وتجربتها لمدة أسبوع.',
        owner_name: 'أ. محمد القحطاني',
        target_date: demoDay(1),
        created_by: 'demo-user',
        created_by_name: 'محمد القحطاني',
        created_at: demoTimestamp(6),
        updated_at: demoTimestamp(6),
        closed_at: null
      },
      {
        id: 'demo-3',
        title: 'عدم اكتمال بيانات الطلاب في النظام',
        description: 'ظهرت سجلات ناقصة لعدد من الطلاب في بيانات ولي الأمر والعنوان، ما يعيق التواصل والمتابعة.',
        domain: 'الشؤون الإدارية',
        priority: 'متوسطة',
        status: STATUS.CLOSED,
        recommendation: 'حصر السجلات الناقصة وإرسال استمارة تحديث بيانات لأولياء الأمور.',
        corrective_action: 'تم تحديث ١٠٠٪ من السجلات الناقصة والتحقق منها من قبل شؤون الطلاب.',
        owner_name: 'أ. نورة الشمري',
        target_date: demoDay(-5),
        created_by: 'demo-user',
        created_by_name: 'نورة الشمري',
        created_at: demoTimestamp(120),
        updated_at: demoTimestamp(20),
        closed_at: demoTimestamp(20)
      },
      {
        id: 'demo-4',
        title: 'ضعف تفاعل أولياء الأمور مع القنوات الرسمية',
        description: 'نسبة المشاهدة والتفاعل مع الرسائل الرسمية منخفضة، خصوصًا في المرحلة المتوسطة.',
        domain: 'الشراكة المجتمعية',
        priority: 'متوسطة',
        status: STATUS.NEW,
        recommendation: 'تنويع قنوات التواصل وإرسال ملخص أسبوعي موجز بدل الرسائل المتعددة.',
        corrective_action: '',
        owner_name: '',
        target_date: demoDay(7),
        created_by: 'demo-user',
        created_by_name: 'فريق المتابعة',
        created_at: demoTimestamp(30),
        updated_at: demoTimestamp(30),
        closed_at: null
      },
      {
        id: 'demo-5',
        title: 'أعطال متكررة في أجهزة معمل الحاسب',
        description: 'تكرر تعطل عدد من الأجهزة أثناء الحصص، ما أدى إلى تأجيل بعض الأنشطة العملية.',
        domain: 'التقنية والدعم',
        priority: 'عالية',
        status: STATUS.PROGRESS,
        recommendation: 'إجراء صيانة وقائية شاملة وتحديد جهاز بديل احتياطي لكل حصة.',
        corrective_action: '',
        owner_name: 'م. عبدالله الحربي',
        target_date: demoDay(3),
        created_by: 'demo-user',
        created_by_name: 'عبدالله الحربي',
        created_at: demoTimestamp(48),
        updated_at: demoTimestamp(9),
        closed_at: null
      },
      {
        id: 'demo-6',
        title: 'قلة المشاركة في الأنشطة اللاصفية',
        description: 'انخفض عدد المشاركين في الأندية الطلابية مقارنة بالفصل السابق، مع ضعف في تنوع الأنشطة.',
        domain: 'الأنشطة الطلابية',
        priority: 'منخفضة',
        status: STATUS.CLOSED,
        recommendation: 'إطلاق استبيان لقياس اهتمامات الطلاب وتصميم أنشطة قصيرة وجاذبة.',
        corrective_action: 'تم تشكيل لجنة الأنشطة وإطلاق ثلاث مبادرات جديدة بمشاركة ٦٠ طالبًا.',
        owner_name: 'أ. ريم الدوسري',
        target_date: demoDay(-3),
        created_by: 'demo-user',
        created_by_name: 'ريم الدوسري',
        created_at: demoTimestamp(140),
        updated_at: demoTimestamp(30),
        closed_at: demoTimestamp(30)
      },
      {
        id: 'demo-7',
        title: 'الحاجة إلى تحديث خطة الإخلاء',
        description: 'خطة الإخلاء الحالية لم تُحدَّث بعد تغيير توزيع الفصول، ولا تشمل نقطة التجمع الجديدة.',
        domain: 'الأمن والسلامة',
        priority: 'حرجة',
        status: STATUS.PROGRESS,
        recommendation: 'مراجعة مسارات الإخلاء ونقاط التجمع وتحديث اللوحات الإرشادية.',
        corrective_action: 'تنفيذ تمرين إخلاء تجريبي وتوثيق زمن الإخلاء وملاحظات التحسين.',
        owner_name: 'أ. محمد القحطاني',
        target_date: demoDay(5),
        created_by: 'demo-user',
        created_by_name: 'محمد القحطاني',
        created_at: demoTimestamp(60),
        updated_at: demoTimestamp(2),
        closed_at: null
      },
      {
        id: 'demo-8',
        title: 'ضعف نواتج التعلم في الرياضيات للصف الرابع',
        description: 'أظهرت نتائج التقييم القصير انخفاضًا في مهارات حل المسائل لدى مجموعة من طلاب الصف الرابع.',
        domain: 'الشؤون الأكاديمية',
        priority: 'عالية',
        status: STATUS.NEW,
        recommendation: 'تحليل نتائج التقييم وتحديد المهارات الأكثر حاجةً للدعم.',
        corrective_action: '',
        owner_name: '',
        target_date: demoDay(10),
        created_by: 'demo-user',
        created_by_name: 'فريق المتابعة',
        created_at: demoTimestamp(10),
        updated_at: demoTimestamp(10),
        closed_at: null
      },
      {
        id: 'demo-9',
        title: 'تأخر تحديث خطة النشاط الطلابي',
        description: 'لم تُعتمد خطة النشاط للفصل الحالي بعد، ما يؤثر على جدولة البرامج والزيارات.',
        domain: 'الشؤون الإدارية',
        priority: 'متوسطة',
        status: STATUS.PROGRESS,
        recommendation: 'تحديد موعد نهائي للاعتماد ومتابعة المهام المتبقية يوميًا.',
        corrective_action: 'عقد اجتماع مصغّر مع لجنة النشاط ورفع النسخة النهائية للاعتماد.',
        owner_name: 'أ. نورة الشمري',
        target_date: demoDay(0),
        created_by: 'demo-user',
        created_by_name: 'نورة الشمري',
        created_at: demoTimestamp(24),
        updated_at: demoTimestamp(1),
        closed_at: null
      }
    ].map(normalizeNote);
  }

  function enterDemo() {
    state.authEpoch += 1;
    state.mode = 'demo';
    try {
      if (new URLSearchParams(location.search).get('demo') !== '1') {
        history.replaceState({}, '', location.pathname + '?demo=1');
      }
    } catch (e) { /* بعض المتصفحات تمنع تعديل الرابط في وضع file:// */ }
    state.user = { id: 'demo-user', email: 'demo@preview.local', user_metadata: { full_name: 'فريق المتابعة' } };
    state.notes = createDemoNotes();
    state.filters = defaultFilters();
    state.editingId = null;
    state.appVisible = true;
    hide(ui.setupScreen);
    hide(ui.authScreen);
    show(ui.mainScreen);
    ui.demoBanner.classList.remove('hidden');
    ui.modeBadge.classList.add('demo');
    ui.modeBadge.innerHTML = `${icon('i-info')}<span>معاينة</span>`;
    ui.btnLogout.querySelector('span').textContent = 'إنهاء المعاينة';
    ui.btnLogout.title = 'إنهاء المعاينة';
    ui.btnLogout.setAttribute('aria-label', 'إنهاء المعاينة');
    ui.footerMode.textContent = 'وضع المعاينة التجريبية';
    setHeaderActive(true);
    updateUserBox(state.user);
    ui.userEmail.textContent = 'بيانات تجريبية غير محفوظة';
    setLiveStatus('demo');
    unsubscribeRealtime();
    syncFilterControls();
    resetFormFields();
    ui.formCard.classList.add('hidden');
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('وضع المعاينة: التغييرات لا تُحفظ بعد إغلاق الصفحة.', 'info', 5200);
  }

  function exitDemo() {
    state.authEpoch += 1;
    state.mode = 'cloud';
    state.appVisible = false;
    state.user = null;
    state.userName = '';
    state.notes = [];
    state.filters = defaultFilters();
    state.editingId = null;
    state.busyId = null;
    state.pendingDeleteId = null;
    unsubscribeRealtime();
    hide(ui.mainScreen);
    ui.demoBanner.classList.add('hidden');
    ui.modeBadge.classList.remove('demo');
    ui.modeBadge.innerHTML = `${icon('i-cloud')}<span>سحابي</span>`;
    ui.btnLogout.title = 'تسجيل الخروج';
    ui.btnLogout.setAttribute('aria-label', 'تسجيل الخروج');
    closeDeleteModal();
    try {
      if (new URLSearchParams(location.search).get('demo') === '1') {
        history.replaceState({}, '', location.pathname);
      }
    } catch (e) { /* تجاهل */ }
    const issue = configIssue();
    if (issue) showSetup(issue);
    else showAuth();
    toast('تم إنهاء وضع المعاينة.', 'info');
  }

  /* ══════════════════════════ الأحداث ══════════════════════════ */
  function bindEvents() {
    ui.noteForm.addEventListener('submit', handleNoteSubmit);
    ui.btnNewNote.addEventListener('click', () => openForm());
    ui.btnCloseForm.addEventListener('click', closeForm);
    ui.btnCancelEdit.addEventListener('click', closeForm);
    ui.noteTitle.addEventListener('input', updateCounters);
    ui.noteDescription.addEventListener('input', updateCounters);

    ui.filterQ.addEventListener('input', () => {
      toggleHidden(ui.btnClearSearch, !ui.filterQ.value);
      clearTimeout(ui.filterQ._timer);
      ui.filterQ._timer = setTimeout(() => {
        state.filters.q = ui.filterQ.value.trim();
        renderNotes();
        renderFilterSummary();
      }, 180);
    });
    ui.btnClearSearch.addEventListener('click', () => {
      ui.filterQ.value = '';
      state.filters.q = '';
      toggleHidden(ui.btnClearSearch, true);
      renderNotes();
      renderFilterSummary();
      ui.filterQ.focus();
    });
    [ui.filterStatus, ui.filterPriority, ui.filterDomain, ui.filterOwner, ui.filterDue, ui.filterMissing, ui.filterFrom, ui.filterTo, ui.filterSort]
      .forEach((node) => node.addEventListener('change', onFilterChange));
    ui.btnResetFilters.addEventListener('click', resetFilters);
    ui.btnClearFiltersInline.addEventListener('click', resetFilters);

    ui.statsGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.stat-card');
      if (!card) return;
      state.filters.status = card.dataset.statusFilter;
      syncFilterControls();
      renderNotes();
      renderFilterSummary();
      updateStatsActive();
      scrollToNotes();
    });

    ui.notesList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'new') openForm();
      else if (action === 'retry') loadNotes({ skeleton: true });
      else if (action === 'reset-filters') resetFilters();
      else if (action === 'edit') startEdit(button.dataset.id);
      else if (action === 'delete') askDelete(button.dataset.id);
      else if (action === 'toggle') quickStatus(button.dataset.id);
    });

    ui.recommendations.addEventListener('click', (event) => {
      const item = event.target.closest('[data-reco]');
      if (item) applyRecommendation(item.dataset.reco);
    });

    ui.activityList.addEventListener('click', (event) => {
      const item = event.target.closest('[data-note-id]');
      if (item) focusNote(item.dataset.noteId);
    });

    ui.btnRefresh.addEventListener('click', refreshNotes);
    ui.btnRefreshNotes.addEventListener('click', refreshNotes);
    ui.btnLogout.addEventListener('click', handleLogout);

    $$('.auth-tab').forEach((tab) => tab.addEventListener('click', () => applyAuthMode(tab.dataset.authTab)));
    ui.authForm.addEventListener('submit', handleAuthSubmit);
    ui.togglePassword.addEventListener('click', () => {
      const showPassword = ui.authPassword.type === 'password';
      ui.authPassword.type = showPassword ? 'text' : 'password';
      ui.togglePassword.innerHTML = icon(showPassword ? 'i-eye-off' : 'i-eye');
      ui.togglePassword.setAttribute('aria-label', showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      ui.togglePassword.title = showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور';
    });

    ui.btnAuthDemo.addEventListener('click', enterDemo);
    ui.btnSetupDemo.addEventListener('click', enterDemo);
    ui.btnSetupRetry.addEventListener('click', () => location.reload());
    ui.btnExitDemo.addEventListener('click', exitDemo);

    ui.btnConfirmDelete.addEventListener('click', confirmDelete);
    ui.btnCancelDelete.addEventListener('click', closeDeleteModal);
    ui.deleteModal.addEventListener('click', (event) => {
      if (event.target === ui.deleteModal && !state.deleting) closeDeleteModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !ui.deleteModal.classList.contains('hidden') && !state.deleting) closeDeleteModal();
    });

    window.addEventListener('online', () => {
      if (state.mode === 'cloud' && state.appVisible) {
        setLiveStatus('connecting');
        subscribeRealtime();
        loadNotes({ skeleton: false, silent: true });
        toast('عاد الاتصال بالإنترنت.', 'success');
      }
    });
    window.addEventListener('offline', () => {
      if (state.mode === 'cloud' && state.appVisible) {
        setLiveStatus('offline');
        toast('انقطع الاتصال بالإنترنت. ستتم المزامنة عند عودته.', 'error');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
