/* ============================================================
   HABIT TRACKER — app.js
   Author: Your Name
   Description: All application logic for the Habit Tracker.
                Handles state management, localStorage persistence,
                calendar rendering, statistics, and UI interactions.
============================================================ */

'use strict';

/* ============================================================
   CONSTANTS
============================================================ */

const EMOJIS = ['📚','💪','🧘','💧','🎨','🎸','🧹','🌱','🍎','✍️','🏃','😴'];

const MONTHS = [
  'January', 'February', 'March',     'April',
  'May',     'June',     'July',      'August',
  'September','October', 'November',  'December'
];

/** localStorage key — bump version suffix to reset all users if schema changes */
const STORAGE_KEY = 'habitTrackerState_v2';


/* ============================================================
   STATE
   Centralised mutable state object.
   Always mutate state via helper functions, then call saveState().
   ─────────────────────────────────────────────────────────────
   habits      {Array}  — [{id: string, name: string, emoji: string}]
   completions {Object} — { habitId: { 'YYYY-MM-DD': true } }
   activeHabit {string} — id of the currently selected habit
   viewYear    {number} — calendar year being displayed
   viewMonth   {number} — calendar month being displayed (0-indexed)
   dark        {boolean}— dark mode on/off
============================================================ */
let state = {
  habits:      [],
  completions: {},
  activeHabit: null,
  viewYear:    0,
  viewMonth:   0,
  dark:        false,
};


/* ============================================================
   STORAGE HELPERS
============================================================ */

/**
 * Load state from localStorage.
 * Falls back to default habits if no saved data is found.
 */
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) Object.assign(state, JSON.parse(saved));
  } catch (err) {
    console.warn('Habit Tracker: could not load saved state.', err);
  }

  // --- Seed default habits for first-time visitors ---
  if (!state.habits.length) {
    const today = new Date();
    state.habits = [
      { id: 'h1', name: 'Study',    emoji: '📚' },
      { id: 'h2', name: 'Workout',  emoji: '💪' },
      { id: 'h3', name: 'Meditate', emoji: '🧘' },
    ];
    state.completions = { h1: {}, h2: {}, h3: {} };
    state.activeHabit = 'h1';
    state.viewYear    = today.getFullYear();
    state.viewMonth   = today.getMonth();
  }

  // --- Ensure viewYear/Month are always set ---
  if (!state.viewYear) {
    const today    = new Date();
    state.viewYear  = today.getFullYear();
    state.viewMonth = today.getMonth();
  }

  // --- Fallback active habit ---
  if (!state.activeHabit && state.habits.length) {
    state.activeHabit = state.habits[0].id;
  }
}

/**
 * Persist the current state object to localStorage.
 */
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}


/* ============================================================
   DATE HELPERS
============================================================ */

/**
 * Build a YYYY-MM-DD date key string.
 * @param {number} y - Full year
 * @param {number} m - Month index (0-based)
 * @param {number} d - Day of month
 * @returns {string}
 */
function dateKey(y, m, d) {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/**
 * Number of days in a given month.
 * @param {number} y - Full year
 * @param {number} m - Month index (0-based)
 * @returns {number}
 */
function getDaysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

/**
 * Day of the week (0=Sun) that the 1st of the month falls on.
 * Used to calculate the number of empty filler cells before the 1st.
 * @param {number} y
 * @param {number} m
 * @returns {number}
 */
function getFirstWeekday(y, m) {
  return new Date(y, m, 1).getDay();
}


/* ============================================================
   STATISTICS CALCULATOR
============================================================ */

/**
 * Calculate all stats for a given habit based on state.
 * @param {string} habitId
 * @returns {{ total, streak, best, monthPct, monthDone, pastDays }}
 */
function calcStats(habitId) {
  const done  = state.completions[habitId] || {};
  const today = new Date();
  const ty    = today.getFullYear();
  const tm    = today.getMonth();
  const td    = today.getDate();
  const { viewYear: y, viewMonth: m } = state;

  // ── All-time total completed days ──
  const total = Object.keys(done).filter(k => done[k]).length;

  // ── Monthly completion % ──
  // Only count days that have already passed (no future inflation)
  const daysInMonth = getDaysInMonth(y, m);
  let pastDays;

  if (y < ty || (y === ty && m < tm)) {
    // Viewing a past month — all days count
    pastDays = daysInMonth;
  } else if (y === ty && m === tm) {
    // Viewing the current month — count up to and including today
    pastDays = td;
  } else {
    // Viewing a future month — nothing to count yet
    pastDays = 0;
  }

  let monthDone = 0;
  for (let d = 1; d <= pastDays; d++) {
    if (done[dateKey(y, m, d)]) monthDone++;
  }

  const monthPct = pastDays > 0 ? Math.round((monthDone / pastDays) * 100) : 0;

  // ── Current streak ──
  // Walk backwards from today, counting consecutive completed days
  let streak = 0;
  const cursor = new Date(ty, tm, td);

  while (true) {
    const k = dateKey(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate()
    );
    if (done[k]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // ── Best (longest) streak ever ──
  // Sort all completed keys and count the longest consecutive run
  const keys = Object.keys(done).filter(k => done[k]).sort();
  let best = 0;
  let run  = 0;
  let prev = null;

  for (const k of keys) {
    if (prev) {
      const diffDays = (new Date(k) - new Date(prev)) / 86400000;
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = k;
  }

  return { total, streak, best, monthPct, monthDone, pastDays };
}


/* ============================================================
   RENDER — HABIT BAR
   Rebuilds the habit pill chips and "New habit" button.
============================================================ */
function renderHabitBar() {
  const bar = document.getElementById('habit-bar');
  bar.innerHTML = '';

  state.habits.forEach(habit => {
    const chip = document.createElement('button');
    chip.className   = 'habit-chip' + (habit.id === state.activeHabit ? ' active' : '');
    chip.textContent = `${habit.emoji}  ${habit.name}`;

    chip.addEventListener('click', () => {
      state.activeHabit = habit.id;
      saveState();
      render();
    });

    bar.appendChild(chip);
  });

  // "New habit" dashed pill
  const addBtn = document.createElement('button');
  addBtn.className   = 'btn-add-habit';
  addBtn.textContent = '+ New habit';
  addBtn.addEventListener('click', openModal);
  bar.appendChild(addBtn);
}


/* ============================================================
   RENDER — STATISTICS
   Updates the four stat cards and the progress bar.
============================================================ */
function renderStats() {
  if (!state.activeHabit) return;

  const s = calcStats(state.activeHabit);

  document.getElementById('stat-total').innerHTML  = `${s.total}<span>days</span>`;
  document.getElementById('stat-streak').innerHTML = `${s.streak}<span>days</span>`;
  document.getElementById('stat-best').innerHTML   = `${s.best}<span>days</span>`;
  document.getElementById('stat-month').innerHTML  = `${s.monthPct}<span>%</span>`;

  // Progress bar
  document.getElementById('progress-pct').textContent  = `${s.monthPct}%`;
  document.getElementById('progress-fill').style.width = `${s.monthPct}%`;

  // Label shows the active habit name
  const habit = state.habits.find(h => h.id === state.activeHabit);
  if (habit) {
    document.getElementById('progress-label').textContent =
      `${habit.emoji} ${habit.name} — monthly completion`;
  }
}


/* ============================================================
   RENDER — CALENDAR
   Builds the full grid of day cells for the viewed month.
============================================================ */
function renderCalendar() {
  const { viewYear: y, viewMonth: m } = state;

  // Update month/year title
  document.getElementById('cal-title').textContent = `${MONTHS[m]} ${y}`;

  const grid      = document.getElementById('cal-grid');
  grid.innerHTML  = '';

  const totalDays  = getDaysInMonth(y, m);
  const startDay   = getFirstWeekday(y, m);
  const today      = new Date();
  const ty         = today.getFullYear();
  const tm         = today.getMonth();
  const td         = today.getDate();
  const isCurrentM = ty === y && tm === m;
  const isFutureM  = (y > ty) || (y === ty && m > tm);
  const done       = state.completions[state.activeHabit] || {};

  // ── Empty filler cells before the 1st ──
  for (let i = 0; i < startDay; i++) {
    const el    = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  // ── Day cells ──
  for (let d = 1; d <= totalDays; d++) {
    const el       = document.createElement('div');
    const key      = dateKey(y, m, d);
    const isToday  = isCurrentM && d === td;
    const isFuture = isFutureM  || (isCurrentM && d > td);
    const isDone   = !!done[key];

    // Build class string
    let cls = 'cal-day';
    if (isToday)  cls += ' today';
    if (isFuture) cls += ' future';
    if (isDone)   cls += ' done';

    el.className = cls;
    el.textContent = d;
    el.setAttribute('aria-label',
      `${MONTHS[m]} ${d}, ${y}${isDone ? ', completed' : ''}`
    );

    // Only allow clicking past/present days
    if (!isFuture) {
      el.addEventListener('click', () => toggleDay(y, m, d, el));
    }

    grid.appendChild(el);
  }
}


/* ============================================================
   FULL RENDER
   Calls all render sub-functions and reapplies the theme.
============================================================ */
function render() {
  renderHabitBar();
  renderStats();
  renderCalendar();
  applyTheme();
}


/* ============================================================
   TOGGLE DAY
   Marks or unmarks a day as completed for the active habit.
   Uses optimistic UI — updates the clicked cell immediately
   without re-rendering the whole calendar.
============================================================ */
function toggleDay(y, m, d, el) {
  if (!state.activeHabit) return;

  const key = dateKey(y, m, d);

  if (!state.completions[state.activeHabit]) {
    state.completions[state.activeHabit] = {};
  }

  // Toggle: add if missing, remove if present
  if (state.completions[state.activeHabit][key]) {
    delete state.completions[state.activeHabit][key];
  } else {
    state.completions[state.activeHabit][key] = true;
  }

  saveState();

  // ── Optimistic cell update (no full re-render) ──
  const isDone  = !!state.completions[state.activeHabit][key];
  const today   = new Date();
  const isToday = y === today.getFullYear() &&
                  m === today.getMonth()    &&
                  d === today.getDate();

  el.className  = 'cal-day' +
    (isToday ? ' today' : '') +
    (isDone  ? ' done'  : '');

  // Update stats only (calendar cells already correct)
  renderStats();
}


/* ============================================================
   MONTH NAVIGATION
============================================================ */
document.getElementById('btn-prev').addEventListener('click', () => {
  if (state.viewMonth === 0) {
    state.viewMonth = 11;
    state.viewYear--;
  } else {
    state.viewMonth--;
  }
  saveState();
  render();
});

document.getElementById('btn-next').addEventListener('click', () => {
  if (state.viewMonth === 11) {
    state.viewMonth = 0;
    state.viewYear++;
  } else {
    state.viewMonth++;
  }
  saveState();
  render();
});


/* ============================================================
   DARK MODE
============================================================ */

/** Apply/remove dark theme on <html> and update toggle button icon */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.dark ? 'dark' : 'light');
  document.getElementById('btn-dark').textContent = state.dark ? '☀️' : '🌙';
}

document.getElementById('btn-dark').addEventListener('click', () => {
  state.dark = !state.dark;
  saveState();
  applyTheme();
});


/* ============================================================
   RESET HABIT
   Clears all completion data for the active habit after confirm.
============================================================ */
document.getElementById('btn-reset').addEventListener('click', () => {
  if (!state.activeHabit) return;

  const habit = state.habits.find(h => h.id === state.activeHabit);
  if (!habit) return;

  const confirmed = confirm(
    `Reset all data for "${habit.emoji} ${habit.name}"?\nThis cannot be undone.`
  );

  if (confirmed) {
    state.completions[state.activeHabit] = {};
    saveState();
    render();
  }
});


/* ============================================================
   ADD HABIT MODAL
============================================================ */
let selectedEmoji = EMOJIS[0]; // Tracks which emoji is selected in the picker

/** Open the modal and focus the text input */
function openModal() {
  selectedEmoji = EMOJIS[0];
  document.getElementById('habit-name-input').value = '';
  renderEmojiPicker();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('habit-name-input').focus(), 120);
}

/** Close the modal */
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

/** Rebuild the emoji picker buttons */
function renderEmojiPicker() {
  const row    = document.getElementById('emoji-row');
  row.innerHTML = '';

  EMOJIS.forEach(em => {
    const btn    = document.createElement('button');
    btn.className = 'emoji-opt' + (em === selectedEmoji ? ' sel' : '');
    btn.textContent = em;
    btn.addEventListener('click', () => {
      selectedEmoji = em;
      renderEmojiPicker(); // Re-render to update selection highlight
    });
    row.appendChild(btn);
  });
}

// Close when clicking the backdrop
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.getElementById('modal-cancel').addEventListener('click', closeModal);

// Save new habit
document.getElementById('modal-save').addEventListener('click', () => {
  const name = document.getElementById('habit-name-input').value.trim();
  if (!name) return; // Don't save empty names

  const id = 'h' + Date.now(); // Unique ID using timestamp
  state.habits.push({ id, name, emoji: selectedEmoji });
  state.completions[id] = {};
  state.activeHabit     = id; // Auto-switch to the new habit

  saveState();
  closeModal();
  render();
});

// Keyboard shortcuts inside the modal
document.getElementById('habit-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  document.getElementById('modal-save').click();
  if (e.key === 'Escape') closeModal();
});


/* ============================================================
   BOOT — initialise app on page load
============================================================ */
loadState();
render();