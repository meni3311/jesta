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
 * @param {string} jobId
 * @param {string} workerId
 */
export async function applyToJob(jobId, workerId) {
  const { data } = await api.post(`/jobs/${jobId}/apply`, { workerId });
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
 * Returns { user, token }
 * @param {{ email, password }} payload
 */
export async function login(payload) {
  const { data } = await api.post('/auth/login', payload);
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
