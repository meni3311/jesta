/**
 * EmployerDashboard — Full-screen employer view (replaces feed in employer mode)
 *
 * Props:
 *   onOpenCreate       fn — open CreateModal
 *   onApproveWorker    fn(workerId)
 *   onRejectWorker     fn(workerId)
 *   approvedWorkerIds  Set<string>
 *   rejectedWorkerIds  Set<string>
 *   onOpenProfile      fn
 *   onOpenChat         fn(contract)
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Check, X, MessageCircle, Star,
  Clock, Users, Wallet, ChevronLeft, Briefcase, Menu,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";
const PINK   = "#ec4899";
const GOLD   = "#d97706";
const GREEN  = "#059669";
const RED    = "#dc2626";

// ── Scrollbar-hide style injected once ───────────────────────────────────────
const HIDE_SCROLL = `
  .jesta-scroll::-webkit-scrollbar { display: none; }
  .jesta-scroll { -ms-overflow-style: none; scrollbar-width: none; }
`;

// ── Mock data ─────────────────────────────────────────────────────────────────
const ACTIVE_JOBS = [
  {
    id: "j-1",
    title: "עוזר בדוכן פופקורן",
    emoji: "🍿",
    applicants: 3,
    pay: "₪55/ש׳",
    time: "היום 16:00–22:00",
    color: VIOLET,
  },
  {
    id: "j-2",
    title: "קיפול ומיון בגדים",
    emoji: "👕",
    applicants: 1,
    pay: "₪50/ש׳",
    time: "שישי 10:00–14:00",
    color: "#0369a1",
  },
  {
    id: "j-3",
    title: "דוגווקר",
    emoji: "🐕",
    applicants: 2,
    pay: "₪70/ש׳",
    time: "מחר 08:00–10:00",
    color: GREEN,
  },
];

const APPLICANTS = [
  {
    id: "w-1",
    name: "יובל כהן",
    emoji: "🧑",
    rating: 4.9,
    jobTitle: "עוזר בדוכן פופקורן",
    jobId: "j-1",
    badge: "מומלץ",
    completedJobs: 12,
  },
  {
    id: "w-2",
    name: "תמר לוי",
    emoji: "👩",
    rating: 4.7,
    jobTitle: "עוזר בדוכן פופקורן",
    jobId: "j-1",
    badge: null,
    completedJobs: 7,
  },
  {
    id: "w-3",
    name: "אריאל גולן",
    emoji: "👦",
    rating: 4.5,
    jobTitle: "קיפול ומיון בגדים",
    jobId: "j-2",
    badge: null,
    completedJobs: 5,
  },
  {
    id: "w-4",
    name: "נועה שמיר",
    emoji: "👧",
    rating: 4.8,
    jobTitle: "דוגווקר",
    jobId: "j-3",
    badge: "חדש",
    completedJobs: 3,
  },
];

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div style={{
      flex: 1,
      background: "#fff",
      borderRadius: 16,
      padding: "13px 12px 11px",
      borderTop: `2.5px solid ${color}`,
      boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: color + "18",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={14} color={color} strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, lineHeight: 1.2 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: SLATE, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Active job chip (horizontal scroll) ───────────────────────────────────────
function JobChip({ job }) {
  return (
    <div style={{
      flexShrink: 0,
      width: 148,
      background: "#fff",
      borderRadius: 18,
      padding: "13px 13px 11px",
      borderTop: `2.5px solid ${job.color}`,
      boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
    }}>
      <div style={{ fontSize: 22, marginBottom: 7 }}>{job.emoji}</div>
      <div style={{
        fontSize: 12.5, fontWeight: 800, color: SLATE,
        lineHeight: 1.3, marginBottom: 6,
        display: "-webkit-box", WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {job.title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <Clock size={10} color={MUTED} strokeWidth={2} />
        <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>{job.time}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: job.color }}>{job.pay}</span>
        <span style={{
          fontSize: 10, color: MUTED, background: "#f1f5f9",
          borderRadius: 10, padding: "2px 7px", fontWeight: 600,
        }}>
          {job.applicants} 👤
        </span>
      </div>
    </div>
  );
}

// ── Applicant card ────────────────────────────────────────────────────────────
function ApplicantCard({
  applicant, isApproved, isRejected,
  onApprove, onReject, onOpenProfile, onOpenChat,
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: isRejected ? 0.38 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{
        background: "#fff",
        borderRadius: 18,
        padding: "14px",
        marginBottom: 10,
        borderTop: "2.5px solid",
        borderTopColor: isApproved ? "#10b981" : isRejected ? "#f87171" : `${VIOLET}66`,
        boxShadow: "0 1px 8px rgba(15,23,42,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Avatar */}
        <motion.div
          whileTap={{ scale: 0.9 }}
          onClick={() => onOpenProfile?.("worker", { name: applicant.name })}
          style={{
            width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
            background: isApproved
              ? "linear-gradient(135deg,#6ee7b7,#059669)"
              : isRejected
              ? "linear-gradient(135deg,#fca5a5,#dc2626)"
              : "linear-gradient(135deg,#a78bfa,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, cursor: "pointer",
          }}
        >
          {applicant.emoji}
        </motion.div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: SLATE }}>
              {applicant.name}
            </span>
            {applicant.badge && (
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: GOLD,
                background: "#fef3c7", border: "1px solid #fde68a",
                borderRadius: 10, padding: "1px 6px",
              }}>
                {applicant.badge}
              </span>
            )}
          </div>

          {/* Stars */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 3 }}>
            {[1,2,3,4,5].map(s => (
              <Star key={s} size={9}
                fill={s <= Math.round(applicant.rating) ? "#fbbf24" : "#e2e8f0"}
                color={s <= Math.round(applicant.rating) ? "#fbbf24" : "#e2e8f0"} />
            ))}
            <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, marginRight: 3 }}>
              {applicant.rating}
            </span>
            <span style={{ fontSize: 10, color: MUTED }}>
              · {applicant.completedJobs} ג׳סטות
            </span>
          </div>

          {/* Job tag */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: VIOLET + "12", borderRadius: 20, padding: "2px 9px",
          }}>
            <Briefcase size={9} color={VIOLET} strokeWidth={2.5} />
            <span style={{ fontSize: 10.5, color: VIOLET, fontWeight: 700 }}>
              {applicant.jobTitle}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          {isApproved ? (
            /* Approved state: green badge + chat button */
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 20, padding: "5px 10px",
              }}>
                <Check size={12} color={GREEN} strokeWidth={3} />
                <span style={{ fontSize: 11, fontWeight: 800, color: GREEN }}>אושר</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => onOpenChat?.({
                  workerId:      applicant.id,
                  workerName:    applicant.name,
                  workerEmoji:   applicant.emoji,
                  employerName:  "אורן פרידמן",
                  employerEmoji: "👨‍💼",
                  jobTitle:      applicant.jobTitle,
                  status:        "approved",
                })}
                style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "#ede9fe", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <MessageCircle size={15} color={VIOLET} strokeWidth={2} />
              </motion.button>
            </div>
          ) : isRejected ? (
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#ef4444",
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 20, padding: "5px 10px",
            }}>
              נדחה
            </div>
          ) : (
            /* Pending: approve + reject */
            <div style={{ display: "flex", gap: 7 }}>
              <motion.button
                whileTap={{ scale: 0.86 }}
                onClick={() => onApprove(applicant.id)}
                style={{
                  width: 38, height: 38, borderRadius: "50%", border: "none",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(16,185,129,0.35)",
                }}
              >
                <Check size={17} color="#fff" strokeWidth={3} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.86 }}
                onClick={() => onReject(applicant.id)}
                style={{
                  width: 38, height: 38, borderRadius: "50%", border: "none",
                  background: "linear-gradient(135deg,#f87171,#dc2626)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 3px 10px rgba(220,38,38,0.3)",
                }}
              >
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
  onOpenCreate,
  onApproveWorker,
  onRejectWorker,
  approvedWorkerIds = new Set(),
  rejectedWorkerIds = new Set(),
  onOpenProfile,
  onOpenChat,
  onOpenSidebar,
}) {
  const pending  = APPLICANTS.filter(a => !approvedWorkerIds.has(a.id) && !rejectedWorkerIds.has(a.id));
  const approved = APPLICANTS.filter(a => approvedWorkerIds.has(a.id));
  const rejected = APPLICANTS.filter(a => rejectedWorkerIds.has(a.id));
  const allSorted = [...pending, ...approved, ...rejected];

  const budgetUsed   = "₪2,400";
  const activeCount  = ACTIVE_JOBS.length;
  const pendingCount = pending.length;

  return (
    <>
      <style>{HIDE_SCROLL}</style>
      <div dir="rtl" style={{
        fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        background: "#f8f7ff",
        overflowY: "auto",
      }}>

        {/* ── Header ── */}
        <div style={{
          background: "#fff",
          padding: "48px 16px 14px",
          borderBottom: "1px solid #ede9fe",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
                שלום, אורן 👋
              </div>
              <div style={{ fontSize: 21, fontWeight: 900, color: SLATE }}>
                דאשבורד מעסיק
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onOpenSidebar}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "#f5f3ff", border: "1.5px solid #ede9fe",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              <Menu size={18} color={VIOLET} strokeWidth={2.5} />
            </motion.button>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div style={{ padding: "14px 14px 0", display: "flex", gap: 9, flexShrink: 0 }}>
          <StatCard
            icon={Wallet}
            label="תקציב שנוצל"
            value={budgetUsed}
            color={GOLD}
            sub="החודש"
          />
          <StatCard
            icon={Briefcase}
            label="ג׳סטות פעילות"
            value={activeCount}
            color={VIOLET}
            sub="כעת"
          />
          <StatCard
            icon={Users}
            label="ממתינים לאישור"
            value={pendingCount}
            color={PINK}
            sub="מועמדים"
          />
        </div>

        {/* ── Publish button ── */}
        <div style={{ padding: "14px 14px 0", flexShrink: 0 }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.015 }}
            onClick={onOpenCreate}
            style={{
              width: "100%",
              padding: "15px 20px",
              borderRadius: 20,
              border: "none",
              background: "linear-gradient(135deg,#9333ea 0%,#ec4899 100%)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 900,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: "0 6px 22px rgba(147,51,234,0.38)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Shimmer */}
            <motion.div
              animate={{ x: ["-120%", "220%"] }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
              style={{
                position: "absolute", top: 0, left: 0,
                width: "45%", height: "100%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)",
                pointerEvents: "none",
              }}
            />
            <Plus size={18} color="#fff" strokeWidth={2.8} />
            פרסם ג׳סטה חדשה
          </motion.button>
        </div>

        {/* ── Active jobs — horizontal scroll ── */}
        <div style={{ padding: "16px 0 0", flexShrink: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: MUTED,
            textTransform: "uppercase", letterSpacing: 0.6,
            padding: "0 14px", marginBottom: 10,
          }}>
            ג׳סטות פעילות
          </div>
          <div
            className="jesta-scroll"
            style={{
              display: "flex", gap: 10,
              overflowX: "auto",
              padding: "0 14px 4px",
            }}
          >
            {ACTIVE_JOBS.map(job => <JobChip key={job.id} job={job} />)}
            {/* trailing space */}
            <div style={{ width: 4, flexShrink: 0 }} />
          </div>
        </div>

        {/* ── Applicants ── */}
        <div style={{ padding: "16px 14px 32px", flex: 1 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: MUTED,
            textTransform: "uppercase", letterSpacing: 0.6,
            marginBottom: 10,
          }}>
            מועמדים חדשים
          </div>
          <AnimatePresence>
            {allSorted.map(applicant => (
              <ApplicantCard
                key={applicant.id}
                applicant={applicant}
                isApproved={approvedWorkerIds.has(applicant.id)}
                isRejected={rejectedWorkerIds.has(applicant.id)}
                onApprove={onApproveWorker}
                onReject={onRejectWorker}
                onOpenProfile={onOpenProfile}
                onOpenChat={onOpenChat}
              />
            ))}
          </AnimatePresence>
        </div>

      </div>
    </>
  );
}
