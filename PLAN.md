# Happy Home Implementation Plan

## Goal

Turn the inherited household-chore idea into a small, joyful, recoverable service for Lucy and Manu, deployed in Manuel's homelab without Lovable or Supabase.

## Decisions

- Happy Home remains a private two-person app.
- Cloudflare Access is the perimeter; the in-app profile remains a trusted `localStorage` selector.
- MongoDB runs as a dedicated local container.
- The app and database publish no host ports. Home-network access uses the same protected public hostname.
- The source of truth for tasks and rotations is `HOUSEHOLD_SETUP.md` plus `src/server/seed.ts`.
- Configuration stays file-backed until actual household use proves an admin screen worthwhile.

## Delivered application

- Lucy 🦄 and Manu 🐱 profiles with explicit current-person switching.
- Calendar-safe daily, two-day, weekly, on-demand-weekly, linked-handoff, and first-Sunday monthly schedules in `Europe/Madrid`; lunch/dinner use daily alternation.
- Time-aware lunch/evening states so future work is not presented as overdue.
- A personalized Today view: own work first, partner work compact, completions collapsed, weekly summary, and on-demand work grouped by zone.
- A general Zones view with weekly Lucy/Manu panels, compact zone drawers, and separate programmed/on-demand rows.
- Clear current owner and next rotation on every rotating card.
- One-tap optimistic completion, idempotent writes, undo toast, optional haptics/sound, and reduced-motion control.
- Competitive weekly first-to-30 duel, provisional crown, exact score gap, monthly season, four recent head-to-head results, variety stats, and trophies.
- Anti-farming scoring: only the first completion of a task occurrence awards league points; useful repeat records remain in history.
- Auditable rescue scoring for assigned work: confirmation before taking the other person's task, `+1` for the person who does it, `-1` for the scheduled owner, distinct visual treatment, live feedback, and fully reversible undo.
- Two-step color, white, and rag laundry relays: washing includes hanging, then collecting includes folding or storing and is assigned automatically to the other person; doing both halves becomes a rescue.
- Cooperative weekly house goal and complete-week streak below the duel.
- PWA shell, self-hosted fonts, cached last-known data, offline write queue, and explicit sync state.
- Server-sent events between open devices with 60-second polling as a fallback.
- Optional gentle notifications while the app/PWA is active. True background web push is intentionally not claimed.
- Loading, offline fallback, Mongo error, empty, and sync states.

## Delivered homelab architecture

```text
Browser/PWA
  -> Cloudflare Access (email OTP allowlist)
  -> Cloudflare Tunnel
  -> happy-home:3000
  -> internal Docker network
  -> happy-home-mongo:27017
```

- Canonical Dockhand stack: `/home/tofu/docker/dockerhand/data/stacks/Homelab/happy-home`.
- Versioned stack source: `/Users/tofu/Code/Git/homelab/docker/stacks/happy-home`.
- Runtime data: `/home/tofu/docker/happy-home/{mongo,backups}`.
- MongoDB is authenticated, health checked, resource limited, and not published.
- The app has a read-only filesystem, a Mongo-backed `/healthz`, and no published port.
- Cloudflare routes `happyhome.tofusito.org` to `http://happy-home:3000`; Access currently intercepts unauthenticated requests.
- The active backup service runs an immediate authenticated `mongodump`, repeats daily, keeps 14 days locally, writes a SHA-256 sidecar, and exposes health through `.last-success`.
- The first archive was checksum-verified and restored into an isolated temporary MongoDB volume; all four collections and expected record counts were recovered before the temporary resources were removed.

## Quality gates

- Prettier passes.
- TypeScript passes with strict settings.
- Fourteen unit tests with 49 assertions cover rotations, timing, on-demand catalogue entries, linked laundry handoffs, weekly goals, household streaks, rescue scoring and undo, anti-farming league scoring, and the offline queue.
- ESLint has zero errors; six inherited Fast Refresh warnings remain in unused generated UI helpers.
- Production build passes locally and inside the Linux/x86_64 Docker build.
- `bun audit --production` reports no known vulnerabilities after forcing patched `js-yaml` resolution.
- Live health, manifest, service worker, SSE stream, Mongo connectivity, Cloudflare Tunnel, and Access redirect are verified after deployment.

## Operational limits and follow-up

- Local backups share the homelab host's failure domain. Copy them to encrypted storage on another machine before treating them as disaster-safe.
- A restore drill must always target a temporary MongoDB container/volume, never production.
- Browser notifications are best-effort without a VAPID push service.
- Historical statistics currently read the newest 500 completion records; this is ample for current household use but should move to server-side aggregates before that limit becomes relevant.
