// Выкладка папки сборки на хостинг по FTPS. Настройки — deploy/ftp.env (вне git).
// Пароль вписывает владелец аккаунта в файл; в чат и в код он не попадает.
//   node scripts/deploy-ftp.mjs [--dry-run] [--no-clean]
import { Client } from 'basic-ftp';
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, 'deploy', 'ftp.env');
const DRY = process.argv.includes('--dry-run');
const NO_CLEAN = process.argv.includes('--no-clean');
const MANIFEST = '.deploy-manifest.json';
const TEXT = /\.(html?|js|mjs|css|xml|txt|json|webmanifest|svg|php)$|(^|\/)\.htaccess$/;
const PAGE = /\.(html?|php)$/;

if (!existsSync(ENV_FILE)) {
  console.error('Нет deploy/ftp.env — создайте по образцу deploy/ftp.env.example');
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+#.*$/, ''))
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
for (const k of ['FTP_HOST', 'FTP_USER', 'FTP_PASS']) {
  if (!env[k]) {
    console.error(`В deploy/ftp.env не заполнено ${k}`);
    process.exit(2);
  }
}

const DIST = path.join(ROOT, env.DIST_DIR || 'dist');
const ASSETS = (env.ASSETS_DIR || '').replace(/^\/+|\/+$/g, '');
const PROTECT = (env.PROTECT || '').split(',').map((s) => s.trim().replace(/^\/+/, '')).filter(Boolean);
const SITE = (env.SITE_URL || '').replace(/\/$/, '');
const CHECKS = (env.CHECK_PATHS || '/').split(',').map((s) => s.trim()).filter(Boolean);
if (!existsSync(path.join(DIST, 'index.html')) && !existsSync(path.join(DIST, 'index.php'))) {
  console.error(`В ${DIST} нет index.html/index.php — сначала соберите сайт`);
  process.exit(2);
}

const sha1 = (f) => createHash('sha1').update(readFileSync(f)).digest('hex');
const isProtected = (f) => PROTECT.some((p) => f === p || f.startsWith(p.replace(/\/?$/, '/')));

let client = null;
let remote = env.FTP_REMOTE_DIR || '';
const join = (...parts) => '/' + [remote, ...parts].join('/').split('/').filter(Boolean).join('/');

async function connect() {
  client?.close();
  client = new Client(120_000);
  const base = { host: env.FTP_HOST, user: env.FTP_USER, password: env.FTP_PASS, port: Number(env.FTP_PORT || 21) };
  try {
    await client.access({ ...base, secure: true, secureOptions: { rejectUnauthorized: false } });
  } catch (e) {
    if (/530/.test(String(e.message))) throw e;
    if (env.FTP_ALLOW_PLAIN !== '1') throw new Error(`FTPS не удался: ${e.message} (обычный FTP — только с FTP_ALLOW_PLAIN=1)`);
    client.close();
    client = new Client(120_000);
    await client.access({ ...base, secure: false });
  }
  client.ftp.socket.setKeepAlive(true, 15_000);
  if (!remote) {
    for (const dir of ['/httpdocs', '/public_html', '/www', '/']) {
      for (const idx of ['index.html', 'index.php']) {
        try {
          await client.size(`${dir === '/' ? '' : dir}/${idx}`);
          remote = dir;
          break;
        } catch {
          /* нет — дальше */
        }
      }
      if (remote) break;
    }
    if (!remote) throw new Error('Не нашёл корень сайта на сервере — задайте FTP_REMOTE_DIR в deploy/ftp.env');
  }
}

let onReconnect = () => {};
async function withRetry(label, fn, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      if (!client || client.closed) await connect();
      return await fn();
    } catch (e) {
      const msg = String(e.message || e).slice(0, 120);
      if (i === tries || /530|FTP_REMOTE_DIR|FTP_ALLOW_PLAIN/.test(msg)) throw new Error(`${label}: ${msg}`);
      console.warn(`  ${label}: ${msg} — переподключаюсь (${i + 1}/${tries})`);
      onReconnect();
      try {
        client.close();
      } catch {
        /* уже закрыт */
      }
      client = null;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

async function main() {
  await withRetry('подключение', async () => {});
  console.log(`Подключено к ${env.FTP_HOST} (${client.ftp.socket.encrypted ? 'FTPS' : 'FTP'}), корень сайта: ${remote}`);

  const all = walk(DIST);
  const skipped = all.filter(isProtected);
  if (skipped.length) console.log(`Не заливаю (PROTECT): ${skipped.join(', ')}`);
  const local = all.filter((f) => !isProtected(f));

  const remoteSizes = new Map();
  const dirs = [...new Set(local.map((f) => path.posix.dirname(f)).map((d) => (d === '.' ? '' : d)))].sort();
  for (const d of dirs) {
    const list = await withRetry(`список /${d}`, async () => {
      try {
        return await client.list(join(d));
      } catch (e) {
        if (String(e.message).includes('550')) return [];
        throw e;
      }
    });
    for (const f of list) if (f.isFile) remoteSizes.set((d ? `${d}/` : '') + f.name, f.size);
  }

  const hashes = Object.fromEntries(local.map((f) => [f, sha1(path.join(DIST, f))]));
  const tmp = mkdtempSync(path.join(tmpdir(), 'deploy-'));
  let manifest = null;
  await withRetry('чтение манифеста', async () => {
    try {
      await client.size(join(MANIFEST));
    } catch (e) {
      if (String(e.message).includes('550')) return;
      throw e;
    }
    await client.downloadTo(path.join(tmp, MANIFEST), join(MANIFEST));
    manifest = JSON.parse(readFileSync(path.join(tmp, MANIFEST), 'utf8'));
  });

  const changed = local
    .filter((f) => {
      if (remoteSizes.get(f) !== statSync(path.join(DIST, f)).size) return true;
      return manifest ? manifest[f] !== hashes[f] : TEXT.test(f);
    })
    .sort((a, b) => Number(PAGE.test(a)) - Number(PAGE.test(b)));
  const mb = (changed.reduce((s, f) => s + statSync(path.join(DIST, f)).size, 0) / 1048576).toFixed(1);
  console.log(`Файлов: ${local.length}; совпадают: ${local.length - changed.length}; заливаю: ${changed.length} (${mb} МБ)` +
    (manifest ? ' — сверка по манифесту' : ' — манифеста нет: текст целиком, остальное по размеру'));
  if (DRY) {
    changed.forEach((f) => console.log(`  ${f}`));
    client.close();
    return;
  }

  let done = 0;
  let lastDir = null;
  onReconnect = () => {
    lastDir = null;
  };
  for (const f of changed) {
    const d = path.posix.dirname(f) === '.' ? '' : path.posix.dirname(f);
    await withRetry(`загрузка ${f}`, async () => {
      if (d !== lastDir) {
        await client.ensureDir(join(d));
        lastDir = d;
      }
      await client.uploadFrom(path.join(DIST, f), path.posix.basename(f));
    });
    if (++done % 25 === 0 || done === changed.length) console.log(`  загружено ${done} из ${changed.length}`);
  }

  if (ASSETS && !NO_CLEAN) {
    const keep = new Set(local.filter((f) => f.startsWith(`${ASSETS}/`)).map((f) => f.slice(ASSETS.length + 1)));
    const removed = await withRetry(`чистка ${ASSETS}`, async () => {
      await client.cd(join(ASSETS));
      let n = 0;
      for (const f of await client.list()) {
        if (f.isFile && !keep.has(f.name) && !isProtected(`${ASSETS}/${f.name}`)) {
          await client.remove(f.name);
          n++;
        }
      }
      return n;
    });
    console.log(`${ASSETS}: удалено файлов прошлых сборок — ${removed}`);
  }

  writeFileSync(path.join(tmp, MANIFEST), JSON.stringify(hashes));
  await withRetry('запись манифеста', async () => {
    await client.cd(join());
    await client.uploadFrom(path.join(tmp, MANIFEST), MANIFEST);
  });
  client.close();

  if (!SITE) return console.log('Выкладка завершена (SITE_URL не задан — HTTP-проверка пропущена).');
  let ok = true;
  for (const p of CHECKS) {
    const url = `${SITE}${p}${p.includes('?') ? '' : `?v=${Date.now()}`}`;
    try {
      const r = await fetch(url, { redirect: 'follow' });
      console.log(`${r.status}  ${url}`);
      if (r.status !== 200) ok = false;
    } catch (e) {
      console.log(`ERR  ${url}: ${String(e.message).slice(0, 80)}`);
      ok = false;
    }
  }
  console.log(ok ? 'Выкладка завершена, сайт отвечает.' : 'Файлы залиты, но HTTP-проверка прошла не полностью.');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  const msg = String(e.message || e);
  console.error('Ошибка выкладки:', /530/.test(msg) ? 'сервер не принял логин/пароль (530) — проверьте FTP_USER и FTP_PASS' : msg);
  try {
    client?.close();
  } catch {
    /* уже закрыт */
  }
  process.exit(1);
});
