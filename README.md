# KnitWise

KnitWise turns knitting patterns (PDF, image, or pasted text) into guided steps. Progress and notes are stored on your device.

**Beta** — feedback welcome.

**Site:** [knitwise.xyz](https://knitwise.xyz)

---

## Features

- Pattern upload or paste; structured steps for working through the pattern.
- Row notes (web) with step tags.
- Local storage on web and Android.
- System appearance (light/dark) on web and in the app.

---

## Repository layout

| Path | Purpose |
|------|---------|
| `web/` | Landing site, web app, and serverless API routes. |
| `www/` | Capacitor web bundle; synced into the Android project. |
| `android/` | Android app (Capacitor). |
| `capacitor.config.ts` | Capacitor configuration. |

---

## Web

```bash
cd web
npm install
npm run dev
```

Deploy uses the Vercel CLI (`npm run deploy` from `web/`). Configure any required secrets in your hosting project settings — do not commit them.

---

## Android

```bash
npm install
npm run cap:sync
npm run cap:open
```

---

## License

ISC — see `LICENSE`.
