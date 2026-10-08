<?php
// Storage of the case editor (docs/17-cases-editor.md §3): SQLite via PDO when available, otherwise JSON files
// guarded by flock. Both expose the same methods. Data lives in $dir (outside the site folder when possible).
declare(strict_types=1);

interface Store {
  public function kind(): string;
  public function drafts(): array;
  public function draft(string $token): ?array;
  public function createDraft(string $token, string $title, array $items): void;
  public function setDraftStatus(string $token, string $status): void;
  /** all items of a draft: [id => [id, kind, data, base, version, status, note, updated, by]] */
  public function items(string $token): array;
  public function item(string $token, string $id): ?array;
  public function putItem(string $token, array $item): void;
  public function photos(string $token): array;
  public function photo(string $token, int $pid): ?array;
  public function addPhoto(string $token, array $p): int;
  public function log(string $token, array $entry): int;
  public function logList(string $token, int $since = 0, ?string $id = null, int $limit = 500): array;
  public function logEntry(string $token, int $lid): ?array;
  public function cursor(string $token): int;
}

final class SqliteStore implements Store {
  private PDO $db;
  public function __construct(string $file) {
    $this->db = new PDO('sqlite:' . $file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $this->db->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    $this->db->exec('CREATE TABLE IF NOT EXISTS drafts (token TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT "open", created TEXT NOT NULL, closed TEXT)');
    $this->db->exec('CREATE TABLE IF NOT EXISTS cases (draft TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, base TEXT, version INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT "todo", note TEXT NOT NULL DEFAULT "", updated TEXT, by TEXT, PRIMARY KEY (draft, id))');
    $this->db->exec('CREATE TABLE IF NOT EXISTS photos (pid INTEGER PRIMARY KEY AUTOINCREMENT, draft TEXT NOT NULL, case_id TEXT NOT NULL, slot TEXT NOT NULL, source TEXT NOT NULL, orig TEXT, orig_type TEXT, crop TEXT, params TEXT, alt_ru TEXT, alt_en TEXT, at TEXT NOT NULL, by TEXT)');
    $this->db->exec('CREATE TABLE IF NOT EXISTS log (lid INTEGER PRIMARY KEY AUTOINCREMENT, draft TEXT NOT NULL, case_id TEXT, field TEXT, old TEXT, new TEXT, by TEXT, at TEXT NOT NULL, type TEXT NOT NULL)');
    $this->db->exec('CREATE INDEX IF NOT EXISTS log_draft ON log (draft, lid)');
  }
  public function kind(): string { return 'sqlite'; }
  public function drafts(): array {
    $r = $this->db->query('SELECT d.*, (SELECT COUNT(*) FROM log l WHERE l.draft = d.token) AS edits FROM drafts d ORDER BY created DESC')->fetchAll();
    return $r;
  }
  public function draft(string $token): ?array {
    $s = $this->db->prepare('SELECT * FROM drafts WHERE token = ?'); $s->execute([$token]); return $s->fetch() ?: null;
  }
  public function createDraft(string $token, string $title, array $items): void {
    $this->db->beginTransaction();
    $this->db->prepare('INSERT INTO drafts (token, title, status, created) VALUES (?, ?, "open", ?)')->execute([$token, $title, gmdate('c')]);
    $ins = $this->db->prepare('INSERT INTO cases (draft, id, kind, data, base, version, status) VALUES (?, ?, ?, ?, ?, 0, "todo")');
    foreach ($items as $it) { $j = json_encode($it['f'], JSON_UNESCAPED_UNICODE); $ins->execute([$token, $it['id'], $it['kind'], $j, json_encode(['f' => $it['f'], 'slots' => $it['slots'], 'thumb' => $it['thumb'] ?? null], JSON_UNESCAPED_UNICODE)]); }
    $this->db->commit();
  }
  public function setDraftStatus(string $token, string $status): void {
    $this->db->prepare('UPDATE drafts SET status = ?, closed = ? WHERE token = ?')->execute([$status, $status === 'closed' ? gmdate('c') : null, $token]);
  }
  private function row(array $r): array {
    return ['id' => $r['id'], 'kind' => $r['kind'], 'data' => json_decode($r['data'], true), 'base' => $r['base'] ? json_decode($r['base'], true) : null,
      'version' => (int) $r['version'], 'status' => $r['status'], 'note' => $r['note'], 'updated' => $r['updated'], 'by' => $r['by']];
  }
  public function items(string $token): array {
    $s = $this->db->prepare('SELECT * FROM cases WHERE draft = ? ORDER BY rowid'); $s->execute([$token]);
    $o = []; foreach ($s->fetchAll() as $r) $o[$r['id']] = $this->row($r); return $o;
  }
  public function item(string $token, string $id): ?array {
    $s = $this->db->prepare('SELECT * FROM cases WHERE draft = ? AND id = ?'); $s->execute([$token, $id]); $r = $s->fetch(); return $r ? $this->row($r) : null;
  }
  public function putItem(string $token, array $it): void {
    $this->db->prepare('INSERT INTO cases (draft, id, kind, data, base, version, status, note, updated, by) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(draft, id) DO UPDATE SET data = excluded.data, version = excluded.version, status = excluded.status, note = excluded.note, updated = excluded.updated, by = excluded.by')
      ->execute([$token, $it['id'], $it['kind'], json_encode($it['data'], JSON_UNESCAPED_UNICODE), $it['base'] === null ? null : json_encode($it['base'], JSON_UNESCAPED_UNICODE),
        $it['version'], $it['status'], $it['note'], $it['updated'], $it['by']]);
  }
  public function photos(string $token): array {
    $s = $this->db->prepare('SELECT * FROM photos WHERE draft = ? ORDER BY pid'); $s->execute([$token]);
    return array_map(function ($p) { $p['pid'] = (int) $p['pid']; $p['params'] = $p['params'] ? json_decode($p['params'], true) : null; return $p; }, $s->fetchAll());
  }
  public function photo(string $token, int $pid): ?array {
    $s = $this->db->prepare('SELECT * FROM photos WHERE draft = ? AND pid = ?'); $s->execute([$token, $pid]); $r = $s->fetch();
    if (!$r) return null; $r['params'] = $r['params'] ? json_decode($r['params'], true) : null; return $r;
  }
  public function addPhoto(string $token, array $p): int {
    $this->db->prepare('INSERT INTO photos (draft, case_id, slot, source, orig, orig_type, crop, params, alt_ru, alt_en, at, by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      ->execute([$token, $p['case_id'], $p['slot'], $p['source'], $p['orig'], $p['orig_type'], $p['crop'], $p['params'] === null ? null : json_encode($p['params']), $p['alt_ru'], $p['alt_en'], gmdate('c'), $p['by']]);
    return (int) $this->db->lastInsertId();
  }
  public function log(string $token, array $e): int {
    $this->db->prepare('INSERT INTO log (draft, case_id, field, old, new, by, at, type) VALUES (?,?,?,?,?,?,?,?)')
      ->execute([$token, $e['case_id'], $e['field'], json_encode($e['old'], JSON_UNESCAPED_UNICODE), json_encode($e['new'], JSON_UNESCAPED_UNICODE), $e['by'], gmdate('c'), $e['type']]);
    return (int) $this->db->lastInsertId();
  }
  private function logRow(array $r): array { $r['lid'] = (int) $r['lid']; $r['old'] = json_decode((string) $r['old'], true); $r['new'] = json_decode((string) $r['new'], true); unset($r['draft']); return $r; }
  public function logList(string $token, int $since = 0, ?string $id = null, int $limit = 500): array {
    $sql = 'SELECT * FROM log WHERE draft = ? AND lid > ?' . ($id !== null ? ' AND case_id = ?' : '') . ' ORDER BY lid DESC LIMIT ' . max(1, min(2000, $limit));
    $s = $this->db->prepare($sql); $s->execute($id !== null ? [$token, $since, $id] : [$token, $since]);
    return array_map([$this, 'logRow'], $s->fetchAll());
  }
  public function logEntry(string $token, int $lid): ?array {
    $s = $this->db->prepare('SELECT * FROM log WHERE draft = ? AND lid = ?'); $s->execute([$token, $lid]); $r = $s->fetch(); return $r ? $this->logRow($r) : null;
  }
  public function cursor(string $token): int {
    $s = $this->db->prepare('SELECT COALESCE(MAX(lid), 0) AS c FROM log WHERE draft = ?'); $s->execute([$token]); return (int) $s->fetch()['c'];
  }
}

/** Fallback: one JSON file per draft + an index, every access under an exclusive flock. */
final class JsonStore implements Store {
  private string $dir;
  public function __construct(string $dir) { $this->dir = $dir; }
  public function kind(): string { return 'json'; }
  private function file(string $token): string { return $this->dir . '/draft-' . $token . '.json'; }
  private function locked(string $file, callable $fn, bool $write) {
    $h = fopen($file, 'c+'); if (!$h) throw new RuntimeException('storage');
    flock($h, $write ? LOCK_EX : LOCK_SH);
    $raw = stream_get_contents($h); $data = $raw ? json_decode($raw, true) : null;
    $res = $fn($data);
    if ($write) { [$data, $res] = $res; ftruncate($h, 0); rewind($h); fwrite($h, json_encode($data, JSON_UNESCAPED_UNICODE)); fflush($h); }
    flock($h, LOCK_UN); fclose($h); return $res;
  }
  private function read(string $token): ?array { $f = $this->file($token); if (!is_file($f)) return null; return $this->locked($f, fn ($d) => $d, false); }
  private function update(string $token, callable $fn) { return $this->locked($this->file($token), fn ($d) => $fn($d), true); }
  public function drafts(): array {
    $o = []; foreach (glob($this->dir . '/draft-*.json') ?: [] as $f) { $d = json_decode((string) file_get_contents($f), true); if ($d) $o[] = $d['draft'] + ['edits' => count($d['log'])]; }
    usort($o, fn ($a, $b) => strcmp($b['created'], $a['created'])); return $o;
  }
  public function draft(string $token): ?array { return $this->read($token)['draft'] ?? null; }
  public function createDraft(string $token, string $title, array $items): void {
    $its = []; foreach ($items as $it) $its[$it['id']] = ['id' => $it['id'], 'kind' => $it['kind'], 'data' => $it['f'], 'base' => ['f' => $it['f'], 'slots' => $it['slots'], 'thumb' => $it['thumb'] ?? null], 'version' => 0, 'status' => 'todo', 'note' => '', 'updated' => null, 'by' => null];
    $this->update($token, fn () => [['draft' => ['token' => $token, 'title' => $title, 'status' => 'open', 'created' => gmdate('c'), 'closed' => null], 'items' => $its, 'photos' => [], 'log' => [], 'seq' => ['photo' => 0, 'log' => 0]], null]);
  }
  public function setDraftStatus(string $token, string $status): void { $this->update($token, function ($d) use ($status) { $d['draft']['status'] = $status; $d['draft']['closed'] = $status === 'closed' ? gmdate('c') : null; return [$d, null]; }); }
  public function items(string $token): array { return $this->read($token)['items'] ?? []; }
  public function item(string $token, string $id): ?array { return $this->read($token)['items'][$id] ?? null; }
  public function putItem(string $token, array $it): void { $this->update($token, function ($d) use ($it) { $d['items'][$it['id']] = $it; return [$d, null]; }); }
  public function photos(string $token): array { return $this->read($token)['photos'] ?? []; }
  public function photo(string $token, int $pid): ?array { foreach ($this->photos($token) as $p) if ((int) $p['pid'] === $pid) return $p; return null; }
  public function addPhoto(string $token, array $p): int {
    return $this->update($token, function ($d) use ($p) { $id = ++$d['seq']['photo']; $d['photos'][] = $p + ['pid' => $id, 'at' => gmdate('c')]; return [$d, $id]; });
  }
  public function log(string $token, array $e): int {
    return $this->update($token, function ($d) use ($e) { $id = ++$d['seq']['log']; $d['log'][] = $e + ['lid' => $id, 'at' => gmdate('c')]; return [$d, $id]; });
  }
  public function logList(string $token, int $since = 0, ?string $id = null, int $limit = 500): array {
    $l = array_values(array_filter($this->read($token)['log'] ?? [], fn ($e) => $e['lid'] > $since && ($id === null || $e['case_id'] === $id)));
    return array_slice(array_reverse($l), 0, $limit);
  }
  public function logEntry(string $token, int $lid): ?array { foreach ($this->read($token)['log'] ?? [] as $e) if ($e['lid'] === $lid) return $e; return null; }
  public function cursor(string $token): int { $l = $this->read($token)['log'] ?? []; return $l ? (int) end($l)['lid'] : 0; }
}
