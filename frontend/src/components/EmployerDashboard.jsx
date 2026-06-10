/**
 * EmployerDashboard — Full-screen employer view (real data from API)
 *
 * Props:
 *   user           { id, fullName, ... }  — logged-in employer
 *   onOpenCreate   fn — open CreateModal
 *   onOpenProfile  fn(type, data)
 *   onOpenChat     fn(contract)
 *   onOpenSidebar  fn
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Check, X, MessageCircle, Star,
  Clock, Users, Briefcase, Menu, Loader2, RefreshCw, Inbox,
} from "lucide-react";
import { getEmployerJobs, approveApplication, rejectApplication } from "../services/api";
import { color, radius, font, styles } from "../design-system";
import { Avatar, Badge, EmptyState, PrimaryButton, SectionLabel } from "./ui";

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

// ── JobChip ───────────────────────────────────────────────────────────────────
function JobChip({ job }) {
  const pendingCount = (job.applications ?? []).filter(a => a.status === "PENDING").length;
  return (
    <div style={{ ...styles.card, flexShrink: 0, width: 148, padding: "12px" }}>
      <div style={{ ...styles.iconBox(32), marginBottom: 8 }}>
        <Briefcase size={16} color={color.primaryText} strokeWidth={1.75} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: color.textPrimary, lineHeight: 1.3, marginBottom: 8,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {job.title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
        <Clock size={10} color={color.textMuted} strokeWidth={2} />
        <span style={{ fontSize: 10, color: color.textSecondary, fontWeight: 400 }}>{formatShift(job.startTime, job.endTime)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: color.primaryText }}>₪{job.pay}/ש׳</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: color.textSecondary,
          background: color.surface3, borderRadius: radius.chip, padding: "2px 8px", fontWeight: 500 }}>
          <Users size={9} strokeWidth={2} /> {pendingCount}
        </span>
      </div>
    </div>
  );
}

// ── ApplicantCard ─────────────────────────────────────────────────────────────
function ApplicantCard({ applicant, jobTitle, jobId, onApprove, onReject, onOpenProfile, onOpenChat }) {
  const [actioning,     setActioning]     = useState(false);
  const [localStatus,   setLocalStatus]   = useState(applicant.status);
  const [chatContract,  setChatContract]  = useState(null);

  const worker = applicant.worker;
  const name   = worker?.fullName ?? "ג׳סטר";
  const rating = worker?.rating ?? 0;
  const jobs   = worker?.completedJobs ?? 0;

  const handleApprove = async () => {
    if (actioning) return;
    setActioning(true);
    try {
      const result = await onApprove(jobId, applicant.id);
      setLocalStatus("APPROVED");
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
    } catch (err) {
      console.error("[Dashboard] Approve error:", err.message);
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async () => {
    if (actioning) return;
    setActioning(true);
    try {
      await onReject(jobId, applicant.id);
      setLocalStatus("REJECTED");
    } catch (err) {
      console.error("[Dashboard] Reject error:", err.message);
    } finally {
      setActioning(false);
    }
  };

  const isApproved = localStatus === "APPROVED";
  const isRejected = localStatus === "REJECTED";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: isRejected ? 0.45 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{
        ...styles.card,
        padding: 16, marginBottom: 12,
        position: "relative", overflow: "hidden",
        borderColor: isApproved ? color.borderStrong : color.borderSubtle,
      }}
    >
      {/* Approved accent — 3px solid primary on the leading edge */}
      {isApproved && (
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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 4 }}>
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={9} strokeWidth={1.5}
                fill={s <= Math.round(rating) ? color.warning : "transparent"}
                color={s <= Math.round(rating) ? color.warning : color.textMuted} />
            ))}
            <span style={{ fontSize: 10, color: color.textSecondary, fontWeight: 500, marginInlineStart: 4 }}>{rating.toFixed(1)}</span>
            <span style={{ fontSize: 10, color: color.textMuted }}>· {jobs} ג׳סטות</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
            background: color.surface2, borderRadius: radius.chip, padding: "2px 8px" }}>
            <Briefcase size={9} color={color.primaryText} strokeWidth={2} />
            <span style={{ fontSize: 10, color: color.primaryText, fontWeight: 500 }}>{jobTitle}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, alignItems: "center" }}>
          {actioning ? (
            <Loader2 size={22} color={color.textSecondary} style={{ animation: "spin 0.7s linear infinite" }} />
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
              {/* Approve — emerald tint, no solid green */}
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleApprove}
                style={{ width: 36, height: 36, borderRadius: "50%",
                  border: `1px solid ${color.borderStrong}`,
                  background: color.successSoft,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Check size={16} color={color.success} strokeWidth={2.5} />
              </motion.button>
              {/* Reject — destructive: surface bg, red icon only */}
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleReject}
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
}) {
  const [jobs,   setJobs]   = useState([]);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await getEmployerJobs();
      setJobs(data);
      setStatus("ok");
    } catch (err) {
      console.error("[Dashboard] load error:", err.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allApplicants = jobs.flatMap(job =>
    (job.applications ?? []).map(app => ({ ...app, _jobId: job.id, _jobTitle: job.title }))
  );
  const pending  = allApplicants.filter(a => a.status === "PENDING");
  const approved = allApplicants.filter(a => a.status === "APPROVED");
  const rejected = allApplicants.filter(a => a.status === "REJECTED");
  const allSorted   = [...pending, ...approved, ...rejected];
  const activeJobs  = jobs.filter(j => j.isActive);
  const firstName   = user?.fullName?.split(" ")[0] ?? "מעסיק";

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
              <div style={{ ...font.overline, marginBottom: 4 }}>
                שלום, {firstName}
              </div>
              <div style={{ fontSize: 21, ...font.heading }}>דאשבורד מעסיק</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
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

        {/* ── Stats ── */}
        <div style={{ padding: "16px 16px 0", display: "flex", gap: 8, flexShrink: 0 }}>
          <StatCard icon={Briefcase} label="ג׳סטות פעילות" value={activeJobs.length} sub="כעת" />
          <StatCard icon={Users}    label="ממתינים לאישור" value={pending.length}     sub="מועמדים" />
        </div>

        {/* ── Publish button — the single primary action ── */}
        <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
          <PrimaryButton onClick={onOpenCreate}>
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            פרסם ג׳סטה חדשה
          </PrimaryButton>
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
            {/* ── Active jobs scroll ── */}
            {activeJobs.length > 0 && (
              <div style={{ padding: "16px 0 0", flexShrink: 0 }}>
                <SectionLabel style={{ padding: "0 16px", marginBottom: 8 }}>ג׳סטות פעילות</SectionLabel>
                <div className="jesta-scroll"
                  style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 4px" }}>
                  {activeJobs.map((job) => (
                    <JobChip key={job.id} job={job} />
                  ))}
                  <div style={{ width: 4, flexShrink: 0 }} />
                </div>
              </div>
            )}

            {/* ── Applicants ── */}
            <div style={{ padding: "16px 16px 32px", flex: 1 }}>
              <SectionLabel style={{ marginBottom: 8 }}>
                מועמדים {allSorted.length > 0 ? `(${allSorted.length})` : ""}
              </SectionLabel>

              {allSorted.length === 0 ? (
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
                      onApprove={approveApplication}
                      onReject={rejectApplication}
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
    </>
  );
}
