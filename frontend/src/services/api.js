/**
 * Jesta API helpers — all HTTP calls go through the centralized axios instance.
 * Each function returns the unwrapped `data` from the response.
 */
import api from './axiosInstance';

// ── Jobs ──────────────────────────────────────────────────────────────────────

/**
 * Fetch active jobs.
 * @param {{ lat?: number, lng?: number, radius?: number, minPay?: number }} params
 */
export async function getJobs(params = {}) {
  const { data } = await api.get('/jobs', { params });
  return data;
}

/**
 * Fetch a single job by id.
 * @param {string} id
 */
export async function getJob(id) {
  const { data } = await api.get(`/jobs/${id}`);
  return data;
}

/**
 * Post a new job (employer).
 * @param {object} payload  CreateJobDto fields + employerId
 */
export async function createJob(payload) {
  const { data } = await api.post('/jobs', payload);
  return data;
}

/**
 * Edit an existing job (employer, owner only).
 * Locked with HTTP 409 once a worker has been APPROVED for the job.
 * @param {string} jobId
 * @param {{ title?, description?, pay?, requiredWorkers?, startTime?, endTime? }} payload
 */
export async function updateJob(jobId, payload) {
  const { data } = await api.patch(`/jobs/${jobId}`, payload);
  return data;
}

/**
 * One-tap apply ("אני בפנים! ⚡").
 * workerId is read from the JWT on the backend — no body needed.
 * @param {string} jobId
 */
export async function applyToJob(jobId) {
  const { data } = await api.post(`/jobs/${jobId}/apply`);
  return data;
}

/**
 * Fetch the logged-in employer's jobs with applicants.
 * Returns Job[] each with an `applications` array of { id, status, worker }
 * and a computed `uiStatus` (OPEN/EMERGENCY/APPROVED/COMPLETED/EXPIRED/CANCELLED).
 * Requires Bearer token (employer role).
 */
export async function getEmployerJobs() {
  const { data } = await api.get('/jobs/employer');
  return data;
}

/**
 * Real dashboard aggregates (System 4):
 * { totalPublished, totalCompleted, avgRating, ratingCount, totalPaid }
 */
export async function getEmployerStats() {
  const { data } = await api.get('/jobs/employer/stats');
  return data;
}

/**
 * Employer cancels an OPEN job. 409 once a worker is APPROVED.
 * @param {string} jobId
 */
export async function cancelJob(jobId) {
  const { data } = await api.patch(`/jobs/${jobId}/cancel`);
  return data;
}

/**
 * Approve a worker for a job.
 * Locks the job (removes from public feed) and creates a chat session.
 * Returns { application, chat }.
 * @param {string} jobId
 * @param {string} appId  Application id
 */
export async function approveApplication(jobId, appId) {
  const { data } = await api.patch(`/jobs/${jobId}/applications/${appId}/approve`);
  return data;
}

/**
 * Reject a worker's application.
 * @param {string} jobId
 * @param {string} appId
 */
export async function rejectApplication(jobId, appId) {
  const { data } = await api.patch(`/jobs/${jobId}/applications/${appId}/reject`);
  return data;
}

/**
 * Fetch the logged-in worker's own applications ("my shifts").
 * Returns Application[] with { status, job: { ...job, employer }, chat }.
 * Requires Bearer token (worker role).
 */
export async function getMyApplications() {
  const { data } = await api.get('/jobs/applications/me');
  return data;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

/**
 * List all chats the logged-in user participates in.
 * Returns Chat[] with last message preview + job title.
 */
export async function getChats() {
  const { data } = await api.get('/chats');
  return data;
}

/**
 * Fetch messages for a chat.
 * @param {string} chatId
 */
export async function getChatMessages(chatId) {
  const { data } = await api.get(`/chats/${chatId}/messages`);
  return data;
}

/**
 * Send a message to a chat.
 * @param {string} chatId
 * @param {string} text
 */
export async function sendChatMessage(chatId, text) {
  const { data } = await api.post(`/chats/${chatId}/messages`, { text });
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Register a new user via NestJS backend.
 * Returns { pendingVerification: true, email } — no token yet.
 * The user must verify their email via verifyEmailOtp() to get a session.
 * @param {{ email, password, fullName, role, phone?, avatarUrl? }} payload
 */
export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

/**
 * Submit the 6-digit OTP received by email.
 * Returns { user, token } — call onAuth() with this to log the user in.
 * @param {string} email
 * @param {string} code  6-digit string
 */
export async function verifyEmailOtp(email, code) {
  const { data } = await api.post('/auth/verify-email', { email, code });
  return data;
}

/**
 * Login via NestJS backend.
 * Returns { user, token } — or { pendingVerification: true, email } if the
 * account hasn't completed OTP verification yet (a fresh code is auto-sent).
 * @param {{ email, password }} payload
 */
export async function login(payload) {
  const { data } = await api.post('/auth/login', payload);
  return data;
}

/**
 * Re-send a 6-digit OTP to an unverified account.
 * Always resolves 200 (doesn't reveal whether the email exists).
 * @param {string} email
 */
export async function resendOtp(email) {
  const { data } = await api.post('/auth/resend-otp', { email });
  return data;
}

// ── Users ─────────────────────────────────────────────────────────────────────

/**
 * Update the authenticated user's profile.
 * Requires Bearer token (auto-attached by axios interceptor).
 * @param {{ fullName?, phone?, avatarUrl? }} payload
 */
export async function updateProfile(payload) {
  const { data } = await api.patch('/users/profile', payload);
  return data;
}

/**
 * Upload a new profile picture to the backend.
 * The backend uploads the file to Supabase storage, saves the public URL
 * to the users table, and returns the updated user object.
 * Requires Bearer token.
 * @param {FormData} formData  Must contain field "file" with the image File
 */
export async function uploadAvatar(formData) {
  const { data } = await api.post('/users/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Send a verification email to the authenticated user.
 * Requires Bearer token.
 */
export async function sendVerificationEmail() {
  const { data } = await api.post('/users/send-verification');
  return data;
}

// ── Ratings (System 1 — trust & rating) ───────────────────────────────────────

/**
 * Submit a 1-5 star rating for the other side of a completed gesta.
 * @param {{ jobId: string, toUserId: string, score: number, comment?: string }} payload
 */
export async function submitRating(payload) {
  const { data } = await api.post('/ratings', payload);
  return data;
}

/**
 * Completed gestas the current user still needs to rate.
 * Returns [{ jobId, jobTitle, completedAt, toUser: { id, fullName, avatarUrl, role } }]
 */
export async function getPendingRatings() {
  const { data } = await api.get('/ratings/pending');
  return data;
}

/**
 * Ratings received by a user (public — powers profile display).
 * Returns { items, average, count }.
 * @param {string} userId
 */
export async function getUserRatings(userId) {
  const { data } = await api.get(`/ratings/user/${userId}`);
  return data;
}

// ── Notifications (System 2 — reliability) ────────────────────────────────────

/**
 * Latest 50 notifications + unread count for the logged-in user.
 * Returns { items, unreadCount }.
 */
export async function getNotifications() {
  const { data } = await api.get('/notifications');
  return data;
}

/** Mark a single notification as read. */
export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}

/** Mark all notifications as read. */
export async function markAllNotificationsRead() {
  const { data } = await api.patch('/notifications/read-all');
  return data;
}

/**
 * Auto-mark notifications of the given types as read (System 3) — called when
 * the user visits the screen those notifications point to.
 * @param {string[]} types
 */
export async function markNotificationsReadByTypes(types) {
  const { data } = await api.patch('/notifications/read-types', { types });
  return data;
}

/**
 * "אישור הגעה" — worker confirms arrival for an approved shift.
 * Feeds the response-speed component of the Jesta Score.
 * @param {string} appId  Application id
 */
export async function confirmArrival(appId) {
  const { data } = await api.post(`/jobs/applications/${appId}/confirm`);
  return data;
}

/**
 * Claim a reopened spot after a JOB_REOPENED notification.
 * First to claim is auto-approved; 409 means someone else won.
 * @param {string} appId  Application id
 */
export async function claimReopened(appId) {
  const { data } = await api.post(`/jobs/applications/${appId}/claim`);
  return data;
}

/**
 * Employer marks a gesta as completed for an approved worker.
 * Triggers Jesta Score update + mutual rating prompts.
 */
export async function completeApplication(jobId, appId) {
  const { data } = await api.patch(`/jobs/${jobId}/applications/${appId}/complete`);
  return data;
}

/**
 * Employer marks an approved worker as no-show.
 * Triggers strike escalation + the fallback re-invite flow.
 */
export async function markNoShow(jobId, appId) {
  const { data } = await api.patch(`/jobs/${jobId}/applications/${appId}/no-show`);
  return data;
}

// ── Pro plan (System 3) ───────────────────────────────────────────────────────

/**
 * Free-tier blind approval: approve the oldest pending applicant.
 * @param {string} jobId
 */
export async function approveFirstApplicant(jobId) {
  const { data } = await api.post(`/jobs/${jobId}/approve-first`);
  return data;
}

/** Fresh full own profile (jestaScore, isPro, flags, availability). */
export async function getMe() {
  const { data } = await api.get('/users/me');
  return data;
}

/** Public profile of any user: rating, count, jestaScore + recent ratings. */
export async function getPublicProfile(userId) {
  const { data } = await api.get(`/users/${userId}/public`);
  return data;
}

/**
 * Worker sets their LEGACY direct-hiring availability card (jsonb).
 * The weekly grid (System 2) uses saveAvailability() below.
 * @param {{ open: boolean, days?: string[], hours?: string, note?: string }} payload
 */
export async function updateAvailability(payload) {
  const { data } = await api.patch('/users/availability', payload);
  return data;
}

/**
 * The worker's own availability profile (System 2).
 * Returns { isSet, slots: [{dayOfWeek,startTime,endTime}], minWage, categories, isOpenToOffers }.
 */
export async function getMyAvailability() {
  const { data } = await api.get('/users/availability');
  return data;
}

/**
 * Replace the worker's full availability profile (System 2).
 * @param {{ slots: {dayOfWeek:number,startTime:string,endTime:string}[],
 *           minWage: number, categories: string[], isOpenToOffers: boolean }} payload
 */
export async function saveAvailability(payload) {
  const { data } = await api.put('/users/availability', payload);
  return data;
}

/**
 * Pro-only: browse available workers, best Jesta Score first.
 * Pass a jobId to match against that job (System 2) — each card then carries
 * `matchingSlots` (availability blocks overlapping the job's time window).
 * @param {string} [jobId]
 */
export async function getAvailableWorkers(jobId) {
  const { data } = await api.get('/users/available-workers', {
    params: jobId ? { jobId } : {},
  });
  return data;
}

/** DEV ONLY: toggle Pro status to test gating (blocked in production). */
export async function toggleProDev() {
  const { data } = await api.patch('/users/dev/pro-toggle');
  return data;
}

// ── Direct offers (System 3 — Pro direct hiring) ──────────────────────────────

/**
 * Pro employer sends a personal job offer to a worker.
 * @param {{ jobId: string, workerId: string, message?: string }} payload
 */
export async function sendOffer(payload) {
  const { data } = await api.post('/offers', payload);
  return data;
}

/** Worker's incoming offers ("הצעות אישיות"). */
export async function getMyOffers() {
  const { data } = await api.get('/offers/me');
  return data;
}

/** Employer's outgoing offers. */
export async function getSentOffers() {
  const { data } = await api.get('/offers/sent');
  return data;
}

/** Worker accepts a direct offer → instant approval + chat. */
export async function acceptOffer(offerId) {
  const { data } = await api.patch(`/offers/${offerId}/accept`);
  return data;
}

/** Worker declines a direct offer. */
export async function declineOffer(offerId) {
  const { data } = await api.patch(`/offers/${offerId}/decline`);
  return data;
}
