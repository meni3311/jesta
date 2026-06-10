/**
 * JestaSchedule — the worker's real shifts ("המשמרות שלי")
 *
 * Real data: GET /api/jobs/applications/me — the logged-in worker's
 * applications, each with its job, employer and chat (when approved).
 *
 * Props:
 *   onBack()
 *   onOpenChat(contract)
 *   user   { fullName, rating, completedJobs } — logged-in worker (optional)
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Clock, MapPin, CheckCircle2, MessageCircle, Loader2 } from "lucide-react";
import { getMyApplications } from "../services/api";

const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";
const GOLD   = "#d97706";

const SHIFT_COLORS = ["#7c3aed", "#059669", "#0369a1", "#b45309", "#be185d"];
const SHIFT_EMOJIS = ["💼", "⚡", "🛍️", "📦", "🎉"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today))    return "היום";
  if (sameDay(d, tomorrow)) return "מחר";
  return d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
}

function timeRange(startIso, endIso) {
  const fmt = (iso) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  if (!startIso) return "";
  return endIso ? `${fmt(startIso)}-${fmt(endIso)}` : fmt(startIso);
}

function shiftHours(startIso, endIso) {
  if (!startIso || !endIso) return 0;
  const h = (new Date(endIso) - new Date(startIso)) / 36e5;
  return h > 0 ? Math.round(h * 10) / 10 : 0;
}

/** Map a backend Application (with job + employer + chat) to the card shape */
function toShift(app, idx) {
  const job   = app.job ?? {};
  const hours = shiftHours(job.startTime, job.endTime);
  return {
    id:        app.id,
    status:    app.status,                       // PENDING | APPROVED | REJECTED | COMPLETED
    chatId:    app.chat?.id ?? null,
    employer:  job.employer?.fullName ?? "מעסיק",
    title:     job.title ?? "",
    date:      dayLabel(job.startTime),
    time:      timeRange(job.startTime, job.endTime),
    pay:       String(job.pay ?? 0),
    payRaw:    job.pay ?? 0,
    hours,
    dist:      job.address ?? "",
    emoji:     SHIFT_EMOJIS[idx % SHIFT_EMOJIS.length],
    color:     SHIFT_COLORS[idx % SHIFT_COLORS.length],
    startTime: job.startTime,
  };
}

function ShiftCard({ shift, onOpenChat }) {
  const total      = Math.round(shift.payRaw * shift.hours);
  const isApproved = shift.status === "APPROVED" || shift.status === "COMPLETED";
  const isPending  = shift.status === "PENDING";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{ background: "#fff", borderRadius: 20, border: "1px solid #ede9fe",
        boxShadow: "0 2px 12px rgba(124,58,237,0.07)", padding: "16px", marginBottom: 12 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14,
          background: shift.color + "18",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, flexShrink: 0 }}>
          {shift.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: SLATE }}>{shift.title}</div>
          <div style={{ fontSize: 12, color: VIOLET, fontWeight: 700, marginTop: 2 }}>
            {shift.employer}
          </div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#5b21b6" }}>
            {"₪"}{shift.pay}
          </div>
          <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>לשעה</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4,
          fontSize: 12, color: MUTED, fontWeight: 500 }}>
          <Calendar size={12} color="#c4b5fd" strokeWidth={2} /> {shift.date}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4,
          fontSize: 12, color: MUTED, fontWeight: 500 }}>
          <Clock size={12} color="#c4b5fd" strokeWidth={2} /> {shift.time}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4,
          fontSize: 12, color: MUTED, fontWeight: 500, overflow: "hidden" }}>
          <MapPin size={12} color="#c4b5fd" strokeWidth={2} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>
            {shift.dist}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 10, borderTop: "1px solid #f1f0fb" }}>
        <div style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>
          {"סה״כ למשמרת: "}
          <span style={{ fontWeight: 800, color: SLATE }}>{"₪"}{total}</span>
        </div>
        {isApproved ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 20, padding: "5px 12px" }}>
              <CheckCircle2 size={13} color="#059669" strokeWidth={2.5} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>אושר!</span>
            </div>
            {shift.chatId && (
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => onOpenChat?.({
                  chatId:        shift.chatId,
                  workerName:    "",
                  workerEmoji:   "🧑",
                  employerName:  shift.employer,
                  employerEmoji: shift.emoji,
                  jobTitle:      shift.title,
                  status:        "approved",
                })}
                style={{ width: 34, height: 34, borderRadius: "50%", background: "#ede9fe",
                  border: "none", display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <MessageCircle size={16} color={VIOLET} strokeWidth={2} />
              </motion.button>
            )}
          </div>
        ) : isPending ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4,
            background: "#fef3c7", border: "1px solid #fde68a",
            borderRadius: 20, padding: "5px 12px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>⏳ ממתין לאישור</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 4,
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 20, padding: "5px 12px" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>לא אושר</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function JestaSchedule({ onBack, onOpenChat, user = null }) {
  const [shifts, setShifts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ok | error

  useEffect(() => {
    let cancelled = false;
    getMyApplications()
      .then((data) => {
        if (cancelled) return;
        setShifts(data.map(toShift));
        setStatus("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Schedule] Failed to load applications:", err.message);
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  // Real stats derived from the data
  const visible  = shifts.filter(s => s.status !== "REJECTED");
  const upcoming = shifts.filter(s => s.status === "APPROVED" || s.status === "PENDING");
  const earned   = shifts
    .filter(s => s.status === "COMPLETED" || s.status === "APPROVED")
    .reduce((sum, s) => sum + Math.round(s.payRaw * s.hours), 0);
  const completedJobs = user?.completedJobs ?? 0;
  const levelPct      = Math.min(100, completedJobs * 10);

  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
      width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f8f7ff" }}>

      {/* Header */}
      <div style={{ background: "#fff", padding: "48px 18px 16px",
        borderBottom: "1px solid #ede9fe", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "#f1f5f9",
              border: "none", display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer" }}>
            <ArrowRight size={18} color={SLATE} strokeWidth={2.5} />
          </motion.button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: SLATE }}>המשמרות שלי ⚡</div>
            <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>
              {status === "ok" ? `${upcoming.length} משמרות קרובות` : " "}
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip — computed from real applications */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        background: "#fff", borderBottom: "1px solid #ede9fe", flexShrink: 0 }}>
        {[
          { label: "קרובות",  value: String(upcoming.length), sub: "משמרות" },
          { label: "צפי הכנסה", value: `₪${earned}`, sub: "" },
          { label: "דירוג", value: user?.rating ? `${user.rating.toFixed(1)} ⭐` : "– ⭐", sub: "ממוצע" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "12px 8px", textAlign: "center",
            borderLeft: i > 0 ? "1px solid #f1f0fb" : "none" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: SLATE }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>
              {s.label} {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Shifts list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 24px" }}>
        {status === "loading" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 size={26} color={VIOLET} style={{ animation: "spin 0.7s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center", padding: "32px 20px",
            fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
            שגיאה בטעינת המשמרות. נסה שוב מאוחר יותר.
          </div>
        )}

        {status === "ok" && visible.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗓️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: SLATE, marginBottom: 6 }}>
              עוד אין משמרות
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>
              הגש מועמדות לג׳סטה מהפיד והיא תופיע כאן
            </div>
          </div>
        )}

        {status === "ok" && visible.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 10,
              textTransform: "uppercase", letterSpacing: 0.5 }}>
              קרובות
            </div>
            {visible.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} onOpenChat={onOpenChat} />
            ))}
          </>
        )}

        {/* Level progress — derived from the user's real completedJobs */}
        {status === "ok" && (
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #ede9fe",
            padding: "16px", marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: GOLD }}>🏆 ג׳סטר זהב</span>
              <span style={{ fontSize: 12, color: MUTED }}>{levelPct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${levelPct}%` }}
                transition={{ duration: 1.2, ease: [0.25, 0, 0.2, 1] }}
                style={{ height: "100%", borderRadius: 4,
                  background: "linear-gradient(90deg,#a78bfa,#fbbf24)" }} />
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
              {completedJobs} ג׳סטות הושלמו עד כה ⚡
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
