<?php
// Case editor settings. The real file (config.php, with the password hash) is written by `npm run editor:password`
// and is NOT committed. Copy this file only if you need to change the data folder.
return [
  // owner password hash (PBKDF2-SHA256): pbkdf2_sha256$<iterations>$<salt b64>$<hash b64>
  'password_hash' => '',
  // where drafts and photos are stored; null = automatic: <one level above the site folder>/cm-case-editor-data,
  // falling back to kejsy-proverka/data (web access denied). Keep it outside the site folder when possible.
  'data_dir' => null,
  // 'auto' (SQLite if available, else JSON files) or 'json'
  'storage' => 'auto',
];
