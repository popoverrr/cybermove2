<?php
/**
 * CYBERMOVE — contact form mail endpoint (optional).
 * The site uses it only when content/data/contacts.json → formEmail is set (then rebuild).
 * Until FORM_EMAIL below is filled in, it answers 503 and the site falls back to WhatsApp.
 */

// TODO: set recipient — the same address as contacts.json → formEmail, e.g. 'hello@your-domain.kz'
const FORM_EMAIL = '';
// Sender address on YOUR domain (many hosts reject mail "from" other domains). Leave empty to use no-reply@<host>.
const FORM_FROM = '';

const MAX_BODY = 10240;      // 10 KB
const MIN_FILL_MS = 3000;    // reject submissions faster than 3 s after page load

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function reply(int $status, array $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reply(405, ['ok' => false, 'error' => 'method_not_allowed']);
}
if (FORM_EMAIL === '' || !filter_var(FORM_EMAIL, FILTER_VALIDATE_EMAIL)) {
    reply(503, ['ok' => false, 'error' => 'not_configured']);
}
$type = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
if (strpos($type, 'application/json') !== 0) {
    reply(415, ['ok' => false, 'error' => 'unsupported_media_type']);
}
$len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($len <= 0 || $len > MAX_BODY) {
    reply(413, ['ok' => false, 'error' => 'payload_too_large']);
}
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw === false || strlen($raw) > MAX_BODY) {
    reply(413, ['ok' => false, 'error' => 'payload_too_large']);
}
$in = json_decode($raw, true);
if (!is_array($in)) {
    reply(400, ['ok' => false, 'error' => 'bad_json']);
}

// Honeypot + timing
if (!empty($in['website'])) {
    reply(400, ['ok' => false, 'error' => 'rejected']);
}
$ts = isset($in['ts']) ? (int)$in['ts'] : 0;
$nowMs = (int)round(microtime(true) * 1000);
if ($ts <= 0 || ($nowMs - $ts) < MIN_FILL_MS) {
    reply(400, ['ok' => false, 'error' => 'too_fast']);
}

/** Plain text, no tags, no control chars (except newlines when allowed), limited length. */
function clean($v, int $max, bool $multiline = false): string {
    if (!is_string($v)) return '';
    $v = strip_tags($v);
    $v = $multiline ? preg_replace('/[^\P{C}\n]/u', '', $v) : preg_replace('/\p{C}/u', '', $v);
    $v = trim((string)$v);
    return mb_substr($v, 0, $max, 'UTF-8');
}

$name    = clean($in['name'] ?? '', 120);
$company = clean($in['company'] ?? '', 160);
$contact = clean($in['contact'] ?? '', 160);
$message = clean($in['message'] ?? '', 2000, true);
$lang    = ($in['lang'] ?? '') === 'en' ? 'en' : 'ru';
$allowedNeeds = ['audit', 'marketing', 'brand', 'ai', 'bizdev', 'tender', 'legal', 'other'];
$needs = array_values(array_intersect(is_array($in['needs'] ?? null) ? $in['needs'] : [], $allowedNeeds));

if ($name === '' || $contact === '') {
    reply(422, ['ok' => false, 'error' => 'required']);
}
$isEmail = (bool)filter_var($contact, FILTER_VALIDATE_EMAIL);
$isPhone = (bool)preg_match('/^\+?[\d\s()\-]{7,20}$/', $contact);
$isTg    = (bool)preg_match('/^@?[A-Za-z0-9_]{4,32}$/', $contact);
if (!$isEmail && !$isPhone && !$isTg) {
    reply(422, ['ok' => false, 'error' => 'invalid_contact']);
}

$host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
$from = FORM_FROM !== '' && filter_var(FORM_FROM, FILTER_VALIDATE_EMAIL) ? FORM_FROM : 'no-reply@' . $host;

$subject = 'CYBERMOVE: ' . ($lang === 'en' ? 'website request' : 'заявка с сайта') . ' — ' . $name;
$body = implode("\n", array_filter([
    'Name / Имя: ' . $name,
    $company !== '' ? 'Company / Компания: ' . $company : null,
    'Contact / Контакт: ' . $contact,
    $needs ? 'Needs / Интересует: ' . implode(', ', $needs) : null,
    $message !== '' ? "\nMessage / Задача:\n" . $message : null,
    "\n— " . $host . ' · ' . gmdate('Y-m-d H:i') . ' UTC · ' . $lang,
]));

// No user input in headers except a validated Reply-To.
$headers = [
    'From: CYBERMOVE <' . $from . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];
if ($isEmail) {
    $headers[] = 'Reply-To: ' . $contact;
}

$ok = mail(FORM_EMAIL, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers));
if (!$ok) {
    reply(502, ['ok' => false, 'error' => 'mail_failed']);
}
reply(200, ['ok' => true]);
