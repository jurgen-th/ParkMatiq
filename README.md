# ParkWise

Slim parkeren — a Dutch parking-session PWA. Start and stop a parking session,
see an honest per-minute cost, keep your history, and download a receipt.

Stack: React 18 + Vite 5, react-leaflet (CARTO Voyager tiles), jsPDF, PWA via
`vite-plugin-pwa`. State persists in `localStorage`. Wrapped for Android/iOS
with Capacitor.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build to dist/
npm run preview    # serve the built app
```

## Data & backend seam

**All persistence goes through a single module: [`src/utils/storage.js`](src/utils/storage.js).**
No screen reads or writes `localStorage` directly. This is the integration seam:
to move to a real backend (e.g. Supabase), reimplement the functions in that one
file (`getProfile`/`saveProfile`, `getSessions`/`addSession`,
`getActiveSession`/`setActiveSession`, `getSettings`/`saveSettings`,
`clearAllData`) against the backend. When those calls become network calls they
turn async, so the handful of call sites (Home, ActiveSession, History,
Settings, Onboarding) will need `await`; nothing else changes.

What still needs a backend/provider to go live (deliberately stubbed for the
demo):

- **Auth** — `Login`/`Register` use mock auth: a profile in `localStorage`,
  passwords never stored. Swap for real auth (Supabase) before public release.
- **Payment** — the onboarding "Betaalmethode" row is a demo placeholder. Real
  billing in NL requires a licensed parking provider / national register.
- **Live tariffs** — parking zones are bundled statically
  (`src/data/rotterdam-parking-zones.geojson`, refresh via
  `scripts/build-zones.py`). Point `src/utils/zones.js` at a live feed when ready.
- **Background auto start/stop** — impossible in a web PWA; needs the native
  wrapper below plus a Capacitor background-geolocation plugin.

Config for a backend goes in a `.env` (Vite exposes `VITE_`-prefixed vars only);
see `.env.example`. Never commit real keys.

## Native (Android / iOS)

The web build is wrapped with [Capacitor](https://capacitorjs.com). Routing uses
`HashRouter`, which works from the `file://` origin a native shell serves.
Native geolocation and notifications plugins are installed
(`@capacitor/geolocation`, `@capacitor/local-notifications`).

One-time, per platform (needs Android Studio / Xcode installed locally):

```bash
npm run cap:add:android     # scaffolds android/ project
npm run cap:add:ios         # scaffolds ios/ project (macOS only)
```

Then to build/run after any web change:

```bash
npm run cap:android         # build web, sync, open Android Studio
npm run cap:ios             # build web, sync, open Xcode
```

App metadata lives in [`capacitor.config.json`](capacitor.config.json).
