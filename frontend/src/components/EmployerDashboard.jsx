/**
 * EmployerDashboard — Full-screen employer view (real data from API)
 *
 * Pro gating (System 3): free employers see PENDING applicants as a count
 * only (the API redacts them server-side) with a single "אשר את הראשון"
 * button; Pro employers see full applicant cards with Jesta Score and can
 * approve a specific applicant + send direct offers.
 *
 * Reliability (System 2): once a shift has started, approved applicants get
 * "הושלם" / "לא הגיע" actions — no-show triggers strike escalation and the
 * fallback re-invite flow on the backend.
 *
 * Props:
 *   user             { id, fullName, isPro, ... } — logged-in employer
 *   onOpenCreate     fn — open CreateModal
 *   onOpenProfile    fn(type, data)
 *   onOpenChat       fn(contract)
 *   onOpenSidebar    fn
 *   onRequestRating  fn — a gesta was completed; parent opens the rating modal
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Check, X, MessageCircle, Lock, Sparkles,
  Clock, Users, Briefcase, Menu, Loader2, RefreshCw, Inbox, Pencil,
  CheckCircle2, UserX, ShieldCheck, MapPin, Star, Banknote, RotateCcw, Ban,
} from "lucide-react";
import {
  getEmployerJobs, getEmployerStats, approveApplication, rejectApplication,
  approveFirstApplicant, completeApplication, markNoShow, cancelJob,
} from "../services/api";
import { supabase } from "../lib/supabaseClient";
import JestaEditJobModal from "./JestaEditJobModal";
import JestaWorkerBrowse from "./JestaWorkerBrowse";
import CoinBalance from "./CoinBalance";
import { color, radius, font, styles } from "../design-system";
import {
  Avatar, Badge, EmptyState, PrimaryButton, SectionLabel, RatingStars,
  JestaScoreRing, JobStatusBadge, EmergencyBadge, BellButton,
} from "./ui";

const HIDE_SCROLL = `
  .jesta-scroll::-webkit-scrollbar { display: none; }
  .jesta-scroll { -ms-overflow-style: none; scrollbar-width: none; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatShift(start, end) {
  if (!start) return "";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const today    = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const sameDay  = (a, b) => a.toDateString() === b.toDateString();
  const dayLabel = sameDay(s, today)    ? "היום"
                 : sameDay(s, tomorrow) ? "מחר"
                 : s.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
  const timeStr = s.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const endStr  = e ? `–${e.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : "";
  return `${dayLabel}, ${timeStr}${endStr}`;
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div style={{ ...styles.card, flex: 1, padding: "12px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={styles.iconBox(28)}>
          <Icon size={14} color={color.primaryText} strokeWidth={1.75} />
        </div>
        <span style={{ fontSize: 11, color: color.textSecondary, fontWeight: 500, lineHeight: 1.2 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color.textPrimary, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: color.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Job lifecycle helpers (System 4) ─────────────────────────────────────────
// uiStatus comes computed from the backend; this is the client-side fallback.
function jobUiStatus(job) {
  if (job.uiStatus) return job.uiStatus;
  const apps = job.applications ?? [];
  if (job.cancelledAt) return "CANCELLED";
  if (apps.some((a) => a.status === "COMPLETED")) return "COMPLETED";
  if (apps.some((a) => a.status === "APPROVED"))  return "APPROVED";
  if (job.endTime && new Date(job.endTime) < new Date()) return "EXPIRED";
  if (job.isEmergency && job.isActive) return "EMERGENCY";
  return "OPEN";
}

function QuickAction({ icon: Icon, label, tone = "neutral", onClick, disabled }) {
  const tint = tone === "danger" ? color.danger
             : tone === "success" ? color.success
             : color.primaryText;
  return (
    <motion.button whileTap={disabled ? undefined : { scale: 0.95 }} onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 30,
        padding: "0 10px", borderRadius: radius.chip,
        border: `1px solid ${tone === "danger" ? "rgba(248,113,113,0.35)" : color.borderStrong}`,
        background: "transparent", color: tint,
        fontSize: 11, fontWeight: 600, fontFamily: font.family,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <Icon size={12} strokeWidth={2} /> {label}
    </motion.button>
  );
}

// ── JobCardV2 — vertical job card with status badge + quick actions ──────────
function JobCardV2({ job, userId, onEdit, onCancel, onComplete, onNoShow, onRepost }) {
  const [cancelArmed, setCancelArmed] = useState(false);
  const [acting,      setActing]      = useState(false);

  const status       = jobUiStatus(job);
  const apps         = job.applications ?? [];
  const pendingCount = apps.filter((a) => a.status === "PENDING").length;
  const approvedApp  = apps.find((a) => a.status === "APPROVED");
  const ratingReceived = (job.ratings ?? []).find((r) => r.toUserId === userId);

  const run = async (fn) => {
    if (acting) return;
    setActing(true);
    try { await fn(); } catch (err) { console.error("[Dashboard] job action:", err.message); }
    finally { setActing(false); }
  };

  const handleCancel = async () => {
    if (!cancelArmed) { setCancelArmed(true); setTimeout(() => setCancelArmed(false), 3500); return; }
    setCancelArmed(false);
    await run(() => onCancel(job.id));
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{ ...styles.card, padding: 14, marginBottom: 10,
        borderColor: status === "EMERGENCY" ? "rgba(248,113,113,0.4)" : color.borderSubtle,
        opacity: status === "CANCELLED" || status === "EXPIRED" ? 0.75 : 1 }}>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={styles.iconBox(36)}>
          <Briefcase size={16} color={color.primaryText} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: color.textPrimary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
              {job.title}
            </span>
            <JobStatusBadge status={status} />
            {job.isEmergency && status !== "EMERGENCY" && <EmergencyBadge size="sm" />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: color.textSecondary }}>
              <Clock size={10} color={color.textMuted} strokeWidth={2} /> {formatShift(job.startTime, job.endTime)}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: color.textSecondary,
              maxWidth: 120, overflow: "hidden" }}>
              <MapPin size={10} color={color.textMuted} strokeWidth={2} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.address}</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: color.primaryText }}>₪{job.pay}/ש׳</span>
            {job.isEmergency && job.basePay != null && (
              <span style={{ fontSize: 9, color: color.danger, fontWeight: 600 }}>
                ₪{job.basePay} + 20% חירום
              </span>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: color.textSecondary,
              background: color.surface3, borderRadius: radius.chip, padding: "2px 8px", fontWeight: 500 }}>
              <Users size={9} strokeWidth={2} /> {pendingCount} ממתינים
            </span>
            {job.isInsured && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 9, color: color.success, fontWeight: 600 }}>
                <ShieldCheck size={10} strokeWidth={2} /> מבוטחת
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rating received (read-only COMPLETED view) */}
      {status === "COMPLETED" && ratingReceived && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10,
          padding: "8px 10px", borderRadius: radius.input, background: color.surface2 }}>
          <span style={{ fontSize: 10, color: color.textSecondary }}>הדירוג שקיבלת:</span>
          <RatingStars rating={ratingReceived.score} size={10} showValue={false} />
          {ratingReceived.comment && (
            <span style={{ fontSize: 10, color: color.textSecondary, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>״{ratingReceived.comment}״</span>
          )}
        </div>
      )}

      {/* Quick actions by lifecycle state (System 4) */}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {acting ? (
          <Loader2 size={18} color={color.textSecondary} style={{ animation: "spin 0.7s linear infinite" }} />
        ) : (status === "OPEN" || status === "EMERGENCY") ? (
          <>
            <QuickAction icon={Pencil} label="עריכה" onClick={() => onEdit?.(job)} />
            <QuickAction icon={Ban} tone="danger"
              label={cancelArmed ? "בטוח? לחצו שוב" : "ביטול"}
              onClick={handleCancel} />
          </>
        ) : status === "APPROVED" && approvedApp ? (
          <>
            <QuickAction icon={CheckCircle2} tone="success" label="סמן כהושלמה"
              onClick={() => run(() => onComplete(job.id, approvedApp.id))} />
            <QuickAction icon={UserX} tone="danger" label="לא הגיע"
              disabled={!job.startTime || new Date() < new Date(job.startTime)}
              onClick={() => run(() => onNoShow(job.id, approvedApp.id))} />
          </>
        ) : (status === "EXPIRED" || status === "CANCELLED" || status === "COMPLETED") ? (
          <QuickAction icon={RotateCcw} label="פרסם שוב" onClick={() => onRepost?.(job)} />
        ) : null}
      </div>
    </motion.div>
  );
}

// ── LockedApplicants — free-tier view of pending applicants (System 3) ───────
function LockedApplicants({ job, onApproveFirst, onUpgradeHint }) {
  const [approving, setApproving] = useState(false);
  const [error,     setError]     = useState(null);
  const pendingCount = (job.applications ?? []).filter(a => a.status === "PENDING").length;
  if (pendingCount === 0) return null;

  const handleApproveFirst = async () => {
    if (approving) return;
    setApproving(true); setError(null);
    try {
      await onApproveFirst(job.id);
    } catch (err) {
      setError(err.status === 404 ? "אין מועמדים ממתינים" : "האישור נכשל, נסו שוב");
    } finally {
      setApproving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      style={{ ...styles.card, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ ...styles.iconBox(44), borderRadius: "50%" }}>
          <Users size={19} color={color.primaryText} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: color.textPrimary }}>
            {pendingCount} מועמדים ממתינים
          </div>
          <div style={{ fontSize: 11, color: color.textSecondary, marginTop: 2 }}>{job.title}</div>
        </div>
        <Lock size={16} color={color.textMuted} strokeWidth={1.75} />
      </div>

      {/* Blurred placeholder rows — who they are is a Pro feature */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {Array.from({ length: Math.min(pendingCount, 2) }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: radius.input, background: color.surface2,
            filter: "blur(0px)" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: color.surface3 }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: "55%", height: 8, borderRadius: 4, background: color.surface3, marginBottom: 5 }} />
              <div style={{ width: "35%", height: 6, borderRadius: 3, background: color.surface3 }} />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ fontSize: 11, color: color.danger, fontWeight: 500, marginBottom: 8 }}>{error}</div>
      )}

      <motion.button whileTap={{ scale: 0.97 }} onClick={handleApproveFirst}
        style={{ width: "100%", height: 44, borderRadius: radius.button, border: "none",
          background: color.primary, color: "#fff", fontSize: 13, fontWeight: 700,
          fontFamily: font.family, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {approving
          ? <Loader2 size={16} color="#fff" style={{ animation: "spin 0.7s linear infinite" }} />
          : <><Check size={15} strokeWidth={2.5} /> אשר את הראשון</>}
      </motion.button>

      <motion.button whileTap={{ scale: 0.97 }} onClick={onUpgradeHint}
        style={{ width: "100%", height: 38, marginTop: 8, borderRadius: radius.button,
          border: `1px solid ${color.borderStrong}`, background: "transparent",
          color: color.primaryText, fontSize: 12, fontWeight: 600,
          fontFamily: font.family, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Sparkles size={13} strokeWidth={2} /> שדרג לפרו — בחרו בעצמכם את המועמד
      </motion.button>
    </motion.div>
  );
}

// ── ApplicantCard (Pro: full details + Jesta Score) ──────────────────────────
function ApplicantCard({ applicant, jobTitle, jobId, jobStart, onApprove, onReject, onComplete, onNoShow, onOpenProfile, onOpenChat }) {
  const [actioning,     setActioning]     = useState(false);
  const [localStatus,   setLocalStatus]   = useState(applicant.status);
  const [chatContract,  setChatContract]  = useState(null);
  const [armedNoShow,   setArmedNoShow]   = useState(false);

  const worker = applicant.worker;
  const name   = worker?.fullName ?? "ג׳סטר";
  const rating = worker?.rating ?? 0;
  const jobs   = worker?.completedJobs ?? 0;

  const shiftStarted = jobStart && new Date() >= new Date(jobStart);

  const run = async (fn, nextStatus) => {
    if (actioning) return;
    setActioning(true);
    try {
      const result = await fn();
      setLocalStatus(nextStatus);
      return result;
    } catch (err) {
      console.error("[Dashboard] action error:", err.message);
    } finally {
      setActioning(false);
    }
  };

  const handleApprove = async () => {
    const result = await run(() => onApprove(jobId, applicant.id), "APPROVED");
    if (result?.chat) {
      const contract = {
        chatId:        result.chat.id,
        workerId:      worker?.id,
        workerName:    name,
        employerName:  result.chat.employer?.fullName ?? "מעסיק",
        jobTitle,
        status:        "approved",
      };
      setChatContract(contract);
      onOpenChat?.(contract);
    }
  };

  const handleComplete = () => run(() => onComplete(jobId, applicant.id), "COMPLETED");
  const handleNoShow = async () => {
    if (!armedNoShow) { setArmedNoShow(true); setTimeout(() => setArmedNoShow(false), 3500); return; }
    setArmedNoShow(false);
    await run(() => onNoShow(jobId, applicant.id), "NO_SHOW");
  };

  const isApproved  = localStatus === "APPROVED";
  const isRejected  = localStatus === "REJECTED";
  const isCompleted = localStatus === "COMPLETED";
  const isNoShow    = localStatus === "NO_SHOW";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: isRejected || isNoShow ? 0.45 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{
        ...styles.card,
        padding: 16, marginBottom: 12,
        position: "relative", overflow: "hidden",
        borderColor: isApproved || isCompleted ? color.borderStrong : color.borderSubtle,
      }}
    >
      {(isApproved || isCompleted) && (
        <div style={{ position: "absolute", top: 0, insetInlineStart: 0, width: 3, height: "100%", background: color.success }} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Avatar */}
        <Avatar size={48} src={worker?.avatarUrl} surface={color.surface1}
          onClick={() => onOpenProfile?.("worker", { name, rating, completedJobs: jobs, id: worker?.id })} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: color.textPrimary }}>{name}</span>
            {jobs >= 10 && <Badge variant="primary">מומלץ</Badge>}
            {worker?.warningFlag && (
              <span title="אזהרת אי-הגעה"
                style={{ fontSize: 9, fontWeight: 600, color: color.warning,
                  background: color.warningSoft, borderRadius: radius.chip, padding: "2px 8px" }}>
                ⚠ אזהרה
              </span>
            )}
          </div>
          <div style={{ marginBottom: 4 }}>
            <RatingStars rating={rating} count={worker?.ratingCount} size={9} />
            <span style={{ fontSize: 10, color: color.textMuted, marginInlineStart: 6 }}>· {jobs} ג׳סטות</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
            background: color.surface2, borderRadius: radius.chip, padding: "2px 8px" }}>
            <Briefcase size={9} color={color.primaryText} strokeWidth={2} />
            <span style={{ fontSize: 10, color: color.primaryText, fontWeight: 500 }}>{jobTitle}</span>
          </div>
          {isApproved && applicant.confirmedAt && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
              fontSize: 10, color: color.success, fontWeight: 600 }}>
              <CheckCircle2 size={11} strokeWidth={2} /> אישר הגעה
            </div>
          )}
        </div>

        {/* Jesta Score (Pro insight) */}
        {worker?.jestaScore != null && (
          <JestaScoreRing score={worker.jestaScore} size={42} label={false} />
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, alignItems: "center" }}>
          {actioning ? (
            <Loader2 size={22} color={color.textSecondary} style={{ animation: "spin 0.7s linear infinite" }} />
          ) : isCompleted ? (
            <Badge variant="approved" icon={CheckCircle2}>הושלם</Badge>
          ) : isNoShow ? (
            <Badge variant="rejected" icon={UserX}>לא הגיע</Badge>
          ) : isApproved ? (
            <>
              <Badge variant="approved" icon={Check}>אושר</Badge>
              {chatContract && (
                <motion.button whileTap={{ scale: 0.88 }}
                  onClick={() => onOpenChat?.(chatContract)}
                  style={{ ...styles.iconBox(32), border: "none", cursor: "pointer" }}>
                  <MessageCircle size={15} color={color.primaryText} strokeWidth={1.75} />
                </motion.button>
              )}
            </>
          ) : isRejected ? (
            <Badge variant="rejected">נדחה</Badge>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleApprove}
                style={{ width: 36, height: 36, borderRadius: "50%",
                  border: `1px solid ${color.borderStrong}`,
                  background: color.successSoft,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Check size={16} color={color.success} strokeWidth={2.5} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => run(() => onReject(jobId, applicant.id), "REJECTED")}
                style={{ width: 36, height: 36, borderRadius: "50%",
                  border: `1px solid ${color.borderStrong}`,
                  background: color.surface2,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} color={color.danger} strokeWidth={2.5} />
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Shift-day actions (System 2): completed / no-show */}
      {isApproved && shiftStarted && !actioning && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12,
          borderTop: `1px solid ${color.borderSubtle}` }}>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleComplete}
            style={{ flex: 1, height: 38, borderRadius: radius.button, border: "none",
              background: color.successSoft, color: color.success, fontSize: 12, fontWeight: 700,
              fontFamily: font.family, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CheckCircle2 size={14} strokeWidth={2} /> הג׳סטה הושלמה
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleNoShow}
            style={{ flex: 1, height: 38, borderRadius: radius.button,
              border: `1px solid ${armedNoShow ? color.danger : color.borderStrong}`,
              background: armedNoShow ? color.dangerSoft : color.surface2,
              color: color.danger, fontSize: 12, fontWeight: 600,
              fontFamily: font.family, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <UserX size={14} strokeWidth={2} /> {armedNoShow ? "בטוח? לחצו שוב" : "לא הגיע"}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EmployerDashboard({
  user,
  onOpenCreate,
  onOpenProfile,
  onOpenChat,
  onOpenSidebar,
  onRequestRating,
  onRepost,
  onOpenNotifications,
  onSessionRefresh,
  unreadCount = 0,
}) {
  const [jobs,       setJobs]       = useState([]);
  const [stats,      setStats]      = useState(null);   // real aggregates (System 4)
  const [status,     setStatus]     = useState("loading");
  const [editJob,    setEditJob]    = useState(null);   // job being edited (null = closed)
  const [browseOpen, setBrowseOpen] = useState(false);  // Pro direct-hiring sheet
  const [upsell,     setUpsell]     = useState(false);  // free-tier upgrade hint

  const isPro = !!user?.isPro;

  // Merge the saved job back into state so the UI reflects changes immediately
  const handleJobSaved = useCallback((updated) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus("loading");
    try {
      const [data, agg] = await Promise.all([
        getEmployerJobs(),
        getEmployerStats().catch(() => null),   // stats are additive — never block jobs
      ]);
      setJobs(data);
      if (agg) setStats(agg);
      setStatus("ok");
    } catch (err) {
      console.error("[Dashboard] load error:", err.message);
      // A failed silent refresh must not blank out data already on screen
      if (!silent) setStatus("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Realtime: new applicants + application updates appear instantly ───────
  // Backend broadcasts on channel `employer:{id}`:
  //   `new-application`   — a worker applied
  //   `application-update` — arrival confirmed / reopened spot claimed
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`employer:${user.id}`)
      .on("broadcast", { event: "new-application" }, () => load({ silent: true }))
      .on("broadcast", { event: "application-update" }, () => load({ silent: true }))
      .subscribe((status, err) => {
        if (err) console.warn("[Dashboard] Realtime subscribe error:", err.message);
      });
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, load]);

  // Wrap the System-2 actions so the dashboard refreshes silently afterwards
  // (no-show triggers fallback re-invites; completion frees the score / stats).
  const handleApproveFirst = useCallback(async (jobId) => {
    const res = await approveFirstApplicant(jobId);
    await load({ silent: true });
    return res;
  }, [load]);

  const handleComplete = useCallback(async (jobId, appId) => {
    const res = await completeApplication(jobId, appId);
    load({ silent: true });
    onRequestRating?.();          // rating prompt for the employer (System 1)
    return res;
  }, [load, onRequestRating]);

  const handleNoShow = useCallback(async (jobId, appId) => {
    const res = await markNoShow(jobId, appId);
    load({ silent: true });
    return res;
  }, [load]);

  const handleCancelJob = useCallback(async (jobId) => {
    const res = await cancelJob(jobId);
    await load({ silent: true });
    return res;
  }, [load]);

  const allApplicants = jobs.flatMap(job =>
    (job.applications ?? []).map(app => ({
      ...app, _jobId: job.id, _jobTitle: job.title, _jobStart: job.startTime,
    }))
  );
  // Redacted (free-tier) PENDING rows are rendered via LockedApplicants instead
  const visibleApplicants = allApplicants.filter(a => !a.redacted);
  const pending   = visibleApplicants.filter(a => a.status === "PENDING");
  const approved  = visibleApplicants.filter(a => a.status === "APPROVED");
  const completed = visibleApplicants.filter(a => a.status === "COMPLETED");
  const others    = visibleApplicants.filter(a => a.status === "REJECTED" || a.status === "NO_SHOW");
  const allSorted = [...pending, ...approved, ...completed, ...others];

  const pendingTotal = allApplicants.filter(a => a.status === "PENDING").length;
  const activeJobs   = jobs.filter(j => j.isActive);
  const lockedJobs   = isPro ? [] : jobs.filter(j => (j.applications ?? []).some(a => a.redacted && a.status === "PENDING"));
  const firstName    = user?.fullName?.split(" ")[0] ?? "מעסיק";

  return (
    <>
      <style>{HIDE_SCROLL}</style>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div dir="rtl" style={{ ...styles.screen, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* ── Header ── */}
        <div style={{ background: color.surface1, padding: "48px 16px 16px",
          borderBottom: `1px solid ${color.borderSubtle}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ ...font.overline, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                שלום, {firstName}
                {isPro && (
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                    color: color.primaryText, background: color.primarySoft,
                    borderRadius: radius.chip, padding: "2px 8px" }}>PRO</span>
                )}
              </div>
              <div style={{ fontSize: 21, ...font.heading }}>דאשבורד מעסיק</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Coin balance + buy coins + Pro upgrade */}
              <CoinBalance
                initialBalance={user?.coinsBalance ?? 0}
                initialIsPro={isPro}
                onProChange={onSessionRefresh}
              />
              {/* Notification bell (System 3) */}
              {onOpenNotifications && (
                <BellButton unreadCount={unreadCount} onClick={onOpenNotifications} />
              )}
              <motion.button whileTap={{ scale: 0.9 }} onClick={load}
                style={styles.iconButton}>
                <RefreshCw size={15} color={color.primaryText} strokeWidth={2}
                  style={status === "loading" ? { animation: "spin 0.7s linear infinite" } : {}} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={onOpenSidebar}
                style={styles.iconButton}>
                <Menu size={17} color={color.primaryText} strokeWidth={2} />
              </motion.button>
            </div>
          </div>
        </div>

        {/* ── Stats bar — real aggregates only (System 4) ── */}
        <div style={{ padding: "16px 16px 0", display: "grid",
          gridTemplateColumns: "1fr 1fr", gap: 8, flexShrink: 0 }}>
          <StatCard icon={Briefcase} label="ג׳סטות פורסמו" value={stats?.totalPublished ?? jobs.length} sub={`${activeJobs.length} פעילות כעת`} />
          <StatCard icon={CheckCircle2} label="ג׳סטות הושלמו" value={stats?.totalCompleted ?? 0} sub={`${pendingTotal} מועמדים ממתינים`} />
          <StatCard icon={Star} label="דירוג ממוצע"
            value={stats && stats.ratingCount > 0 ? stats.avgRating.toFixed(1) : "–"}
            sub={stats?.ratingCount ? `${stats.ratingCount} דירוגים` : "אין דירוגים עדיין"} />
          <StatCard icon={Banknote} label="סה״כ שולם" value={`₪${stats?.totalPaid ?? 0}`} sub="ג׳סטות שהושלמו" />
        </div>

        {/* ── Publish + direct hiring ── */}
        <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
          <PrimaryButton onClick={onOpenCreate}>
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            פרסם ג׳סטה חדשה
          </PrimaryButton>

          {/* Direct hiring (System 3) — Pro feature, locked CTA for free tier */}
          <motion.button whileTap={{ scale: 0.98 }}
            onClick={() => isPro ? setBrowseOpen(true) : setUpsell(u => !u)}
            style={{ width: "100%", height: 46, marginTop: 8, borderRadius: radius.button,
              border: `1px solid ${color.borderStrong}`, background: "transparent",
              color: isPro ? color.textPrimary : color.textSecondary,
              fontSize: 13, fontWeight: 600, fontFamily: font.family, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {isPro
              ? <><Sparkles size={15} color={color.primaryText} strokeWidth={2} /> גיוס ישיר — מצאו ג׳סטר זמין</>
              : <><Lock size={14} strokeWidth={2} /> גיוס ישיר <span style={{ fontSize: 11, color: color.primaryText, fontWeight: 700 }}>· שדרג לפרו</span></>}
          </motion.button>

          <AnimatePresence>
            {upsell && !isPro && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
                style={{ overflow: "hidden" }}>
                <div style={{ ...styles.card, padding: 14, marginTop: 8, border: `1px solid ${color.primarySoft}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Sparkles size={15} color={color.primaryText} strokeWidth={2} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: color.textPrimary }}>Jesta Pro למעסיקים</span>
                  </div>
                  <div style={{ fontSize: 12, color: color.textSecondary, lineHeight: 1.7 }}>
                    בחירת מועמד ספציפי עם Jesta Score · גיוס ישיר של ג׳סטרים זמינים · ג׳סטה מבוטחת עם מחליף אוטומטי
                  </div>
                  <div style={{ fontSize: 11, color: color.textMuted, marginTop: 8 }}>
                    בקרוב — בינתיים אפשר להדליק מצב פרו לבדיקות מתפריט הצד (מצב פיתוח)
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Loading ── */}
        {status === "loading" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 size={28} color={color.primary} style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        )}

        {/* ── Error ── */}
        {status === "error" && (
          <div style={{ ...styles.card, margin: "20px 16px", padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: color.danger, fontWeight: 600, marginBottom: 12 }}>
              שגיאה בטעינת הנתונים
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={load}
              style={{ ...styles.buttonSecondary, height: 44, fontSize: 13 }}>
              נסה שוב
            </motion.button>
          </div>
        )}

        {status === "ok" && (
          <>
            {/* ── Jobs with lifecycle status + quick actions (System 4) ── */}
            {jobs.length > 0 && (
              <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
                <SectionLabel style={{ marginBottom: 8 }}>הג׳סטות שלי</SectionLabel>
                <AnimatePresence>
                  {jobs.map((job) => (
                    <JobCardV2 key={job.id} job={job} userId={user?.id}
                      onEdit={setEditJob}
                      onCancel={handleCancelJob}
                      onComplete={handleComplete}
                      onNoShow={handleNoShow}
                      onRepost={onRepost} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* ── Applicants ── */}
            <div style={{ padding: "16px 16px 32px", flex: 1 }}>
              <SectionLabel style={{ marginBottom: 8 }}>
                מועמדים {pendingTotal + approved.length + completed.length + others.length > 0
                  ? `(${pendingTotal + approved.length + completed.length + others.length})` : ""}
              </SectionLabel>

              {/* Free tier: pending applicants are count-only, per job */}
              {lockedJobs.map((job) => (
                <LockedApplicants key={`locked-${job.id}`} job={job}
                  onApproveFirst={handleApproveFirst}
                  onUpgradeHint={() => setUpsell(true)} />
              ))}

              {allSorted.length === 0 && lockedJobs.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="עוד אין מועמדים"
                  subtitle="ברגע שמישהו יירשם לג׳סטה שלך הוא יופיע כאן"
                />
              ) : (
                <AnimatePresence>
                  {allSorted.map(applicant => (
                    <ApplicantCard
                      key={applicant.id}
                      applicant={applicant}
                      jobTitle={applicant._jobTitle}
                      jobId={applicant._jobId}
                      jobStart={applicant._jobStart}
                      onApprove={approveApplication}
                      onReject={rejectApplication}
                      onComplete={handleComplete}
                      onNoShow={handleNoShow}
                      onOpenProfile={onOpenProfile}
                      onOpenChat={onOpenChat}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </>
        )}

      </div>

      <JestaEditJobModal
        isOpen={!!editJob}
        job={editJob}
        onClose={() => setEditJob(null)}
        onSaved={handleJobSaved}
      />

      {/* Pro direct hiring */}
      <JestaWorkerBrowse
        isOpen={browseOpen}
        onClose={() => setBrowseOpen(false)}
        activeJobs={activeJobs}
      />
    </>
  );
}
