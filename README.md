# KnitWise

KnitWise turns knitting patterns (PDF, image, or pasted text) into guided steps. Progress and notes are stored on your device.

**Beta** — feedback welcome.

**Site:** [knitwise.xyz](https://knitwise.xyz)

---

## Features

- Pattern upload or paste; structured steps for working through the pattern.
- Row notes (web) with step tags.
- Local storage in the browser.
- System appearance (light/dark).

---

## Repository layout

| Path | Purpose |
|------|---------|
| `web/` | Landing site, web app, and serverless API routes. |

---

## Web

```bash
cd web
npm install
npm run dev
```

Deploy with the Vercel CLI from the **repository root** (`npm run deploy`), because the linked Vercel project’s **Root Directory** is `web` (running deploy from inside `web/` would resolve `web/web`). You can also use `npm run deploy` from `web/` (it targets the parent directory). Configure any required secrets in your hosting project settings — do not commit them.

---

## Deprecated: Android / Capacitor

This repository previously included a **Capacitor-wrapped Android app** (`android/`, `www/`, `capacitor.config.ts`, root Capacitor npm packages). That stack is **no longer maintained**; **KnitWise is web-only**. Use the responsive web app in the browser (including on phones). Older mobile code was removed to reduce noise; you can still recover it from Git history if needed.

---

## License

ISC — see `LICENSE`.
