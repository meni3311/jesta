/**
 * JestaEmployerDashboard — Employer management screen
 *
 * Props:
 *   onBack             fn
 *   onOpenCreate       fn — open CreateModal
 *   onApproveWorker    fn(workerId)
 *   approvedWorkerIds  Set<string>
 *   onOpenProfile      fn
 */
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, PlusCircle, BarChart3, Clock, Star, Users } from "lucide-react";

const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";
const GOLD   = "#d97706";

const APPLICANTS = [
  { id: "w-1", name: "יובל כהן",    role: "עוזר בדוכן פופקורן", rating: 4.9, shift: "היום 16:00", emoji: "🧑", badge: "מומלץ" },
  { id: "w-2", name: "תמר לוי",     role: "עוזר בדוכן פופקורן", rating: 4.7, shift: "היום 16:00", emoji: "👩", badge: null },
  { id: "w-3", name: "אריאל גולן",  role: "עוזר בדוכן פופקורן", rating: 4.5, shift: "היום 16:00", emoji: "👦", badge: null },
];

const ACTIVE_JOBS = [
  { id: "j-1", title: "עוזר בדוכן פופקורן", applicants: 3, pay: "₪55", time: "היום 16:00–22:00" },
  { id: "j-2", title: "קיפול ומיון בגדים",  applicants: 1, pay: "₪50", time: "שישי 10:00–14:00" },
];

function ApplicantCard({ applicant, isApproved, onApprove, onOpenProfile }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{ background: "#fff", borderRadius: 18, border: "1px solid #ede9fe", boxShadow: "0 2px 8px rgba(124,58,237,0.06)", padding: "14px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <motion.div whileTap={{ scale: 0.92 }} onClick={() => onOpenProfile?.("worker", { name: applicant.name })}
          style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#a78bfa,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer", flexShrink: 0 }}>
          {applicant.emoji}
        </motion.div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: SLATE }}>{applicant.name}</span>
            {applicant.badge && (
              <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "1px 7px" }}>{applicant.badge}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {[1,2,3,4,5].map(s => <Star key={s} size={9} fill={s <= Math.round(applicant.rating) ? "#fbbf24" : "#e2e8f0"} color={s <= Math.round(applicant.rating) ? "#fbbf24" : "#e2e8f0"} />)}
            <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginRight: 2 }}>{applicant.rating}</span>
          </div>
        </div>
        {isApproved ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "6px 12px" }}>
            <CheckCircle2 size={13} color="#059669" strokeWidth={2.5} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>אושר</span>
          </div>
        ) : (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onApprove(applicant.id)}
            style={{ background: "linear-gradient(135deg,#9333ea,#ec4899)", color: "#fff", border: "none", borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 3px 10px rgba(147,51,234,0.3)" }}>
            אשר ✓
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function JestaEmployerDashboard({ onBack, onOpenCreate, onApproveWorker, approvedWorkerIds, onOpenProfile }) {
  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif", width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f8f7ff" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "48px 18px 16px", borderBottom: "1px solid #ede9fe", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "#f1f5f9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <ArrowRight size={18} color={SLATE} strokeWidth={2.5} />
            </motion.button>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: SLATE }}>דאשבורד מעסיק 📊</div>
              <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>3 ג׳סטות פעילות</div>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={onOpenCreate}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#9333ea,#ec4899)", color: "#fff", border: "none", borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 3px 12px rgba(147,51,234,0.35)" }}>
            <PlusCircle size={15} strokeWidth={2} /> פרסם
          </motion.button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#fff", borderBottom: "1px solid #ede9fe", flexShrink: 0 }}>
        {[
          { label: "פעילות", value: "3", icon: BarChart3, color: VIOLET },
          { label: "מועמדים", value: "4", icon: Users, color: "#059669" },
          { label: "שולמו", value: "₪2,400", icon: CheckCircle2, color: GOLD },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <div key={i} style={{ padding: "12px 8px", textAlign: "center", borderLeft: i > 0 ? "1px solid #f1f0fb" : "none" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
              <Icon size={16} color={color} strokeWidth={2} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: SLATE }}>{value}</div>
            <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 24px" }}>
        {/* Active jobs */}
        <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>ג׳סטות פעילות</div>
        {ACTIVE_JOBS.map((job) => (
          <div key={job.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #ede9fe", padding: "13px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: SLATE }}>{job.title}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 500 }}><Clock size={10} color="#c4b5fd" style={{ display: "inline", marginLeft: 3 }} />{job.time}</span>
              </div>
            </div>
            <div style={{ textAlign: "left", flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#5b21b6" }}>{job.pay}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{job.applicants} מועמדים</div>
            </div>
          </div>
        ))}

        {/* Applicants */}
        <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 10, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>מועמדים לאישור</div>
        {APPLICANTS.map((applicant) => (
          <ApplicantCard
            key={applicant.id}
            applicant={applicant}
            isApproved={approvedWorkerIds.has(applicant.id)}
            onApprove={onApproveWorker}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
    </div>
  );
}
