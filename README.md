# KnitWise

**Knitting patterns weren’t written to be followed — they were written to be deciphered.** KnitWise turns PDFs, photos, and pasted text into guided steps you can move through one at a time, with notes that stay with your session.

**Status:** beta — feedback welcome.

- **Web:** [knitwise.xyz](https://knitwise.xyz)  
- **Author:** [rohandharane.com](https://rohandharane.com)

---

## Features

- Upload a pattern (PDF, image) or paste text; the app structures it into steps.
- Row notes with step-tagged entries on the web app.
- Saves progress locally in the browser (web) or on device (Android).
- Dark mode follows the system on web and in the app.

---

## Repository layout

| Path | Purpose |
|------|---------|
| `web/` | Production **Vercel** site: landing page, `app.html`, Edge API proxy (`api/chat.js`), static assets. |
| `www/` | **Capacitor** web bundle (`webDir`); synced into the Android project. API calls use the production host for the Anthropic proxy. |
| `android/` | Android shell (Capacitor 8). |
| `capacitor.config.ts` | Capacitor config (`appId`, `webDir: www`, plugins). |

---

## Web (Vercel)

The deployable app lives under **`web/`**.

```bash
cd web
npm install
npm run dev      # local dev with Vercel CLI
npm run deploy   # production (requires Vercel CLI + login)
```

Environment variables (set in the **Vercel project**, not in git):

| Variable | Required | Description |
|----------|----------|---------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key (server-side only; never exposed to the client). |
| `RATE_LIMIT_PER_DAY` | No | Requests per IP per day for `/api/chat` (default: `30`). |

For local `vercel dev`, copy `web/.env.example` to `web/.env.local` and set `ANTHROPIC_API_KEY`.

---

## Android

```bash
npm install
npm run cap:sync   # copies `www/` into `android/`
npm run cap:open   # open Android Studio
```

The in-app WebView loads bundled assets from `www/`; LLM requests go to the **KnitWise API** on `knitwise.xyz` (no API keys ship in the app).

---

## Security

- **Do not** commit `.env`, `.env.local`, or any file containing API keys.
- The Edge route `web/api/chat.js` holds the only server-side use of `ANTHROPIC_API_KEY`.
- If a key is ever exposed, revoke it in the Anthropic console and rotate it in Vercel.

---

## License

ISC (see root `package.json` and `LICENSE`).
