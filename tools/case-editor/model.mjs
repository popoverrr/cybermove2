// Case editor data model (docs/17-cases-editor.md): the site's case data (content/data/cases.json, sites.json,
// case-rank.json) ⇄ flat editor fields. Used by the snapshot (site → seed.json) and by the import (edits → site).
// Import applies only changed fields onto the existing structure, so anything the editor does not show is kept.

export const LANGS = ['ru', 'en'];
const ROLE = { ru: 'Роль Cyber Move Consulting', en: 'Cyber Move Consulting role' };
const TITLES = {
  task: { ru: 'Задача', en: 'Task' }, project: { ru: 'Проект', en: 'Project' }, done: { ru: 'Что было сделано', en: 'What we did' },
  result: { ru: 'Результат', en: 'Result' }, vessel: { ru: 'Судно', en: 'Vessel' },
};
// vessel rows: editor field ← RU key / EN key
export const VESSEL = [
  ['v_type', 'Тип', 'Type'], ['v_imo', 'IMO', 'IMO'], ['v_year', 'Год постройки', 'Built'], ['v_flag', 'Флаг', 'Flag'],
  ['v_length', 'Длина', 'Length'], ['v_width', 'Ширина', 'Beam'], ['v_gt', 'GT', 'GT'], ['v_dwt', 'Дедвейт', 'Deadweight'],
  ['v_value', 'Стоимость судна', 'Vessel value'],
];
const split = (s, sep) => (s ? s.split(sep).map((x) => x.trim()).filter(Boolean) : []);
const paras = (b) => (b ? b.paras.join('\n\n') : '');

export function monogram(name) {
  const w = String(name || '').replace(/[«»"()]/g, '').split(/[\s/]+/).filter(Boolean);
  return (w.length === 1 ? w[0].slice(0, 4) : w.slice(0, 2).map((x) => x[0]).join('')).toUpperCase();
}

/** cases.json item → editor fields */
export function caseToFields(c) {
  const f = { kind: 'case', show: !c.hidden, rank: c.rank ?? null, n: Number(c.n) || null, sector: c.sector, monogram: c.monogram ?? monogram(c.name.ru) };
  for (const l of LANGS) {
    const bl = c.blocks[l] ?? [];
    const by = (k) => bl.find((b) => b.kind === k);
    const role = bl.find((b) => b.kind === 'extra' && b.title === ROLE[l]);
    f[`name_${l}`] = c.name[l] ?? '';
    f[`summary_${l}`] = c.summary[l] ?? '';
    f[`tags_${l}`] = split(c.disciplinesLine?.[l], '·');
    f[`card_${l}`] = c.tags?.[l] ?? '';
    f[`task_${l}`] = paras(by('task'));
    f[`project_${l}`] = paras(by('project'));
    f[`role_${l}`] = paras(role);
    f[`done_${l}`] = by('done')?.items ?? [];
    f[`result_${l}`] = paras(by('result'));
    f[`extra_${l}`] = bl.filter((b) => b.kind === 'extra' && b !== role).map((b) => ({ title: b.title, text: b.paras.join('\n\n'), items: b.items }));
    f[`alt_${l}`] = c.alt?.[l] ?? '';
    f[`seo_title_${l}`] = c.seo?.[l]?.title ?? '';
    f[`seo_desc_${l}`] = c.seo?.[l]?.description ?? '';
  }
  f.disciplines = split(c.disciplines?.ru, '·');
  f.link_text = c.link?.ru?.text ?? '';
  f.link_url = c.link?.ru?.href ?? '';
  f.services = [...(c.services ?? [])];
  f.similar = [...new Set(c.similar ?? [])];
  const v = c.blocks.ru.find((b) => b.kind === 'vessel');
  if (v) {
    const ve = c.blocks.en.find((b) => b.kind === 'vessel');
    for (const [key, ru] of VESSEL) f[key] = v.rows.find((r) => r.k === ru)?.v ?? '';
    f.v_value_note = v.rows.find((r) => r.k === 'Стоимость судна')?.note ?? '';
    f.v_note_ru = v.former ?? '';
    f.v_note_en = ve?.former ?? '';
    f.v_link = v.source?.href ?? '';
  }
  f.comment = '';
  return f;
}

/** sites.json item → editor fields */
export function siteToFields(s, i) {
  return {
    kind: 'site', show: !s.hidden, order: s.order ?? i + 1, name: s.name, domain: s.domain, url: s.url,
    type_ru: s.type.ru, type_en: s.type.en, summary_ru: s.summary.ru, summary_en: s.summary.en,
    desc_ru: s.description.ru, desc_en: s.description.en, langs: (s.languages ?? []).join(' · '),
    tags_ru: [...(s.tags?.ru ?? [])], tags_en: [...(s.tags?.en ?? [])], comment: '',
  };
}

const blank = () => ({
  id: '', n: '', rank: 100, sector: 'experts', name: { ru: '', en: '' }, cardName: { ru: '', en: '' }, tags: { ru: '', en: '' }, summary: { ru: '', en: '' },
  disciplinesLine: { ru: '', en: '' }, disciplines: { ru: '', en: '' }, link: null, blocks: { ru: [], en: [] }, services: [], similar: [],
  live: {}, logo: null, alt: { ru: '', en: '' }, seo: { ru: { title: '', description: '', h1: '' }, en: { title: '', description: '', h1: '' } },
});

function setBlock(c, l, kind, title, text, items) {
  const bl = c.blocks[l];
  let b = kind === 'role' ? bl.find((x) => x.kind === 'extra' && x.title === ROLE[l]) : bl.find((x) => x.kind === kind);
  const empty = !String(text || '').trim() && !(items && items.length);
  if (empty) { if (b) bl.splice(bl.indexOf(b), 1); return; }
  if (!b) {
    b = { kind: kind === 'role' ? 'extra' : kind, title, paras: [], items: [], numbered: kind === 'done' };
    const order = ['vessel', 'task', 'project', 'role', 'done', 'result'];
    const rank = (x) => order.indexOf(x.kind === 'extra' ? (x.title === ROLE[l] ? 'role' : 'z') : x.kind);
    const pos = bl.findIndex((x) => rank(x) > order.indexOf(kind) || rank(x) === -1);
    bl.splice(pos < 0 ? bl.length : pos, 0, b);
  }
  if (text !== undefined) b.paras = split(text, /\n\s*\n/);
  if (items !== undefined) b.items = items;
}

/** apply editor fields onto a cases.json item (only the given keys) */
export function applyCaseFields(c0, f, keys) {
  const c = c0 ? structuredClone(c0) : blank();
  for (const k of keys) {
    const v = f[k];
    const m = k.match(/^(.*)_(ru|en)$/); const l = m?.[2]; const base = m?.[1];
    if (k === 'show') { if (v) delete c.hidden; else c.hidden = true; }
    else if (k === 'rank') c.rank = Number(v) || 100;
    else if (k === 'n') c.n = String(v).padStart(2, '0');
    else if (k === 'sector') c.sector = v;
    else if (k === 'monogram') c.monogram = v;
    else if (base === 'name') { c.name[l] = v; c.cardName[l] = v; if (c.seo?.[l]) c.seo[l].h1 = v; }
    else if (base === 'summary') c.summary[l] = v;
    else if (base === 'tags') c.disciplinesLine[l] = v.join(' · ');
    else if (base === 'card') c.tags[l] = v;
    else if (base === 'task') setBlock(c, l, 'task', TITLES.task[l], v);
    else if (base === 'project') setBlock(c, l, 'project', TITLES.project[l], v);
    else if (base === 'role') setBlock(c, l, 'role', ROLE[l], v);
    else if (base === 'done') setBlock(c, l, 'done', TITLES.done[l], undefined, v);
    else if (base === 'result') setBlock(c, l, 'result', TITLES.result[l], v);
    else if (base === 'extra') {
      const role = c.blocks[l].find((b) => b.kind === 'extra' && b.title === ROLE[l]);
      const keep = c.blocks[l].filter((b) => b.kind !== 'extra' || b === role);
      c.blocks[l] = [...keep, ...v.filter((x) => x.title || x.text || x.items?.length).map((x) => ({ kind: 'extra', title: x.title, paras: split(x.text, /\n\s*\n/), items: x.items ?? [], numbered: false }))];
    }
    else if (base === 'alt') c.alt[l] = v;
    else if (base === 'seo_title') (c.seo[l] ??= {}).title = v;
    else if (base === 'seo_desc') (c.seo[l] ??= {}).description = v;
    else if (k === 'disciplines') { c.disciplines.ru = v.join(' · '); c.disciplines.en = v.join(' · '); }
    else if (k === 'link_text' || k === 'link_url') {
      const text = k === 'link_text' ? v : f.link_text; const href = k === 'link_url' ? v : f.link_url;
      c.link = href ? { ru: { text: text || href, href }, en: { text: text || href, href } } : null;
    }
    else if (k === 'services') c.services = v;
    else if (k === 'similar') c.similar = v;
    else if (k.startsWith('v_')) {
      for (const lang of LANGS) {
        const b = c.blocks[lang].find((x) => x.kind === 'vessel'); if (!b) continue;
        const row = VESSEL.find((r) => r[0] === k);
        if (row) { const key = lang === 'ru' ? row[1] : row[2]; const r = b.rows.find((x) => x.k === key); if (r) r.v = v; else b.rows.push({ k: key, v, note: null }); }
        if (k === 'v_value_note' && lang === 'ru') { const r = b.rows.find((x) => x.k === 'Стоимость судна'); if (r) r.note = v || null; }
        if (k === `v_note_${lang}`) b.former = v;
        if (k === 'v_link' && b.source) b.source.href = v;
      }
    }
  }
  return c;
}

/** apply editor fields onto a sites.json item */
export function applySiteFields(s0, f, keys) {
  const s = s0 ? structuredClone(s0) : { id: '', name: '', domain: '', url: '', type: { ru: '', en: '' }, summary: { ru: '', en: '' }, description: { ru: '', en: '' }, languages: [], tags: { ru: [], en: [] }, direction: 'systems' };
  for (const k of keys) {
    const v = f[k]; const m = k.match(/^(.*)_(ru|en)$/);
    if (k === 'show') { if (v) delete s.hidden; else s.hidden = true; }
    else if (k === 'order') s.order = Number(v) || null;
    else if (['name', 'domain', 'url'].includes(k)) s[k] = v;
    else if (k === 'langs') s.languages = split(v, '·');
    else if (m && m[1] === 'type') s.type[m[2]] = v;
    else if (m && m[1] === 'summary') s.summary[m[2]] = v;
    else if (m && m[1] === 'desc') s.description[m[2]] = v;
    else if (m && m[1] === 'tags') s.tags[m[2]] = v;
  }
  return s;
}

/** photo slots of an item */
export function slotsFor(kind, id, liveFiles, featured) {
  if (kind === 'site') return [{ slot: 'shot', ratio: 1440 / 900, label: 'Скриншот сайта', file: `sites/${id}-desktop.webp` }];
  const s = [
    { slot: '4x3', ratio: 4 / 3, label: 'Фото карточки 4:3', file: `live/${id}-4x3.webp` },
    { slot: '16x9', ratio: 16 / 9, label: 'Обложка 16:9', file: `live/${id}-16x9.webp` },
  ];
  if (featured || liveFiles.has(`${id}-4x5.webp`)) s.push({ slot: '4x5', ratio: 4 / 5, label: 'Фото 4:5 (главная)', file: `live/${id}-4x5.webp` });
  s.push({ slot: 'logo', ratio: 1, label: 'Логотип в чипе', file: `live/${id}.webp`, free: true });
  return s.map((x) => ({ ...x, exists: x.file.startsWith('live/') ? liveFiles.has(x.file.slice(5)) : true }));
}
