# JESTA FIX LOG

Started: 2026-06-10

## Fixes

### Backend
- ✅ [users.service.ts / send-verification] — OTP email was hardcoded to `meni3311il@gmail.com` from `onboarding@resend.dev`; now sends to the actual user's email using configured RESEND_FROM
- ✅ [auth.service.ts / login] — unverified users could log in and bypass OTP; login now re-issues an OTP and returns `{ pendingVerification, email }`
- ✅ [auth / resend-otp] — added POST /api/auth/resend-otp endpoint + DTO (AuthScreen "שלח שוב" button was a stub)
- ✅ [auth.service.ts + jwt.guard.ts / JWT] — removed forgeable `'dev-secret'` fallback; missing JWT_SECRET now fails loudly
- ✅ [jobs / role enforcement] — only EMPLOYER can create jobs, only WORKER can apply
- ✅ [jobs / GET /api/jobs/applications/me] — new endpoint: worker's own applications with job + employer + chat id (powers Schedule & Pending screens)
- ✅ [jobs.service.ts / approveApplication] — approving one applicant now auto-rejects all other PENDING applications in the same transaction
- ✅ [chat.service.ts / realtime] — every persisted message is now broadcast to Supabase Realtime channel `chat:{chatId}` (event `new-message`) via service-role client
- ✅ [supabase_schema.sql] — was missing `chats` + `messages` tables entirely; added them with FKs + indexes, enabled RLS on all tables (API-only access model), added `avatars` bucket + storage policies

### Frontend
- ✅ [api.js] — added `getMyApplications()` and `resendOtp()` helpers for the new endpoints
- ✅ [AuthScreen.jsx] — "שלח שוב" resend button was a stub showing an apology; now calls POST /auth/resend-otp. Login now handles `pendingVerification` and routes to the OTP screen
- ✅ [JestaChat.jsx] — removed SEED_MESSAGES; loads history via GET /chats/:id/messages, sends via POST /chats/:id/messages, subscribes to Supabase Realtime broadcast `chat:{chatId}` for live incoming messages, dedupes by id; locked when no real chat exists
- ✅ [JestaChatInbox.jsx] — removed 4 fake conversations; fetches GET /chats on open with loading/empty/error states. ⚠️ unread counts are 0 with TODO — needs read-receipt infra (message_reads table)
- ✅ [JestaSchedule.jsx] — removed SHIFTS mock + fake stats (₪470 / 4.9⭐); now renders the worker's real applications from GET /jobs/applications/me, stats computed from data, chat opens with real chatId, level bar driven by user.completedJobs
- ✅ [JestaPending.jsx] — removed fake 3.4s auto-approval timer; polls real application status every 5s and only celebrates on actual APPROVED; handles REJECTED with a return-to-feed state; removed hardcoded "אורן"
- ✅ [JestaPublicProfile.jsx] — removed fake "יובל כהן"/"אורן פרידמן" defaults; renders passed real data with neutral fallbacks. ⚠️ CTA ("שלח הצעת עבודה") disabled with TODO — needs a job-offers endpoint
- ✅ [JestaSidebar.jsx] — removed hardcoded "3 ג׳סטות פעילות"/"₪2,400 שולמו"/"₪1,240 נצברו"/badge "2"; level text now from user.completedJobs. ⚠️ payments/work history + WhatsApp help disabled with TODOs (no backing endpoints)
- ✅ [JestaJobsFeed.jsx] — removed INITIAL_JOBS seed fallback (now defaults to []). ⚠️ user location still a fixed Gush Dan point with TODO (needs navigator.geolocation)
- ✅ [JestaCreateModal.jsx] — publish was already wired to POST /jobs. ⚠️ mockCoords() kept with TODO (needs geocoding); category field collected but not persisted (jobs table has no category column) — TODO added
- ✅ [App.jsx] — passes currentUserId to JestaChat (own-message detection) and user to JestaSchedule; FAB badge no longer driven by fake TOTAL_UNREAD=3
- ❌ [JestaEmployerDashboard.jsx] — legacy unused mock file; marked with header warning instead of deleting (instructions: don't remove existing UI)

### Verification
- ✅ All edited backend + frontend files re-read and verified post-edit (imports, props, JSX balance, Prisma queries against schema)
- ⚠️ Full `nest build` / `vite build` could not be run in this session (sandboxed Linux shell + Windows-built node_modules are incompatible, npm registry blocked). Run locally: `cd backend && npx prisma generate && npm run build`, `cd frontend && npm run build`

---

## Session 2026-06-10 (later) — three broken features

### BUG 1 — "אני בפנים" not reaching employer
**Root cause:** the backend write worked, but `App.jsx` fired `POST /jobs/:id/apply` fire-and-forget and swallowed every error — a failed DB write (expired token, network, role) showed the teen a fake "pending" screen with no record created. The employer dashboard also only fetched once, with no realtime.
- ✅ [JestaPending.jsx] — now owns the apply call: POSTs on mount, treats 409 ("already applied") as success, shows a real error state with a **retry button** for any other failure (403 → role message, network → "בעיית תקשורת"). Status polling starts only after the row actually exists in the DB
- ✅ [App.jsx] — `goToPending` no longer swallows apply errors (navigation only)
- ✅ [axiosInstance.js] — normalized errors now carry `.status` so callers can branch (409 vs real failure)
- ✅ [jobs.service.ts / apply] — after the application row is persisted (workerId + jobId + status PENDING default + createdAt), broadcasts `new-application` to Supabase Realtime channel `employer:{employerId}` via the service-role client (same pattern as chat). Broadcast failure is logged, never loses the application
- ✅ [EmployerDashboard.jsx] — subscribes to `employer:{user.id}` broadcast; new applicants appear instantly via a **silent** refetch (no loading flicker, and a failed silent refresh never blanks data already on screen). Dashboard already queried all PENDING/APPROVED/REJECTED applicants via GET /jobs/employer

### BUG 2 — employer cannot edit an active Gesta
- ✅ [schema.prisma + supabase_schema.sql] — new `requiredWorkers INT NOT NULL DEFAULT 1` column on jobs (safe re-run ALTER included). **Run in Supabase SQL editor + `npx prisma generate`**
- ✅ [update-job.dto.ts] — new DTO: title, description, pay, requiredWorkers, startTime, endTime (all optional, validated). Address/coords intentionally not editable — moving a published job would invalidate applicants' distance decisions
- ✅ [jobs.controller.ts + jobs.service.ts] — new `PATCH /api/jobs/:id`: owner-only (403 otherwise), 404 if missing, **409 once any applicant is APPROVED** (terms are a commitment to the approved worker)
- ✅ [JestaEditJobModal.jsx] — new edit modal: all six fields, validation, save → Supabase via the API, loading/error states. Locked state shows a clear explanation (עובד כבר אושר — שינוי תנאים אחרי אישור אינו הוגן); a mid-edit 409 flips to the locked view
- ✅ [EmployerDashboard.jsx] — pencil button on every active job chip; on save the job is merged back into state so the UI reflects changes immediately
- ✅ [create-job.dto.ts] — accepts optional `requiredWorkers` on creation too (defaults to 1)

### BUG 3 — no location autocomplete in job creation
- ✅ [JestaLocationField.jsx] — new component: debounced address autocomplete dropdown + "השתמשו במיקום הנוכחי שלי" button (browser Geolocation API → reverse geocode to a readable address). Returns **both** the human-readable address and lat/lng
  - Primary provider: **Google Places Autocomplete + Geocoder** — `// REQUIRES: GOOGLE_MAPS_API_KEY in .env` (frontend name: `VITE_GOOGLE_MAPS_API_KEY`, documented in `frontend/.env`; enable "Maps JavaScript API" + "Places API")
  - Keyless fallback: **OpenStreetMap Nominatim** (search + reverse) so the flow works end-to-end in development with real data
  - Error states: geolocation permission denied / timeout / unsupported browser, geocode failure, stale-response guard on fast typing — each with a Hebrew message; typing after a selection invalidates stale coordinates
- ✅ [JestaCreateModal.jsx] — **removed `mockCoords()`** (jobs no longer get random Gush Dan coordinates). Publish uses the selected coords; if the employer typed free text, the address is forward-geocoded at publish time, and if that fails publishing is blocked with a clear error instead of saving fake coordinates
- ✅ Map pins — `JestaJobsFeed` already places Leaflet pins from `job.lat/lng`, so real stored coordinates now position pins correctly

### Verification (this session)
- ✅ Backend: full `tsc --noEmit` passes
- ✅ Frontend: all 22 src files parse clean (babel)
- ⚠️ `npm run build` / live API calls still can't run in this sandbox (Windows-built node_modules, npm registry + outbound fetch blocked) — Nominatim/Google endpoints not exercised live here. Run locally: backend `npx prisma generate && npm run build`, frontend `npm run dev`, and apply the `requiredWorkers` ALTER in Supabase SQL editor

---

## Session 2026-06-11 — Trust & Rating · Reliability · Pro Employer Plan

### DB migrations (run `backend/prisma/migrations/20260611_trust_reliability_pro.sql` in Supabase SQL editor, then `cd backend && npx prisma generate`)
- ✅ enum `ApplicationStatus` + `NO_SHOW`; new enums `NotificationType`, `OfferStatus`
- ✅ `users` + ratingCount, jestaScore (default 60), showUpCount, noShowCount, responseCount, responseTotalMin, warningFlag, suspendedUntil, reviewFlag, isPro, proFeatures (jsonb), availability (jsonb)
- ✅ `jobs` + isInsured
- ✅ `applications` + autoRejected, approvedAt, confirmedAt, noShowAt, completedAt, preShiftNotifiedAt, urgentNotifiedAt
- ✅ new tables: `ratings` (unique jobId+fromUserId, score 1-5, comment ≤100), `notifications`, `job_offers` (unique jobId+workerId) — all with RLS enabled (API-only model)
- ✅ same DDL appended to `supabase_schema.sql` (fresh installs need only that file); `schema.prisma` updated to match
- ⚠️ `prisma generate` can't run in this sandbox (engine downloads blocked; node_modules is Windows-built). Until it's re-run locally, new code accesses Prisma through a documented `prisma.db` any-cast (see PrismaService.db) — runtime-identical, fully typed again after regeneration

### SYSTEM 1 — Trust & Rating
- ✅ [ratings module] POST /api/ratings (participants of a COMPLETED gesta only, both directions, duplicate→409), GET /api/ratings/pending (gestas I still owe a rating), GET /api/ratings/user/:id (public; recent 10 + avg + count). Each rating re-aggregates the target's `rating` (avg) + `ratingCount`, then recalculates jestaScore
- ✅ [score.service.ts] Jesta Score 0-100: 40% rating (1-5→0-100) + 30% attendance (showUp/(showUp+noShow)) + 20% response speed (avg minutes to confirm: ≤15min=100, ≥12h=0, linear) + 10% completed count (cap 20). Neutral baselines for empty history (new user = 60). Recalculated after rating / completion / no-show / arrival-confirmation. Never throws into business flows
- ✅ [jobs] PATCH /api/jobs/:jobId/applications/:appId/complete — employer marks gesta done: app→COMPLETED, worker completedJobs+1 + showUpCount+1, score recalc, RATE_REQUEST notification to BOTH sides (auto-opens the rating modal via realtime)
- ✅ [JestaRatingModal.jsx] new — queued star picker (1-5) + comment ≤100, snapshot queue, 409→skip; auto-opens on login if ratings are pending and on incoming RATE_REQUEST broadcast
- ✅ rating display: RatingStars (avg + count) + JestaScoreRing (new ui.jsx primitives) on applicant cards, public profile (live GET /users/:id/public incl. recent rating comments), worker browse, offers

### SYSTEM 2 — Reliability
- ✅ [notifications module] `notifications` table + GET /api/notifications, PATCH :id/read, PATCH read-all; every notification also broadcast to realtime channel `user:{userId}` (badge updates instantly in App.jsx)
- ✅ [pre-shift confirmation] in-process sweep every 5 min (no new npm deps — registry blocked): T-3h CONFIRM_SHIFT → if unconfirmed 1h later CONFIRM_SHIFT_URGENT. Idempotent via preShiftNotifiedAt/urgentNotifiedAt stamps. **Production cron note:** for multi-instance deploys move to Supabase pg_cron / scheduled Edge Function (the sweep is duplicate-safe) — documented in notifications.service.ts
- ✅ ["אישור הגעה"] POST /api/jobs/applications/:appId/confirm + button on approved shifts in JestaSchedule + action button inside the notification card; minutes-to-confirm feed the response-speed score
- ✅ [no-show] PATCH /api/jobs/:jobId/applications/:appId/no-show (owner-only, only after start time, two-tap confirm in UI): attendance drops + score recalc; strikes: 1st→warningFlag (shown on profile + applicant card), 2nd→48h suspendedUntil, 3rd→reviewFlag (manual unblock); suspended/review workers are blocked from apply/claim/accept with clear Hebrew messages
- ✅ [fallback flow] on no-show the job reopens and PENDING + auto-rejected applicants (new `autoRejected` column distinguishes them from manually rejected — those are never re-invited) with no overlapping approved job and in good standing are reverted to PENDING + notified "המשרה התפנתה — עדיין מעוניין?"; POST /api/jobs/applications/:appId/claim — first to claim wins via atomic conditional updateMany (status PENDING + no APPROVED app on the job), creates chat, closes job, notifies employer + broadcasts `application-update` for live dashboard refresh
- ✅ [overlap limit] on apply (and offer-accept): 3+ APPROVED time-overlapping jobs → 409 `OVERLAP_LIMIT` with the conflicting jobs; axiosInstance now preserves `code`+`data`, JestaPending shows exactly which shifts collide (and no longer mistakes this 409 for "already applied")

### SYSTEM 3 — Pro Employer Plan
- ✅ users.isPro + proFeatures(jsonb); PATCH /api/users/dev/pro-toggle (blocked when NODE_ENV=production) + hidden sidebar item shown only in Vite dev mode ("הדלק מצב פרו (DEV)")
- ✅ [applicant selection] GET /jobs/employer redacts PENDING applicants server-side for free employers (count-only, worker:null, redacted:true — can't bypass via API). Free UI: "X מועמדים ממתינים" + blurred placeholder rows + "אשר את הראשון" (POST /api/jobs/:id/approve-first approves the oldest PENDING) + "שדרג לפרו" CTA. Pro UI: full cards with photo, rating+count, Jesta Score ring, completed count, warning flag, confirmed-arrival indicator
- ✅ [insurance mode] "ג׳סטה מבוטחת" toggle in create modal step 3 (free: locked + upgrade hint; server enforces Pro on POST /jobs); on no-show of an insured job: fallback flow runs + employer gets proFeatures.prioritySupport=true + notification. Actual insurance logic TBD (scaffold only)
- ✅ [direct hiring] PATCH /api/users/availability (worker opt-in: open/days/hours/note — new card in profile settings), GET /api/users/available-workers (Pro-only, ordered by jestaScore), offers module: POST /api/offers (Pro-only, own active job, dup→409), GET /offers/me, GET /offers/sent, PATCH /offers/:id/accept (atomic: offer ACCEPTED + application upsert→APPROVED + job closed + others auto-rejected + chat + employer notified; same suspension/overlap gates as apply), PATCH /offers/:id/decline
- ✅ [JestaWorkerBrowse.jsx] new — Pro browse sheet from the dashboard ("גיוס ישיר"; free sees lock + upgrade hint), per-worker job picker, "נשלחה הצעה" state
- ✅ [JestaOffers.jsx] new — "הצעות אישיות" page in the worker sidebar: accept ("אני בפנים!") opens the chat, decline, employer rating shown
- ✅ GET /api/users/me — fresh profile (isPro/jestaScore/flags) merged into the session on every app start; auth USER_SELECT extended the same way

### Frontend wiring (App.jsx)
- ✅ notification center (JestaNotifications.jsx, sidebar item with unread badge for both roles) with inline actions: אישור הגעה / אני בפנים (claim) / דרגו עכשיו
- ✅ realtime `user:{id}` subscription: unread badge bumps instantly; RATE_REQUEST auto-opens the rating modal; 60s badge poll as fallback
- ✅ EmployerDashboard also listens to `application-update` (claim/confirm) for silent refetch

### Verification
- ✅ Backend: full `tsc --noEmit` passes (exit 0)
- ✅ Frontend: all 26 src files parse clean (@babel/parser, JSX)
- ✅ schema.prisma matches the SQL DDL column-for-column
- ⚠️ Not run here (sandbox: Windows node_modules, npm + outbound fetch blocked): `npx prisma generate`, `nest build`, `vite build`, live API flows. **Local checklist:** 1) run the migration SQL in Supabase 2) `cd backend && npx prisma generate && npm run build` 3) `cd frontend && npm run dev` 4) test: complete a gesta → both sides get rating prompts → jesta_score moves; no-show → strikes + re-invites; dev pro-toggle → dashboard switches between count-only and full applicant cards

### Cron / scheduled functions needed
1. **Pre-shift confirmation sweep** — currently in-process `setInterval` (5 min) in NotificationsService; for production move to Supabase pg_cron or a scheduled Edge Function (idempotent, duplicate-safe)
2. *(optional)* nightly jestaScore reconciliation — not required (score updates event-driven), but cheap insurance against drift

---

## Session 2026-06-11 (b) — Final layer: Emergency Gesta · Availability · Notifications Center · Dashboard V2 ×2 · CV PDF

### DB migrations (run `backend/prisma/migrations/20260611_final_layer.sql` in Supabase SQL editor, then `cd backend && npx prisma generate`)
- ✅ enum `NotificationType` + 7 values: `NEW_APPLICANT`, `APPLICATION_APPROVED`, `PRE_SHIFT_REMINDER`, `SHIFT_CONFIRMED`, `NO_SHOW_FALLBACK`, `RATING_REQUEST`, `EMERGENCY_GESTA` (legacy values kept so old rows stay valid)
- ✅ `jobs` + `isEmergency` (bool), `basePay` (original wage before the +20% bonus), `category` (text), `cancelledAt` (timestamptz); partial index `idx_jobs_emergency`
- ✅ **new table `availability`**: id, userId FK, dayOfWeek (0-6, 0=Sunday), startTime/endTime ("HH:MM" text — string compare works), minWage, categories[], isOpenToOffers, UNIQUE(userId,dayOfWeek,startTime), RLS enabled. One row per selected weekly block; profile fields ride on every row and the API rewrites a user's rows atomically
- ✅ same DDL appended to `supabase_schema.sql` (fresh installs need only that file); `schema.prisma` updated to match (new model `AvailabilitySlot` @@map("availability"))

### SYSTEM 1 — Emergency Gesta (ג'סטה חירום)
- ✅ [create-job.dto.ts] + `isEmergency?`, `category?`
- ✅ [jobs.service.ts / create] emergency validation: start must be within 3h (400 otherwise); wage auto-raised 20% server-side (`pay = round(basePay*1.2)`, original kept in `basePay`); after persist → `EMERGENCY_GESTA` notification fanout to eligible workers (good standing + no APPROVED job overlapping the shift, best jestaScore first, capped at 200). ⚠️ "within radius" cannot run server-side — **workers have no stored location** (only jobs carry lat/lng); documented in code, needs a worker-location field later
- ✅ [jobs.service.ts / findAll] feed priority: emergency jobs first (newest first), then regular — by distance when the caller sends lat/lng, else by recency
- ✅ [JestaCreateModal.jsx] "ג'סטה חירום" toggle in step 3 — enabled only when the shift starts within 3h (locked + hint otherwise); live wage breakdown in the summary (base + ‎+20% bonus = final hourly + shift total); payload sends the BASE wage, server applies the bonus
- ✅ [ui.jsx] new `EmergencyBadge` — styled div (pulsing dot + lucide `Siren`), **no emoji in code** per design-system rules
- ✅ [JestaJobsFeed.jsx] emergency jobs pinned to top of the list (client-side re-pin survives filtering); card shows badge + "₪X + 20% בונוס חירום" breakdown + red border; map pins styled red w/ glow + zIndexOffset so they sit on top
- ✅ [JestaJobDetails.jsx] emergency banner (badge + base/bonus/total breakdown) + breakdown in the sticky CTA bar — both sides see original + bonus
- ✅ [App.jsx] realtime: an incoming `EMERGENCY_GESTA` broadcast silently refreshes the jobs feed (pinned job appears without reload); tapping the notification navigates to the job details

### SYSTEM 2 — Availability profile for teenagers
- ✅ [upsert-availability.dto.ts] new — slots[{dayOfWeek 0-6, "HH:MM" regex-validated}], minWage (0-500), categories[], isOpenToOffers
- ✅ [users.service.ts] `getMyAvailability()` (GET /api/users/availability) + `upsertAvailability()` (PUT /api/users/availability — WORKER-only, deleteMany+createMany in one transaction, also mirrors a compact summary into the legacy users.availability jsonb so old UI keeps working). Legacy PATCH /users/availability kept
- ✅ [users.service.ts / getAvailableWorkers] rewritten on the new table + optional `?jobId=` **matching** (System 2 spec): availability overlaps the job's time window (Israel-timezone day+HH:MM via Intl; midnight-crossing shifts matched until 24:00 on the start day), worker minWage <= job pay, categories include the job's category (empty preference = matches all; non-worker-taxonomy job categories normalize to 'other'); sorted by jestaScore desc; each card carries `slots` + `matchingSlots`
- ✅ [JestaAvailability.jsx] new full-screen flow: weekly grid 7 days × 8 two-hour blocks (08:00-24:00, tap to toggle), min-wage slider (₪30-120), category multi-select (שליחויות/בייביסיטר/אירועים/חיות מחמד/מחסן/אחר), "פתוח להצעות עבודה ישירות מפרו" toggle, atomic save with saved-flash
- ✅ [JestaSidebar.jsx] worker nav: availability not set → large CTA "הגדר זמינות וקבל הצעות אישיות"; set → NavItem "ערוך זמינות" with a green dot
- ✅ [JestaWorkerBrowse.jsx] job-match `<select>` in the header (defaults to the first active job; "כל הג'סטרים הזמינים" opt-out); matching availability blocks highlighted green and sorted first on each worker card; minWage + category chips shown
- ✅ [JestaCreateModal.jsx] job categories now PERSISTED (closes the old TODO) and aligned with the worker taxonomy: added שליחויות/בייביסיטר/חיות מחמד/מחסן alongside the original six

### SYSTEM 3 — Notifications Center
- ✅ all 8 spec types implemented end-to-end: `NEW_APPLICANT` (apply → employer, persisted in addition to the realtime broadcast), `APPLICATION_APPROVED` (was GENERAL), `PRE_SHIFT_REMINDER` (T-3h sweep, was CONFIRM_SHIFT), `SHIFT_CONFIRMED` (confirm-arrival → employer, new), `NO_SHOW_FALLBACK` (was JOB_REOPENED), `DIRECT_OFFER` (existing), `RATING_REQUEST` (was RATE_REQUEST), `EMERGENCY_GESTA` (new fanout)
- ✅ [notifications.service/controller] new PATCH /api/notifications/read-types {types[]} — bulk mark-read by type
- ✅ [ui.jsx] new `BellButton` (bell + unread badge) — added to the worker feed header and the employer dashboard header
- ✅ [JestaNotifications.jsx] converted from bottom sheet to a **right-side slide-in panel**; per-type icons incl. the 8 new types; tap on a card → marks read + navigates to the relevant screen; inline actions kept (אישור הגעה / אני בפנים / דרגו עכשיו); "סמן הכל כנקרא" kept
- ✅ [App.jsx] `handleNotificationNavigate`: NEW_APPLICANT/SHIFT_CONFIRMED/OFFER_RESPONSE → employer dashboard · APPLICATION_APPROVED/PRE_SHIFT_REMINDER/NO_SHOW_FALLBACK (+legacy) → worker schedule · DIRECT_OFFER → offers screen · EMERGENCY_GESTA → job details (or feed) · RATING_REQUEST → rating modal
- ✅ [App.jsx] **auto-mark-read on visiting the relevant screen**: schedule visit clears the worker-shift types, employer-dashboard visit clears NEW_APPLICANT/SHIFT_CONFIRMED/OFFER_RESPONSE, offers screen clears DIRECT_OFFER — badge refreshes after each
- ✅ realtime unchanged and verified: every persisted notification broadcasts to `user:{id}`, badge bumps instantly, 60s poll fallback

### SYSTEM 4 — Employer Dashboard V2
- ✅ [jobs.service.ts] computed `uiStatus` (OPEN/EMERGENCY/APPROVED/COMPLETED/EXPIRED/CANCELLED) attached to every job in GET /jobs/employer; jobs now include their `ratings` so completed cards can show the rating received
- ✅ [jobs.service.ts] new GET /api/jobs/employer/stats — **real aggregates only**: totalPublished (count), totalCompleted (COMPLETED applications), avgRating+ratingCount (from users), totalPaid (Σ pay × shift-hours over completed gestas)
- ✅ [jobs.service.ts] new PATCH /api/jobs/:id/cancel — owner-only; **409 once a worker is APPROVED/COMPLETED** (use complete/no-show instead); sets isActive=false + cancelledAt, rejects PENDING applicants (autoRejected=false — cancelled jobs never re-invite) and notifies each
- ✅ [EmployerDashboard.jsx] stats bar → 2×2 grid of the 4 real metrics; horizontal JobChips replaced by vertical `JobCardV2` list ("הג'סטות שלי"): title/time/location/applicant-count/wage (+emergency breakdown, insurance), `JobStatusBadge`, quick actions per lifecycle: OPEN/EMERGENCY → edit + two-tap cancel · APPROVED → mark complete + mark no-show (no-show disabled until the shift starts) · COMPLETED → read-only + rating received · EXPIRED/CANCELLED/COMPLETED → "פרסם שוב"
- ✅ [repost] duplicates the job as a new draft: App passes the job as `prefill` to JestaCreateModal (everything pre-filled EXCEPT date/time — a reposted job must pick a fresh shift window); wage prefills from basePay so the 20% bonus isn't compounded
- ✅ free-tier applicant redaction, realtime silent refetch, LockedApplicants — all preserved

### SYSTEM 5 — Teenager Dashboard V2
- ✅ [JestaSchedule.jsx] renamed "הג'סטות שלי"; tabs ממתינות/מאושרות/הושלמו/נדחו (NO_SHOW rides with נדחו) with counts; smart default tab
- ✅ confirmed shifts (אישור הגעה done) show a **live 1-second countdown** to start time
- ✅ earnings summary strip — real sums: total earned (COMPLETED), this month (by completedAt), pending (APPROVED not yet completed)
- ✅ ["ייצא כקורות חיים"] button on the completed tab → **real downloadable PDF** via new `lib/cvPdf.js`: name, Jesta Score ring, completed-gestas table (role/employer/date/rating received per job via GET /ratings/user/:id), average rating, categories worked in; multi-page slicing for long histories; filename `Jesta-CV-<name>.pdf`
  - ⚠️ jsPDF 2.5.1 + html2canvas 1.4.1 load on demand from cdnjs (npm registry blocked in this environment; rasterized HTML keeps Hebrew/RTL pixel-perfect — text-mode jsPDF has no Hebrew font). Graceful Hebrew error if the CDN is unreachable. To self-host later: `npm i jspdf html2canvas` and swap the two loadScript calls for imports

### New DB tables & migrations (summary for DoD)
| Change | Where |
|---|---|
| `availability` table (new) | `20260611_final_layer.sql` + `supabase_schema.sql` |
| `jobs.isEmergency`, `jobs.basePay`, `jobs.category`, `jobs.cancelledAt` | same |
| 7 new `NotificationType` enum values | same |
| `idx_jobs_emergency`, `idx_availability_user`, `idx_availability_open` | same |

### Scheduled functions needed (unchanged + note)
1. **Pre-shift confirmation sweep** (existing, now emits `PRE_SHIFT_REMINDER`) — in-process 5-min interval; move to Supabase pg_cron / scheduled Edge Function for multi-instance deploys (idempotent)
2. *(optional)* hourly job-expiry sweep — EXPIRED is currently computed on read (endTime < now), so nothing breaks without it; add one only if you later want push notifications on expiry
3. *(optional)* nightly jestaScore reconciliation — as before

### Verification (this session)
- ✅ Every edited/created file re-read post-edit: imports, props, route ordering (employer/stats + availability declared before `:id` catch-alls), JSX balance, Prisma queries against the new schema, enum names consistent across SQL/Prisma/Nest/React
- ✅ schema.prisma matches the migration SQL column-for-column
- ⚠️ `tsc --noEmit` / `vite build` could NOT run in this session — the sandbox mount failed to expose project subdirectories (worse than previous sessions) and the npm registry is blocked. **Local checklist:** 1) run `20260611_final_layer.sql` in Supabase 2) `cd backend && npx prisma generate && npm run build` 3) `cd frontend && npm run dev` 4) smoke-test: publish an emergency gesta starting <3h from now → +20% wage breakdown, pinned to feed top, red map pin, workers get EMERGENCY_GESTA; set availability as a worker → Pro "גיוס ישיר" with a job selected returns the matched worker with green-highlighted blocks; bell badge updates in realtime and clears when visiting the relevant screen; cancel/repost/complete from the new job cards; complete a gesta → teen's הושלמו tab → "ייצא כקורות חיים" downloads a PDF
