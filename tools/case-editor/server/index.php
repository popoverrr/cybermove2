<?php
// Entry of /kejsy-proverka/: the editor shell. ?d=<token> must name an existing draft (else 404);
// without a token — the owner screen (login, drafts). The interface itself is app.js.
declare(strict_types=1);
$t = (string) ($_GET['d'] ?? '');
if ($t !== '') {
  ob_start(); $ok = false;
  try {
    require __DIR__ . '/lib/boot.php';
    $ok = preg_match('/^[a-f0-9]{32}$/', $t) && store()->draft($t) !== null;
  } catch (Throwable $e) { $ok = false; }
  ob_end_clean();
  header_remove('Content-Type'); header_remove('Cache-Control');
  if (!$ok) { http_response_code(404); header('Content-Type: text/html; charset=utf-8'); header('X-Robots-Tag: noindex, nofollow'); echo '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Не найдено</title><body style="background:#08090B;color:#F2F2EF;font:16px system-ui;padding:24px">Редакция не найдена. Проверьте ссылку.</body>'; exit; }
}
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
readfile(__DIR__ . '/app.html');
