/**
 * JestaSchedule — Teenager Dashboard V2 ("הג'סטות שלי")
 *
 * Real data: GET /api/jobs/applications/me — the logged-in worker's
 * applications, each with its job, employer and chat (when approved).
 *
 * System 5:
 *   • Tabs: ממתינות לאישור / מאושרות / הושלמו / נדחו
 *   • Confirmed shifts show a live countdown to start time
 *   • Earnings summary: total / this month / pending
 *   • "ייצא כקורות חיים" → real downloadable PDF (lib/cvPdf.js)
 *
 * Props:
 *   onBack()
 *   onOpenChat(contract)
 *   user   { id, fullName, rating, ratingCount, jestaScore, completedJobs }
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Calendar, Clock, MapPin, CheckCircle2, MessageCircle,
  Loader2, CalendarX, Trophy, Briefcase, Zap, ShoppingBag, Package, PartyPopper,
  FileDown, Timer, AlertCircle,
} from "lucide-react";
import { getMyApplications, confirmArrival, getUserRatings } from "../services/api";
import { exportCvPdf } from "../lib/cvPdf";
import { color, radius, font, styles } from "../design-system";
import { Badge, EmptyState } from "./ui";

// ── Tabs (System 5) ───────────────────────────────────────────────────────────
const TABS = [
  { key: "PENDING",   label: "ממתינות" },
  { key: "APPROVED",  label: "מאושרות" },
  { key: "COMPLETED", label: "הושלמו"  },
  { key: "REJECTED",  label: "נדחו"    },
];

/** Live countdown to a confirmed shift's start time */
function Countdown({ startTime }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(startTime).getTime() - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  const s = Math.floor((ms % 6e4) / 1e3);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      marginTop: 8, padding: "8px 12px", borderRadius: radius.input,
      background: color.primarySoft, border: `1px solid ${color.borderSubtle}` }}>
      <Timer size={14} color={color.primaryText} strokeWidth={2} />
      <span style={{ fontSize: 12, color: color.textSecondary }}>המשמרת מתחילה בעוד</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: color.primaryText,
        fontVariantNumeric: "tabular-nums", direction: "ltr" }}>
        {h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}
      </span>
    </div>
  );
}

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
    jobId:     job.id ?? null,
    status:    app.status,                       // PENDING | APPROVED | REJECTED | COMPLETED | NO_SHOW
    chatId:    app.chat?.id ?? null,
    employer:  job.employer?.fullName ?? "מעסיק",
    title:     job.title ?? "",
    date:      dayLabel(job.startTime),
    time:      timeRange(job.startTime, job.endTime),
    pay:       String(job.pay ?? 0),
    payRaw:    job.pay ?? 0,
    hours,
    dist:      job.address ?? "",
    category:  job.category ?? null,
    iconIdx:   idx % SHIFT_ICONS.length,
    startTime: job.startTime,
    endTime:   job.endTime,
    isEmergency: !!job.isEmergency,
    confirmedAt: app.confirmedAt ?? null,
    completedAt: app.completedAt ?? null,
  };
}

function ShiftCard({ shift, onOpenChat }) {
  // "אישור הגעה" (System 2): approved + not yet confirmed + shift not over
  const [confirmed,  setConfirmed]  = useState(!!shift.confirmedAt);
  const [confirming, setConfirming] = useState(false);
  const [confirmErr, setConfirmErr] = useState(null);

  const shiftOver   = shift.endTime && new Date(shift.endTime) < new Date();
  const showConfirm = shift.status === "APPROVED" && !shiftOver;

  const handleConfirm = useCallback(async () => {
    if (confirming || confirmed) return;
    setConfirming(true); setConfirmErr(null);
    try {
      await confirmArrival(shift.id);
      setConfirmed(true);
    } catch (err) {
      if (err.status === 409) setConfirmed(true);   // already confirmed elsewhere
      else setConfirmErr("אישור ההגעה נכשל, נסו שוב");
    } finally {
      setConfirming(false);
    }
  }, [confirming, confirmed, shift.id]);

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
        {shift.status === "COMPLETED" ? (
          <Badge variant="approved" icon={CheckCircle2}>הושלמה</Badge>
        ) : isApproved ? (
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

      {/* Countdown to a confirmed upcoming shift (System 5) */}
      {shift.status === "APPROVED" && (confirmed || shift.confirmedAt) &&
        shift.startTime && new Date(shift.startTime) > new Date() && (
        <Countdown startTime={shift.startTime} />
      )}

      {/* אישור הגעה — feeds the response-speed part of the Jesta Score */}
      {showConfirm && (
        <div style={{ marginTop: 12 }}>
          {confirmed ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              height: 40, borderRadius: radius.button, background: color.successSoft,
              fontSize: 13, fontWeight: 700, color: color.success }}>
              <CheckCircle2 size={15} strokeWidth={2} /> אישרת הגעה — נתראה במשמרת!
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleConfirm}
              style={{ width: "100%", height: 40, borderRadius: radius.button, border: "none",
                background: color.primary, color: "#fff", fontSize: 13, fontWeight: 700,
                fontFamily: font.family, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {confirming
                ? <Loader2 size={15} color="#fff" style={{ animation: "spin 0.7s linear infinite" }} />
                : <><CheckCircle2 size={15} strokeWidth={2} /> אישור הגעה</>}
            </motion.button>
          )}
          {confirmErr && (
            <div style={{ fontSize: 11, color: color.danger, fontWeight: 500, marginTop: 6,
              textAlign: "center" }}>{confirmErr}</div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function JestaSchedule({ onBack, onOpenChat, user = null }) {
  const [shifts,    setShifts]    = useState([]);
  const [status,    setStatus]    = useState("loading"); // loading | ok | error
  const [tab,       setTab]       = useState("APPROVED");
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getMyApplications()
      .then((data) => {
        if (cancelled) return;
        const mapped = data.map(toShift);
        setShifts(mapped);
        setStatus("ok");
        // Land on the busiest meaningful tab
        if (!mapped.some((s) => s.status === "APPROVED") &&
            mapped.some((s) => s.status === "PENDING")) {
          setTab("PENDING");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Schedule] Failed to load applications:", err.message);
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  // Tab filtering — NO_SHOW rides with "נדחו" (it's a closed, negative state)
  const byTab = useMemo(() => ({
    PENDING:   shifts.filter((s) => s.status === "PENDING"),
    APPROVED:  shifts.filter((s) => s.status === "APPROVED"),
    COMPLETED: shifts.filter((s) => s.status === "COMPLETED"),
    REJECTED:  shifts.filter((s) => s.status === "REJECTED" || s.status === "NO_SHOW"),
  }), [shifts]);
  const visible = byTab[tab] ?? [];

  // ── Earnings summary (System 5) — real sums from the data ──
  const completed = byTab.COMPLETED;
  const now       = new Date();
  const sumOf     = (list) => list.reduce((sum, s) => sum + Math.round(s.payRaw * s.hours), 0);
  const totalEarned  = sumOf(completed);
  const monthEarned  = sumOf(completed.filter((s) => {
    const d = new Date(s.completedAt ?? s.endTime ?? s.startTime);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }));
  const pendingPay   = sumOf(byTab.APPROVED);

  const upcoming      = [...byTab.PENDING, ...byTab.APPROVED];
  const completedJobs = user?.completedJobs ?? completed.length;
  const levelPct      = Math.min(100, completedJobs * 10);

  // ── "ייצא כקורות חיים" → real downloadable PDF (System 5) ──
  const handleExportCv = useCallback(async () => {
    if (exporting) return;
    setExporting(true); setExportErr(null);
    try {
      // Per-job ratings received (best effort — CV still works without them)
      let ratingByJob = {};
      if (user?.id) {
        try {
          const { items } = await getUserRatings(user.id);
          ratingByJob = Object.fromEntries(
            (items ?? []).filter((r) => r.jobId).map((r) => [r.jobId, r.score]),
          );
        } catch { /* optional enrichment */ }
      }
      await exportCvPdf(
        {
          fullName:      user?.fullName,
          jestaScore:    user?.jestaScore,
          rating:        user?.rating,
          ratingCount:   user?.ratingCount,
          completedJobs,
        },
        completed.map((s) => ({
          title:       s.title,
          employer:    s.employer,
          completedAt: s.completedAt,
          startTime:   s.startTime,
          category:    s.category,
          ratingScore: ratingByJob[s.jobId] ?? null,
        })),
      );
    } catch (err) {
      setExportErr(err.message ?? "ייצוא קורות החיים נכשל, נסו שוב");
    } finally {
      setExporting(false);
    }
  }, [exporting, user, completed, completedJobs]);

  return (
    <div dir="rtl" style={styles.screen}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: color.surface1, padding: "48px 20px 16px",
        borderBottom: `1px solid ${color.borderSubtle}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            style={styles.iconButton}>
            <ArrowRight size={18} color={color.textPrimary} strokeWidth={2} />
          </motion.button>
          <div>
            <div style={{ fontSize: 20, ...font.heading }}>הג׳סטות שלי</div>
            <div style={{ fontSize: 13, color: color.textSecondary, fontWeight: 400 }}>
              {status === "ok" ? `${upcoming.length} משמרות קרובות` : " "}
            </div>
          </div>
        </div>
      </div>

      {/* Earnings summary (System 5) — real sums from completed/approved shifts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        background: color.surface1, borderBottom: `1px solid ${color.borderSubtle}`, flexShrink: 0 }}>
        {[
          { label: "סה״כ הרווחת",  value: `₪${totalEarned}` },
          { label: "החודש",        value: `₪${monthEarned}` },
          { label: "ממתין לתשלום", value: `₪${pendingPay}`, hint: "מאושרות שטרם הושלמו" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "12px 8px", textAlign: "center",
            borderInlineStart: i > 0 ? `1px solid ${color.borderSubtle}` : "none" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: color.textPrimary, letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: color.textSecondary, fontWeight: 400 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs (System 5): ממתינות / מאושרות / הושלמו / נדחו */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px",
        background: color.surface1, borderBottom: `1px solid ${color.borderSubtle}`, flexShrink: 0 }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          const count  = (byTab[key] ?? []).length;
          return (
            <motion.button key={key} whileTap={{ scale: 0.95 }} onClick={() => setTab(key)}
              style={{ flex: 1, height: 34, borderRadius: radius.chip,
                border: `1px solid ${active ? color.primary : color.borderSubtle}`,
                background: active ? color.primarySoft : "transparent",
                color: active ? color.primaryText : color.textSecondary,
                fontSize: 11, fontWeight: active ? 700 : 500,
                fontFamily: font.family, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              {label}
              {count > 0 && <span style={{ fontSize: 10, opacity: 0.85 }}>({count})</span>}
            </motion.button>
          );
        })}
      </div>

      {/* Shifts list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        {status === "loading" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 size={26} color={color.primary} style={{ animation: "spin 0.7s linear infinite" }} />
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
            title={tab === "COMPLETED" ? "עוד לא הושלמו ג׳סטות"
                 : tab === "REJECTED"  ? "אין ג׳סטות שנדחו"
                 : tab === "APPROVED"  ? "אין משמרות מאושרות"
                 : "אין בקשות ממתינות"}
            subtitle="הגש מועמדות לג׳סטה מהפיד והיא תופיע כאן"
          />
        )}

        {status === "ok" && visible.length > 0 && (
          <AnimatePresence mode="popLayout">
            {visible.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} onOpenChat={onOpenChat} />
            ))}
          </AnimatePresence>
        )}

        {/* Work history as CV (System 5) — completed tab only */}
        {status === "ok" && tab === "COMPLETED" && completed.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleExportCv}
              style={{ width: "100%", height: 48, borderRadius: radius.button,
                border: `1px solid ${color.borderStrong}`, background: "transparent",
                color: color.primaryText, fontSize: 14, fontWeight: 700,
                fontFamily: font.family, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {exporting
                ? <Loader2 size={16} style={{ animation: "spin 0.7s linear infinite" }} />
                : <FileDown size={16} strokeWidth={2} />}
              {exporting ? "מכין PDF..." : "ייצא כקורות חיים"}
            </motion.button>
            {exportErr && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontSize: 11, color: color.danger, fontWeight: 500, marginTop: 8 }}>
                <AlertCircle size={13} strokeWidth={2} /> {exportErr}
              </div>
            )}
            <div style={{ fontSize: 10, color: color.textMuted, textAlign: "center", marginTop: 8, lineHeight: 1.6 }}>
              PDF עם השם, ה-Jesta Score, רשימת הג׳סטות שהושלמו, הדירוג הממוצע ותחומי העבודה
            </div>
          </div>
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
