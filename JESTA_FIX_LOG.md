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
