# Happy Home

Small household coordination app for Lucy and Manu. It gamifies recurring and on-demand chores while keeping identity deliberately simple: each device remembers the selected person in `localStorage`.

The interface is designed around pleasant daily use: personal work first, time-aware schedules, clear rotations, one-tap optimistic completion, cooperative goals, offline queuing, and live updates between open devices. The weekly league has authoritative score receipts, rescue rules, a rotating household reward, and durable vouchers that remain visible to both profiles until they are redeemed.

## Local development

The app requires an authenticated MongoDB database. Copy `.env.example` to `.env`, adjust the values, then run:

```sh
bun install
bun run dev
```

Quality checks:

```sh
bun run typecheck
bun test
bun run lint
bun run build
bun audit --production
```

## Production

The included multi-stage `Dockerfile` builds the TanStack Start application as a Node.js server. The homelab Compose definition lives in the separate homelab repository under `docker/stacks/happy-home` and runs this image with a private MongoDB instance and an optional Cloudflare Tunnel connector.

The application and MongoDB do not publish host ports. The live tunnel route targets `http://happy-home:3000` and is protected by Cloudflare Access email verification. The PWA service worker caches the shell and the browser stores the latest successful data snapshot; writes made offline are queued and synchronized when connectivity returns.

Background reminders are optional. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to enable Web Push for installed PWAs. Without VAPID keys, the preference falls back to foreground notifications. Push endpoints are stored in MongoDB and removed automatically when the browser reports that a subscription has expired.

Each Monday the default reward rotates through the built-in household catalog. Lucy or Manu may change it before the weekly winner reaches ten points. Reaching the target freezes the announced reward into a voucher; vouchers do not expire. The skip-task voucher becomes an active credit and automatically neutralizes the next rescue penalty when the partner takes over an assigned chore.

See `HOUSEHOLD_SETUP.md` for the exact initial task rotations and `PLAN.md` for the migration and operating decisions.
