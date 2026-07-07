# ParkMatiq

Slim parkeren — a Dutch parking-session PWA.

## Target Architecture

The repository is being migrated toward a feature-based architecture:

```text
src/
├─ app/
├─ features/
│  ├─ auth/
│  ├─ onboarding/
│  ├─ parking-session/
│  ├─ parking-history/
│  ├─ receipts/
│  └─ settings/
├─ services/
│  ├─ storage/
│  ├─ geolocation/
│  ├─ notifications/
│  ├─ tariffs/
│  └─ receipts/
├─ components/
├─ hooks/
├─ data/
└─ utils/
```

Current implementation remains backwards compatible while the migration is performed incrementally.

## Data & backend seam

Primary persistence boundary moving forward:

`src/services/storage/`

Current implementation delegates to the existing localStorage implementation.

Future adapters:

- localStorageAdapter
- supabaseAdapter
- backend API adapter

## Native

Capacitor remains the mobile wrapper for Android and iOS.
