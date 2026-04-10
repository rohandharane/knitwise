import { list } from '@vercel/blob';

/** Node required: @vercel/blob uses Node streams (not Edge-compatible). */
export const config = { runtime: 'nodejs20.x', maxDuration: 15 };

/** Must match scripts/upload-landing-demos-to-blob.mjs */
const PREFIX = 'knitwise/landing-demos/';

const FILES = [
  'kw_upload_parse.mp4',
  'kw_steps_glossary.mp4',
  'kw_sizing.mp4',
  'kw_repeats.mp4',
  'kw_reference_images.mp4',
  'kw_notes.mp4',
];

export default async function handler() {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
  };

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return new Response('{}', { headers });
  }

  try {
    const result = await list({
      prefix: PREFIX,
      limit: 100,
      token,
    });

    const manifest = {};
    for (var i = 0; i < result.blobs.length; i++) {
      var blob = result.blobs[i];
      var pathname = blob.pathname || '';
      var base = pathname.split('/').pop();
      if (base && FILES.indexOf(base) !== -1) {
        manifest[base] = blob.url;
      }
    }

    return new Response(JSON.stringify(manifest), { headers });
  } catch (e) {
    console.error('[landing-demo-manifest]', e);
    return new Response('{}', { headers });
  }
}
