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
 * Returns Job[] each with an `applications` array of { id, status, worker }.
 * Requires Bearer token (employer role).
 */
export async function getEmployerJobs() {
  const { data } = await api.get('/jobs/employer');
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
