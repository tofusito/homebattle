# Happy Home Household Setup

This file defines the agreed initial household data for the MongoDB deployment.

## Household profiles

The app keeps a simple two-person selector in browser `localStorage`. Cloudflare Access protects entry to the application, while either household member can intentionally switch between the two local profiles.

| ID     | Display name | Emoji | Color key |
| ------ | ------------ | ----- | --------- |
| `lucy` | Lucy         | 🦄    | `lucy`    |
| `manu` | Manu         | 🐱    | `manu`    |

## Active zones

| ID           | Display name | Purpose                                                |
| ------------ | ------------ | ------------------------------------------------------ |
| `cocina`     | Cocina       | Meals, kitchen surfaces, kitchen floor, and dishwasher |
| `gatos`      | Gatos        | Litter box, food, water fountain, and scratching tree  |
| `habitacion` | Habitación   | Bed linen, towels, and pillowcases                     |
| `ropa`       | Ropa         | Washing and collecting white/colored laundry           |
| `general`    | General      | Whole-home tasks and robot-vacuum maintenance          |

## Removed zones

- Salón: removed from Happy Home.
- Baño: removed because a cleaner handles it weekly.

## Agreed task catalogue

|   # | ID                                | Zone       | Task                                  | Schedule                            | Assignment/relationship                                                                  | League points |
| --: | --------------------------------- | ---------- | ------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------: |
|   1 | `cocina_comida`                   | Cocina     | Hacer la comida                       | Daily                               | Assignments swap daily; the assignee can skip it when lunch is not at home               |             1 |
|   2 | `cocina_cena`                     | Cocina     | Hacer la cena                         | Daily                               | Always opposite lunch; the assignee can skip it when dinner is not at home               |             1 |
|   3 | `cocina_recoger_comida`           | Cocina     | Recoger y limpiar tras la comida      | Linked to lunch; starts 2026-08-10  | Appears after lunch is marked; assigned opposite the actual cook; surfaces are included  |             1 |
|   4 | `cocina_recoger_cena`             | Cocina     | Recoger y limpiar tras la cena        | Linked to dinner; starts 2026-08-10 | Appears after dinner is marked; assigned opposite the actual cook; surfaces are included |             1 |
|   5 | `cocina_suelo`                    | Cocina     | Fregar el suelo de la cocina          | On demand; minimum weekly           | One person per week, alternating; Lucy starts the week of 2026-08-03; marked separately  |             1 |
|   6 | `cocina_desayuno`                 | Cocina     | Preparar el desayuno                  | On demand                           | Whoever marks it; scores once per day                                                    |             1 |
|   7 | `cocina_poner_lavavajillas`       | Cocina     | Poner el lavavajillas                 | On demand                           | Whoever marks it; scores up to three times per day                                       |             1 |
|   8 | `cocina_lavavajillas`             | Cocina     | Recoger el lavavajillas               | On demand                           | Whoever marks it; scores up to three times per day                                       |             1 |
|   9 | `gatos_arenero`                   | Gatos      | Limpiar el arenero                    | Daily; preferably in the evening    | Lucy on 2026-08-07; Manu next; alternate every day                                       |             1 |
|  10 | `gatos_llenar_agua`               | Gatos      | Llenar de agua el bebedero            | On demand                           | Whoever marks it                                                                         |             1 |
|  11 | `gatos_llenar_comida`             | Gatos      | Llenar la comida de los gatos         | On demand                           | Whoever marks it                                                                         |             1 |
|  12 | `gatos_bebedero`                  | Gatos      | Limpiar el bebedero de los gatos      | Weekly                              | Lucy completed the week of 2026-08-03; Manu is responsible next week; alternate weekly   |             1 |
|  13 | `gatos_rascador`                  | Gatos      | Quitar pelos del árbol rascador       | Weekly                              | Manu starts the week of 2026-08-03; alternate weekly                                     |             1 |
|  14 | `habitacion_hacer_cama`           | Habitación | Hacer la cama                         | On demand                           | Whoever marks it; scores once per day                                                    |             1 |
|  15 | `habitacion_sabanas`              | Habitación | Cambiar las sábanas                   | On demand; no limit                 | Either person can mark it whenever needed; every completion scores                       |             1 |
|  16 | `habitacion_toallas_almohadas`    | Habitación | Cambiar toallas y fundas de almohada  | Every Sunday                        | One combined task; Manu starts the week of 2026-08-03 and the turn alternates weekly     |             1 |
|  17 | `ropa_lavadora_color`             | Ropa       | Poner y tender la lavadora de color   | On demand                           | Whoever marks it; completing it means the load is washed and hung                        |             1 |
|  18 | `ropa_lavadora_blanco`            | Ropa       | Poner y tender la lavadora de blanco  | On demand                           | Whoever marks it; completing it means the white load is washed and hung                  |             1 |
|  19 | `ropa_lavadora_trapos`            | Ropa       | Poner y tender la lavadora de trapos  | On demand                           | Whoever marks it; completing it means the rags are washed and hung                       |             1 |
|  20 | `ropa_recoger_color`              | Ropa       | Recoger y doblar la ropa de color     | Linked to the colored washing task  | Assigned to the other person after washing and hanging                                   |             1 |
|  21 | `ropa_recoger_blanco`             | Ropa       | Recoger y doblar la ropa de blanco    | Linked to the white washing task    | Assigned to the other person after washing and hanging                                   |             1 |
|  22 | `ropa_recoger_trapos`             | Ropa       | Recoger y guardar los trapos          | Linked to the rag washing task      | Assigned to the other person after washing and hanging                                   |             1 |
|  23 | `general_plumero`                 | General    | Pasar el plumero                      | On demand                           | Whoever marks it                                                                         |             1 |
|  24 | `general_robot_deposito`          | General    | Rellenar y limpiar depósito del robot | On demand                           | Whoever marks it; scores once per day                                                    |             1 |
|  25 | `general_robot_limpieza_profunda` | General    | Limpiar robot y base en profundidad   | On demand                           | Whoever marks it; scores once per day                                                    |             1 |

`cocina_superficies` remains archived with zero points. The former separate towel and pillowcase tasks are also archived so their two 2026-08-09 history entries remain auditable; from 2026-08-16 onward only the combined one-point task is active.

## Scheduling behavior

### Alternating rotation

- Rotations have an explicit next responsible profile.
- Calendar dates advance the turn, so marking a task early or late never shifts the agreed rotation.
- The UI shows both the due state and whose turn it is.
- The initial responsible profile remains pending until the two profiles are defined.

### Meals, kitchen handoffs, and kitchen floor

- Lunch and dinner form one paired cycle.
- Both tasks are due every day.
- Within a cycle, one profile is responsible for lunch and the other for dinner.
- Assignments swap every calendar day.
- Rotation anchor: on 2026-08-08, Manu is responsible for lunch and Lucy for dinner. On 2026-08-09, Lucy is responsible for lunch and Manu for dinner.
- From 2026-08-10, completing lunch or dinner activates one matching kitchen-cleanup handoff assigned to the other person. It is not actionable before the cooking task is marked.
- Lunch and dinner alone have a small skip action. A skipped meal resolves that occurrence with no league points and never activates its linked kitchen-cleanup handoff; it remains undoable in history.
- Kitchen cleanup includes counters, surfaces, putting stray items away, and a reasonable general tidy. Loading and unloading the dishwasher remain separate actions.
- The kitchen-floor task is on demand, with a minimum of one completion per week. One person owns each week and the assignment alternates; it remains separate from dinner.
- The Today tab shows daily work and kitchen handoffs in the responsible person's list; laundry handoffs remain shared in `Ropa lista`. On-demand tasks have their own section underneath and remain visible in Zones.
- Task cards no longer show an unexplained percentage/progress bar; the status text and assigned person are the source of truth.
- Missed daily and two-day-block occurrences get a separate `Tiempo de descuento` card throughout the following day. Completing it keeps yesterday's assignee and date, so it neither replaces nor changes today's turn. Linked laundry pickup remains available until it is actually completed.

### On-demand tasks

- On-demand tasks never become overdue and do not affect the "urgent" count.
- They remain available in their zone and record who completed them.
- Dishwasher, cat-refill, washing-and-hanging, bed-making, robot maintenance, and general whole-home tasks use this mode.
- All active tasks score within their configured cap. Archived kitchen-surface records remain visible but no longer score.

### Laundry handoff

- Color, white, and rag laundry use the same two-step workflow.
- Completing `Poner y tender` means both running the washing machine and hanging that load when it finishes.
- That completion activates the matching collect task and assigns it to the other person. Clothes are folded; rags are stored.
- The app records who started the cycle and shows the handoff in Today and the Ropa zone.
- Completing `Recoger y doblar` closes the latest cycle. A newer `Poner y tender` completion opens a new handoff.
- If the person who washed and hung the load also collects and folds it, the normal rescue confirmation and `+1/-1` scoring apply.
- Undoing a source or target completion recalculates the handoff from the remaining valid history.

### Rescue scoring

- A rescue happens when Lucy or Manu completes a currently assigned task belonging to the other person.
- It applies to daily, weekly, on-demand-weekly, monthly, kitchen-handoff, and linked laundry work. Pure on-demand tasks have no owner and cannot become rescues.
- Every action that would subtract points is blocked behind an explicit `Cancel` / `Confirm rescue` dialog. Cancelling records nothing.
- The person who completes it earns the normal task point; the scheduled owner loses one point. This creates a two-point swing without awarding an additional farming bonus.
- Only the first valid completion for that schedule occurrence can score or deduct points.
- The completion stores both the person who did the work and the scheduled owner so the result remains auditable if a future rotation changes.
- Undo reverses both the awarded point and the deduction.
- An activated skip-task voucher neutralizes the next rescue: the partner still earns the task point, but the original owner does not lose one.

### Fixed calendar task

- Bed linen is due on the first Sunday of each calendar month in `Europe/Madrid`.
- Completing it early should satisfy that month's occurrence; completing it late should close the missed occurrence without creating duplicates.

## Confirmed product choices

- App name: Happy Home.
- Keep the humorous, warm tone.
- Make the League intentionally competitive while keeping a shared weekly house goal underneath it.
- Use one point for competitive chores. Small quick actions stay visible in history but do not score.
- Keep the simple local profile selector.
- Use a dedicated MongoDB container in the same homelab stack.
- Protect the application with Cloudflare Access email verification.
- Public hostname: `happyhome.tofusito.org`, protected by Cloudflare Access.

## Interaction model

- Today prioritizes the selected person's tasks. The partner's tasks and completed work are collapsed by default.
- Lunch, dinner, and litter-box cards only become timely around their preferred part of the day.
- Zones opens with the complete weekly assignment split into Lucy and Manu panels, while Today remains personal.
- Every zone is a compact drawer with a status summary; inside, programmed and on-demand work are separated.
- Open zone drawers are remembered on each device, and Today offers four common actions in a 2-by-2 shortcut grid. Breakfast remains there and becomes disabled once completed that day.
- On-demand work is divided into collapsible zone sections in both Today and Zones.
- Pending laundry handoffs appear in a shared `Ropa lista` section in both people's Today view. The other person remains responsible, but either person can collect and fold; completing it outside the assigned turn asks for rescue confirmation first.
- Completion is optimistic and idempotent. A brief celebration and undo action appear immediately.
- Profile history shows the exact Madrid day and time. Existing entries can be corrected in place; changing the person or date recalculates the original assignee, rescue state, scoring cap, and any still-unredeemed weekly result.
- New completions store both when the chore happened and when it was recorded. Edits keep the original record ID and add an edit timestamp; future timestamps and broken linked-task order are rejected.
- The header activity bell shows the five latest active records. Partner activity is unread per selected local profile until the bell is opened, and live synchronization raises a gentle in-app notice.
- Each browser caches the last successful household view and queues completion, correction, and undo operations while offline.
- Server-sent events update the other open device immediately; a 60-second poll remains as a fallback.
- Optional haptics, sound, reduced motion, and gentle reminders are stored per device. Configured Web Push sends lunch/evening reminders to an installed PWA even while it is closed.
- The League has a weekly first-to-30 duel, provisional crown, monthly season, recent head-to-head results, zone variety, and unlockable trophies.
- A task scores only on valid completions within its schedule cap. Most score once per period; unloading the dishwasher scores up to three times per day.
- Rescue completions use a distinct amber treatment in Today, Zones, and History; the League shows rescues and conceded points for each person.
- The person completing a rescue receives an immediate `+1` message. If the other person's app is open, live synchronization shows that one point was conceded.
- The cooperative weekly goal and complete-week streak remain separate from the duel.
- The shared goal counts distinct required occurrences only; repeats and free-form work cannot fill it.
- Each Monday selects a new household reward from a rotating catalog. It may be changed before the duel has a winner, then freezes into a non-expiring voucher for the first person to reach thirty.
- Profile replaces the old top-level History tab. It shows both people's weekly progress, voucher wallets, redemption state, and the filterable household register.
- The installable PWA caches its shell and self-hosted fonts. Web Push is enabled when the deployment provides VAPID keys; otherwise reminders fall back to the active app.

## Private configuration kept outside the repository

The exact email allowlist, tunnel token, and MongoDB credentials remain only in their respective private services and remote `.env`; they must never be committed here.
