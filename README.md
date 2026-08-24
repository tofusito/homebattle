# Happy Home

Small household coordination app for Lucy and Manu. It gamifies recurring and on-demand chores while keeping identity deliberately simple: each device remembers the selected person in `localStorage`.

The interface is designed around pleasant daily use: personal work first, time-aware schedules, clear rotations, one-tap optimistic completion, cooperative goals, offline queuing, and live updates between open devices. The weekly league has authoritative score receipts, rescue rules, a rotating household reward, and durable vouchers that remain visible to both profiles until they are redeemed.

## Local development

The app requires an authenticated MongoDB database. Copy `.env.example` to `.env`, adjust the values, then run:

```sh
bun install
bun run dev
```

Quality checks (also enforced by GitHub Actions on every push and pull request):

```sh
bun run typecheck
bun test
bun run lint
bun run build
bun audit --production
```

When the cached app shell changes (icons, manifest, offline fallback), bump the `CACHE` version constant in `public/sw.js` so installed PWAs refresh their cache.

## Production

The included multi-stage `Dockerfile` builds the TanStack Start application as a Node.js server. The Dockerhand Compose stack runs this image with a private MongoDB instance and a Cloudflare Tunnel connector. See `DEPLOYMENT.md` for the pull, build, health-check, and rollback workflow.

The application and MongoDB do not publish host ports. The live tunnel route targets `http://happy-home:3000` and is protected by Cloudflare Access email verification. The PWA service worker caches the shell and the browser stores the latest successful data snapshot; writes made offline are queued and synchronized when connectivity returns.

Background reminders are optional. Configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` to enable Web Push for installed PWAs. Without VAPID keys, the preference falls back to foreground notifications. Push endpoints are stored in MongoDB and removed automatically when the browser reports that a subscription has expired.

Each Monday the default reward rotates through the built-in household catalog. The two profiles can request one shared reroll per week. Reaching the thirty-point target freezes the announced reward into a voucher; vouchers do not expire. The skip-task voucher becomes an active credit and automatically neutralizes the next rescue penalty when the partner takes over an assigned chore.

See `HOUSEHOLD_SETUP.md` for the exact task rotations and scoring rules.
