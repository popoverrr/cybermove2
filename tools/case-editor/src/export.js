// «Скачать изменения» (docs/17-cases-editor.md §6): ZIP built in the browser with fflate —
// changes.json, cases-full.json, changes.md, cases.xlsx, photos/<ID>/<slot>-original.<ext> + -crop.jpg.
import { zipSync, strToU8 } from 'fflate';
import { XLSX_CASES, XLSX_SITES, XLSX_VESSELS, FIELD_LABELS } from './fields.js';

const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return `${n} ${m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c}`; };
const STATUS = { todo: 'Не проверено', ok: 'Проверено', changed: 'Изменено', question: 'Есть вопрос' };
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/* ── minimal XLSX (inline strings, wrap text, bold header, frozen first row) ── */
function colName(i) { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function sheetXml(rows) {
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const ref = `${colName(ci)}${ri + 1}`; const st = ri === 0 ? ' s="1"' : ' s="2"';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
    if (v === null || v === undefined || v === '') return `<c r="${ref}"${st}/>`;
    return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const cols = rows[0].map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 22 : 30}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}
export function xlsx(sheets) {
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s.rows); });
  const o = {}; for (const [k, v] of Object.entries(files)) o[k] = strToU8(v);
  return zipSync(o, { level: 6 });
}

/** builds the ZIP for a draft state; fetchPhoto(pid, 'orig'|'crop') → Uint8Array */
export async function buildZip(S, fetchPhoto, onProgress = () => {}) {
  const items = [...S.items.values()];
  const cat = (id) => S.categories.find((c) => c.id === id)?.ru ?? id;
  const servicePath = (id) => S.services.find((s) => s.id === id)?.path ?? id;
  const lastPhoto = (it, slot) => { const l = S.photos.filter((p) => p.case_id === it.id && p.slot === slot); return l.length ? l[l.length - 1] : null; };
  const sitePhoto = (it, slot) => it.base?.slots?.find((s) => s.slot === slot)?.url;
  const photoUrl = (it, slot) => { const p = lastPhoto(it, slot); if (p && p.source !== 'reset') return `photos/${it.id}/${slot}-crop.jpg`; const u = sitePhoto(it, slot); return u ? new URL(u, location.href).href : ''; };
  const ctx = { cat, servicePath, photoUrl };

  const changes = []; let fieldsChanged = 0, newPhotos = 0, questions = 0;
  const md = [];
  for (const it of items) {
    const base = it.base?.f ?? null; const f = it.data;
    const diff = Object.keys({ ...(base ?? {}), ...f }).filter((k) => !same(base?.[k], f[k])).map((k) => ({ field: k, label: FIELD_LABELS[k] ?? k, was: base ? base[k] ?? null : null, now: f[k] ?? null }));
    const ph = [...new Set(S.photos.filter((p) => p.case_id === it.id).map((p) => p.slot))].map((slot) => lastPhoto(it, slot)).filter(Boolean)
      .filter((p) => p.source !== 'reset' || S.photos.some((q) => q.case_id === it.id && q.slot === p.slot && q.source !== 'reset'));
    const photos = ph.map((p) => ({ slot: p.slot, action: p.source === 'reset' ? 'reset' : p.source === 'upload' ? 'replaced' : 'recropped', crop: p.params, alt_ru: p.alt_ru, alt_en: p.alt_en,
      original: p.orig ? `photos/${it.id}/${p.slot}-original.${(p.orig_type || 'image/jpeg').split('/')[1].replace('jpeg', 'jpg')}` : null, crop_file: p.crop ? `photos/${it.id}/${p.slot}-crop.jpg` : null, pid: p.pid, by: p.by, at: p.at }));
    if (!diff.length && !photos.length && it.status === 'todo' && !it.note) continue;
    fieldsChanged += diff.length; newPhotos += photos.filter((p) => p.action !== 'reset').length; if (it.status === 'question') questions++;
    changes.push({ id: it.id, kind: it.kind, isNew: !it.base, hidden: f.show === false, status: it.status, question: it.note || null, comment: f.comment || null,
      lastEditedBy: it.by, lastEditedAt: it.updated, fields: diff, photos });
  }
  const changedItems = changes.filter((c) => c.fields.length || c.photos.length);
  const newItems = changes.filter((c) => c.isNew).map((c) => c.id);
  const hidden = changes.filter((c) => c.hidden).map((c) => c.id);
  const now = new Date();
  const json = { format: 'cybermove-cases-edits/1', draft: S.draft.title, exportedAt: now.toISOString(), summary: { itemsChanged: changedItems.length, fieldsChanged, newPhotos, questions, newItems, hidden,
    checked: items.filter((i) => i.status === 'ok').length, total: items.length }, items: changes };

  // human-readable
  const fmt = (v) => (Array.isArray(v) ? (v.length ? v.map((x) => (typeof x === 'object' ? `[${x.title}] ${x.text ?? ''} ${(x.items ?? []).join('; ')}` : x)).join('; ') : '—') : v === null || v === '' || v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'да' : 'нет') : String(v));
  md.push(`# Правки кейсов — ${S.draft.title}`, '', `Выгружено ${now.toLocaleString('ru-RU')}.`, '',
    `**Сводка:** изменено ${plural(changedItems.length, 'кейс', 'кейса', 'кейсов')} (${plural(fieldsChanged, 'поле', 'поля', 'полей')}), ${plural(newPhotos, 'новое фото', 'новых фото', 'новых фото')}, ${plural(questions, 'вопрос', 'вопроса', 'вопросов')}; новых кейсов — ${newItems.length}, скрытых — ${hidden.length}. Проверено ${json.summary.checked} из ${items.length}.`, '');
  for (const c of changes) {
    const it = S.items.get(c.id); const name = it.data.name_ru || it.data.name || c.id;
    md.push(`## ${name} (${c.id})${c.isNew ? ' — новый' : ''}`, '', `Статус: ${STATUS[c.status] ?? c.status}${c.lastEditedBy ? ` · последняя правка: ${c.lastEditedBy}` : ''}`);
    if (c.question) md.push('', `**Вопрос:** ${c.question}`);
    if (c.comment) md.push('', `**Комментарий:** ${c.comment}`);
    if (c.hidden) md.push('', '**Скрыт с сайта.**');
    if (c.fields.length) { md.push(''); for (const d of c.fields) md.push(`- **${d.label}:** было «${fmt(d.was)}» → стало «${fmt(d.now)}»`); }
    if (c.photos.length) { md.push(''); for (const p of c.photos) md.push(`- Фото ${p.slot}: ${p.action === 'replaced' ? 'заменено' : p.action === 'recropped' ? 'перекадрировано' : 'возвращено как на сайте'}${p.by ? ` (${p.by})` : ''}`); }
    md.push('');
  }

  const full = items.map((it) => ({ id: it.id, kind: it.kind, status: it.status, question: it.note || null, fields: it.data }));
  const rowsOf = (cols, list) => [cols.map((c) => c[0]), ...list.map((it) => cols.map((c) => { const v = c[1](it, it.data, ctx); return v === undefined || v === null ? '' : v; }))];
  const caseItems = items.filter((i) => i.kind === 'case').sort((a, b) => (a.data.rank ?? 999) - (b.data.rank ?? 999));
  const book = xlsx([
    { name: 'Кейсы', rows: rowsOf(XLSX_CASES, caseItems) },
    { name: 'Суда', rows: rowsOf(XLSX_VESSELS, caseItems.filter((i) => 'v_type' in i.data)) },
    { name: 'Сайты', rows: rowsOf(XLSX_SITES, items.filter((i) => i.kind === 'site')) },
  ]);

  const files = { 'changes.json': strToU8(JSON.stringify(json, null, 2)), 'cases-full.json': strToU8(JSON.stringify(full, null, 2)), 'changes.md': strToU8(md.join('\n')), 'cases.xlsx': book };
  const todo = changes.flatMap((c) => c.photos.map((p) => ({ c, p })));
  let n = 0;
  for (const { c, p } of todo) {
    if (p.original) files[p.original] = await fetchPhoto(p.pid, 'orig');
    else if (p.action === 'recropped') { const u = sitePhoto(S.items.get(c.id), p.slot); if (u) { const name = `photos/${c.id}/${p.slot}-original.${u.split('.').pop()}`; files[name] = new Uint8Array(await (await fetch(new URL(u, location.href))).arrayBuffer()); p.original = name; } }
    if (p.crop_file) files[p.crop_file] = await fetchPhoto(p.pid, 'crop');
    onProgress(++n, todo.length);
  }
  return { zip: zipSync(files, { level: 0 }), name: `cybermove-cases-edits-${now.toISOString().slice(0, 10)}.zip` };
}
