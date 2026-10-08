<?php
// Shared bootstrap of the case editor API: config, data folder (outside the site folder when possible), session,
// storage choice (SQLite → JSON fallback), input validation, rate limits, safe photo uploads.
declare(strict_types=1);

if (!function_exists('str_starts_with')) { function str_starts_with(string $h, string $n): bool { return $n === '' || strpos($h, $n) === 0; } }

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$cfgFile = dirname(__DIR__) . '/config.php';
define('CONFIG', is_file($cfgFile) ? (array) require $cfgFile : []);
define('SEED_FILE', dirname(__DIR__) . '/seed.json');

/* data folder: config → one level above the site root → fallback inside the editor folder (web access denied) */
(function () {
  $cands = [];
  if (!empty(CONFIG['data_dir'])) $cands[] = [CONFIG['data_dir'], true];
  $docroot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
  if ($docroot !== '') $cands[] = [dirname($docroot) . '/cm-case-editor-data', true];
  $cands[] = [dirname(__DIR__) . '/data', false];
  foreach ($cands as [$dir, $outside]) {
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    if (is_dir($dir) && is_writable($dir)) {
      if (!is_dir($dir . '/photos')) @mkdir($dir . '/photos', 0750, true);
      $ht = $dir . '/.htaccess';
      if (!is_file($ht)) @file_put_contents($ht, "Require all denied\nOptions -Indexes -ExecCGI\n<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n<IfModule mod_php7.c>\n  php_flag engine off\n</IfModule>\nRemoveHandler .php .phtml .php7 .php8\n");
      define('DATA_DIR', $dir); define('PHOTO_DIR', $dir . '/photos');
      define('DATA_OUTSIDE', $outside && !str_starts_with(realpath($dir) ?: $dir, realpath($docroot ?: '/nonexistent') ?: '/nonexistent'));
      return;
    }
  }
  http_response_code(500); echo json_encode(['error' => 'no writable data folder']); exit;
})();

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('cmce');
session_set_cookie_params(['lifetime' => 0, 'path' => rtrim(dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

function store(): Store {
  static $s = null;
  if ($s) return $s;
  require_once __DIR__ . '/../store.php';
  $force = CONFIG['storage'] ?? 'auto';
  if ($force !== 'json' && class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    try { return $s = new SqliteStore(DATA_DIR . '/editor.sqlite'); } catch (Throwable $e) { error_log('[case-editor] sqlite: ' . $e->getMessage()); }
  }
  return $s = new JsonStore(DATA_DIR);
}

function out(array $data, int $code = 200): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function fail(int $code, string $msg): void { out(['error' => $msg], $code); }
function must_post(string $m): void { if ($m !== 'POST') fail(405, 'POST only'); }
function owner(): void { if (empty($_SESSION['owner'])) fail(401, 'owner login required'); }

/** password: PBKDF2-SHA256 written by `npm run editor:password` (pbkdf2_sha256$iterations$salt$hash, base64) */
function verify_password(string $pw): bool {
  $h = (string) (CONFIG['password_hash'] ?? '');
  if ($h === '' || $pw === '') return false;
  if (str_starts_with($h, '$2y$') || str_starts_with($h, '$argon')) return password_verify($pw, $h);
  $p = explode('$', $h);
  if (count($p) !== 4 || $p[0] !== 'pbkdf2_sha256') return false;
  $calc = hash_pbkdf2('sha256', $pw, base64_decode($p[2]), (int) $p[1], 32, true);
  return hash_equals(base64_decode($p[3]), $calc);
}

/** simple per-IP limits stored in the data folder */
function rate(string $bucket, int $max, int $window): void {
  $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0');
  $f = DATA_DIR . '/rate.json'; $h = fopen($f, 'c+'); if (!$h) return;
  flock($h, LOCK_EX);
  $d = json_decode((string) stream_get_contents($h), true) ?: [];
  $now = time(); $k = $bucket . ':' . $ip;
  $d[$k] = array_values(array_filter($d[$k] ?? [], fn ($t) => $t > $now - $window));
  $over = count($d[$k]) >= $max;
  if (!$over) $d[$k][] = $now;
  foreach ($d as $kk => $v) if (!$v || max($v) < $now - 3600) unset($d[$kk]);
  ftruncate($h, 0); rewind($h); fwrite($h, json_encode($d)); flock($h, LOCK_UN); fclose($h);
  if ($over) fail(429, 'too many requests');
}

function clean_str($v, int $max): string {
  if (!is_string($v) && !is_numeric($v)) return '';
  $s = (string) $v; if (!mb_check_encoding($s, 'UTF-8')) return '';
  $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s);
  return mb_substr(trim($s), 0, $max);
}
/** JSON value of a field: string / number / bool / null / list / small object, bounded */
function clean_value($v, int $depth = 0) {
  if ($depth > 3) fail(400, 'too deep');
  if (is_null($v) || is_bool($v) || is_int($v) || is_float($v)) return $v;
  if (is_string($v)) { if (strlen($v) > 20000) fail(400, 'too long'); return clean_str($v, 20000); }
  if (is_array($v)) {
    if (count($v) > 300) fail(400, 'too many');
    $o = []; foreach ($v as $k => $x) { if (!is_int($k) && !preg_match('/^[a-z_0-9]{1,40}$/', (string) $k)) fail(400, 'bad key'); $o[$k] = clean_value($x, $depth + 1); }
    return $o;
  }
  fail(400, 'bad value');
}
function id_arg(string $id): string { if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $id) || strlen($id) > 60) fail(400, 'bad id'); return $id; }
function field_arg(string $f): string { if (!preg_match('/^[a-z][a-z_0-9]{0,39}$/', $f)) fail(400, 'bad field'); return $f; }
function token_arg(string $t): string { if (!preg_match('/^[a-f0-9]{32}$/', $t)) fail(404, 'not found'); return $t; }

function draft_from_request(): array {
  $t = (string) ($_GET['d'] ?? '');
  if (!preg_match('/^[a-f0-9]{32}$/', $t)) fail(404, 'not found');
  $d = store()->draft($t);
  if (!$d || !hash_equals($d['token'], $t)) fail(404, 'not found');
  return $d;
}
function public_draft(array $d): array { return ['title' => $d['title'], 'status' => $d['status'], 'created' => $d['created'], 'closed' => $d['closed'] ?? null]; }

/** stores an uploaded image: real type by signature (finfo), ≤ 20 MB, re-encoded through GD (drops EXIF/payloads) */
function save_upload(string $name, bool $isOrig): array {
  $f = $_FILES[$name] ?? null;
  if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail(400, 'upload failed');
  if ($f['size'] > 20 * 1024 * 1024) fail(413, 'file too large');
  $type = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
  $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$type] ?? null;
  if (!$ext) fail(415, 'only JPEG, PNG or WebP');
  if (@getimagesize($f['tmp_name']) === false) fail(415, 'not an image');
  $file = bin2hex(random_bytes(12)) . '.' . ($isOrig ? $ext : 'jpg');
  $dest = PHOTO_DIR . '/' . $file;
  $done = false;
  if (function_exists('imagecreatefromstring')) {
    $im = @imagecreatefromstring((string) file_get_contents($f['tmp_name']));
    if ($im) {
      if (!$isOrig || $ext === 'jpg') { $done = imagejpeg($im, $dest, $isOrig ? 92 : 88); }
      elseif ($ext === 'png') { imagesavealpha($im, true); $done = imagepng($im, $dest, 6); }
      elseif ($ext === 'webp' && function_exists('imagewebp')) { $done = imagewebp($im, $dest, 90); }
      imagedestroy($im);
    }
  }
  if (!$done) { if (!$isOrig && $type !== 'image/jpeg') fail(415, 'crop must be JPEG'); if (!move_uploaded_file($f['tmp_name'], $dest)) fail(500, 'cannot store file'); }
  @chmod($dest, 0640);
  return [$file, $isOrig ? $type : 'image/jpeg'];
}
