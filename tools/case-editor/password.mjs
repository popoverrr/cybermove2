// npm run editor:password — asks for the owner password (input hidden) and writes its PBKDF2-SHA256 hash into
// tools/case-editor/config.php (not committed). The password itself is stored nowhere.
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const file = join(process.cwd(), 'tools/case-editor/config.php');
function ask(q) {
  return new Promise((res) => {
    process.stdout.write(q);
    const stdin = process.stdin; let s = '';
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume(); stdin.setEncoding('utf8');
    const on = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') { if (stdin.isTTY) stdin.setRawMode(false); stdin.pause(); stdin.off('data', on); process.stdout.write('\n'); res(s); return; }
        if (c === '\u0003') process.exit(1);
        if (c === '\u007f' || c === '\b') s = s.slice(0, -1); else s += c;
      }
    };
    stdin.on('data', on);
  });
}
const pw = process.env.EDITOR_PASSWORD ?? await ask('Новый пароль владельца редактора: ');
if (pw.length < 10) { console.error('Пароль слишком короткий: нужно не меньше 10 символов.'); process.exit(1); }
if (!process.env.EDITOR_PASSWORD) { const again = await ask('Повторите пароль: '); if (again !== pw) { console.error('Пароли не совпадают.'); process.exit(1); } }
const iter = 210000; const salt = randomBytes(16);
const hash = `pbkdf2_sha256$${iter}$${salt.toString('base64')}$${pbkdf2Sync(pw, salt, iter, 32, 'sha256').toString('base64')}`;
let dataDir = 'null';
if (existsSync(file)) { const m = readFileSync(file, 'utf8').match(/'data_dir'\s*=>\s*([^,\n]+)/); if (m) dataDir = m[1].trim(); }
writeFileSync(file, `<?php\n// Written by npm run editor:password — do not commit.\nreturn [\n  'password_hash' => '${hash}',\n  'data_dir' => ${dataDir},\n  'storage' => 'auto',\n];\n`);
console.log('Хэш пароля записан в tools/case-editor/config.php. Соберите и выложите сайт: npm run deploy');
