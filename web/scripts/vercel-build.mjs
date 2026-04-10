/**
 * Vercel `buildCommand` hook. Does not upload to Blob — that is manual:
 *   npm run upload-landing-media
 * Production uses committed public/media-cdn.json (+ optional /api/landing-demo-manifest).
 */
console.log('[vercel-build] skip Blob upload; using committed public/media-cdn.json');
