// Field set of the case editor = the columns of docs/ref/cases-fields-reference.xlsx (sheets «Кейсы», «Суда», «Сайты»).
// type: text | area | num | toggle | select | chips | list | sections | refs(services|cases) ; max → character counter

const L = { ru: 'RU', en: 'EN' };
const textGroup = (l) => [
  { k: `name_${l}`, t: 'text', label: 'Название', hint: 'Как в карточке и в заголовке страницы кейса' },
  { k: `summary_${l}`, t: 'area', label: 'Подзаголовок', hint: 'Одна-две строки под названием на странице кейса' },
  { k: `tags_${l}`, t: 'chips', label: 'Теги', hint: 'Строка тегов на странице кейса; Enter — добавить' },
  { k: `card_${l}`, t: 'text', label: 'Строка под названием в карточке', hint: 'Коротко, через « · »' },
  { k: `task_${l}`, t: 'area', label: 'Задача' },
  { k: `project_${l}`, t: 'area', label: 'Проект' },
  { k: `role_${l}`, t: 'area', label: 'Роль Cyber Move Consulting' },
  { k: `done_${l}`, t: 'list', label: 'Что сделано', hint: 'Каждый пункт отдельно; порядок можно менять' },
  { k: `result_${l}`, t: 'area', label: 'Результат' },
  { k: `extra_${l}`, t: 'sections', label: 'Дополнительные разделы', hint: 'Заголовок, текст и пункты' },
];

export function caseGroups(item) {
  const g = [
    { title: 'Основное', fields: [
      { k: 'show', t: 'toggle', label: 'Показывать на сайте' },
      { k: 'rank', t: 'num', label: 'Порядок на главной', hint: '1 — первым в ленте и в своей категории' },
      { k: 'n', t: 'num', label: '№ на странице кейсов' },
      { k: 'sector', t: 'select', label: 'Категория', src: 'categories' },
      { k: 'monogram', t: 'text', label: 'Монограмма в чипе', hint: 'Показывается, если нет логотипа' },
    ] },
    { title: 'Русский текст', fields: textGroup('ru') },
    { title: 'English', collapsed: true, fields: textGroup('en') },
    { title: 'Общее', fields: [
      { k: 'disciplines', t: 'chips', label: 'Дисциплины', hint: 'Блок дисциплин на странице кейса' },
      { k: 'link_text', t: 'text', label: 'Внешняя ссылка — текст' },
      { k: 'link_url', t: 'text', label: 'Внешняя ссылка — URL', hint: 'https://…' },
      { k: 'services', t: 'refs', src: 'services', label: 'Услуги в проекте' },
      { k: 'similar', t: 'refs', src: 'cases', label: 'Похожие кейсы' },
    ] },
  ];
  if ('v_type' in (item.data ?? {}) || 'v_type' in (item.base?.f ?? {})) g.push({ title: 'Судно', fields: [
    { k: 'v_type', t: 'text', label: 'Тип' }, { k: 'v_imo', t: 'text', label: 'IMO' }, { k: 'v_year', t: 'text', label: 'Год постройки' },
    { k: 'v_flag', t: 'text', label: 'Флаг' }, { k: 'v_length', t: 'text', label: 'Длина' }, { k: 'v_width', t: 'text', label: 'Ширина' },
    { k: 'v_gt', t: 'text', label: 'GT' }, { k: 'v_dwt', t: 'text', label: 'Дедвейт' }, { k: 'v_value', t: 'text', label: 'Стоимость судна' },
    { k: 'v_value_note', t: 'text', label: 'Стоимость — пояснение' }, { k: 'v_note_ru', t: 'area', label: 'Примечание RU' }, { k: 'v_note_en', t: 'area', label: 'Примечание EN' },
    { k: 'v_link', t: 'text', label: 'Ссылка на данные судна' },
  ] });
  g.push({ title: 'SEO', collapsed: true, fields: [
    { k: 'seo_title_ru', t: 'text', label: 'Title RU', max: 60 }, { k: 'seo_desc_ru', t: 'area', label: 'Description RU', max: 160 },
    { k: 'seo_title_en', t: 'text', label: 'Title EN', max: 60 }, { k: 'seo_desc_en', t: 'area', label: 'Description EN', max: 160 },
    { k: 'alt_ru', t: 'text', label: 'Alt фото RU' }, { k: 'alt_en', t: 'text', label: 'Alt фото EN' },
  ] });
  return g;
}

export function siteGroups() {
  return [
    { title: 'Основное', fields: [
      { k: 'show', t: 'toggle', label: 'Показывать на сайте' }, { k: 'order', t: 'num', label: 'Порядок' },
      { k: 'name', t: 'text', label: 'Название' }, { k: 'domain', t: 'text', label: 'Домен' }, { k: 'url', t: 'text', label: 'URL' },
      { k: 'langs', t: 'text', label: 'Языки', hint: 'Через « · »' },
    ] },
    { title: 'Русский текст', fields: [
      { k: 'type_ru', t: 'text', label: 'Тип' }, { k: 'summary_ru', t: 'area', label: 'Кратко' }, { k: 'desc_ru', t: 'area', label: 'Описание' }, { k: 'tags_ru', t: 'chips', label: 'Теги' },
    ] },
    { title: 'English', collapsed: true, fields: [
      { k: 'type_en', t: 'text', label: 'Type' }, { k: 'summary_en', t: 'area', label: 'Summary' }, { k: 'desc_en', t: 'area', label: 'Description' }, { k: 'tags_en', t: 'chips', label: 'Tags' },
    ] },
  ];
}

/** column layout of cases.xlsx (same as docs/ref/cases-fields-reference.xlsx, sheet «Кейсы») */
export const XLSX_CASES = [
  ['ID (не менять)', (it) => it.id], ['Порядок на главной', (it, f) => f.rank], ['Показывать на сайте', (it, f) => (f.show === false ? 'нет' : 'да')],
  ['№ на странице кейсов', (it, f) => f.n], ['Категория (код)', (it, f) => f.sector], ['Категория', (it, f, c) => c.cat(f.sector)],
  ...['ru', 'en'].flatMap((l) => [
    [`Название ${L[l]}`, (it, f) => f[`name_${l}`]], [`Подзаголовок ${L[l]}`, (it, f) => f[`summary_${l}`]], [`Теги ${L[l]} (через ; )`, (it, f) => (f[`tags_${l}`] ?? []).join('; ')],
    [`Строка под названием в карточке ${L[l]}`, (it, f) => f[`card_${l}`]], [`Задача ${L[l]}`, (it, f) => f[`task_${l}`]], [`Проект ${L[l]}`, (it, f) => f[`project_${l}`]],
    [`Роль Cyber Move Consulting ${L[l]}`, (it, f) => f[`role_${l}`]], [`Что сделано ${L[l]} (каждый пункт с новой строки)`, (it, f) => (f[`done_${l}`] ?? []).join('\n')],
    [`Результат ${L[l]}`, (it, f) => f[`result_${l}`]],
    [`Доп. разделы ${L[l]}`, (it, f) => (f[`extra_${l}`] ?? []).map((s) => `[${s.title}]\n${[s.text, ...(s.items ?? []).map((x) => '— ' + x)].filter(Boolean).join('\n')}`).join('\n\n')],
  ]),
  ['Дисциплины (блок, через ; )', (it, f) => (f.disciplines ?? []).join('; ')], ['Внешняя ссылка — текст', (it, f) => f.link_text], ['Внешняя ссылка — URL', (it, f) => f.link_url],
  ['Услуги в проекте (адреса, каждый с новой строки)', (it, f, c) => (f.services ?? []).map((s) => c.servicePath(s)).join('\n')], ['Похожие кейсы (ID через ; )', (it, f) => (f.similar ?? []).join('; ')],
  ['Фото карточки 4:3 — URL', (it, f, c) => c.photoUrl(it, '4x3')], ['Фото обложки 16:9 — URL', (it, f, c) => c.photoUrl(it, '16x9')], ['Логотип в чипе — URL', (it, f, c) => c.photoUrl(it, 'logo')],
  ['Монограмма в чипе', (it, f) => f.monogram], ['Alt фото RU', (it, f) => f.alt_ru], ['Alt фото EN', (it, f) => f.alt_en],
  ['SEO title RU', (it, f) => f.seo_title_ru], ['SEO description RU', (it, f) => f.seo_desc_ru], ['SEO title EN', (it, f) => f.seo_title_en], ['SEO description EN', (it, f) => f.seo_desc_en],
  ['Страница RU', (it) => `https://cybermove.asia/cases/${it.id}/`], ['Страница EN', (it) => `https://cybermove.asia/en/cases/${it.id}/`],
  ['Комментарий редактора', (it, f) => [f.comment, it.note && `Вопрос: ${it.note}`].filter(Boolean).join('\n')],
];
export const XLSX_VESSELS = [
  ['ID', (it) => it.id], ['Судно', (it, f) => f.name_ru], ['Тип', (it, f) => f.v_type], ['IMO', (it, f) => f.v_imo], ['Год постройки', (it, f) => f.v_year], ['Флаг', (it, f) => f.v_flag],
  ['Длина', (it, f) => f.v_length], ['Ширина', (it, f) => f.v_width], ['GT', (it, f) => f.v_gt], ['Дедвейт', (it, f) => f.v_dwt], ['Стоимость судна', (it, f) => f.v_value],
  ['Стоимость судна — пояснение', (it, f) => f.v_value_note], ['Примечание RU', (it, f) => f.v_note_ru], ['Примечание EN', (it, f) => f.v_note_en], ['Ссылка на данные судна', (it, f) => f.v_link],
];
export const XLSX_SITES = [
  ['ID', (it) => it.id], ['Показывать на сайте', (it, f) => (f.show === false ? 'нет' : 'да')], ['Порядок', (it, f) => f.order], ['Название', (it, f) => f.name], ['Домен', (it, f) => f.domain],
  ['URL', (it, f) => f.url], ['Тип RU', (it, f) => f.type_ru], ['Тип EN', (it, f) => f.type_en], ['Кратко RU', (it, f) => f.summary_ru], ['Кратко EN', (it, f) => f.summary_en],
  ['Описание RU', (it, f) => f.desc_ru], ['Описание EN', (it, f) => f.desc_en], ['Языки', (it, f) => f.langs], ['Теги RU', (it, f) => (f.tags_ru ?? []).join('; ')], ['Теги EN', (it, f) => (f.tags_en ?? []).join('; ')],
  ['Скриншот на сайте — URL', (it, f, c) => c.photoUrl(it, 'shot')], ['Комментарий редактора', (it, f) => [f.comment, it.note && `Вопрос: ${it.note}`].filter(Boolean).join('\n')],
];

export const FIELD_LABELS = (() => {
  const m = { show: 'Показывать на сайте', rank: 'Порядок на главной', n: '№ на странице кейсов', sector: 'Категория', monogram: 'Монограмма', comment: 'Комментарий редактора', order: 'Порядок',
    disciplines: 'Дисциплины', link_text: 'Ссылка — текст', link_url: 'Ссылка — URL', services: 'Услуги в проекте', similar: 'Похожие кейсы', name: 'Название', domain: 'Домен', url: 'URL', langs: 'Языки' };
  for (const g of [...caseGroups({ data: { v_type: '' } }), ...siteGroups()]) for (const f of g.fields) m[f.k] ??= /_(ru|en)$/.test(f.k) && !/ (RU|EN)$/.test(f.label) ? `${f.label} ${f.k.endsWith('_ru') ? 'RU' : 'EN'}` : f.label;
  return m;
})();
