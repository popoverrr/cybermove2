<?php
// Case editor API (docs/17-cases-editor.md). JSON in/out. Drafts are addressed by an unguessable token (?d=);
// creating/closing drafts needs the owner password (PHP session). Photos are served only through this file.
declare(strict_types=1);
require __DIR__ . '/lib/boot.php';

$a = (string) ($_GET['a'] ?? (isset($_GET['health']) ? 'health' : ''));
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$in = [];
if ($method === 'POST' && str_starts_with((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
  $raw = file_get_contents('php://input', false, null, 0, 2_000_000);
  $in = json_decode((string) $raw, true);
  if (!is_array($in)) fail(400, 'bad json');
}

try {
  if ($a === 'health') {
    out(['ok' => true, 'store' => store()->kind(), 'outsideSite' => DATA_OUTSIDE, 'gd' => function_exists('imagecreatefromstring'), 'php' => PHP_VERSION, 'passwordSet' => (string) (CONFIG['password_hash'] ?? '') !== '']);
  }

  /* ── owner ── */
  if ($a === 'login') {
    must_post($method); rate('login', 5, 600);
    $ok = verify_password((string) ($in['password'] ?? ''));
    if (!$ok) fail(403, 'wrong password');
    session_regenerate_id(true); $_SESSION['owner'] = true; out(['ok' => true]);
  }
  if ($a === 'logout') { $_SESSION = []; session_destroy(); out(['ok' => true]); }
  if ($a === 'me') out(['owner' => !empty($_SESSION['owner']), 'passwordSet' => (string) (CONFIG['password_hash'] ?? '') !== '', 'outsideSite' => DATA_OUTSIDE]);
  if ($a === 'drafts') { owner(); out(['drafts' => store()->drafts()]); }
  if ($a === 'create') {
    must_post($method); owner(); rate('write', 240, 60);
    $title = clean_str($in['title'] ?? '', 120) ?: 'Правки от ' . date('d.m.Y');
    $seed = json_decode((string) @file_get_contents(SEED_FILE), true);
    if (!$seed || empty($seed['items'])) fail(500, 'seed.json missing — run npm run editor:build');
    $token = bin2hex(random_bytes(16));
    store()->createDraft($token, $title, $seed['items']);
    out(['token' => $token]);
  }
  if ($a === 'close' || $a === 'reopen') {
    must_post($method); owner(); $t = token_arg((string) ($in['token'] ?? ''));
    store()->setDraftStatus($t, $a === 'close' ? 'closed' : 'open'); out(['ok' => true]);
  }

  /* ── draft (token) ── */
  $d = draft_from_request();
  $T = $d['token'];
  $by = clean_str($in['by'] ?? ($_POST['by'] ?? ''), 60) ?: 'без имени';

  if ($a === 'state') {
    $seed = json_decode((string) @file_get_contents(SEED_FILE), true) ?: [];
    out(['draft' => public_draft($d), 'items' => array_values(store()->items($T)), 'photos' => store()->photos($T),
      'cursor' => store()->cursor($T), 'categories' => $seed['categories'] ?? [], 'services' => $seed['services'] ?? []]);
  }
  if ($a === 'poll') {
    $since = max(0, (int) ($_GET['since'] ?? 0));
    $log = store()->logList($T, $since, null, 2000);
    $ids = array_values(array_unique(array_filter(array_map(fn ($e) => $e['case_id'], $log))));
    $items = []; foreach ($ids as $id) { $it = store()->item($T, $id); if ($it) $items[] = $it; }
    $photos = array_values(array_filter(store()->photos($T), fn ($p) => in_array($p['case_id'], $ids, true)));
    out(['draft' => public_draft($d), 'items' => $items, 'photos' => $photos, 'log' => $log, 'cursor' => store()->cursor($T)]);
  }
  if ($a === 'log') {
    $id = isset($_GET['id']) ? id_arg((string) $_GET['id']) : null;
    out(['log' => store()->logList($T, 0, $id, 300)]);
  }
  if ($a === 'img') {
    $p = store()->photo($T, (int) ($_GET['photo'] ?? 0)); if (!$p) fail(404, 'no photo');
    $which = ($_GET['v'] ?? 'crop') === 'orig' ? 'orig' : 'crop';
    $f = $p[$which] ? PHOTO_DIR . '/' . basename((string) $p[$which]) : null;
    if (!$f || !is_file($f)) fail(404, 'no file');
    $type = $which === 'orig' ? ((string) $p['orig_type'] ?: 'image/jpeg') : 'image/jpeg';
    header('Content-Type: ' . $type); header('Cache-Control: private, max-age=31536000, immutable'); header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . filesize($f)); readfile($f); exit;
  }

  /* writes */
  if (in_array($a, ['save', 'status', 'new', 'photo', 'revert'], true)) {
    if ($method !== 'POST') fail(405, 'POST only');
    if ($d['status'] !== 'open') fail(403, 'draft closed');
    rate('write', 600, 60);
  }

  if ($a === 'save') {
    $id = id_arg((string) ($in['id'] ?? '')); $field = field_arg((string) ($in['field'] ?? ''));
    $it = store()->item($T, $id); if (!$it) fail(404, 'no item');
    $value = clean_value($in['value'] ?? null);
    $cur = $it['data'][$field] ?? null;
    $prev = array_key_exists('prev', $in) ? clean_value($in['prev']) : $cur;
    if (empty($in['force']) && $cur != $prev && $cur != $value) {
      $last = store()->logList($T, 0, $id, 50); $who = null;
      foreach ($last as $e) if ($e['field'] === $field) { $who = $e['by']; break; }
      out(['conflict' => true, 'value' => $cur, 'by' => $who, 'version' => $it['version']]);
    }
    if ($cur == $value) out(['ok' => true, 'version' => $it['version'], 'cursor' => store()->cursor($T)]);
    $it['data'][$field] = $value; $it['version']++; $it['updated'] = gmdate('c'); $it['by'] = $by;
    if ($field !== 'comment' && in_array($it['status'], ['todo', 'ok'], true)) $it['status'] = 'changed';
    store()->putItem($T, $it);
    store()->log($T, ['case_id' => $id, 'field' => $field, 'old' => $cur, 'new' => $value, 'by' => $by, 'type' => 'field']);
    out(['ok' => true, 'version' => $it['version'], 'status' => $it['status'], 'cursor' => store()->cursor($T)]);
  }
  if ($a === 'status') {
    $id = id_arg((string) ($in['id'] ?? '')); $it = store()->item($T, $id); if (!$it) fail(404, 'no item');
    $st = (string) ($in['status'] ?? ''); if (!in_array($st, ['todo', 'ok', 'changed', 'question'], true)) fail(400, 'status');
    $old = ['status' => $it['status'], 'note' => $it['note']];
    $it['status'] = $st; $it['note'] = clean_str($in['note'] ?? $it['note'], 4000); $it['version']++; $it['updated'] = gmdate('c'); $it['by'] = $by;
    store()->putItem($T, $it);
    store()->log($T, ['case_id' => $id, 'field' => 'status', 'old' => $old, 'new' => ['status' => $st, 'note' => $it['note']], 'by' => $by, 'type' => 'status']);
    out(['ok' => true, 'version' => $it['version'], 'cursor' => store()->cursor($T)]);
  }
  if ($a === 'new') {
    $id = (string) ($in['id'] ?? ''); if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $id) || strlen($id) > 60) fail(400, 'id: a-z 0-9 -');
    if (store()->item($T, $id)) fail(409, 'id exists');
    $kind = ($in['kind'] ?? 'case') === 'site' ? 'site' : 'case';
    $f = clean_value($in['fields'] ?? []); if (!is_array($f)) $f = [];
    $it = ['id' => $id, 'kind' => $kind, 'data' => $f, 'base' => null, 'version' => 1, 'status' => 'changed', 'note' => '', 'updated' => gmdate('c'), 'by' => $by];
    store()->putItem($T, $it);
    store()->log($T, ['case_id' => $id, 'field' => 'new', 'old' => null, 'new' => $kind, 'by' => $by, 'type' => 'new']);
    out(['ok' => true, 'item' => $it, 'cursor' => store()->cursor($T)]);
  }
  if ($a === 'photo') {
    $id = id_arg((string) ($_POST['id'] ?? '')); if (!store()->item($T, $id)) fail(404, 'no item');
    $slot = (string) ($_POST['slot'] ?? ''); if (!preg_match('/^(4x3|16x9|4x5|logo|shot)$/', $slot)) fail(400, 'slot');
    $source = (string) ($_POST['source'] ?? 'upload'); if (!in_array($source, ['upload', 'site', 'reset', 'alt'], true)) fail(400, 'source');
    $params = json_decode((string) ($_POST['params'] ?? 'null'), true);
    if ($params !== null) { foreach (['x', 'y', 'w', 'h'] as $k) if (!isset($params[$k]) || !is_numeric($params[$k]) || $params[$k] < -0.01 || $params[$k] > 1.01) fail(400, 'crop params'); $params = array_intersect_key($params, array_flip(['x', 'y', 'w', 'h'])); }
    $orig = null; $origType = null; $crop = null;
    $prevPhotos = array_values(array_filter(store()->photos($T), fn ($p) => $p['case_id'] === $id && $p['slot'] === $slot));
    $last = $prevPhotos ? end($prevPhotos) : null;
    if ($source === 'upload') { [$orig, $origType] = save_upload('orig', true); }
    elseif ($source === 'alt' && $last) { $orig = $last['orig']; $origType = $last['orig_type']; $crop = $last['crop']; $params = $last['params']; $source = $last['source']; }
    if (in_array($source, ['upload', 'site'], true) && ($_POST['keep_orig'] ?? '') === '1' && $last && !$orig) { $orig = $last['orig']; $origType = $last['orig_type']; }
    if (isset($_FILES['crop'])) { [$crop] = save_upload('crop', false); }
    $pid = store()->addPhoto($T, ['case_id' => $id, 'slot' => $slot, 'source' => $source, 'orig' => $orig, 'orig_type' => $origType, 'crop' => $crop, 'params' => $params,
      'alt_ru' => clean_str($_POST['alt_ru'] ?? '', 300), 'alt_en' => clean_str($_POST['alt_en'] ?? '', 300), 'by' => $by]);
    $it = store()->item($T, $id);
    if (in_array($it['status'], ['todo', 'ok'], true) && ($_POST['source'] ?? '') !== 'alt') { $it['status'] = 'changed'; }
    $it['version']++; $it['updated'] = gmdate('c'); $it['by'] = $by; store()->putItem($T, $it);
    store()->log($T, ['case_id' => $id, 'field' => 'photo:' . $slot, 'old' => $last ? $last['pid'] : null, 'new' => $pid, 'by' => $by, 'type' => 'photo']);
    out(['ok' => true, 'photo' => store()->photo($T, $pid), 'cursor' => store()->cursor($T)]);
  }
  if ($a === 'revert') {
    $e = store()->logEntry($T, (int) ($in['lid'] ?? 0)); if (!$e) fail(404, 'no entry');
    $it = store()->item($T, (string) $e['case_id']); if (!$it) fail(404, 'no item');
    if ($e['type'] === 'field') {
      $cur = $it['data'][$e['field']] ?? null;
      $it['data'][$e['field']] = $e['old']; $it['version']++; $it['updated'] = gmdate('c'); $it['by'] = $by; store()->putItem($T, $it);
      store()->log($T, ['case_id' => $it['id'], 'field' => $e['field'], 'old' => $cur, 'new' => $e['old'], 'by' => $by, 'type' => 'field']);
    } elseif ($e['type'] === 'photo') {
      $slot = substr((string) $e['field'], 6); $prev = $e['old'] ? store()->photo($T, (int) $e['old']) : null;
      $pid = store()->addPhoto($T, $prev ? ['case_id' => $it['id'], 'slot' => $slot, 'source' => $prev['source'], 'orig' => $prev['orig'], 'orig_type' => $prev['orig_type'], 'crop' => $prev['crop'], 'params' => $prev['params'], 'alt_ru' => $prev['alt_ru'], 'alt_en' => $prev['alt_en'], 'by' => $by]
        : ['case_id' => $it['id'], 'slot' => $slot, 'source' => 'reset', 'orig' => null, 'orig_type' => null, 'crop' => null, 'params' => null, 'alt_ru' => '', 'alt_en' => '', 'by' => $by]);
      $it['version']++; store()->putItem($T, $it);
      store()->log($T, ['case_id' => $it['id'], 'field' => $e['field'], 'old' => $e['new'], 'new' => $pid, 'by' => $by, 'type' => 'photo']);
    } elseif ($e['type'] === 'status') {
      $it['status'] = $e['old']['status']; $it['note'] = $e['old']['note']; $it['version']++; store()->putItem($T, $it);
      store()->log($T, ['case_id' => $it['id'], 'field' => 'status', 'old' => $e['new'], 'new' => $e['old'], 'by' => $by, 'type' => 'status']);
    } else fail(400, 'cannot revert');
    out(['ok' => true, 'item' => store()->item($T, $it['id']), 'cursor' => store()->cursor($T)]);
  }
  fail(404, 'unknown action');
} catch (Throwable $e) {
  error_log('[case-editor] ' . $e->getMessage());
  fail(500, 'server error');
}
