// «Проверка кейсов» — the case editor (docs/17-cases-editor.md). Vanilla JS, no framework.
// All user data is put into the page through textContent / value only (no innerHTML with user data).
import { caseGroups, siteGroups, FIELD_LABELS } from './fields.js';
import { cropDialog, loadBitmap, normaliseFile } from './cropper.js';

const API = 'api.php';
const TOKEN = (new URLSearchParams(location.search).get('d') || '').toLowerCase();
const $ = (s, r = document) => r.querySelector(s);
const STATUS = { todo: 'Не проверено', ok: 'Проверено', changed: 'Изменено', question: 'Есть вопрос' };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const store = { get: (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };

/* ── tiny DOM helper (text only) ── */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
function toast(msg, actions = []) {
  const t = h('div', { class: 'toast', role: 'status' }, h('p', { text: msg }), actions.length ? h('div', { class: 'toast__acts' }, actions.map(([label, fn]) => h('button', { type: 'button', class: 'btn btn--sm', text: label, onclick: () => { fn(); t.remove(); } }))) : null);
  $('#toasts').append(t); if (!actions.length) setTimeout(() => t.remove(), 4200);
  return t;
}

/* ── network ── */
async function api(a, { body, query = {}, method } = {}) {
  const q = new URLSearchParams({ a, ...(TOKEN ? { d: TOKEN } : {}), ...query });
  const r = await fetch(`${API}?${q}`, { method: method || (body ? 'POST' : 'GET'), headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' });
  let j = null; try { j = await r.json(); } catch { /* not json */ }
  if (!r.ok) { const e = new Error(j?.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return j;
}
function upload(form, onProgress) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open('POST', `${API}?a=photo&d=${TOKEN}`); x.responseType = 'json';
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => (x.status === 200 ? res(x.response) : rej(Object.assign(new Error(x.response?.error || `HTTP ${x.status}`), { status: x.status })));
    x.onerror = () => rej(new Error('network')); x.send(form);
  });
}

/* ════════════ OWNER SCREEN (no token) ════════════ */
async function ownerScreen() {
  const root = $('#app'); root.replaceChildren();
  let me; try { me = await api('me'); } catch { root.append(h('p', { class: 'muted', text: 'Сервер редактора недоступен.' })); return; }
  root.append(h('header', { class: 'top' }, h('h1', { text: 'Проверка кейсов' }), h('p', { class: 'muted', text: 'Вход владельца: создание редакций и ссылок для команды.' })));
  if (!me.outsideSite) root.append(h('p', { class: 'warn', text: 'Данные редактора лежат внутри папки сайта (kejsy-proverka/data). Не перезаписывайте и не удаляйте эту папку при выкладке.' }));
  if (!me.passwordSet) { root.append(h('p', { class: 'warn', text: 'Пароль владельца не задан. Выполните в проекте npm run editor:password и выложите сайт.' })); return; }
  if (!me.owner) {
    const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Пароль', class: 'inp', required: true });
    const err = h('p', { class: 'err' });
    root.append(h('form', { class: 'card login', onsubmit: async (e) => { e.preventDefault(); err.textContent = ''; try { await api('login', { body: { password: pw.value } }); ownerScreen(); } catch (x) { err.textContent = x.status === 429 ? 'Слишком много попыток. Подождите 10 минут.' : 'Неверный пароль.'; } } },
      h('label', { class: 'lbl', text: 'Пароль владельца' }), pw, h('button', { class: 'btn btn--primary', type: 'submit', text: 'Войти' }), err));
    return;
  }
  const title = h('input', { class: 'inp', placeholder: `Правки от ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`, maxLength: 120 });
  const list = h('div', { class: 'drafts' });
  const load = async () => {
    const { drafts } = await api('drafts'); list.replaceChildren();
    if (!drafts.length) list.append(h('p', { class: 'muted', text: 'Редакций пока нет.' }));
    for (const d of drafts) {
      const link = `${location.origin}${location.pathname}?d=${d.token}`;
      list.append(h('div', { class: 'card draft' },
        h('div', { class: 'draft__head' }, h('strong', { text: d.title }), h('span', { class: `badge ${d.status === 'open' ? 'badge--ok' : ''}`, text: d.status === 'open' ? 'открыта' : 'закрыта' })),
        h('p', { class: 'muted small', text: `создана ${new Date(d.created).toLocaleString('ru-RU')} · правок: ${d.edits}` }),
        h('div', { class: 'row' },
          h('a', { class: 'btn btn--sm btn--primary', href: link, text: 'Открыть' }),
          h('button', { type: 'button', class: 'btn btn--sm', text: 'Скопировать ссылку', onclick: () => copy(link) }),
          h('a', { class: 'btn btn--sm', href: `${link}#/download`, text: 'Скачать изменения' }),
          h('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: d.status === 'open' ? 'Закрыть редакцию' : 'Открыть снова', onclick: async () => { if (d.status === 'open' && !confirm('Закрыть редакцию? Править по ссылке станет нельзя, просмотр и скачивание останутся.')) return; await api(d.status === 'open' ? 'close' : 'reopen', { body: { token: d.token } }); load(); } }),
        )));
    }
  };
  root.append(
    h('form', { class: 'card', onsubmit: async (e) => { e.preventDefault(); const { token } = await api('create', { body: { title: title.value.trim() } }); const link = `${location.origin}${location.pathname}?d=${token}`; copy(link, 'Редакция создана, ссылка скопирована'); title.value = ''; load(); } },
      h('label', { class: 'lbl', text: 'Новая редакция' }), title, h('p', { class: 'muted small', text: 'Создаётся из текущих данных сайта. Ссылку можно отправить команде — пароль им не нужен.' }), h('button', { class: 'btn btn--primary', type: 'submit', text: '+ Новая редакция' })),
    h('h2', { class: 'h2', text: 'Редакции' }), list,
    h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Выйти', onclick: async () => { await api('logout', { body: {} }); ownerScreen(); } }));
  load();
}
async function copy(text, msg = 'Ссылка скопирована') {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { prompt('Скопируйте ссылку', text); }
}

/* ════════════ DRAFT ════════════ */
const S = { draft: null, items: new Map(), photos: [], categories: [], services: [], cursor: 0, filter: { q: '', cat: 'all', st: 'all' }, open: null, saving: 0, offline: false };
const pendingKey = `cmce-q-${TOKEN}`;
let queue = store.get(pendingKey, []); // [{id, field, value, prev}]
const userName = () => store.get('cmce-name', '');

function setSave(state) {
  const el = $('#save'); if (!el) return;
  el.dataset.state = state; el.textContent = { ok: 'Сохранено', saving: 'Сохраняю…', offline: 'Нет связи — правки сохранятся позже', closed: 'Только просмотр' }[state];
}
const canEdit = () => S.draft?.status === 'open';

async function askName() {
  if (userName()) return;
  await new Promise((res) => {
    const inp = h('input', { class: 'inp', placeholder: 'Например: Айгерим', maxLength: 60, autocomplete: 'name' });
    const dlg = h('div', { class: 'modal' }, h('form', { class: 'card modal__box', onsubmit: (e) => { e.preventDefault(); if (!inp.value.trim()) return; store.set('cmce-name', inp.value.trim()); dlg.remove(); res(); } },
      h('h2', { class: 'h2', text: 'Кто правит?' }), h('p', { class: 'muted', text: 'Имя подпишет ваши правки, чтобы команда видела, кто что изменил.' }), inp, h('button', { class: 'btn btn--primary', type: 'submit', text: 'Продолжить' })));
    document.body.append(dlg); inp.focus();
  });
}

async function loadState() {
  const st = await api('state');
  S.draft = st.draft; S.categories = st.categories; S.services = st.services; S.cursor = st.cursor; S.photos = st.photos;
  S.items = new Map(st.items.map((i) => [i.id, i]));
  // pending local edits win in the view until they are sent
  for (const q of queue) { const it = S.items.get(q.id); if (it) it.data[q.field] = q.value; }
}

async function flush() {
  if (!queue.length || S.flushing) return;
  S.flushing = true; setSave('saving');
  try {
    while (queue.length) {
      const q = queue[0];
      let r;
      try { r = await api('save', { body: { ...q, by: userName() } }); }
      catch (e) { if (e.status && e.status < 500 && e.status !== 429) { queue.shift(); store.set(pendingKey, queue); toast(`Не сохранено: ${e.message}`); continue; } throw e; }
      queue.shift(); store.set(pendingKey, queue);
      const it = S.items.get(q.id);
      if (r.conflict) {
        const who = r.by || 'другой участник';
        toast(`Поле «${FIELD_LABELS[q.field] ?? q.field}» только что изменил(а) ${who}.`, [
          ['Оставить моё', () => { queue.push({ ...q, force: true }); store.set(pendingKey, queue); flush(); }],
          ['Взять их', () => { if (it) { it.data[q.field] = r.value; rerender(q.id); } }],
        ]);
        continue;
      }
      if (it) { it.version = r.version; if (r.status) it.status = r.status; it.by = userName(); it.updated = new Date().toISOString(); }
      S.cursor = Math.max(S.cursor, r.cursor ?? 0);
    }
    S.offline = false; setSave('ok'); renderListMeta();
  } catch { S.offline = true; setSave('offline'); }
  finally { S.flushing = false; }
}
const timers = new Map();
function edit(id, field, value) {
  if (!canEdit()) return;
  const it = S.items.get(id); const prevServer = it.data[field];
  it.data[field] = value;
  if (it.status === 'todo' || it.status === 'ok') { if (field !== 'comment') it.status = 'changed'; }
  const existing = queue.find((q) => q.id === id && q.field === field);
  if (existing) existing.value = value; else queue.push({ id, field, value, prev: prevServer });
  store.set(pendingKey, queue); setSave('saving');
  clearTimeout(timers.get(id + field));
  timers.set(id + field, setTimeout(flush, 800));
  updateDirty(id, field); renderPreview(); renderListMeta();
}
addEventListener('online', flush);
addEventListener('pagehide', () => { if (queue.length) for (const q of queue) navigator.sendBeacon?.(`${API}?a=save&d=${TOKEN}`, new Blob([JSON.stringify({ ...q, by: userName() })], { type: 'application/json' })); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); else flush(); });

async function poll() {
  if (!TOKEN || !S.draft) return;
  try {
    await flush();
    const r = await api('poll', { query: { since: S.cursor } });
    S.draft = r.draft; S.offline = false; if (!queue.length) setSave(canEdit() ? 'ok' : 'closed');
    const mine = new Set(queue.map((q) => q.id + '|' + q.field));
    for (const it of r.items) {
      const cur = S.items.get(it.id);
      if (cur) for (const k of Object.keys(cur.data)) if (mine.has(it.id + '|' + k)) it.data[k] = cur.data[k];
      S.items.set(it.id, it);
    }
    for (const p of r.photos) if (!S.photos.some((x) => x.pid === p.pid)) S.photos.push(p);
    if (r.cursor > S.cursor) {
      S.cursor = r.cursor;
      const others = r.log.filter((e) => e.by !== userName());
      if (others.length) {
        renderList();
        if (S.open && others.some((e) => e.case_id === S.open)) {
          const active = document.activeElement?.closest?.('[data-field]')?.dataset.field;
          openItem(S.open, { keepScroll: true, keepField: active });
        }
      }
    }
  } catch { S.offline = true; setSave('offline'); }
}

/* ── photos helpers ── */
const lastPhoto = (id, slot) => { const l = S.photos.filter((p) => p.case_id === id && p.slot === slot); return l.length ? l[l.length - 1] : null; };
const sitePhotoUrl = (it, slot) => it.base?.slots?.find((s) => s.slot === slot)?.url ?? null;
function photoUrl(it, slot) {
  const p = lastPhoto(it.id, slot);
  if (p && p.source !== 'reset' && p.crop) return `${API}?a=img&d=${TOKEN}&photo=${p.pid}&v=crop`;
  return sitePhotoUrl(it, slot);
}
const catName = (id) => S.categories.find((c) => c.id === id)?.ru ?? id ?? '—';
const itemName = (it) => it.data.name_ru || it.data.name || it.id;
const itemCat = (it) => (it.kind === 'site' ? 'sites' : it.data.sector);

/* ════════════ LIST ════════════ */
function orderedItems() {
  return [...S.items.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'case' ? -1 : 1) || ((a.data.rank ?? a.data.order ?? 999) - (b.data.rank ?? b.data.order ?? 999)));
}
function renderListMeta() {
  const all = [...S.items.values()]; const done = all.filter((i) => i.status === 'ok').length;
  const pg = $('#progress'); if (!pg) return;
  pg.querySelector('span').textContent = `Проверено ${done} из ${all.length}`;
  pg.querySelector('i').style.width = `${(done / Math.max(1, all.length)) * 100}%`;
  const last = all.filter((i) => i.updated).sort((a, b) => (b.updated > a.updated ? 1 : -1))[0];
  $('#lastedit').textContent = last ? `последняя правка: ${last.by || '—'}, ${new Date(last.updated).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'правок пока нет';
}
function draftScreen() {
  const root = $('#app'); root.replaceChildren();
  const search = h('input', { class: 'inp', type: 'search', placeholder: 'Поиск по названию', value: S.filter.q, oninput: (e) => { S.filter.q = e.target.value; renderList(); } });
  const cats = h('div', { class: 'chips', role: 'group', 'aria-label': 'Категория' });
  const sts = h('div', { class: 'chips', role: 'group', 'aria-label': 'Статус' });
  const mkChip = (box, key, val, label) => box.append(h('button', { type: 'button', class: `chip${S.filter[key] === val ? ' is-on' : ''}`, 'aria-pressed': String(S.filter[key] === val), text: label, onclick: () => { S.filter[key] = val; draftScreen(); } }));
  mkChip(cats, 'cat', 'all', 'Все'); for (const c of S.categories) mkChip(cats, 'cat', c.id, c.ru);
  mkChip(sts, 'st', 'all', 'Все'); for (const [k, v] of Object.entries(STATUS)) mkChip(sts, 'st', k, v);
  root.append(
    h('header', { class: 'top' },
      h('h1', { text: 'Проверка кейсов' }),
      h('p', { class: 'muted', text: 'Нажмите на кейс, проверьте текст и фото и исправьте, что неверно. Всё сохраняется само.' }),
      h('div', { id: 'progress', class: 'progress' }, h('span'), h('b', {}, h('i'))),
      h('div', { class: 'draftline' }, h('strong', { text: S.draft.title }), h('span', { id: 'lastedit', class: 'muted small' }), h('span', { id: 'save', class: 'save', 'aria-live': 'polite' })),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn--primary', text: 'Поделиться ссылкой', onclick: () => copy(location.href.split('#')[0]) }),
        h('button', { type: 'button', class: 'btn', text: 'Скачать изменения', onclick: download }),
        h('button', { type: 'button', class: 'btn btn--ghost', text: 'История', onclick: () => { location.hash = '#/history'; } })),
    ),
    search, cats, sts,
    h('ol', { id: 'list', class: 'list' }),
    canEdit() ? h('button', { type: 'button', class: 'btn btn--ghost newcase', text: '+ Новый кейс', onclick: newCase }) : null,
  );
  renderList(); renderListMeta(); setSave(queue.length ? (navigator.onLine ? 'saving' : 'offline') : canEdit() ? 'ok' : 'closed');
}
function renderList() {
  const ol = $('#list'); if (!ol) return;
  const q = S.filter.q.trim().toLowerCase();
  const list = orderedItems().filter((it) => (S.filter.cat === 'all' || itemCat(it) === S.filter.cat) && (S.filter.st === 'all' || it.status === S.filter.st)
    && (!q || `${itemName(it)} ${it.data.name_en ?? ''} ${it.id}`.toLowerCase().includes(q)));
  ol.replaceChildren(...list.map((it) => {
    const all = orderedItems(); const num = all.indexOf(it) + 1; const slot = it.kind === 'site' ? 'shot' : '4x3'; const changedPh = lastPhoto(it.id, slot); const thumb = changedPh && changedPh.source !== 'reset' ? photoUrl(it, slot) : it.base?.thumb || photoUrl(it, slot);
    return h('li', {}, h('a', { class: `item${it.data.show === false ? ' is-hidden' : ''}`, href: `#/c/${it.id}` },
      thumb ? h('img', { class: 'item__img', src: thumb, alt: '', loading: 'lazy', decoding: 'async', width: 64, height: 48 }) : h('span', { class: 'item__img item__img--none', text: (it.data.monogram || '—').slice(0, 3) }),
      h('span', { class: 'item__body' }, h('span', { class: 'item__name', text: `${num}. ${itemName(it)}` }), h('span', { class: 'item__cat muted small', text: `${catName(itemCat(it))}${it.data.show === false ? ' · скрыт' : ''}` })),
      h('span', { class: `badge badge--${it.status}`, text: STATUS[it.status] })));
  }));
  if (!list.length) ol.append(h('li', { class: 'muted', text: 'Ничего не найдено.' }));
}
async function newCase() {
  const id = prompt('ID нового кейса — латиницей через дефис, например new-client');
  if (id === null) return;
  const clean = id.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) { toast('ID: только латиница, цифры и дефис'); return; }
  if (S.items.has(clean)) { toast('Такой ID уже есть'); return; }
  const fields = { kind: 'case', show: true, rank: 100, n: null, sector: S.categories[0]?.id ?? '', monogram: '', name_ru: '', name_en: '', summary_ru: '', summary_en: '', tags_ru: [], tags_en: [], card_ru: '', card_en: '',
    task_ru: '', task_en: '', project_ru: '', project_en: '', role_ru: '', role_en: '', done_ru: [], done_en: [], result_ru: '', result_en: '', extra_ru: [], extra_en: [],
    disciplines: [], link_text: '', link_url: '', services: [], similar: [], alt_ru: '', alt_en: '', seo_title_ru: '', seo_desc_ru: '', seo_title_en: '', seo_desc_en: '', comment: '' };
  try { const r = await api('new', { body: { id: clean, kind: 'case', fields, by: userName() } }); S.items.set(clean, r.item); S.cursor = r.cursor; location.hash = `#/c/${clean}`; }
  catch (e) { toast(e.status === 409 ? 'Такой ID уже есть' : `Не получилось: ${e.message}`); }
}

/* ════════════ ITEM ════════════ */
let previewBox = null;
function updateDirty(id, field) {
  const wrap = document.querySelector(`[data-field="${field}"]`); if (!wrap) return;
  const it = S.items.get(id); const changed = it.base && !same(it.base.f[field], it.data[field]);
  wrap.classList.toggle('is-changed', !!changed);
  const st = $('#itemstatus'); if (st) st.textContent = STATUS[it.status];
}
function rerender(id) { if (S.open === id) openItem(id, { keepScroll: true }); }

function fieldControl(it, f) {
  const v = it.data[f.k]; const set = (val) => edit(it.id, f.k, val); const ro = !canEdit();
  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight + 2}px`; };
  if (f.t === 'text' || f.t === 'num') {
    const inp = h('input', { class: 'inp', type: f.t === 'num' ? 'number' : 'text', value: v ?? '', readOnly: ro, inputMode: f.t === 'num' ? 'numeric' : undefined,
      oninput: (e) => { set(f.t === 'num' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value); counter?.(e.target.value); } });
    const counter = f.max ? mkCounter(f.max, inp) : null;
    return f.max ? h('div', {}, inp, counter.el) : inp;
  }
  if (f.t === 'area') {
    const ta = h('textarea', { class: 'inp ta', rows: 2, value: v ?? '', readOnly: ro, oninput: (e) => { grow(e.target); set(e.target.value); counter?.(e.target.value); } });
    requestAnimationFrame(() => grow(ta));
    const counter = f.max ? mkCounter(f.max, ta) : null;
    return f.max ? h('div', {}, ta, counter.el) : ta;
  }
  if (f.t === 'toggle') {
    return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: v !== false, disabled: ro, onchange: (e) => set(e.target.checked) }), h('span', { class: 'switch__ui' }), h('span', { text: v !== false ? 'Да' : 'Нет — кейс скрыт' }));
  }
  if (f.t === 'select') {
    const sel = h('select', { class: 'inp', disabled: ro, onchange: (e) => set(e.target.value) }, S.categories.filter((c) => c.id !== 'sites').map((c) => h('option', { value: c.id, text: c.ru })));
    sel.value = v ?? ''; return sel;
  }
  if (f.t === 'chips') return chipsControl(v ?? [], set, ro);
  if (f.t === 'list') return listControl(v ?? [], set, ro);
  if (f.t === 'sections') return sectionsControl(v ?? [], set, ro);
  if (f.t === 'refs') {
    const opts = f.src === 'services' ? S.services.map((s) => [s.id, s.name]) : orderedItems().filter((x) => x.kind === 'case' && x.id !== it.id).map((x) => [x.id, itemName(x)]);
    return refsControl(v ?? [], opts, set, ro);
  }
  return h('span');
}
function mkCounter(max, el) {
  const c = h('span', { class: 'counter small' });
  const upd = (s) => { const n = (s ?? '').length; c.textContent = `${n} / ${max}`; c.classList.toggle('is-over', n > max); };
  upd(el.value); return Object.assign(upd, { el: c });
}
function chipsControl(arr, set, ro) {
  const box = h('div', { class: 'chipsed' });
  const draw = () => {
    box.replaceChildren(...arr.map((t, i) => h('span', { class: 'tag' }, h('span', { text: t }), ro ? null : h('button', { type: 'button', class: 'tag__x', 'aria-label': `Удалить ${t}`, text: '×', onclick: () => { arr = arr.filter((_, j) => j !== i); set(arr); draw(); } }))),
      ro ? '' : h('input', { class: 'tag__in', placeholder: '+ добавить', enterKeyHint: 'done', onkeydown: (e) => { if ((e.key === 'Enter' || e.key === ',' || e.key === ';') && e.target.value.trim()) { e.preventDefault(); arr = [...arr, e.target.value.trim()]; set(arr); draw(); box.querySelector('.tag__in').focus(); } },
        onblur: (e) => { if (e.target.value.trim()) { arr = [...arr, e.target.value.trim()]; set(arr); draw(); } } }));
  };
  draw(); return box;
}
function listControl(arr, set, ro) {
  const box = h('div', { class: 'listed' }); let dragFrom = null;
  const draw = () => {
    box.replaceChildren(...arr.map((t, i) => h('div', { class: 'listed__row', draggable: !ro,
      ondragstart: () => { dragFrom = i; }, ondragover: (e) => e.preventDefault(),
      ondrop: (e) => { e.preventDefault(); if (dragFrom === null || dragFrom === i) return; const a = [...arr]; const [x] = a.splice(dragFrom, 1); a.splice(i, 0, x); arr = a; set(arr); draw(); dragFrom = null; } },
      h('span', { class: 'listed__n', text: String(i + 1).padStart(2, '0') }),
      h('textarea', { class: 'inp ta', rows: 1, value: t, readOnly: ro, oninput: (e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight + 2}px`; arr = arr.map((x, j) => (j === i ? e.target.value : x)); set(arr); } }),
      ro ? null : h('span', { class: 'listed__acts' },
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Выше', text: '↑', disabled: i === 0, onclick: () => { const a = [...arr]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; arr = a; set(arr); draw(); } }),
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Ниже', text: '↓', disabled: i === arr.length - 1, onclick: () => { const a = [...arr]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; arr = a; set(arr); draw(); } }),
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Удалить пункт', text: '×', onclick: () => { arr = arr.filter((_, j) => j !== i); set(arr); draw(); } })))),
    ro ? '' : h('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: '+ пункт', onclick: () => { arr = [...arr, '']; set(arr); draw(); box.querySelectorAll('textarea')[arr.length - 1]?.focus(); } }));
    requestAnimationFrame(() => box.querySelectorAll('textarea').forEach((t) => { t.style.height = `${t.scrollHeight + 2}px`; }));
  };
  draw(); return box;
}
function sectionsControl(arr, set, ro) {
  const box = h('div', { class: 'sections' });
  const draw = () => {
    box.replaceChildren(...arr.map((s, i) => h('div', { class: 'section' },
      h('input', { class: 'inp', placeholder: 'Заголовок раздела', value: s.title ?? '', readOnly: ro, oninput: (e) => { arr = arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)); set(arr); } }),
      h('textarea', { class: 'inp ta', rows: 2, placeholder: 'Текст', value: s.text ?? '', readOnly: ro, oninput: (e) => { arr = arr.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)); set(arr); } }),
      listControl(s.items ?? [], (items) => { arr = arr.map((x, j) => (j === i ? { ...x, items } : x)); set(arr); }, ro),
      ro ? null : h('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Удалить раздел', onclick: () => { if (confirm('Удалить раздел?')) { arr = arr.filter((_, j) => j !== i); set(arr); draw(); } } }))),
    ro ? '' : h('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: '+ раздел', onclick: () => { arr = [...arr, { title: '', text: '', items: [] }]; set(arr); draw(); } }));
  };
  draw(); return box;
}
function refsControl(arr, opts, set, ro) {
  const box = h('div', { class: 'chipsed' }); const name = (id) => opts.find((o) => o[0] === id)?.[1] ?? id;
  const draw = () => {
    box.replaceChildren(...arr.map((id, i) => h('span', { class: 'tag' }, h('span', { text: name(id) }), ro ? null : h('button', { type: 'button', class: 'tag__x', 'aria-label': `Убрать ${name(id)}`, text: '×', onclick: () => { arr = arr.filter((_, j) => j !== i); set(arr); draw(); } }))),
      ro ? '' : h('select', { class: 'inp inp--sm', onchange: (e) => { if (e.target.value) { arr = [...arr, e.target.value]; set(arr); draw(); } } },
        h('option', { value: '', text: '+ добавить' }), opts.filter((o) => !arr.includes(o[0])).map((o) => h('option', { value: o[0], text: o[1] }))));
  };
  draw(); return box;
}

function renderPreview() {
  if (!previewBox || !S.open) return;
  const it = S.items.get(S.open); const d = it.data;
  if (it.kind === 'site') {
    previewBox.replaceChildren(h('div', { class: 'pv pv--site' }, h('div', { class: 'pv__bar', text: d.domain || '' }),
      photoUrl(it, 'shot') ? h('img', { class: 'pv__img pv__img--site', src: photoUrl(it, 'shot'), alt: '' }) : h('div', { class: 'pv__img' }),
      h('div', { class: 'pv__body' }, h('p', { class: 'pv__meta', text: (d.type_ru || '').toUpperCase() }), h('p', { class: 'pv__name', text: `${d.name || ''} ↗` }), h('p', { class: 'pv__line', text: d.summary_ru || '' }))));
    return;
  }
  const logo = photoUrl(it, 'logo'); const n = orderedItems().filter((x) => x.kind === 'case' && x.data.sector === d.sector).indexOf(it) + 1;
  previewBox.replaceChildren(h('div', { class: 'pv' },
    h('div', { class: 'pv__imgwrap' }, photoUrl(it, '4x3') ? h('img', { class: 'pv__img', src: photoUrl(it, '4x3'), alt: '' }) : h('div', { class: 'pv__img' }),
      h('span', { class: 'pv__chip' }, logo ? h('img', { src: logo, alt: '', class: 'pv__logo' }) : h('b', { text: d.monogram || '' }), h('span', { text: `${String(d.n ?? n).padStart(2, '0')} · ${catName(d.sector).toUpperCase()}` }))),
    h('div', { class: 'pv__body' }, h('p', { class: 'pv__name', text: d.name_ru || '' }), h('p', { class: 'pv__line', text: d.card_ru || '' }))));
}

function photoSlots(it) {
  const slots = it.base?.slots ?? (it.kind === 'site' ? [{ slot: 'shot', ratio: 1.6, label: 'Скриншот сайта' }] : [{ slot: '4x3', ratio: 4 / 3, label: 'Фото карточки 4:3' }, { slot: '16x9', ratio: 16 / 9, label: 'Обложка 16:9' }, { slot: 'logo', ratio: 1, label: 'Логотип в чипе', free: true }]);
  return h('div', { class: 'slots' }, slots.map((s) => slotCard(it, s)));
}
function slotCard(it, s) {
  const p = lastPhoto(it.id, s.slot); const url = photoUrl(it, s.slot); const ro = !canEdit();
  const prog = h('div', { class: 'slot__prog', hidden: true }, h('i'));
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/*', hidden: true, onchange: async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) replace(f); } });
  const altRu = h('input', { class: 'inp inp--sm', placeholder: 'Alt RU — что на фото', value: p?.alt_ru ?? '', readOnly: ro });
  const altEn = h('input', { class: 'inp inp--sm', placeholder: 'Alt EN', value: p?.alt_en ?? '', readOnly: ro });
  let altT = null; const altSave = () => { clearTimeout(altT); altT = setTimeout(() => send({ source: 'alt' }), 1200); };
  altRu.addEventListener('input', altSave); altEn.addEventListener('input', altSave);
  async function send(fields, files = {}) {
    const fd = new FormData(); fd.append('id', it.id); fd.append('slot', s.slot); fd.append('by', userName()); fd.append('alt_ru', altRu.value); fd.append('alt_en', altEn.value);
    for (const [k, v] of Object.entries(fields)) fd.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    for (const [k, v] of Object.entries(files)) fd.append(k, v, `${k}.jpg`);
    prog.hidden = false;
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await upload(fd, (x) => { prog.firstChild.style.width = `${Math.round(x * 100)}%`; });
        S.photos.push(r.photo); S.cursor = Math.max(S.cursor, r.cursor); prog.hidden = true;
        const item = S.items.get(it.id); if (fields.source !== 'alt' && (item.status === 'todo' || item.status === 'ok')) item.status = 'changed';
        if (fields.source !== 'alt') { rerender(it.id); toast('Фото сохранено'); }
        return;
      } catch (e) {
        if (e.status && e.status < 500) { prog.hidden = true; toast(`Фото не принято: ${e.message === 'only JPEG, PNG or WebP' ? 'нужен JPEG, PNG или WebP' : e.message}`); return; }
        if (attempt >= 4) { prog.hidden = true; toast('Нет связи — фото не загружено.', [['Повторить', () => send(fields, files)]]); return; }
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  async function replace(f) {
    try {
      const { blob, bitmap } = await normaliseFile(f);
      const res = await cropDialog({ image: bitmap, ratio: s.ratio, title: `${s.label}: кадрирование`, free: s.free });
      if (!res) return;
      await send({ source: 'upload', params: res.params }, { orig: blob, crop: res.blob });
    } catch (e) { toast(e.message); }
  }
  async function recrop() {
    try {
      let src = null, initial = null;
      if (p && p.source === 'upload' && p.orig) { src = `${API}?a=img&d=${TOKEN}&photo=${p.pid}&v=orig`; initial = p.params; }
      else { src = sitePhotoUrl(it, s.slot); initial = p && p.source === 'site' ? p.params : null; }
      if (!src) { toast('Нет фото для кадрирования'); return; }
      const img = await loadBitmap(src);
      const res = await cropDialog({ image: img, ratio: s.ratio, title: `${s.label}: кадрировать заново`, initial, free: s.free });
      if (!res) return;
      await send({ source: p && p.source === 'upload' ? 'upload' : 'site', params: res.params, keep_orig: '1' }, { crop: res.blob });
    } catch (e) { toast(e.message || 'Не удалось открыть фото'); }
  }
  const changed = p && p.source !== 'reset';
  return h('div', { class: `slot${changed ? ' is-changed' : ''}` },
    h('p', { class: 'lbl' }, s.label, changed ? h('span', { class: 'dot', title: 'изменено' }) : null),
    url ? h('img', { class: 'slot__img', src: url, alt: '', style: `aspect-ratio:${s.free ? 'auto' : s.ratio}` }) : h('div', { class: 'slot__img slot__img--none', style: `aspect-ratio:${s.ratio}`, text: 'нет фото' }),
    prog,
    ro ? null : h('div', { class: 'row row--wrap' },
      h('button', { type: 'button', class: 'btn btn--sm', text: 'Заменить', onclick: () => file.click() }),
      url ? h('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Кадрировать заново', onclick: recrop }) : null,
      changed ? h('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Вернуть фото с сайта', onclick: () => send({ source: 'reset' }) }) : null, file),
    h('div', { class: 'slot__alt' }, altRu, altEn));
}

function openItem(id, { keepScroll = false, keepField = null } = {}) {
  const it = S.items.get(id); if (!it) { location.hash = ''; return; }
  S.open = id; const y = scrollY; const ro = !canEdit();
  const order = orderedItems(); const idx = order.indexOf(it);
  const groups = it.kind === 'site' ? siteGroups() : caseGroups(it);
  const note = h('textarea', { class: 'inp ta', rows: 2, placeholder: 'Что не так? Вопрос увидит владелец', value: it.note ?? '', readOnly: ro });
  const qbox = h('div', { class: 'qbox', hidden: it.status !== 'question' }, note, h('button', { type: 'button', class: 'btn btn--sm', text: 'Сохранить вопрос', onclick: () => setStatus('question', note.value) }));
  async function setStatus(st, n) {
    try { const r = await api('status', { body: { id, status: st, note: n ?? it.note, by: userName() } }); it.status = st; it.note = n ?? it.note; it.version = r.version; S.cursor = r.cursor; openItem(id, { keepScroll: true }); renderListMeta(); toast(st === 'ok' ? 'Отмечено: проверено' : 'Вопрос сохранён'); }
    catch (e) { toast(`Не сохранено: ${e.message}`); }
  }
  const view = h('div', { class: 'itemview' },
    h('div', { class: 'itemnav' },
      h('a', { class: 'btn btn--ghost btn--sm', href: '#', text: '← К списку' }),
      h('span', { class: 'row' },
        h('a', { class: 'iconbtn', href: idx > 0 ? `#/c/${order[idx - 1].id}` : '#', 'aria-label': 'Предыдущий', text: '‹' }),
        h('span', { id: 'save', class: 'save', 'aria-live': 'polite' }),
        h('span', { class: 'muted small', text: `${idx + 1} / ${order.length}` }),
        h('a', { class: 'iconbtn', href: idx < order.length - 1 ? `#/c/${order[idx + 1].id}` : '#', 'aria-label': 'Следующий', text: '›' }))),
    h('h1', { class: 'h1', text: itemName(it) }),
    h('p', { class: 'muted small' }, `${it.id} · ${catName(itemCat(it))} · `, h('span', { id: 'itemstatus', text: STATUS[it.status] }), it.by ? ` · ${it.by}, ${new Date(it.updated).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''),
    ro ? h('p', { class: 'warn', text: 'Редакция закрыта — только просмотр.' }) : h('div', { class: 'row row--wrap statusbar' },
      h('button', { type: 'button', class: `btn ${it.status === 'ok' ? 'btn--primary' : ''}`, text: '✓ Всё верно', onclick: () => setStatus('ok', '') }),
      h('button', { type: 'button', class: `btn ${it.status === 'question' ? 'btn--warn' : ''}`, text: '? Есть вопрос', onclick: () => { qbox.hidden = false; note.focus(); } }),
      h('button', { type: 'button', class: 'btn btn--ghost', text: 'История', onclick: () => showHistory(id) })),
    qbox,
    h('div', { class: 'itemgrid' },
      h('div', { class: 'itemform' },
        ...groups.map((g) => h('details', { class: 'group', open: !g.collapsed },
          h('summary', { class: 'group__title', text: g.title }),
          ...g.fields.map((f) => {
            const changed = it.base && !same(it.base.f[f.k], it.data[f.k]);
            const ctl = fieldControl(it, f); const inner = ctl.matches('input,textarea,select') ? ctl : ctl.querySelector('input,textarea,select');
            if (inner) inner.id = `f-${f.k}`;
            return h('div', { class: `field${changed ? ' is-changed' : ''}`, 'data-field': f.k },
              h('div', { class: 'field__head' }, h('label', { class: 'lbl', text: f.label, htmlFor: inner ? `f-${f.k}` : undefined }), h('span', { class: 'dot', title: 'изменено' }),
                it.base && !ro ? h('button', { type: 'button', class: 'linkbtn small', text: 'Вернуть как на сайте', onclick: () => { edit(id, f.k, structuredClone(it.base.f[f.k] ?? (Array.isArray(it.data[f.k]) ? [] : ''))); rerender(id); } }) : null),
              f.hint ? h('p', { class: 'hint', text: f.hint }) : null,
              ctl);
          }))),
        h('details', { class: 'group', open: true }, h('summary', { class: 'group__title', text: 'Фото' }), photoSlots(it)),
        h('div', { class: 'field', 'data-field': 'comment' }, h('label', { class: 'lbl', text: 'Комментарий редактора' }), fieldControl(it, { k: 'comment', t: 'area' }))),
      h('aside', { class: 'itemside' }, h('p', { class: 'lbl', text: 'Превью карточки на сайте' }), (previewBox = h('div', { class: 'pvbox' })))),
    h('div', { class: 'itemnav itemnav--bottom' },
      idx > 0 ? h('a', { class: 'btn btn--ghost btn--sm', href: `#/c/${order[idx - 1].id}`, text: '‹ Предыдущий' }) : h('span'),
      idx < order.length - 1 ? h('a', { class: 'btn btn--sm', href: `#/c/${order[idx + 1].id}`, text: 'Следующий ›' }) : h('span')));
  $('#app').replaceChildren(view); renderPreview();
  if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
  if (keepField) view.querySelector(`[data-field="${keepField}"] input, [data-field="${keepField}"] textarea`)?.focus({ preventScroll: true });
  setSave(queue.length ? 'saving' : canEdit() ? 'ok' : 'closed');
}

/* ── history ── */
const fmtV = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? x.title || '…' : x)).join('; ') || '—' : v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? (v.status ? STATUS[v.status] + (v.note ? `: ${v.note}` : '') : JSON.stringify(v)) : typeof v === 'boolean' ? (v ? 'да' : 'нет') : String(v));
async function showHistory(id = null) {
  const { log } = await api('log', { query: id ? { id } : {} });
  const box = h('div', { class: 'modal' }, h('div', { class: 'card modal__box modal__box--wide' },
    h('div', { class: 'row row--between' }, h('h2', { class: 'h2', text: id ? `История: ${itemName(S.items.get(id))}` : 'История правок' }), h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Закрыть', text: '×', onclick: () => box.remove() })),
    log.length ? h('ol', { class: 'hist' }, log.map((e) => h('li', { class: 'hist__row' },
      h('p', { class: 'small muted', text: `${new Date(e.at).toLocaleString('ru-RU')} · ${e.by || '—'}${id ? '' : ` · ${S.items.get(e.case_id) ? itemName(S.items.get(e.case_id)) : e.case_id}`}` }),
      h('p', {}, h('b', { text: e.type === 'photo' ? `Фото ${e.field.slice(6)}` : e.type === 'new' ? 'Новый кейс' : e.type === 'status' ? 'Статус' : FIELD_LABELS[e.field] ?? e.field })),
      e.type === 'field' || e.type === 'status' ? h('p', { class: 'small' }, h('span', { class: 'was', text: fmtV(e.old) }), ' → ', h('span', { text: fmtV(e.new) })) : null,
      canEdit() && ['field', 'photo', 'status'].includes(e.type) ? h('button', { type: 'button', class: 'linkbtn small', text: 'Откатить эту правку', onclick: async () => { if (!confirm('Вернуть значение, которое было до этой правки?')) return; const r = await api('revert', { body: { lid: e.lid, by: userName() } }); S.items.set(r.item.id, r.item); S.cursor = r.cursor; await poll(); box.remove(); if (S.open) openItem(S.open, { keepScroll: true }); else renderList(); toast('Правка откачена'); } }) : null)))
      : h('p', { class: 'muted', text: 'Правок пока нет.' })));
  document.body.append(box);
}

/* ── download ── */
async function download() {
  const t = toast('Собираю архив…');
  try {
    await flush();
    const { buildZip } = await import('./export.js');
    const { zip, name } = await buildZip(S, async (pid, v) => new Uint8Array(await (await fetch(`${API}?a=img&d=${TOKEN}&photo=${pid}&v=${v}`, { credentials: 'same-origin' })).arrayBuffer()),
      (n, all) => { t.firstChild.textContent = `Собираю архив… фото ${n} из ${all}`; });
    const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
    const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    t.remove(); toast('Архив скачан');
  } catch (e) { t.remove(); toast(`Не удалось собрать архив: ${e.message}`); }
}

/* ── routing ── */
function route() {
  const m = location.hash.match(/^#\/c\/([a-z0-9-]+)$/);
  if (m) openItem(m[1]);
  else if (location.hash === '#/download') { S.open = null; draftScreen(); history.replaceState(null, '', location.pathname + location.search); download(); }
  else if (location.hash === '#/history') { S.open = null; draftScreen(); showHistory(); history.replaceState(null, '', location.pathname + location.search); }
  else { S.open = null; draftScreen(); }
}

(async function main() {
  if (!TOKEN) { ownerScreen(); return; }
  try { await loadState(); } catch (e) { $('#app').replaceChildren(h('p', { class: 'warn', text: e.status === 404 ? 'Редакция не найдена. Проверьте ссылку.' : 'Не удалось загрузить редакцию. Обновите страницу.' })); return; }
  document.title = `${S.draft.title} — проверка кейсов`;
  if (canEdit()) await askName();
  addEventListener('hashchange', route); route();
  flush(); setInterval(poll, 15000);
})();
