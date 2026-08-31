/* ===================== Ibrahim Focus — app core ===================== */
const STORAGE_KEY = 'ibrahimFocus.state.v1';
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2, 9);

function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayKey() { return dateKey(new Date()); }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
const DAY_ORDER = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const DAY_LABEL = { sat: 'السبت', sun: 'الأحد', mon: 'الاثنين', tue: 'الثلاثاء', wed: 'الأربعاء', thu: 'الخميس', fri: 'الجمعة' };
const DAY_LABEL_SHORT = { sat: 'سبت', sun: 'أحد', mon: 'اثنين', tue: 'ثلاثاء', wed: 'أربعاء', thu: 'خميس', fri: 'جمعة' };
function jsDayToKey(jsDay) { // JS: 0=Sun..6=Sat  -> our keys
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][jsDay];
}
function fmtHMS(totalSeconds) {
  totalSeconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function fmtMinutesLabel(totalMinutes) {
  const h = Math.floor(totalMinutes / 60), m = Math.round(totalMinutes % 60);
  if (h <= 0) return `${m} د`;
  return `${h} س ${m} د`;
}

/* ---------- default data (only what Ibrahim actually specified) ---------- */
function defaultSchedule() {
  return {
    sat: [{ id: uid(), subject: 'عربي', time: '12:00' }],
    sun: [{ id: uid(), subject: 'فيزياء', time: '11:00' }, { id: uid(), subject: 'كيمياء', time: '15:00' }],
    mon: [{ id: uid(), subject: 'English', time: '12:30–14:30' }, { id: uid(), subject: 'أحياء', time: '16:00' }],
    tue: [{ id: uid(), subject: 'عربي', time: '12:00' }],
    wed: [{ id: uid(), subject: 'فيزياء', time: '11:00' }, { id: uid(), subject: 'كيمياء', time: '15:00' }],
    thu: [{ id: uid(), subject: 'English', time: '12:30–14:30' }, { id: uid(), subject: 'أحياء', time: '16:00' }],
    fri: [],
  };
}
function defaultBooks() {
  const b = (subject, name, term) => ({ id: uid(), subject, name, term, year: '2027', fileMeta: null });
  return [
    b('الإنجليزي', 'جيم إنجليزي تالتة ثانوي 2027', 'الترم الأول'),
    b('الإنجليزي', 'المعاصر English', 'الترم الأول'),
    b('الكيمياء', 'الوافي كيمياء 2027', 'الترم الأول'),
    b('الكيمياء', 'مندليف كيمياء 2027 — الجزء الأول', 'الترم الأول'),
    b('الكيمياء', 'مندليف كيمياء 2027 — الجزء الثاني', 'الترم الأول'),
    b('الكيمياء', 'الامتحان كيمياء 2027', 'الترم الأول'),
    b('الأحياء', 'أحياء التفوق 2027', 'الترم الأول'),
    b('الأحياء', 'كتاب التفوق أحياء أسئلة — الجزء الأول', 'الترم الأول'),
    b('الأحياء', 'كتاب التفوق أحياء أسئلة — الجزء الثاني', 'الترم الأول'),
    b('الفيزياء', 'نيوتن فيزياء 2027', 'الترم الأول'),
  ];
}
const SUBJECTS = ['الكيمياء', 'الفيزياء', 'الأحياء', 'العربي', 'الإنجليزي'];

function defaultState() {
  return {
    firstLaunch: todayKey(),
    profileName: 'إبراهيم',
    goal: 'كلية الصيدلة 💊',
    xp: 0,
    tasks: [],           // {id, date(key), subject, title, time, duration, priority, done}
    logs: {},            // dateKey -> { minutes, sessions }
    schedule: defaultSchedule(),
    gymLast: null,        // dateKey of last gym day
    books: defaultBooks(),
    questionBank: [],     // {id, subject, question, options:[4], correctIndex, level, note}
    exams: [],            // completed exam results
    errorLog: [],         // wrong question ids w/ dates
    spacedReviews: [],    // {id, subject, lessonName, dueDate, done, createdFrom}
    dailyGoalMinutes: 240,
    weeklyGoalMinutes: 1500,
    settings: {
      darkMode: false,
      notifications: true,
      focusPasswordHash: null,
      blockedApps: [],
      reviewIntervalsDays: [1, 3, 7, 14, 30],
      lessonReminders: true,
      reminderMinutesBefore: 10,
    },
    timerSession: null,   // {startTs, plannedMs, pausedMs, isPaused, pauseStartTs, subject, label}
    lastMotivationIndex: -1,
    lastMotivationDate: null,
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // merge with defaults to survive future upgrades
    return Object.assign(defaultState(), parsed, {
      schedule: Object.assign(defaultSchedule(), parsed.schedule || {}),
      settings: Object.assign(defaultState().settings, parsed.settings || {}),
    });
  } catch (e) {
    console.error('state load failed', e);
    return defaultState();
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- study days / streak ---------- */
function logMinutes(minutes, subject) {
  const k = todayKey();
  if (!state.logs[k]) state.logs[k] = { minutes: 0, sessions: 0 };
  state.logs[k].minutes += minutes;
  state.logs[k].sessions += 1;
  const prevXp = state.xp;
  state.xp += Math.round(minutes); // 1 XP per minute, tasks/exams add more elsewhere
  saveState();
  checkLevelUp(prevXp, state.xp);
}
function totalMinutes(dateKeyStr) { return (state.logs[dateKeyStr] || { minutes: 0 }).minutes; }
function todayTotalMinutes() { return totalMinutes(todayKey()); }
function weekTotalMinutes() {
  let sum = 0;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    sum += totalMinutes(dateKey(d));
  }
  return sum;
}
function monthTotalMinutes() {
  let sum = 0;
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    sum += totalMinutes(dateKey(d));
  }
  return sum;
}
function lifetimeMinutes() { return Object.values(state.logs).reduce((s, v) => s + v.minutes, 0); }
function studyStreak() {
  let streak = 0;
  let d = new Date();
  // if today has no minutes yet, still allow streak counted through yesterday
  if (totalMinutes(todayKey()) === 0) d.setDate(d.getDate() - 1);
  while (totalMinutes(dateKey(d)) > 0) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
function dayIndex() {
  const first = startOfDay(new Date(state.firstLaunch));
  const now = startOfDay(new Date());
  return Math.round((now - first) / 86400000);
}
function studyDaysCount() { return Object.values(state.logs).filter(v => v.minutes > 0).length; }

/* ---------- gym (يوم نعم يوم لا) ---------- */
function isGymDayToday() {
  if (!state.gymLast) return null;
  const last = startOfDay(new Date(state.gymLast));
  const now = startOfDay(new Date());
  const diffDays = Math.round((now - last) / 86400000);
  if (diffDays <= 0) return diffDays === 0 ? 'today-was-gym' : null;
  return (diffDays % 2 === 1) ? 'gym' : 'rest';
}

/* ---------- garden stage (based on TODAY's minutes, per Ibrahim's spec) ---------- */
function gardenStage(minutes) {
  if (minutes >= 120) return { emoji: '🌳', label: 'شجرة', next: null };
  if (minutes >= 90) return { emoji: '🌿', label: 'نبات أكبر', next: 120 };
  if (minutes >= 60) return { emoji: '🌱', label: 'ساق طالعة', next: 90 };
  if (minutes >= 30) return { emoji: '🌰', label: 'بذرة', next: 60 };
  return { emoji: '', label: 'أرض جديدة تنتظر', next: 30 };
}

/* ---------- motivational messages (rotate, avoid repeats) ---------- */
const MOTIVATIONS = [
  'كل ساعة مذاكرة تقربك من الصيدلة 💊',
  'لا تنتظر الحماس، ابدأ فقط.',
  'مذاكرة اليوم = نجاحك غدًا.',
  'أنت لا تذاكر من أجل الامتحان فقط، أنت تبني مستقبلك.',
  'ساعة تركيز أفضل من ساعات من التشتت.',
  'أنت لا تحتاج إلى يوم مثالي، فقط جلسة واحدة. ابدأ بها.',
];
function motivationForToday() {
  const k = todayKey();
  if (state.lastMotivationDate === k && state.lastMotivationIndex >= 0) {
    return MOTIVATIONS[state.lastMotivationIndex];
  }
  let idx = Math.floor(Math.random() * MOTIVATIONS.length);
  if (idx === state.lastMotivationIndex) idx = (idx + 1) % MOTIVATIONS.length;
  state.lastMotivationIndex = idx;
  state.lastMotivationDate = k;
  saveState();
  return MOTIVATIONS[idx];
}
function encouragementFor(kind, payload) {
  if (kind === 'session') return `🔥 ممتاز يا إبراهيم! ${payload} دقيقة تركيز كاملة.`;
  if (kind === 'twoHours') return '🌳 ساعتان من المذاكرة! زرعت شجرة جديدة في مستقبلك.';
  if (kind === 'task') return '💊 خطوة جديدة نحو كلية الصيدلة!';
  if (kind === 'comeback') return 'لم يفت الوقت. ابدأ بـ 25 دقيقة فقط.';
  return '';
}

/* ===================== XP levels & titles ===================== */
const LEVELS = [
  { level: 1, title: 'بذرة الطموح', xp: 0 },
  { level: 2, title: 'طالب مجتهد', xp: 100 },
  { level: 3, title: 'باحث عن التفوق', xp: 300 },
  { level: 4, title: 'متمكن من موادك', xp: 600 },
  { level: 5, title: 'مستعد للتفوق', xp: 1000 },
  { level: 6, title: 'على أعتاب الصيدلة 🎓', xp: 1500 },
  { level: 7, title: 'صيدلي المستقبل 💊', xp: 2200 },
  { level: 8, title: 'أسطورة المذاكرة 🏆', xp: 3200 },
];
function levelInfo(xp) {
  let current = LEVELS[0];
  let next = LEVELS[1] || null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xp) { current = LEVELS[i]; next = LEVELS[i + 1] || null; }
  }
  const span = next ? (next.xp - current.xp) : 1;
  const into = next ? (xp - current.xp) : 0;
  const progressPct = next ? Math.min(100, Math.round((into / span) * 100)) : 100;
  return { level: current.level, title: current.title, xp, next, progressPct, xpToNext: next ? next.xp - xp : 0 };
}
function checkLevelUp(prevXp, newXp) {
  const before = levelInfo(prevXp).level;
  const after = levelInfo(newXp).level;
  if (after > before) {
    const info = levelInfo(newXp);
    toast(`🏆 مبروك! وصلت للمستوى ${after} — ${info.title}`, 3600);
  }
}

function toast(msg, ms = 2600) {
  const root = $('#toastRoot');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.innerHTML = '';
  root.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, ms);
}

/* ===================== Focus Timer Engine (timestamp-based, background safe) =====================
   We never rely on setInterval to accumulate elapsed time. We store the wall-clock start
   timestamp plus accumulated paused time in localStorage, and always recompute elapsed as
   (now - startTs - pausedMs) whenever the UI needs it (on tick, on resume, on visibilitychange,
   on page load). This means the truth lives in real timestamps, so leaving the app, the phone
   sleeping, or the tab being backgrounded does not lose time — the moment the app is looked at
   again, the correct elapsed time is recalculated from Date.now(). */

let tickHandle = null;

function startTimerSession(durationMinutes, subject) {
  state.timerSession = {
    startTs: Date.now(),
    plannedMs: durationMinutes * 60 * 1000,
    pausedMs: 0,
    isPaused: false,
    pauseStartTs: null,
    subject: subject || null,
    label: subject || 'جلسة تركيز',
  };
  saveState();
  scheduleFinishNotification();
  startTicking();
}
function pauseTimerSession() {
  if (!state.timerSession || state.timerSession.isPaused) return;
  state.timerSession.isPaused = true;
  state.timerSession.pauseStartTs = Date.now();
  saveState();
}
function resumeTimerSession() {
  if (!state.timerSession || !state.timerSession.isPaused) return;
  const s = state.timerSession;
  s.pausedMs += Date.now() - s.pauseStartTs;
  s.isPaused = false;
  s.pauseStartTs = null;
  saveState();
  scheduleFinishNotification();
}
function elapsedMsOf(session) {
  if (!session) return 0;
  const pausedExtra = session.isPaused ? (Date.now() - session.pauseStartTs) : 0;
  return Date.now() - session.startTs - session.pausedMs - pausedExtra;
}
function finishTimerSession(auto) {
  const s = state.timerSession;
  if (!s) return;
  const elapsedMin = Math.max(0, Math.round(elapsedMsOf(s) / 60000));
  state.timerSession = null;
  saveState();
  stopTicking();
  if (elapsedMin > 0) {
    logMinutes(elapsedMin, s.subject);
    checkTaskAutoComplete(s.subject);
    const todayMin = todayTotalMinutes();
    if (todayMin >= 120 && todayMin - elapsedMin < 120) {
      toast(encouragementFor('twoHours'));
    } else {
      toast(encouragementFor('session', elapsedMin));
    }
  }
  render();
}
function startTicking() {
  stopTicking();
  tickHandle = setInterval(() => { renderTimerOnly(); }, 1000);
}
function stopTicking() {
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    if (state.timerSession) {
      // auto-finish if planned duration already elapsed while away
      const s = state.timerSession;
      if (!s.isPaused && elapsedMsOf(s) >= s.plannedMs && s.plannedMs > 0) {
        finishTimerSession(true);
      } else {
        startTicking();
        renderTimerOnly();
      }
    }
  }
});
window.addEventListener('focus', () => { if (state.timerSession) renderTimerOnly(); });

function checkTaskAutoComplete(subject) {
  if (!subject) return;
  const k = todayKey();
  const match = state.tasks.find(t => t.date === k && !t.done && t.subject === subject);
  // We don't auto-tick tasks (would be a guess) — left for Ibrahim to confirm manually.
}

/* local notification (best-effort; see sw.js comment on limits) */
function scheduleFinishNotification() {
  if (!state.settings.notifications || !state.timerSession) return;
  if (!('Notification' in window)) return;
  const s = state.timerSession;
  const msLeft = s.plannedMs - elapsedMsOf(s);
  if (msLeft <= 0) return;
  if (Notification.permission === 'granted') {
    setTimeout(() => {
      if (!state.timerSession) return;
      sendLocalNotification('انتهت جلسة التركيز 🎯', 'أحسنت! سجّل وقتك وابدأ الجلسة التالية.');
    }, msLeft);
  }
}
function sendLocalNotification(title, body) {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'notify', title, body });
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}
/* ===================== Lesson reminders (best-effort, page must be open) =====================
   We schedule one setTimeout per remaining lesson today, N minutes before its start time.
   Like all local-notification approaches in a plain web app, Android can throttle or kill
   these timers once the app/tab is fully closed for a while — this is a real platform limit,
   not a bug. Rescheduling on every app open/resume keeps today's reminders as accurate as
   a web app can get. */
let reminderTimeouts = [];
function clearLessonReminders() {
  reminderTimeouts.forEach(h => clearTimeout(h));
  reminderTimeouts = [];
}
function parseLessonTime(timeStr) {
  if (!timeStr) return null;
  const first = timeStr.split(/[–-]/)[0].trim();
  const m = first.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}
function scheduleLessonReminders() {
  clearLessonReminders();
  if (!state.settings.lessonReminders || !state.settings.notifications) return;
  const dayKey = jsDayToKey(new Date().getDay());
  const lessons = state.schedule[dayKey] || [];
  const leadMs = (state.settings.reminderMinutesBefore || 10) * 60000;
  const now = Date.now();
  lessons.forEach(lesson => {
    const t = parseLessonTime(lesson.time);
    if (!t) return;
    const lessonDate = new Date();
    lessonDate.setHours(t.h, t.m, 0, 0);
    const fireAt = lessonDate.getTime() - leadMs;
    const msUntilFire = fireAt - now;
    if (msUntilFire > 0 && msUntilFire < 24 * 3600 * 1000) {
      const handle = setTimeout(() => {
        sendLocalNotification('تذكير بحصة قريبة 📚', `حصة ${lesson.subject} الساعة ${lesson.time} — استعد الآن.`);
      }, msUntilFire);
      reminderTimeouts.push(handle);
    }
  });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleLessonReminders(); });

async function requestNotificationPermission() {
  if (!('Notification' in window)) { toast('الإشعارات غير مدعومة على هذا المتصفح'); return; }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') toast('تم تفعيل الإشعارات');
  else toast('لم يتم منح إذن الإشعارات');
  render();
}

/* ===================== Tasks ===================== */
function todaysTasks() {
  const k = todayKey();
  return state.tasks.filter(t => t.date === k).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}
function addTask(task) {
  state.tasks.push(Object.assign({
    id: uid(), date: todayKey(), subject: '', title: '', time: '', duration: 30,
    priority: 'متوسطة', done: false,
  }, task));
  saveState();
}
function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  if (t.done) {
    const prevXp = state.xp;
    state.xp += 5;
    toast(encouragementFor('task'));
    checkLevelUp(prevXp, state.xp);
  }
  saveState();
  render();
}
function deleteTask(id) {
  state.tasks = state.tasks.filter(x => x.id !== id);
  saveState();
  render();
}

/* auto-generate today's tasks from schedule (idempotent per day) */
function ensureTodayAutoTasks() {
  const k = todayKey();
  const already = state.tasks.some(t => t.date === k && t.auto);
  if (already) return;
  const dayKey = jsDayToKey(new Date().getDay());
  const lessons = state.schedule[dayKey] || [];
  lessons.forEach(lesson => {
    addTask({
      date: k, subject: lesson.subject, title: `مذاكرة ${lesson.subject}`,
      time: (lesson.time || '').split('–')[0].trim(), duration: 45, priority: 'عالية', auto: true,
    });
  });
  const gym = isGymDayToday();
  if (gym === 'gym') {
    addTask({ date: k, subject: 'الجيم', title: 'الجيم 🏋️', time: '', duration: 60, priority: 'متوسطة', auto: true });
  }
  const dueReviews = state.spacedReviews.filter(r => !r.done && r.dueDate === k);
  dueReviews.forEach(r => {
    addTask({ date: k, subject: r.subject, title: `مراجعة متباعدة: ${r.lessonName}`, time: '', duration: 20, priority: 'عالية', auto: true, reviewId: r.id });
  });
  saveState();
}

/* ===================== Spaced repetition ===================== */
function createSpacedReviewsForLesson(subject, lessonName) {
  const base = new Date();
  state.settings.reviewIntervalsDays.forEach(days => {
    const d = new Date(base); d.setDate(d.getDate() + days);
    state.spacedReviews.push({ id: uid(), subject, lessonName, dueDate: dateKey(d), done: false });
  });
  saveState();
}
function todaysReviews() {
  const k = todayKey();
  return state.spacedReviews.filter(r => r.dueDate === k && !r.done);
}
function completeReview(id) {
  const r = state.spacedReviews.find(x => x.id === id);
  if (r) { r.done = true; saveState(); render(); }
}

/* ===================== Question bank & exams ===================== */
function addQuestion(q) {
  state.questionBank.push(Object.assign({ id: uid(), subject: '', question: '', options: ['', '', '', ''], correctIndex: 0, level: 'متوسط', note: '' }, q));
  saveState();
}
function deleteQuestion(id) {
  state.questionBank = state.questionBank.filter(q => q.id !== id);
  saveState();
}
function questionsFor(subject) {
  return state.questionBank.filter(q => q.subject === subject);
}
function pickExamQuestions(subject, count) {
  const pool = questionsFor(subject).slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}
function recordExamResult(result) {
  state.exams.push(result);
  const prevXp = state.xp;
  state.xp += 15;
  result.wrongQuestionIds.forEach(qid => {
    if (!state.errorLog.some(e => e.questionId === qid)) {
      state.errorLog.push({ id: uid(), questionId: qid, date: todayKey(), subject: result.subject });
    }
  });
  saveState();
  checkLevelUp(prevXp, state.xp);
}
function removeFromErrorLog(entryId) {
  state.errorLog = state.errorLog.filter(e => e.id !== entryId);
  saveState();
}
function errorLogWithQuestions() {
  return state.errorLog
    .map(e => ({ entry: e, q: state.questionBank.find(q => q.id === e.questionId) }))
    .filter(x => x.q); // question may have been deleted from bank
}
function retryErrorLogExam() {
  const items = errorLogWithQuestions();
  if (items.length === 0) { toast('لا توجد أسئلة في سجل الأخطاء'); return; }
  const qs = items.map(x => x.q);
  examFlow = { stage: 'running', questions: qs, index: 0, answers: {}, subject: 'مراجعة الأخطاء', startedAt: Date.now(), plannedMs: 0, fromErrorLog: true };
  switchTab('exam');
}

/* ===================== IndexedDB — local PDF storage ===================== */
const DB_NAME = 'ibrahimFocusFiles';
let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('pdfs'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function savePdfBlob(bookId, file) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pdfs', 'readwrite');
    tx.objectStore('pdfs').put(file, bookId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function getPdfBlob(bookId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pdfs', 'readonly');
    const req = tx.objectStore('pdfs').get(bookId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function deletePdfBlob(bookId) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('pdfs', 'readwrite');
    tx.objectStore('pdfs').delete(bookId);
    tx.oncomplete = () => resolve(true);
  });
}

/* ===================== Navigation / render ===================== */
let activeTab = 'home';
let scheduleActiveDay = jsDayToKey(new Date().getDay());
let examFlow = null; // {questions, index, answers, subject}

function switchTab(tab) { activeTab = tab; render(); window.scrollTo(0, 0); }

function render() {
  ensureTodayAutoTasks();
  const app = $('#app');
  let body = '';
  if (activeTab === 'home') body = renderHome();
  else if (activeTab === 'schedule') body = renderSchedule();
  else if (activeTab === 'exam') body = renderExam();
  else if (activeTab === 'library') body = renderLibrary();
  else if (activeTab === 'more') body = renderMore();
  app.innerHTML = body + renderBottomNav();
  bindScreenEvents();
}
function renderTimerOnly() {
  const disp = $('#timerDisplay');
  if (!disp || !state.timerSession) return;
  const s = state.timerSession;
  const elapsed = elapsedMsOf(s);
  const remaining = s.plannedMs > 0 ? Math.max(0, s.plannedMs - elapsed) : elapsed;
  disp.textContent = fmtHMS(remaining / 1000);
  const sub = $('#timerSub');
  if (sub) sub.textContent = s.plannedMs > 0 ? 'الوقت المتبقي' : 'وقت مفتوح — بدون حد';
}

function renderBottomNav() {
  const tabs = [
    { id: 'home', icon: '🏠', label: 'الرئيسية' },
    { id: 'schedule', icon: '📅', label: 'الجدول' },
    { id: 'exam', icon: '📝', label: 'الامتحان' },
    { id: 'library', icon: '📚', label: 'المكتبة' },
    { id: 'more', icon: '⚙️', label: 'المزيد' },
  ];
  return `<div class="bottom-nav">
    ${tabs.map(t => `
      <button class="nav-btn ${activeTab === t.id ? 'active' : ''}" data-nav="${t.id}">
        <span class="icon">${t.icon}</span><span>${t.label}</span>
      </button>`).join('')}
  </div>`;
}

/* ---------------- HOME ---------------- */
function renderHome() {
  const s = state.timerSession;
  const todayMin = todayTotalMinutes();
  const garden = gardenStage(todayMin);
  const tasks = todaysTasks();
  const doneCount = tasks.filter(t => t.done).length;
  const hour = new Date().getHours();
  const greetWord = hour < 12 ? 'صباح التركيز' : hour < 18 ? 'مساء التركيز' : 'ليلة تركيز';

  return `
  <div class="screen">
    <div class="topbar">
      <div>
        <p class="greeting">${greetWord}، ${state.profileName}</p>
      </div>
      <div class="day-chip"><span class="num">${dayIndex()}</span><span class="lbl">يوم مذاكرة</span></div>
    </div>

    <div class="card card-green">
      <div class="msg-row">
        <div class="msg-icon">☀️</div>
        <div>
          <p class="msg-title">رسالتك اليوم</p>
          <p class="msg-text">${motivationForToday()}</p>
        </div>
      </div>
    </div>

    ${!isStandalone() ? `<button class="install-bar" id="installBtn">تثبيت إبراهيم فوكس على الشاشة الرئيسية <span>+</span></button>` : ''}

    <div class="card card-navy timer-card">
      <div class="timer-top">
        <span class="timer-pill">${s ? (s.isPaused ? 'الجلسة متوقفة مؤقتًا' : 'جلسة تركيز جارية') : 'جاهز لجلسة جديدة'}</span>
        <span class="timer-ring-btn">🎯</span>
      </div>
      <div class="timer-display" id="timerDisplay">${s ? fmtHMS(Math.max(0, (s.plannedMs - elapsedMsOf(s)) / 1000)) : '00:00:00'}</div>
      <div class="timer-sub" id="timerSub">${s ? 'الوقت المتبقي' : 'كل دقيقة هنا تقربك من هدفك'}</div>
      ${!s ? `
        <div class="timer-durations" id="durationPicker">
          ${[25, 30, 45, 50, 60, 90].map(d => `<span class="dur-chip ${d === 25 ? 'active' : ''}" data-dur="${d}">${d} د</span>`).join('')}
          <span class="dur-chip" data-dur="custom">مخصص</span>
        </div>
        <button class="btn-main" id="startTimerBtn">▶ ابدأ التركيز</button>
      ` : `
        <div class="timer-actions">
          ${s.isPaused
      ? `<button class="btn-main" id="resumeBtn">▶ استكمال</button>`
      : `<button class="btn-main btn-ghost-light" id="pauseBtn">⏸ إيقاف مؤقت</button>`}
          <button class="btn-main" id="finishBtn">✔ إنهاء</button>
        </div>
      `}
    </div>

    <div class="stats-row">
      <div class="stat-box"><div class="stat-num">${todayMin}</div><div class="stat-lbl">دقيقة اليوم</div></div>
      <div class="stat-box"><div class="stat-num">${(lifetimeMinutes() / 60).toFixed(1)}</div><div class="stat-lbl">ساعة إجمالي</div></div>
      <div class="stat-box"><div class="stat-num accent">${doneCount}/${tasks.length}</div><div class="stat-lbl">مهام منجزة</div></div>
    </div>

    <div class="card garden-card">
      <div>
        <p class="garden-eyebrow">حديقة إنجازك</p>
        <p class="garden-title">${garden.emoji ? garden.emoji + ' ' + garden.label : 'أرض جديدة تنتظر'}</p>
        <p class="garden-sub">${garden.next ? `ذاكر ${garden.next} دقيقة اليوم للمرحلة التالية` : 'أحسنت! أقصى مرحلة اليوم 🌳'}</p>
      </div>
      <div class="garden-plot">${garden.emoji || '🌱'}</div>
    </div>

    ${todaysReviews().length ? `
      <div class="card card-coral">
        <div class="msg-row">
          <div class="msg-icon">🧠</div>
          <div>
            <p class="msg-title">مراجعات مستحقة اليوم</p>
            <p class="msg-text">${todaysReviews().map(r => r.subject).join(' · ')}</p>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="section-head">
      <div><p class="section-eyebrow">قائمتك</p><p class="section-title">مهام اليوم</p></div>
      <button class="link-btn" id="addTaskBtn">+ إضافة مهمة</button>
    </div>
    ${tasks.length === 0 ? `<div class="empty-state"><span class="em-icon">🗒️</span>لا مهام اليوم بعد — أضف أول مهمة لك.</div>` :
      tasks.map(t => renderTaskRow(t)).join('')}

    <div class="distract-banner" data-nav="more">
      <div class="distract-icon">🛡️</div>
      <div class="distract-text">ابعد المشتتات — Focus Mode</div>
      <span>‹</span>
    </div>
  </div>`;
}
function renderTaskRow(t) {
  const pColor = t.priority === 'عالية' ? 'var(--danger)' : t.priority === 'منخفضة' ? 'var(--muted)' : 'var(--amber)';
  return `<div class="task-item">
    <div class="task-check ${t.done ? 'done' : ''}" data-toggle-task="${t.id}">${t.done ? '✓' : ''}</div>
    <div class="task-body">
      <p class="task-title ${t.done ? 'done' : ''}">${escapeHtml(t.title)}</p>
      <p class="task-meta">${escapeHtml(t.subject || '')} ${t.time ? '· ' + t.time : ''} · ${t.duration} د <span class="priority-dot" style="background:${pColor}"></span></p>
    </div>
    <button class="task-del" data-del-task="${t.id}">🗑</button>
  </div>`;
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- SCHEDULE ---------------- */
function renderSchedule() {
  const gym = isGymDayToday();
  const gymText = gym === 'gym' ? 'اليوم يوم جيم 🏋️' : gym === 'today-was-gym' ? 'ذهبت للجيم اليوم بالفعل ✅' : gym === 'rest' ? 'اليوم يوم راحة' : 'حدّد آخر يوم جيم من الإعدادات';
  const lessons = state.schedule[scheduleActiveDay] || [];
  return `
  <div class="screen">
    <div class="topbar">
      <div><p class="section-eyebrow">خطة الأسبوع</p><p class="section-title" style="margin:0;font-size:22px;">جدولك الدراسي</p></div>
      <button class="plus-btn" id="addLessonBtn">+</button>
    </div>

    <div class="card card-navy" style="padding:16px;">
      <p style="margin:0 0 10px;font-weight:800;">رتّب يومك قبل أن يبدأ</p>
      <p style="margin:0 0 14px;font-size:12.5px;opacity:.8;">حصص ثابتة، ووقتك بينها للمراجعة والإنجاز.</p>
      <div class="day-tabs" style="margin-bottom:0;">
        ${DAY_ORDER.map(d => `<div class="day-tab ${d === scheduleActiveDay ? 'active' : ''}" style="${d === scheduleActiveDay ? '' : 'background:rgba(255,255,255,.08);color:#fff;border-color:transparent;'}" data-day="${d}">${DAY_LABEL_SHORT[d]}</div>`).join('')}
      </div>
    </div>

    <div class="section-head" style="margin-top:6px;">
      <p class="section-title" style="font-size:16px;">حصص ${DAY_LABEL[scheduleActiveDay]}</p>
      <span class="link-btn" style="pointer-events:none;">تعديل الجدول</span>
    </div>

    ${lessons.length === 0 ? `<div class="empty-state"><span class="em-icon">📖</span>لا حصص في هذا اليوم.</div>` :
      lessons.map(l => `
      <div class="lesson-row">
        <div class="lesson-body">
          <p class="lesson-name">${escapeHtml(l.subject)}</p>
          <p class="lesson-time">${escapeHtml(l.time || '')}</p>
        </div>
        <button class="icon-btn" data-edit-lesson="${l.id}">✎</button>
        <button class="icon-btn" data-del-lesson="${l.id}">🗑</button>
      </div>`).join('')}

    <div class="card" style="display:flex;align-items:center;gap:12px;margin-top:10px;">
      <div class="msg-icon" style="background:var(--mint);color:var(--green-deep);">🏋️</div>
      <div style="flex:1;">
        <p style="margin:0;font-weight:800;font-size:14px;">الجيم يوم ويوم</p>
        <p style="margin:2px 0 0;font-size:12px;color:var(--muted);">${gymText}</p>
      </div>
      <button class="link-btn" id="setGymBtn">تحديث</button>
    </div>

    <div class="card" style="background:var(--purple);">
      <p style="margin:0;font-weight:800;font-size:14px;">الجمعة = مراجعة وامتحان</p>
      <p style="margin:6px 0 0;font-size:12.5px;color:var(--ink);opacity:.75;">راجع كل ما أخذته خلال الأسبوع ثم اختبر نفسك قبل أسبوع جديد.</p>
    </div>
  </div>`;
}

/* ---------------- EXAM ---------------- */
function renderExam() {
  if (examFlow && examFlow.stage === 'running') return renderExamRunning();
  if (examFlow && examFlow.stage === 'result') return renderExamResult();
  return renderExamBuilder();
}
let examBuilder = { subject: 'الكيمياء', count: 5, duration: 10, mode: 'normal' };
function renderExamBuilder() {
  const available = questionsFor(examBuilder.subject).length;
  return `
  <div class="screen">
    <p class="section-eyebrow" style="margin-top:6px;">اختبر نفسك</p>
    <p class="section-title">امتحان الجمعة</p>
    <p style="color:var(--muted);font-size:13px;margin:4px 0 16px;">اختر المادة وعدد الأسئلة والمدة، ثم ابدأ تحديك.</p>

    <div class="card card-coral" id="reviewExamCard" style="cursor:pointer;">
      <div class="msg-row">
        <div class="msg-icon">🏅</div>
        <div><p class="msg-title" style="margin:0;font-weight:800;">مراجعة متباعدة</p><p class="msg-text" style="opacity:.9;font-weight:600;">أسئلة قصيرة تثبّت المعلومات التي درستها خلال الأسبوع.</p></div>
      </div>
    </div>

    <label>المادة</label>
    <div class="chip-row" id="subjectChips">
      ${SUBJECTS.map(s => `<span class="chip ${examBuilder.subject === s ? 'active' : ''}" data-subject="${s}">${s}</span>`).join('')}
    </div>

    <label>عدد الأسئلة</label>
    <div class="chip-row" id="countChips">
      ${[3, 5, 10].map(c => `<span class="chip ${examBuilder.count === c ? 'active navy' : ''}" data-count="${c}">${c} سؤال</span>`).join('')}
    </div>

    <label>مدة الامتحان</label>
    <div class="chip-row" id="durChips">
      ${[5, 10, 20].map(c => `<span class="chip ${examBuilder.duration === c ? 'active navy' : ''}" data-examdur="${c}">${c} دقيقة</span>`).join('')}
    </div>

    <p style="font-size:12px;color:var(--muted);margin:0 0 14px;">
      ${available > 0 ? `يوجد ${available} سؤال محفوظ في بنك الأسئلة لمادة ${examBuilder.subject}.` : `لا توجد أسئلة محفوظة بعد لمادة ${examBuilder.subject} — أضفها من بنك الأسئلة قبل البدء (لا نخترع أسئلة).`}
    </p>

    <button class="btn-primary" id="startExamBtn" ${available === 0 ? 'disabled style="opacity:.5;"' : ''}>▶ ابدأ الامتحان</button>

    <div class="section-head"><p class="section-title" style="font-size:16px;">بنك الأسئلة</p>
      <button class="link-btn" id="addQuestionBtn">+ إضافة سؤال</button>
    </div>
    ${state.questionBank.length === 0 ? `<div class="empty-state"><span class="em-icon">🧠</span>أضف أسئلتك بنفسك من كتبك — لن نخترع أي سؤال.</div>` :
      state.questionBank.slice().reverse().map(q => `
      <div class="lesson-row">
        <div class="lesson-body">
          <p class="lesson-name">${escapeHtml(q.question)}</p>
          <p class="lesson-time">${escapeHtml(q.subject)} · ${escapeHtml(q.level)}</p>
        </div>
        <button class="icon-btn" data-del-q="${q.id}">🗑</button>
      </div>`).join('')}

    <div class="section-head"><p class="section-title" style="font-size:16px;">سجل الأخطاء</p></div>
    ${(() => {
      const items = errorLogWithQuestions();
      if (items.length === 0) return `<div class="empty-state"><span class="em-icon">✅</span>لا أخطاء محفوظة الآن — كل الأسئلة اللي حليتها صح.</div>`;
      return `
      <div class="card card-navy" style="display:flex;align-items:center;gap:12px;">
        <div class="msg-icon">❌</div>
        <div style="flex:1;">
          <p style="margin:0;font-weight:800;">${items.length} سؤال يحتاج مراجعة</p>
          <p style="margin:4px 0 0;font-size:12px;opacity:.8;">أعد المحاولة فيهم الآن لتثبيت المعلومة.</p>
        </div>
        <button class="link-btn" style="color:var(--amber);" id="retryErrorLogBtn">ابدأ</button>
      </div>
      ${items.map(x => `
        <div class="lesson-row">
          <div class="lesson-body">
            <p class="lesson-name">${escapeHtml(x.q.question)}</p>
            <p class="lesson-time">${escapeHtml(x.q.subject)} · ${escapeHtml(x.entry.date)}</p>
          </div>
          <button class="icon-btn" data-del-error="${x.entry.id}">🗑</button>
        </div>`).join('')}`;
    })()}
  </div>`;
}
function renderExamRunning() {
  const { questions, index, answers } = examFlow;
  const q = questions[index];
  return `
  <div class="screen">
    <p class="q-progress">سؤال ${index + 1} من ${questions.length}</p>
    <p class="q-text">${escapeHtml(q.question)}</p>
    ${q.options.map((opt, i) => `
      <button class="option-btn ${answers[index] === i ? 'selected' : ''}" data-answer="${i}">${escapeHtml(opt)}</button>
    `).join('')}
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn-secondary" id="prevQBtn" ${index === 0 ? 'style="opacity:.4;pointer-events:none;"' : ''}>السابق</button>
      ${index === questions.length - 1
      ? `<button class="btn-primary" id="finishExamBtn">إنهاء الامتحان</button>`
      : `<button class="btn-primary" id="nextQBtn">التالي</button>`}
    </div>
  </div>`;
}
function renderExamResult() {
  const r = examFlow.result;
  return `
  <div class="screen">
    <div class="result-big">
      <div class="result-num">${r.percentage}%</div>
      <div class="result-lbl">${r.correct} صحيح من ${r.total}</div>
    </div>
    <div class="stats-row">
      <div class="stat-box"><div class="stat-num">${r.correct}</div><div class="stat-lbl">إجابات صحيحة</div></div>
      <div class="stat-box"><div class="stat-num">${r.wrong}</div><div class="stat-lbl">إجابات خاطئة</div></div>
      <div class="stat-box"><div class="stat-num">${r.timeTakenLabel}</div><div class="stat-lbl">وقت الحل</div></div>
    </div>
    <button class="btn-primary" id="backToExamBtn">امتحان جديد</button>
  </div>`;
}

/* ---------------- LIBRARY ---------------- */
function renderLibrary() {
  const filter = libraryFilter || 'الكل';
  const cats = ['الكل', ...SUBJECTS];
  const books = filter === 'الكل' ? state.books : state.books.filter(b => b.subject === filter);
  return `
  <div class="screen">
    <div class="topbar">
      <div><p class="section-eyebrow">كل أدواتك في مكان واحد</p><p class="section-title" style="margin:0;font-size:22px;">مكتبة الكتب</p></div>
      <button class="plus-btn" id="addBookBtn">+</button>
    </div>
    <div class="card card-navy" style="padding:16px;">
      <div class="msg-row">
        <div class="msg-icon">📖</div>
        <div><p class="msg-title" style="margin:0;font-weight:800;">كتب الحل والمراجعة</p><p class="msg-text" style="opacity:.85;">أرفق ملفات PDF من هاتفك لتعمل معك بدون إنترنت.</p></div>
      </div>
    </div>
    <div class="chip-row">
      ${cats.map(c => `<span class="chip ${filter === c ? 'active' : ''}" data-libfilter="${c}">${c}</span>`).join('')}
    </div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 10px;">${books.length} كتب محفوظة</p>
    ${books.map(b => renderBookCard(b)).join('')}
  </div>`;
}
let libraryFilter = 'الكل';
function renderBookCard(b) {
  return `<div class="book-card">
    <div class="book-thumb">📘</div>
    <div class="book-body">
      <p class="book-name">${escapeHtml(b.name)}</p>
      <span class="book-tag">${escapeHtml(b.subject)}</span>
      <span class="book-meta">${escapeHtml(b.term)} · ${escapeHtml(b.year)}</span>
      <p class="book-meta" style="margin-top:4px;">${b.fileMeta ? `📎 ${escapeHtml(b.fileMeta.name)} (${(b.fileMeta.size / (1024 * 1024)).toFixed(1)}MB)` : 'لا يوجد ملف مرفق بعد'}</p>
    </div>
    <div class="book-actions">
      <button class="icon-btn" data-attach-book="${b.id}">📎</button>
      ${b.fileMeta ? `<button class="icon-btn" data-open-book="${b.id}">👁</button>` : ''}
      <button class="icon-btn" data-del-book="${b.id}">🗑</button>
    </div>
  </div>`;
}

/* ---------------- MORE / SETTINGS ---------------- */
function renderMore() {
  const s = state.settings;
  return `
  <div class="screen">
    <p class="section-eyebrow" style="margin-top:6px;">هدفك</p>
    <p class="section-title">${state.goal}</p>
    <div class="card card-navy" style="text-align:center;padding:22px 16px;">
      <p style="font-size:14px;margin:0 0 6px;opacity:.85;">🎯 الهدف</p>
      <p style="font-size:20px;font-weight:800;margin:0 0 10px;">${state.goal}</p>
      <p style="font-size:13px;opacity:.8;margin:0;">كل يوم تذاكر فيه، أنت أقرب لهدفك.</p>
    </div>

    ${(() => {
      const info = levelInfo(state.xp);
      return `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div>
            <p style="margin:0;font-size:12px;color:var(--muted);font-weight:700;">المستوى ${info.level}</p>
            <p style="margin:2px 0 0;font-size:16px;font-weight:800;">${info.title}</p>
          </div>
          <div style="width:46px;height:46px;border-radius:50%;background:var(--mint);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:var(--green-deep);flex-shrink:0;">${info.level}</div>
        </div>
        <div style="height:8px;border-radius:6px;background:var(--line);overflow:hidden;">
          <div style="height:100%;width:${info.progressPct}%;background:var(--amber);border-radius:6px;"></div>
        </div>
        <p style="margin:8px 0 0;font-size:11.5px;color:var(--muted);">${info.next ? `${info.xpToNext} XP للمستوى التالي (${info.next.title})` : 'وصلت لأعلى مستوى — استمر! 🏆'}</p>
      </div>`;
    })()}

    <div class="section-head"><p class="section-title" style="font-size:16px;">Focus Mode</p></div>
    <div class="card">
      <div class="switch-row">
        <span class="switch-label">🛡️ تفعيل وضع التركيز</span>
        <div class="switch ${focusModeOn() ? 'on' : ''}" id="focusModeSwitch"><div class="knob"></div></div>
      </div>
      <p style="font-size:12px;color:var(--muted);margin:10px 2px 0;line-height:1.7;">
        يمنعك من فتح التطبيقات التي تختارها بينما المؤقت شغّال، ولا يمكن إيقافه إلا بكلمة السر.
        ملاحظة مهمة: متصفح الويب لا يقدر يمنع تطبيقات أخرى على مستوى النظام فعليًا — هذا يحتاج تطبيق Android حقيقي بصلاحيات خاصة. هنا نقفل واجهة التطبيق نفسه ونذكّرك بكلمة السر كخط دفاع بسيط.
      </p>
      <button class="link-btn" id="setFocusPasswordBtn" style="margin-top:10px;padding:0;">${s.focusPasswordHash ? 'تغيير كلمة سر Focus' : 'إنشاء كلمة سر Focus'}</button>
    </div>
    <div class="card">
      <p style="margin:0 0 8px;font-weight:800;font-size:14px;">التطبيقات المشتتة</p>
      <div class="chip-row" id="blockedAppsChips">
        ${['TikTok', 'Instagram', 'Facebook', 'YouTube', 'الألعاب', 'Telegram'].map(a => `<span class="chip ${s.blockedApps.includes(a) ? 'active' : ''}" data-blockapp="${a}">${a}</span>`).join('')}
      </div>
    </div>

    <div class="section-head"><p class="section-title" style="font-size:16px;">الإحصائيات</p></div>
    <div class="card">
      <div class="switch-row"><span class="switch-label">أسبوع (دقيقة)</span><b>${weekTotalMinutes()}</b></div>
      <div class="switch-row"><span class="switch-label">شهر (دقيقة)</span><b>${monthTotalMinutes()}</b></div>
      <div class="switch-row"><span class="switch-label">Streak (أيام متتالية)</span><b>🔥 ${studyStreak()}</b></div>
      <div class="switch-row"><span class="switch-label">أيام مذاكرة إجمالي</span><b>${studyDaysCount()}</b></div>
      <div class="switch-row" style="border-bottom:none;"><span class="switch-label">XP</span><b>${state.xp}</b></div>
    </div>

    <div class="section-head"><p class="section-title" style="font-size:16px;">الإعدادات</p></div>
    <div class="card">
      <div class="switch-row">
        <span class="switch-label">🌙 الوضع الليلي</span>
        <div class="switch ${s.darkMode ? 'on' : ''}" id="darkModeSwitch"><div class="knob"></div></div>
      </div>
      <div class="switch-row" style="border-bottom:none;">
        <span class="switch-label">🔔 الإشعارات</span>
        <div class="switch ${s.notifications ? 'on' : ''}" id="notifSwitch"><div class="knob"></div></div>
      </div>
      <p style="font-size:11.5px;color:var(--muted);margin:8px 2px 0;line-height:1.7;">
        ملاحظة: الإشعارات تصلك محليًا طالما الجهاز يبقي التطبيق يعمل في الخلفية. أندرويد قد يوقف ذلك بعد إغلاق التطبيق تمامًا لفترة طويلة — هذا قيد حقيقي لأي تطبيق ويب وليس خطأ.
      </p>
      <div class="switch-row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:14px;">
        <span class="switch-label">⏰ تذكير قبل كل حصة</span>
        <div class="switch ${s.lessonReminders ? 'on' : ''}" id="lessonRemindersSwitch"><div class="knob"></div></div>
      </div>
      ${s.lessonReminders ? `
      <div class="field" style="margin-top:8px;">
        <label>كام دقيقة قبل الحصة</label>
        <input type="number" id="reminderMinutesInput" value="${s.reminderMinutesBefore}" min="1" max="60">
      </div>` : ''}
    </div>
    <div class="card">
      <label>الهدف اليومي (دقيقة)</label>
      <input type="number" id="dailyGoalInput" value="${state.dailyGoalMinutes}">
      <label>الهدف الأسبوعي (دقيقة)</label>
      <input type="number" id="weeklyGoalInput" value="${state.weeklyGoalMinutes}">
      <button class="btn-secondary" id="saveGoalsBtn">حفظ الأهداف</button>
    </div>
    <div class="card">
      <button class="btn-secondary" id="exportBtn">⬇ تصدير نسخة احتياطية</button>
      <div style="height:10px;"></div>
      <label>استيراد نسخة احتياطية</label>
      <input type="file" id="importInput" accept="application/json">
    </div>
    <div class="card">
      <button class="btn-secondary" id="resetBtn" style="color:var(--danger);">حذف جميع البيانات</button>
    </div>
    <p style="text-align:center;font-size:11px;color:var(--muted);margin:10px 0 20px;">Ibrahim Focus 🌱💊 — Study Today, Pharmacy Tomorrow</p>
  </div>`;
}
function focusModeOn() { return !!(state.timerSession && state.settings.focusModeActive); }

/* ===================== Modal sheet helper ===================== */
function showSheet(title, innerHtml, onMount) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="sheet-overlay" id="sheetOverlay">
      <div class="sheet" id="sheetBody">
        <div class="sheet-handle"></div>
        <p class="sheet-title">${title}</p>
        ${innerHtml}
      </div>
    </div>`;
  $('#sheetOverlay').addEventListener('click', (e) => { if (e.target.id === 'sheetOverlay') closeSheet(); });
  if (onMount) onMount();
}
function closeSheet() { $('#modalRoot').innerHTML = ''; }

/* ===================== Password hashing (Focus Mode) ===================== */
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ===================== Event binding ===================== */
function bindScreenEvents() {
  $$('[data-nav]').forEach(el => el.addEventListener('click', () => switchTab(el.dataset.nav)));

  /* ---- HOME ---- */
  const installBtn = $('#installBtn');
  if (installBtn) installBtn.addEventListener('click', triggerInstall);

  $$('#durationPicker .dur-chip').forEach(chip => chip.addEventListener('click', () => {
    if (chip.dataset.dur === 'custom') {
      showSheet('مدة مخصصة', `
        <div class="field"><label>عدد الدقائق</label><input type="number" id="customDurInput" placeholder="مثال: 40"></div>
        <button class="btn-primary" id="customDurConfirm">ابدأ</button>
      `, () => {
        $('#customDurConfirm').addEventListener('click', () => {
          const v = parseInt($('#customDurInput').value, 10);
          if (v > 0) { startTimerSession(v, currentSubjectGuess()); closeSheet(); render(); }
        });
      });
    } else {
      $$('#durationPicker .dur-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedDuration = parseInt(chip.dataset.dur, 10);
    }
  }));
  const startBtn = $('#startTimerBtn');
  if (startBtn) startBtn.addEventListener('click', () => { startTimerSession(selectedDuration || 25, currentSubjectGuess()); render(); });
  const pauseBtn = $('#pauseBtn'); if (pauseBtn) pauseBtn.addEventListener('click', () => { pauseTimerSession(); render(); });
  const resumeBtn = $('#resumeBtn'); if (resumeBtn) resumeBtn.addEventListener('click', () => { resumeTimerSession(); render(); });
  const finishBtn = $('#finishBtn'); if (finishBtn) finishBtn.addEventListener('click', () => finishTimerSession(false));
  if (state.timerSession) startTicking(); else stopTicking();

  $$('[data-toggle-task]').forEach(el => el.addEventListener('click', () => toggleTask(el.dataset.toggleTask)));
  $$('[data-del-task]').forEach(el => el.addEventListener('click', () => deleteTask(el.dataset.delTask)));
  const addTaskBtn = $('#addTaskBtn'); if (addTaskBtn) addTaskBtn.addEventListener('click', openAddTaskSheet);

  /* ---- SCHEDULE ---- */
  $$('[data-day]').forEach(el => el.addEventListener('click', () => { scheduleActiveDay = el.dataset.day; render(); }));
  const addLessonBtn = $('#addLessonBtn'); if (addLessonBtn) addLessonBtn.addEventListener('click', () => openLessonSheet(null));
  $$('[data-edit-lesson]').forEach(el => el.addEventListener('click', () => openLessonSheet(el.dataset.editLesson)));
  $$('[data-del-lesson]').forEach(el => el.addEventListener('click', () => {
    state.schedule[scheduleActiveDay] = state.schedule[scheduleActiveDay].filter(l => l.id !== el.dataset.delLesson);
    saveState(); render(); scheduleLessonReminders();
  }));
  const setGymBtn = $('#setGymBtn'); if (setGymBtn) setGymBtn.addEventListener('click', openGymSheet);

  /* ---- EXAM ---- */
  $$('[data-subject]').forEach(el => el.addEventListener('click', () => { examBuilder.subject = el.dataset.subject; render(); }));
  $$('[data-count]').forEach(el => el.addEventListener('click', () => { examBuilder.count = parseInt(el.dataset.count, 10); render(); }));
  $$('[data-examdur]').forEach(el => el.addEventListener('click', () => { examBuilder.duration = parseInt(el.dataset.examdur, 10); render(); }));
  const startExamBtn = $('#startExamBtn'); if (startExamBtn) startExamBtn.addEventListener('click', beginExam);
  const addQBtn = $('#addQuestionBtn'); if (addQBtn) addQBtn.addEventListener('click', openAddQuestionSheet);
  $$('[data-del-q]').forEach(el => el.addEventListener('click', () => { deleteQuestion(el.dataset.delQ); render(); }));
  const retryErrBtn = $('#retryErrorLogBtn'); if (retryErrBtn) retryErrBtn.addEventListener('click', retryErrorLogExam);
  $$('[data-del-error]').forEach(el => el.addEventListener('click', () => { removeFromErrorLog(el.dataset.delError); render(); }));
  $$('[data-answer]').forEach(el => el.addEventListener('click', () => {
    examFlow.answers[examFlow.index] = parseInt(el.dataset.answer, 10);
    render();
  }));
  const nextQBtn = $('#nextQBtn'); if (nextQBtn) nextQBtn.addEventListener('click', () => { examFlow.index++; render(); });
  const prevQBtn = $('#prevQBtn'); if (prevQBtn) prevQBtn.addEventListener('click', () => { examFlow.index--; render(); });
  const finishExamBtn = $('#finishExamBtn'); if (finishExamBtn) finishExamBtn.addEventListener('click', finishExam);
  const backToExamBtn = $('#backToExamBtn'); if (backToExamBtn) backToExamBtn.addEventListener('click', () => { examFlow = null; render(); });

  /* ---- LIBRARY ---- */
  $$('[data-libfilter]').forEach(el => el.addEventListener('click', () => { libraryFilter = el.dataset.libfilter; render(); }));
  const addBookBtn = $('#addBookBtn'); if (addBookBtn) addBookBtn.addEventListener('click', openAddBookSheet);
  $$('[data-attach-book]').forEach(el => el.addEventListener('click', () => attachBookPdf(el.dataset.attachBook)));
  $$('[data-open-book]').forEach(el => el.addEventListener('click', () => openBookPdf(el.dataset.openBook)));
  $$('[data-del-book]').forEach(el => el.addEventListener('click', async () => {
    const id = el.dataset.delBook;
    state.books = state.books.filter(b => b.id !== id);
    await deletePdfBlob(id);
    saveState(); render();
  }));

  /* ---- MORE ---- */
  const focusSwitch = $('#focusModeSwitch');
  if (focusSwitch) focusSwitch.addEventListener('click', toggleFocusMode);
  $$('[data-blockapp]').forEach(el => el.addEventListener('click', () => {
    const a = el.dataset.blockapp;
    const list = state.settings.blockedApps;
    const i = list.indexOf(a);
    if (i >= 0) list.splice(i, 1); else list.push(a);
    saveState(); render();
  }));
  const setFocusPwBtn = $('#setFocusPasswordBtn'); if (setFocusPwBtn) setFocusPwBtn.addEventListener('click', openFocusPasswordSheet);
  const darkSwitch = $('#darkModeSwitch');
  if (darkSwitch) darkSwitch.addEventListener('click', () => {
    state.settings.darkMode = !state.settings.darkMode;
    applyDarkMode(); saveState(); render();
  });
  const notifSwitch = $('#notifSwitch');
  if (notifSwitch) notifSwitch.addEventListener('click', async () => {
    state.settings.notifications = !state.settings.notifications;
    saveState();
    if (state.settings.notifications) await requestNotificationPermission();
    render(); scheduleLessonReminders();
  });
  const lessonRemindersSwitch = $('#lessonRemindersSwitch');
  if (lessonRemindersSwitch) lessonRemindersSwitch.addEventListener('click', async () => {
    state.settings.lessonReminders = !state.settings.lessonReminders;
    saveState();
    if (state.settings.lessonReminders && state.settings.notifications) await requestNotificationPermission();
    render(); scheduleLessonReminders();
  });
  const reminderMinutesInput = $('#reminderMinutesInput');
  if (reminderMinutesInput) reminderMinutesInput.addEventListener('change', () => {
    state.settings.reminderMinutesBefore = parseInt(reminderMinutesInput.value, 10) || 10;
    saveState(); scheduleLessonReminders();
  });
  const saveGoalsBtn = $('#saveGoalsBtn');
  if (saveGoalsBtn) saveGoalsBtn.addEventListener('click', () => {
    state.dailyGoalMinutes = parseInt($('#dailyGoalInput').value, 10) || state.dailyGoalMinutes;
    state.weeklyGoalMinutes = parseInt($('#weeklyGoalInput').value, 10) || state.weeklyGoalMinutes;
    saveState(); toast('تم حفظ الأهداف');
  });
  const exportBtn = $('#exportBtn'); if (exportBtn) exportBtn.addEventListener('click', exportBackup);
  const importInput = $('#importInput'); if (importInput) importInput.addEventListener('change', importBackup);
  const resetBtn = $('#resetBtn'); if (resetBtn) resetBtn.addEventListener('click', () => {
    showSheet('تأكيد الحذف', `
      <p style="font-size:14px;margin-bottom:16px;">سيتم حذف كل بياناتك نهائيًا. هل أنت متأكد؟</p>
      <button class="btn-primary" style="background:var(--danger);" id="confirmResetBtn">نعم، احذف كل شيء</button>
      <div style="height:8px;"></div>
      <button class="btn-secondary" id="cancelResetBtn">إلغاء</button>
    `, () => {
      $('#confirmResetBtn').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); location.reload(); });
      $('#cancelResetBtn').addEventListener('click', closeSheet);
    });
  });
}
let selectedDuration = 25;
function currentSubjectGuess() {
  const dayKey = jsDayToKey(new Date().getDay());
  const lessons = state.schedule[dayKey] || [];
  return lessons[0] ? lessons[0].subject : null;
}

/* ===================== Sheets: forms ===================== */
function openAddTaskSheet() {
  showSheet('إضافة مهمة', `
    <div class="field"><label>اسم المهمة</label><input id="tTitle" placeholder="مثال: حل أسئلة الفيزياء"></div>
    <div class="field"><label>المادة</label>
      <div class="chip-row" id="tSubjectChips">${SUBJECTS.concat(['أخرى']).map(s => `<span class="chip" data-tsub="${s}">${s}</span>`).join('')}</div>
    </div>
    <div class="field"><label>الوقت (اختياري)</label><input id="tTime" type="time"></div>
    <div class="field"><label>المدة (دقيقة)</label><input id="tDuration" type="number" value="30"></div>
    <div class="field"><label>الأولوية</label>
      <div class="chip-row" id="tPriorityChips">${['عالية', 'متوسطة', 'منخفضة'].map(p => `<span class="chip ${p === 'متوسطة' ? 'active' : ''}" data-tprio="${p}">${p}</span>`).join('')}</div>
    </div>
    <button class="btn-primary" id="saveTaskBtn">حفظ المهمة</button>
  `, () => {
    let subj = ''; let prio = 'متوسطة';
    $$('#tSubjectChips .chip').forEach(c => c.addEventListener('click', () => { $$('#tSubjectChips .chip').forEach(x => x.classList.remove('active')); c.classList.add('active'); subj = c.dataset.tsub; }));
    $$('#tPriorityChips .chip').forEach(c => c.addEventListener('click', () => { $$('#tPriorityChips .chip').forEach(x => x.classList.remove('active')); c.classList.add('active'); prio = c.dataset.tprio; }));
    $('#saveTaskBtn').addEventListener('click', () => {
      const title = $('#tTitle').value.trim();
      if (!title) { toast('اكتب اسم المهمة أولًا'); return; }
      addTask({ title, subject: subj, time: $('#tTime').value, duration: parseInt($('#tDuration').value, 10) || 30, priority: prio });
      closeSheet(); render();
    });
  });
}

function openLessonSheet(lessonId) {
  const lessons = state.schedule[scheduleActiveDay] || [];
  const existing = lessonId ? lessons.find(l => l.id === lessonId) : null;
  showSheet(existing ? 'تعديل الحصة' : `إضافة حصة — ${DAY_LABEL[scheduleActiveDay]}`, `
    <div class="field"><label>المادة</label><input id="lSubject" value="${existing ? escapeHtml(existing.subject) : ''}" placeholder="مثال: كيمياء"></div>
    <div class="field"><label>الوقت</label><input id="lTime" value="${existing ? escapeHtml(existing.time) : ''}" placeholder="مثال: 15:00 أو 12:30–14:30"></div>
    <button class="btn-primary" id="saveLessonBtn">حفظ</button>
  `, () => {
    $('#saveLessonBtn').addEventListener('click', () => {
      const subject = $('#lSubject').value.trim();
      const time = $('#lTime').value.trim();
      if (!subject) { toast('اكتب اسم المادة'); return; }
      if (!state.schedule[scheduleActiveDay]) state.schedule[scheduleActiveDay] = [];
      if (existing) { existing.subject = subject; existing.time = time; }
      else { state.schedule[scheduleActiveDay].push({ id: uid(), subject, time }); }
      saveState(); closeSheet(); render(); scheduleLessonReminders();
    });
  });
}

function openGymSheet() {
  showSheet('تحديث موعد الجيم', `
    <div class="field"><label>آخر يوم ذهبت فيه للجيم</label><input id="gymDateInput" type="date" value="${state.gymLast || todayKey()}"></div>
    <button class="btn-primary" id="saveGymBtn">حفظ</button>
  `, () => {
    $('#saveGymBtn').addEventListener('click', () => {
      state.gymLast = $('#gymDateInput').value || todayKey();
      saveState(); closeSheet(); render();
    });
  });
}

function openAddQuestionSheet() {
  showSheet('إضافة سؤال لبنك الأسئلة', `
    <div class="field"><label>المادة</label>
      <div class="chip-row" id="qSubjectChips">${SUBJECTS.map(s => `<span class="chip ${s === examBuilder.subject ? 'active' : ''}" data-qsub="${s}">${s}</span>`).join('')}</div>
    </div>
    <div class="field"><label>نص السؤال</label><textarea id="qText" rows="2"></textarea></div>
    <div class="field"><label>الاختيار 1</label><input id="qOpt0"></div>
    <div class="field"><label>الاختيار 2</label><input id="qOpt1"></div>
    <div class="field"><label>الاختيار 3</label><input id="qOpt2"></div>
    <div class="field"><label>الاختيار 4</label><input id="qOpt3"></div>
    <div class="field"><label>رقم الاختيار الصحيح (1-4)</label><input id="qCorrect" type="number" min="1" max="4" value="1"></div>
    <button class="btn-primary" id="saveQBtn">حفظ السؤال</button>
  `, () => {
    let subj = examBuilder.subject;
    $$('#qSubjectChips .chip').forEach(c => c.addEventListener('click', () => { $$('#qSubjectChips .chip').forEach(x => x.classList.remove('active')); c.classList.add('active'); subj = c.dataset.qsub; }));
    $('#saveQBtn').addEventListener('click', () => {
      const question = $('#qText').value.trim();
      const options = [$('#qOpt0').value.trim(), $('#qOpt1').value.trim(), $('#qOpt2').value.trim(), $('#qOpt3').value.trim()];
      const correctIndex = (parseInt($('#qCorrect').value, 10) || 1) - 1;
      if (!question || options.some(o => !o)) { toast('أكمل السؤال والاختيارات الأربعة'); return; }
      addQuestion({ subject: subj, question, options, correctIndex });
      closeSheet(); render();
    });
  });
}

function openAddBookSheet() {
  showSheet('إضافة كتاب', `
    <div class="field"><label>اسم الكتاب</label><input id="bName"></div>
    <div class="field"><label>المادة</label>
      <div class="chip-row" id="bSubjectChips">${SUBJECTS.map(s => `<span class="chip" data-bsub="${s}">${s}</span>`).join('')}</div>
    </div>
    <div class="field"><label>الترم / الجزء</label><input id="bTerm" placeholder="مثال: الترم الأول"></div>
    <div class="field"><label>السنة</label><input id="bYear" placeholder="مثال: 2027"></div>
    <button class="btn-primary" id="saveBookBtn">حفظ الكتاب</button>
  `, () => {
    let subj = '';
    $$('#bSubjectChips .chip').forEach(c => c.addEventListener('click', () => { $$('#bSubjectChips .chip').forEach(x => x.classList.remove('active')); c.classList.add('active'); subj = c.dataset.bsub; }));
    $('#saveBookBtn').addEventListener('click', () => {
      const name = $('#bName').value.trim();
      if (!name || !subj) { toast('اكتب اسم الكتاب واختر المادة'); return; }
      state.books.push({ id: uid(), name, subject: subj, term: $('#bTerm').value.trim(), year: $('#bYear').value.trim(), fileMeta: null });
      saveState(); closeSheet(); render();
    });
  });
}

function attachBookPdf(bookId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/pdf';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    await savePdfBlob(bookId, file);
    const book = state.books.find(b => b.id === bookId);
    book.fileMeta = { name: file.name, size: file.size };
    saveState(); render();
    toast('تم حفظ الملف — يعمل الآن بدون إنترنت');
  };
  input.click();
}
async function openBookPdf(bookId) {
  const blob = await getPdfBlob(bookId);
  if (!blob) { toast('الملف غير موجود'); return; }
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function openFocusPasswordSheet() {
  showSheet(state.settings.focusPasswordHash ? 'تغيير كلمة سر Focus' : 'إنشاء كلمة سر Focus', `
    <div class="field"><label>كلمة السر الجديدة</label><input id="pw1" type="password"></div>
    <div class="field"><label>تأكيد كلمة السر</label><input id="pw2" type="password"></div>
    <button class="btn-primary" id="savePwBtn">حفظ</button>
  `, () => {
    $('#savePwBtn').addEventListener('click', async () => {
      const p1 = $('#pw1').value, p2 = $('#pw2').value;
      if (!p1 || p1.length < 4) { toast('اكتب كلمة سر من 4 أحرف على الأقل'); return; }
      if (p1 !== p2) { toast('كلمتا السر غير متطابقتين'); return; }
      state.settings.focusPasswordHash = await sha256(p1);
      saveState(); closeSheet(); toast('تم حفظ كلمة السر');
    });
  });
}

function toggleFocusMode() {
  if (focusModeOn()) {
    if (!state.settings.focusPasswordHash) { state.settings.focusModeActive = false; saveState(); render(); return; }
    showSheet('إدخال كلمة السر لإيقاف Focus Mode', `
      <div class="field"><input id="pwCheck" type="password" placeholder="كلمة السر"></div>
      <button class="btn-primary" id="checkPwBtn">تأكيد</button>
    `, () => {
      $('#checkPwBtn').addEventListener('click', async () => {
        const hash = await sha256($('#pwCheck').value);
        if (hash === state.settings.focusPasswordHash) {
          state.settings.focusModeActive = false; saveState(); closeSheet(); render();
        } else toast('كلمة السر غير صحيحة');
      });
    });
  } else {
    state.settings.focusModeActive = true; saveState(); render();
    toast('تم تفعيل Focus Mode 🛡️');
  }
}

/* ===================== Exam flow ===================== */
function beginExam() {
  const qs = pickExamQuestions(examBuilder.subject, examBuilder.count);
  if (qs.length === 0) { toast('أضف أسئلة أولًا'); return; }
  examFlow = { stage: 'running', questions: qs, index: 0, answers: {}, subject: examBuilder.subject, startedAt: Date.now(), plannedMs: examBuilder.duration * 60000 };
  render();
}
function finishExam() {
  const { questions, answers, startedAt, fromErrorLog } = examFlow;
  let correct = 0; const wrongQuestionIds = [];
  questions.forEach((q, i) => { if (answers[i] === q.correctIndex) correct++; else wrongQuestionIds.push(q.id); });
  const total = questions.length;
  const wrong = total - correct;
  const percentage = Math.round((correct / total) * 100);
  const secs = Math.round((Date.now() - startedAt) / 1000);
  const result = {
    id: uid(), subject: examFlow.subject, total, correct, wrong, percentage,
    date: todayKey(), timeTakenSeconds: secs, timeTakenLabel: fmtHMS(secs), wrongQuestionIds,
  };
  if (fromErrorLog) {
    // answered correctly this time -> clear from error log; still wrong -> stays logged
    questions.forEach((q, i) => {
      if (answers[i] === q.correctIndex) {
        state.errorLog = state.errorLog.filter(e => e.questionId !== q.id);
      }
    });
    state.xp += 10;
    saveState();
  } else {
    recordExamResult(result);
  }
  examFlow = { stage: 'result', result };
  render();
}

/* ===================== Backup / restore ===================== */
function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `ibrahim-focus-backup-${todayKey()}.json`;
  a.click();
}
function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = Object.assign(defaultState(), parsed);
      saveState(); applyDarkMode(); render();
      toast('تم استيراد النسخة الاحتياطية');
    } catch (err) { toast('ملف غير صالح'); }
  };
  reader.readAsText(file);
}

/* ===================== Dark mode / install / init ===================== */
function applyDarkMode() {
  document.documentElement.classList.toggle('dark', !!state.settings.darkMode);
}
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstallPrompt = e; });
async function triggerInstall() {
  if (deferredInstallPrompt) { deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; }
  else toast('من متصفحك: افتح القائمة ⋮ ثم اختر "إضافة إلى الشاشة الرئيسية"');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

applyDarkMode();
render();
scheduleLessonReminders();
