function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie =
    encodeURIComponent(name) + '=' + encodeURIComponent(value) +
    '; expires=' + expires + '; path=/; SameSite=Lax';
}

function getCookie(name) {
  const target = encodeURIComponent(name) + '=';
  const parts = document.cookie ? document.cookie.split('; ') : [];
  for (const part of parts) {
    if (part.indexOf(target) === 0) {
      return decodeURIComponent(part.substring(target.length));
    }
  }
  return null;
}

function deleteCookie(name) {
  document.cookie =
    encodeURIComponent(name) + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

function clearAllCookies() {
  document.cookie.split('; ').forEach(c => {
    const name = c.split('=')[0];
    if (name) deleteCookie(decodeURIComponent(name));
  });
}

const CK = {
  NAME:'lib_userName',
  LAST_VISIT:'lib_lastVisit',
  VISITS:'lib_visits',
  LAST_BOOK:'lib_lastBook',
  FILTER:'lib_filter'
};

document.addEventListener('DOMContentLoaded', () => {
  restoreVisitInfo();
  restoreName();
  initCalc();
  initModal();
  initClearButtons();
  initAddBookForm();
  initDeleteButtons();
  updateSavedDataBlock();
});

function restoreVisitInfo() {
  const lastVisit = getCookie(CK.LAST_VISIT);
  let visits = parseInt(getCookie(CK.VISITS) || '0', 10) + 1;

  setCookie(CK.VISITS, visits, 365);
  setCookie(CK.LAST_VISIT, new Date().toISOString(), 365);

  const greetEl = document.getElementById('greeting');
  const lastEl = document.getElementById('last-visit');
  if (!greetEl || !lastEl) return;

  const name = getCookie(CK.NAME);
  greetEl.textContent = name
    ? `С возвращением, ${name}! Это ваш визит №${visits}.`
    : `Рады видеть! Это ваш визит №${visits}.`;

  if (lastVisit) {
    const d = new Date(lastVisit);
    lastEl.textContent = 'Прошлый раз вы заходили: ' + d.toLocaleString('ru-RU');
  } else {
    lastEl.textContent = 'Это ваш первый визит — добро пожаловать!';
  }
}

function restoreName() {
  const input = document.getElementById('nameInput');
  const btn = document.getElementById('saveNameBtn');
  if (!input || !btn) return;

  const saved = getCookie(CK.NAME);
  if (saved) input.value = saved;

  btn.addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) {
      alert('Пожалуйста, введите имя.');
      return;
    }
    setCookie(CK.NAME, value, 365);
    const visits = getCookie(CK.VISITS) || '1';
    document.getElementById('greeting').textContent =
      `Приятно познакомиться, ${value}! Это ваш визит №${visits}.`;
    updateSavedDataBlock();
  });
}

function initCalc() {
  const slider = document.getElementById('booksPerMonth');
  if (!slider) return;

  const bpmEl = document.getElementById('bpmValue');
  const bpyEl = document.getElementById('booksPerYear');
  const ppyEl = document.getElementById('pagesPerYear');
  const hpyEl = document.getElementById('hoursPerYear');
  const AVG_PAGES = 300;
  const AVG_MIN_PER_PAGE = 2;

  function recalc() {
    const bpm = parseInt(slider.value, 10);
    const bpy = bpm * 12;
    const pages = bpy * AVG_PAGES;
    const hours = Math.round((pages * AVG_MIN_PER_PAGE) / 60);

    bpmEl.textContent = bpm;
    bpyEl.textContent = bpy;
    ppyEl.textContent = pages.toLocaleString('ru-RU');
    hpyEl.textContent = hours.toLocaleString('ru-RU');
  }

  slider.addEventListener('input', recalc);
  recalc();
}

function initFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('#cards .card');
  const counter = document.getElementById('visible-count');
  if (!buttons.length || !cards.length) return;

  function apply(genre) {
    let visible = 0;
    cards.forEach(card => {
      const match = genre === 'all' || card.dataset.genre === genre;
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    buttons.forEach(b =>
      b.classList.toggle('active', b.dataset.genre === genre)
    );
    if (counter) counter.textContent = `Показано книг: ${visible}`;
    setCookie(CK.FILTER, genre, 30);
  }

  buttons.forEach(b => {
    b.addEventListener('click', () => apply(b.dataset.genre));
  });

  apply(getCookie(CK.FILTER) || 'all');
}

function initModal() {
  const modal = document.getElementById('modal');
  if (!modal) return;

  const img = document.getElementById('modalImg');
  const title = document.getElementById('modalTitle');
  const desc = document.getElementById('modalDesc');
  const closeBt = document.getElementById('modalClose');

  document.querySelectorAll('#cards .card').forEach(card => {
    card.addEventListener('click', () => {
      img.src = card.dataset.img;
      img.alt = card.dataset.title;
      title.textContent = card.dataset.title;
      desc.textContent = card.dataset.desc;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');

      setCookie(CK.LAST_BOOK, card.dataset.title, 30);
      updateSavedDataBlock();
    });
  });

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  closeBt.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function restoreLastBook() {
  const lastBook = getCookie(CK.LAST_BOOK);
  if (!lastBook) return;

  document.querySelectorAll('#cards .card').forEach(card => {
    if (card.dataset.title === lastBook) {
      card.classList.add('last-viewed');
      card.title = 'Вы недавно смотрели эту книгу';
    }
  });
}

function initClearButtons() {
  document.querySelectorAll('#clearCookiesBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Удалить все сохранённые данные (имя, визиты, фильтр)?')) return;
      clearAllCookies();
      location.reload();
    });
  });
}

function updateSavedDataBlock() {
  const block = document.getElementById('savedData');
  if (!block) return;

  const name = getCookie(CK.NAME)   || '—';
  const visits = getCookie(CK.VISITS) || '—';
  const filter = getCookie(CK.FILTER) || '—';
  const book = getCookie(CK.LAST_BOOK) || '—';
  const visit = getCookie(CK.LAST_VISIT);
  const visitStr = visit ? new Date(visit).toLocaleString('ru-RU') : '—';

  block.innerHTML =
    `Имя: <strong>${name}</strong><br>` +
    `Визитов: <strong>${visits}</strong><br>` +
    `Последний вход: <strong>${visitStr}</strong><br>` +
    `Фильтр: <strong>${filter}</strong><br>` +
    `Последняя открытая книга: <strong>${book}</strong>`;
}

function initAddBookForm() {
  const form = document.getElementById('addBookForm');
  const msg = document.getElementById('formMessage');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        msg.textContent = 'Ошибка: ' + (json.errors || []).join('; ');
        msg.style.color = '#c0392b';
        return;
      }
      msg.textContent = 'Книга добавлена (id ' + json.id + '). Обновляю…';
      msg.style.color = '#2f4a3d';
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      msg.textContent = 'Сеть недоступна: ' + err.message;
      msg.style.color = '#c0392b';
    }
  });
}

function initDeleteButtons() {
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('Удалить книгу №' + id + '?')) return;

      const res = await fetch('/api/books/' + id, { method: 'DELETE' });
      if (res.ok) {
        location.reload();
      } else {
        alert('Не удалось удалить книгу.');
      }
    });
  });
}