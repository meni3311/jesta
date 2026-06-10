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
  Clock, Users, Briefcase, Menu, Loader2, RefreshCw,
} from "lucide-react";
import { getEmployerJobs, approveApplication, rejectApplication } from "../services/api";

// ── Design tokens ─────────────────────────────────────────────────────────────
const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";
const PINK   = "#ec4899";
const GREEN  = "#059669";

const HIDE_SCROLL = `
  .jesta-scroll::-webkit-scrollbar { display: none; }
  .jesta-scroll { -ms-overflow-style: none; scrollbar-width: none; }
`;

const CHIP_COLORS = [VIOLET, "#0369a1", GREEN, "#b45309", "#be185d", "#0891b2"];

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
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div style={{
      flex: 1, background: "#fff", borderRadius: 16, padding: "13px 12px 11px",
      borderTop: `2.5px solid ${color}`, boxShadow: "0 1px 6px rgba(15,23,42,0.06)", minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: color + "18",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, lineHeight: 1.2 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: SLATE, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── JobChip ───────────────────────────────────────────────────────────────────
function JobChip({ job, color }) {
  const pendingCount = (job.applications ?? []).filter(a => a.status === "PENDING").length;
  return (
    <div style={{
      flexShrink: 0, width: 148, background: "#fff", borderRadius: 18,
      padding: "13px 13px 11px", borderTop: `2.5px solid ${color}`,
      boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
    }}>
      <div style={{ fontSize: 22, marginBottom: 7 }}>💼</div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: SLATE, lineHeight: 1.3, marginBottom: 6,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {job.title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Clock size={10} color={MUTED} strokeWidth={2} />
        <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>{formatShift(job.startTime, job.endTime)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>₪{job.pay}/ש׳</span>
        <span style={{ fontSize: 10, color: MUTED, background: "#f1f5f9", borderRadius: 10,
          padding: "2px 7px", fontWeight: 600 }}>
          {pendingCount} 👤
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
          workerEmoji:   "🧑",
          employerName:  result.chat.employer?.fullName ?? "מעסיק",
          employerEmoji: "👨‍💼",
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
      animate={{ opacity: isRejected ? 0.38 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{
        background: "#fff", borderRadius: 18, padding: "14px", marginBottom: 10,
        borderTop: "2.5px solid",
        borderTopColor: isApproved ? "#10b981" : isRejected ? "#f87171" : `${VIOLET}66`,
        boxShadow: "0 1px 8px rgba(15,23,42,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Avatar */}
        <motion.div
          whileTap={{ scale: 0.9 }}
          onClick={() => onOpenProfile?.("worker", { name, rating, completedJobs: jobs, id: worker?.id })}
          style={{
            width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
            background: isApproved
              ? "linear-gradient(135deg,#6ee7b7,#059669)"
              : isRejected
              ? "linear-gradient(135deg,#fca5a5,#dc2626)"
              : "linear-gradient(135deg,#a78bfa,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, cursor: "pointer", overflow: "hidden",
          }}
        >
          {worker?.avatarUrl
            ? <img src={worker.avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : "🧑"
          }
        </motion.div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: SLATE }}>{name}</span>
            {jobs >= 10 && (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#d97706",
                background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "1px 6px" }}>
                מומלץ
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 3 }}>
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={9}
                fill={s <= Math.round(rating) ? "#fbbf24" : "#e2e8f0"}
                color={s <= Math.round(rating) ? "#fbbf24" : "#e2e8f0"} />
            ))}
            <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, marginRight: 3 }}>{rating.toFixed(1)}</span>
            <span style={{ fontSize: 10, color: MUTED }}>· {jobs} ג׳סטות</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
            background: VIOLET + "12", borderRadius: 20, padding: "2px 9px" }}>
            <Briefcase size={9} color={VIOLET} strokeWidth={2.5} />
            <span style={{ fontSize: 10.5, color: VIOLET, fontWeight: 700 }}>{jobTitle}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "center" }}>
          {actioning ? (
            <Loader2 size={22} color={MUTED} style={{ animation: "spin 0.7s linear infinite" }} />
          ) : isApproved ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 4,
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 20, padding: "5px 10px" }}>
                <Check size={12} color={GREEN} strokeWidth={3} />
                <span style={{ fontSize: 11, fontWeight: 800, color: GREEN }}>אושר</span>
              </div>
              {chatContract && (
                <motion.button whileTap={{ scale: 0.88 }}
                  onClick={() => onOpenChat?.(chatContract)}
                  style={{ width: 34, height: 34, borderRadius: "50%",
                    background: "#ede9fe", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <MessageCircle size={15} color={VIOLET} strokeWidth={2} />
                </motion.button>
              )}
            </>
          ) : isRejected ? (
            <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444",
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 20, padding: "5px 10px" }}>
              נדחה
            </div>
          ) : (
            <div style={{ display: "flex", gap: 7 }}>
              <motion.button whileTap={{ scale: 0.86 }} onClick={handleApprove}
                style={{ width: 38, height: 38, borderRadius: "50%", border: "none",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(16,185,129,0.35)" }}>
                <Check size={17} color="#fff" strokeWidth={3} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.86 }} onClick={handleReject}
                style={{ width: 38, height: 38, borderRadius: "50%", border: "none",
                  background: "linear-gradient(135deg,#f87171,#dc2626)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(220,38,38,0.3)" }}>
                <X size={17} color="#fff" strokeWidth={3} />
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
      <div dir="rtl" style={{
        fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        background: "#f8f7ff", overflowY: "auto",
      }}>

        {/* ── Header ── */}
        <div style={{ background: "#fff", padding: "48px 16px 14px",
          borderBottom: "1px solid #ede9fe", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
                שלום, {firstName} 👋
              </div>
              <div style={{ fontSize: 21, fontWeight: 900, color: SLATE }}>דאשבורד מעסיק</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={load}
                style={{ width: 36, height: 36, borderRadius: "50%",
                  background: "#f5f3ff", border: "1.5px solid #ede9fe",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <RefreshCw size={15} color={VIOLET} strokeWidth={2.5}
                  style={status === "loading" ? { animation: "spin 0.7s linear infinite" } : {}} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.88 }} onClick={onOpenSidebar}
                style={{ width: 40, height: 40, borderRadius: "50%",
                  background: "#f5f3ff", border: "1.5px solid #ede9fe",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", flexShrink: 0 }}>
                <Menu size={18} color={VIOLET} strokeWidth={2.5} />
              </motion.button>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ padding: "14px 14px 0", display: "flex", gap: 9, flexShrink: 0 }}>
          <StatCard icon={Briefcase} label="ג׳סטות פעילות" value={activeJobs.length} color={VIOLET} sub="כעת" />
          <StatCard icon={Users}    label="ממתינים לאישור" value={pending.length}     color={PINK}   sub="מועמדים" />
        </div>

        {/* ── Publish button ── */}
        <div style={{ padding: "14px 14px 0", flexShrink: 0 }}>
          <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.015 }} onClick={onOpenCreate}
            style={{ width: "100%", padding: "15px 20px", borderRadius: 20, border: "none",
              background: "linear-gradient(135deg,#9333ea 0%,#ec4899 100%)",
              color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, boxShadow: "0 6px 22px rgba(147,51,234,0.38)", position: "relative", overflow: "hidden" }}>
            <motion.div animate={{ x: ["-120%", "220%"] }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
              style={{ position: "absolute", top: 0, left: 0, width: "45%", height: "100%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)", pointerEvents: "none" }} />
            <Plus size={18} color="#fff" strokeWidth={2.8} />
            פרסם ג׳סטה חדשה
          </motion.button>
        </div>

        {/* ── Loading ── */}
        {status === "loading" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 size={28} color={VIOLET} style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        )}

        {/* ── Error ── */}
        {status === "error" && (
          <div style={{ margin: "20px 14px", padding: "16px", borderRadius: 16,
            background: "#fef2f2", border: "1px solid #fecaca", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 700, marginBottom: 8 }}>
              שגיאה בטעינת הנתונים
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={load}
              style={{ padding: "8px 20px", borderRadius: 20, border: "none",
                background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit" }}>
              נסה שוב
            </motion.button>
          </div>
        )}

        {status === "ok" && (
          <>
            {/* ── Active jobs scroll ── */}
            {activeJobs.length > 0 && (
              <div style={{ padding: "16px 0 0", flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED,
                  textTransform: "uppercase", letterSpacing: 0.6, padding: "0 14px", marginBottom: 10 }}>
                  ג׳סטות פעילות
                </div>
                <div className="jesta-scroll"
                  style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 14px 4px" }}>
                  {activeJobs.map((job, i) => (
                    <JobChip key={job.id} job={job} color={CHIP_COLORS[i % CHIP_COLORS.length]} />
                  ))}
                  <div style={{ width: 4, flexShrink: 0 }} />
                </div>
              </div>
            )}

            {/* ── Applicants ── */}
            <div style={{ padding: "16px 14px 32px", flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED,
                textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
                מועמדים {allSorted.length > 0 ? `(${allSorted.length})` : ""}
              </div>

              {allSorted.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: SLATE, marginBottom: 6 }}>
                    עוד אין מועמדים
                  </div>
                  <div style={{ fontSize: 12, color: MUTED }}>
                    ברגע שמישהו יירשם לג׳סטה שלך הוא יופיע כאן
                  </div>
                </div>
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
