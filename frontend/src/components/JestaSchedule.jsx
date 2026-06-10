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
import {
  ArrowRight, Calendar, Clock, MapPin, CheckCircle2, MessageCircle,
  Loader2, CalendarX, Trophy, Briefcase, Zap, ShoppingBag, Package, PartyPopper,
} from "lucide-react";
import { getMyApplications } from "../services/api";
import { color, radius, font, styles } from "../design-system";
import { Badge, EmptyState, SectionLabel } from "./ui";

const SHIFT_ICONS = [Briefcase, Zap, ShoppingBag, Package, PartyPopper];

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
    iconIdx:   idx % SHIFT_ICONS.length,
    startTime: job.startTime,
  };
}

function ShiftCard({ shift, onOpenChat }) {
  const total      = Math.round(shift.payRaw * shift.hours);
  const isApproved = shift.status === "APPROVED" || shift.status === "COMPLETED";
  const isPending  = shift.status === "PENDING";
  const ShiftIcon  = SHIFT_ICONS[shift.iconIdx];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{ ...styles.card, padding: 16, marginBottom: 12 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={styles.iconBox(44)}>
          <ShiftIcon size={20} color={color.primaryText} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: color.textPrimary }}>{shift.title}</div>
          <div style={{ fontSize: 12, color: color.primaryText, fontWeight: 500, marginTop: 2 }}>
            {shift.employer}
          </div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: color.textPrimary, letterSpacing: "-0.02em" }}>
            {"₪"}{shift.pay}
          </div>
          <div style={{ fontSize: 10, color: color.textSecondary, fontWeight: 400 }}>לשעה</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4,
          fontSize: 12, color: color.textSecondary, fontWeight: 400 }}>
          <Calendar size={12} color={color.textMuted} strokeWidth={2} /> {shift.date}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4,
          fontSize: 12, color: color.textSecondary, fontWeight: 400 }}>
          <Clock size={12} color={color.textMuted} strokeWidth={2} /> {shift.time}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4,
          fontSize: 12, color: color.textSecondary, fontWeight: 400, overflow: "hidden" }}>
          <MapPin size={12} color={color.textMuted} strokeWidth={2} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>
            {shift.dist}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 12, borderTop: `1px solid ${color.borderSubtle}` }}>
        <div style={{ fontSize: 12, color: color.textSecondary, fontWeight: 400 }}>
          {"סה״כ למשמרת: "}
          <span style={{ fontWeight: 600, color: color.textPrimary }}>{"₪"}{total}</span>
        </div>
        {isApproved ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge variant="approved" icon={CheckCircle2}>אושר</Badge>
            {shift.chatId && (
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => onOpenChat?.({
                  chatId:        shift.chatId,
                  workerName:    "",
                  employerName:  shift.employer,
                  jobTitle:      shift.title,
                  status:        "approved",
                })}
                style={{ ...styles.iconBox(32), border: "none", cursor: "pointer" }}>
                <MessageCircle size={15} color={color.primaryText} strokeWidth={1.75} />
              </motion.button>
            )}
          </div>
        ) : isPending ? (
          <Badge variant="pending" icon={Clock}>ממתין לאישור</Badge>
        ) : (
          <Badge variant="rejected">לא אושר</Badge>
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
    <div dir="rtl" style={styles.screen}>

      {/* Header */}
      <div style={{ background: color.surface1, padding: "48px 20px 16px",
        borderBottom: `1px solid ${color.borderSubtle}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            style={styles.iconButton}>
            <ArrowRight size={18} color={color.textPrimary} strokeWidth={2} />
          </motion.button>
          <div>
            <div style={{ fontSize: 20, ...font.heading }}>המשמרות שלי</div>
            <div style={{ fontSize: 13, color: color.textSecondary, fontWeight: 400 }}>
              {status === "ok" ? `${upcoming.length} משמרות קרובות` : " "}
            </div>
          </div>
        </div>
      </div>

      {/* Stats strip — computed from real applications */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        background: color.surface1, borderBottom: `1px solid ${color.borderSubtle}`, flexShrink: 0 }}>
        {[
          { label: "קרובות",   value: String(upcoming.length), sub: "משמרות" },
          { label: "צפי הכנסה", value: `₪${earned}`, sub: "" },
          { label: "דירוג",    value: user?.rating ? user.rating.toFixed(1) : "–", sub: "ממוצע" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "12px 8px", textAlign: "center",
            borderInlineStart: i > 0 ? `1px solid ${color.borderSubtle}` : "none" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: color.textPrimary, letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: color.textSecondary, fontWeight: 400 }}>
              {s.label} {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Shifts list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        {status === "loading" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 size={26} color={color.primary} style={{ animation: "spin 0.7s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center", padding: "32px 20px",
            fontSize: 13, color: color.danger, fontWeight: 500 }}>
            שגיאה בטעינת המשמרות. נסה שוב מאוחר יותר.
          </div>
        )}

        {status === "ok" && visible.length === 0 && (
          <EmptyState
            icon={CalendarX}
            title="עוד אין משמרות"
            subtitle="הגש מועמדות לג׳סטה מהפיד והיא תופיע כאן"
          />
        )}

        {status === "ok" && visible.length > 0 && (
          <>
            <SectionLabel style={{ marginBottom: 8 }}>קרובות</SectionLabel>
            {visible.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} onOpenChat={onOpenChat} />
            ))}
          </>
        )}

        {/* Level progress — derived from the user's real completedJobs */}
        {status === "ok" && (
          <div style={{ ...styles.card, padding: 16, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 8 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: color.primaryText }}>
                <Trophy size={13} strokeWidth={2} /> ג׳סטר זהב
              </span>
              <span style={{ fontSize: 12, color: color.textMuted }}>{levelPct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: color.surface3, overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${levelPct}%` }}
                transition={{ duration: 1.2, ease: [0.25, 0, 0.2, 1] }}
                style={{ height: "100%", borderRadius: 4, background: color.primary }} />
            </div>
            <div style={{ fontSize: 11, color: color.textMuted, marginTop: 8 }}>
              {completedJobs} ג׳סטות הושלמו עד כה
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
