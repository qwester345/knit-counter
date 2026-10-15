// =====================================================================
//  Счётчик рядов для вязания
//
//  Главная идея: мы храним ТОЛЬКО номер текущего ряда изделия.
//  Ряд каждого паттерна не хранится, а вычисляется из него формулой
//  (см. patternRow). Поэтому счётчики паттернов всегда синхронны
//  и сами "обнуляются" в конце своего цикла.
// =====================================================================

const STORAGE_KEY = 'knit-counter-v1';
const MAX_PATTERNS = 10;

// ---------- Данные ----------

// Короткий уникальный id для проектов и паттернов
function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeProject(name) {
  return {
    id: makeId(),
    name,
    totalRows: 82,
    row: 1, // текущий ряд изделия (тот, который сейчас вяжем)
    patterns: [
      { id: makeId(), name: 'A', height: 4, startRow: 1 },
      { id: makeId(), name: 'B', height: 6, startRow: 1 },
      { id: makeId(), name: 'C', height: 17, startRow: 1 },
    ],
  };
}

// Загружаем состояние из памяти браузера (localStorage).
// Если там пусто или мусор — создаём первый проект.
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.projects && saved.projects.length) return saved;
  } catch (e) { /* повреждённые данные — начнём заново */ }
  const first = makeProject('Свитер');
  return { currentId: first.id, projects: [first] };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

function currentProject() {
  return state.projects.find(p => p.id === state.currentId) || state.projects[0];
}

// ---------- Логика ----------

// Какой ряд паттерна соответствует ряду изделия `row`.
// Возвращает null, если паттерн ещё не начался.
//
// Пример: высота 4, начало с 1-го ряда изделия.
//   ряд изделия: 1 2 3 4 5 6 7 8 9 ...
//   ряд паттерна: 1 2 3 4 1 2 3 4 1 ...
// Оператор % (остаток от деления) как раз даёт такой цикл.
function patternRow(pattern, row) {
  if (row < pattern.startRow) return null;
  const passed = row - pattern.startRow; // сколько рядов паттерна уже позади
  return {
    row: (passed % pattern.height) + 1,             // 1..height
    repeat: Math.floor(passed / pattern.height) + 1, // какой по счёту повтор
  };
}

function changeRow(delta) {
  const p = currentProject();
  p.row = Math.min(p.totalRows, Math.max(1, p.row + delta));
  saveState();
  render();
  if (navigator.vibrate) navigator.vibrate(15); // лёгкий отклик на телефоне
}

// ---------- Отрисовка ----------

const $ = id => document.getElementById(id);

function render() {
  const p = currentProject();

  // Список проектов в шапке
  $('projectSelect').innerHTML = state.projects
    .map(pr => `<option value="${pr.id}">${escapeHtml(pr.name)}</option>`)
    .join('');
  $('projectSelect').value = p.id;

  // Главный счётчик
  $('rowNow').textContent = p.row;
  $('rowTotal').textContent = p.totalRows;
  $('progressBar').style.width = (p.row / p.totalRows) * 100 + '%';
  $('doneMsg').hidden = p.row < p.totalRows;
  $('minusBtn').disabled = p.row <= 1;
  $('plusBtn').disabled = p.row >= p.totalRows;

  // Карточки паттернов
  if (!p.patterns.length) {
    $('patterns').innerHTML = '<div class="empty">Паттернов нет — добавь их в настройках ⚙︎</div>';
    return;
  }
  $('patterns').innerHTML = p.patterns.map(pat => {
    const r = patternRow(pat, p.row);
    if (!r) {
      return `<div class="pattern waiting">
        <div class="name">${escapeHtml(pat.name)}</div>
        <div class="value">—</div>
        <div class="sub">начнётся с ряда ${pat.startRow}</div>
      </div>`;
    }
    return `<div class="pattern ${r.row === 1 ? 'first' : ''}">
      <div class="name">${escapeHtml(pat.name)}</div>
      <div class="value">${r.row}<small> / ${pat.height}</small></div>
      <div class="sub">повтор ${r.repeat}</div>
    </div>`;
  }).join('');
}

// Защита от того, чтобы название вида "<b>" не превратилось в HTML-код
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Настройки ----------

const dialog = $('settings');

function patternRowHtml(pat) {
  return `<div class="pattern-row">
    <input class="p-name" value="${escapeHtml(pat.name)}" placeholder="Название" required maxlength="20">
    <input class="p-height" type="number" min="1" max="999" value="${pat.height}" required>
    <input class="p-start" type="number" min="1" max="9999" value="${pat.startRow}" required>
    <button type="button" class="del" aria-label="Удалить паттерн">✕</button>
  </div>`;
}

function updateAddButton() {
  $('addPatternBtn').disabled = $('patternRows').children.length >= MAX_PATTERNS;
}

function openSettings() {
  const p = currentProject();
  $('projName').value = p.name;
  $('projTotal').value = p.totalRows;
  $('patternRows').innerHTML = p.patterns.map(patternRowHtml).join('');
  updateAddButton();
  $('deleteProjectBtn').disabled = state.projects.length <= 1;
  dialog.showModal();
}

// Читаем значения из формы обратно в проект
function saveSettings() {
  const p = currentProject();
  p.name = $('projName').value.trim() || 'Без названия';
  p.totalRows = Math.max(1, parseInt($('projTotal').value, 10) || 1);
  p.patterns = [...$('patternRows').children].map((rowEl, i) => ({
    id: p.patterns[i]?.id || makeId(),
    name: rowEl.querySelector('.p-name').value.trim() || '?',
    height: Math.max(1, parseInt(rowEl.querySelector('.p-height').value, 10) || 1),
    startRow: Math.max(1, parseInt(rowEl.querySelector('.p-start').value, 10) || 1),
  }));
  p.row = Math.min(p.row, p.totalRows);
  saveState();
  render();
}

$('settingsBtn').addEventListener('click', openSettings);

// Форма отправлена — смотрим, какой кнопкой (Сохранить / Отмена).
// e.submitter — это нажатая кнопка. Закрытие по Esc сюда не попадает,
// значит изменения тогда просто не сохранятся.
$('settingsForm').addEventListener('submit', e => {
  if (e.submitter && e.submitter.value === 'save') saveSettings();
});

$('addPatternBtn').addEventListener('click', () => {
  const n = $('patternRows').children.length;
  const name = String.fromCharCode(65 + n); // A, B, C, ...
  $('patternRows').insertAdjacentHTML('beforeend', patternRowHtml({ name, height: 4, startRow: 1 }));
  updateAddButton();
});

// Один обработчик на весь список: ловим клики по любой кнопке ✕
$('patternRows').addEventListener('click', e => {
  if (e.target.classList.contains('del')) {
    e.target.closest('.pattern-row').remove();
    updateAddButton();
  }
});

$('newProjectBtn').addEventListener('click', () => {
  const name = prompt('Название нового проекта:', 'Новый проект');
  if (!name) return;
  const p = makeProject(name.trim());
  state.projects.push(p);
  state.currentId = p.id;
  saveState();
  dialog.close();
  render();
  openSettings(); // сразу открываем настройки нового проекта
});

$('resetBtn').addEventListener('click', () => {
  if (!confirm('Сбросить счётчик на 1-й ряд?')) return;
  currentProject().row = 1;
  saveState();
  dialog.close();
  render();
});

$('deleteProjectBtn').addEventListener('click', () => {
  const p = currentProject();
  if (!confirm(`Удалить проект «${p.name}»? Это нельзя отменить.`)) return;
  state.projects = state.projects.filter(pr => pr.id !== p.id);
  state.currentId = state.projects[0].id;
  saveState();
  dialog.close();
  render();
});

// ---------- Кнопки и запуск ----------

$('plusBtn').addEventListener('click', () => changeRow(+1));
$('minusBtn').addEventListener('click', () => changeRow(-1));
$('projectSelect').addEventListener('change', e => {
  state.currentId = e.target.value;
  saveState();
  render();
});

render();

// Service worker позволяет приложению работать без интернета
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
