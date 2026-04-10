/**
 * Uploads landing demo MP4s to Vercel Blob (public, CDN-backed) and writes
 * public/media-cdn.json so landing.html can prefer those URLs.
 *
 * - If media-cdn.json already maps every file to an http(s) URL, upload is skipped
 *   (set BLOB_FORCE_UPLOAD=1 to replace blobs).
 * - Without BLOB_READ_WRITE_TOKEN, skips upload; use committed media-cdn.json (Blob URLs).
 * - MP4s are gitignored under public/media/; run this locally with files present to refresh Blob.
 *
 * Run manually when demos change: npm run upload-landing-media (not part of vercel-build).
 */
import { put } from '@vercel/blob';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load web/.env.local if present (e.g. after `vercel env pull .env.local`). */
function loadEnvLocal() {
  var p = join(__dirname, '..', '.env.local');
  if (!existsSync(p)) return;
  var text = readFileSync(p, 'utf8');
  var lines = text.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.indexOf('#') === 0) continue;
    var eq = line.indexOf('=');
    if (eq === -1) continue;
    var key = line.slice(0, eq).trim();
    var val = line.slice(eq + 1).trim();
    if (
      (val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') ||
      (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'")
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();
const publicDir = join(__dirname, '..', 'public');
const mediaDir = join(publicDir, 'media');
const manifestPath = join(publicDir, 'media-cdn.json');

const FILES = [
  'kw_upload_parse.mp4',
  'kw_steps_glossary.mp4',
  'kw_sizing.mp4',
  'kw_repeats.mp4',
  'kw_reference_images.mp4',
  'kw_notes.mp4',
];

function readManifest() {
  if (!existsSync(manifestPath)) return {};
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return {};
  }
}

function manifestComplete(m) {
  return FILES.every(function (f) {
    var u = m[f];
    return typeof u === 'string' && /^https?:\/\//.test(u);
  });
}

const existing = readManifest();
if (manifestComplete(existing) && !process.env.BLOB_FORCE_UPLOAD) {
  console.log(
    '[upload-landing-demos-to-blob] media-cdn.json is complete; skip upload. Set BLOB_FORCE_UPLOAD=1 to refresh blobs.'
  );
  process.exit(0);
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.warn(
    '[upload-landing-demos-to-blob] BLOB_READ_WRITE_TOKEN not set; skip upload. Using /media/* fallbacks until you run: npm run upload-landing-media'
  );
  process.exit(0);
}

const manifest = {};
for (const name of FILES) {
  const filePath = join(mediaDir, name);
  if (!existsSync(filePath)) {
    console.error('[upload-landing-demos-to-blob] Missing file:', filePath);
    process.exit(1);
  }
  const body = readFileSync(filePath);
  const pathname = `knitwise/landing-demos/${name}`;
  const result = await put(pathname, body, {
    access: 'public',
    token,
    contentType: 'video/mp4',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  manifest[name] = result.url;
  console.log('[upload-landing-demos-to-blob]', name, '->', result.url);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('[upload-landing-demos-to-blob] Wrote', manifestPath);
