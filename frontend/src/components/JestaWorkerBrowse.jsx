/**
 * JestaWorkerBrowse — Pro direct hiring (Systems 2+3, employer side)
 *
 * Browse workers who opened their availability profile (best Jesta Score
 * first) and send a personal job offer for one of the employer's active jobs.
 *
 * Matching (System 2): pick a job in the header → the list is filtered
 * server-side (availability overlaps the job's time window, minWage <= pay,
 * categories match) and each card highlights the matching availability blocks.
 *
 * Props:
 *   isOpen     boolean
 *   onClose    fn
 *   activeJobs Job[] — the employer's active jobs (offer target picker)
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sparkles, Loader2, Send, Check, ChevronDown, Users, Filter,
} from "lucide-react";
import { getAvailableWorkers, getSentOffers, sendOffer } from "../services/api";
import { color, radius, font, styles } from "../design-system";
import { Avatar, EmptyState, RatingStars, JestaScoreRing, SheetHandle, Badge } from "./ui";

const DAY_LETTERS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const CATEGORY_LABELS = {
  delivery: "שליחויות", babysit: "בייביסיטר", events: "אירועים",
  pets: "חיות מחמד", warehouse: "מחסן", other: "אחר",
};

function SlotChip({ slot, highlighted }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: highlighted ? 700 : 500,
      color: highlighted ? color.success : color.textSecondary,
      background: highlighted ? color.successSoft : color.surface3,
      border: `1px solid ${highlighted ? "rgba(16,185,129,0.35)" : "transparent"}`,
      borderRadius: radius.chip, padding: "3px 8px",
      fontVariantNumeric: "tabular-nums",
    }}>
      {DAY_LETTERS[slot.dayOfWeek]} {slot.startTime}–{slot.endTime}
    </span>
  );
}

function WorkerCard({ worker, activeJobs, sentJobIds, onSent }) {
  const [open,    setOpen]    = useState(false);   // job picker open
  const [sending, setSending] = useState(null);    // jobId being sent
  const [error,   setError]   = useState(null);

  const availability = worker.availability ?? {};
  const offeredJobs  = activeJobs.filter((j) => !sentJobIds.has(`${j.id}:${worker.id}`));
  const allSent      = activeJobs.length > 0 && offeredJobs.length === 0;

  const send = async (jobId) => {
    if (sending) return;
    setSending(jobId); setError(null);
    try {
      const offer = await sendOffer({ jobId, workerId: worker.id });
      onSent?.(offer);
      setOpen(false);
    } catch (err) {
      if (err.status === 409) { setError("כבר נשלחה הצעה לעובד הזה"); onSent?.(null, { jobId, workerId: worker.id }); }
      else setError("שליחת ההצעה נכשלה, נסו שוב");
    } finally {
      setSending(null);
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{ ...styles.card, padding: 16, marginBottom: 12 }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar size={48} src={worker.avatarUrl} surface={color.surface1} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: color.textPrimary, marginBottom: 3 }}>
            {worker.fullName}
          </div>
          <RatingStars rating={worker.rating ?? 0} count={worker.ratingCount} size={10} />
          <div style={{ fontSize: 11, color: color.textMuted, marginTop: 3 }}>
            {worker.completedJobs ?? 0} ג׳סטות הושלמו
          </div>
        </div>
        <JestaScoreRing score={worker.jestaScore} size={48} label={false} />
      </div>

      {/* Availability — weekly slots; blocks matching the picked job glow green */}
      {worker.slots?.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
          {(() => {
            const matchKeys = new Set(
              (worker.matchingSlots ?? []).map((s) => `${s.dayOfWeek}:${s.startTime}`),
            );
            // Matching blocks first, then the rest (capped to keep cards tidy)
            const sorted = [...worker.slots].sort((a, b) => {
              const am = matchKeys.has(`${a.dayOfWeek}:${a.startTime}`) ? 0 : 1;
              const bm = matchKeys.has(`${b.dayOfWeek}:${b.startTime}`) ? 0 : 1;
              return am - bm;
            });
            return sorted.slice(0, 8).map((s, i) => (
              <SlotChip key={i} slot={s}
                highlighted={matchKeys.has(`${s.dayOfWeek}:${s.startTime}`)} />
            ));
          })()}
          {worker.slots.length > 8 && (
            <span style={{ fontSize: 10, color: color.textMuted, alignSelf: "center" }}>
              +{worker.slots.length - 8}
            </span>
          )}
        </div>
      ) : (availability.days?.length || availability.hours || availability.note) ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {availability.days?.length > 0 && (
            <Badge variant="neutral">{availability.days.join(" · ")}</Badge>
          )}
          {availability.hours && <Badge variant="neutral">{availability.hours}</Badge>}
          {availability.note && (
            <span style={{ fontSize: 11, color: color.textSecondary, lineHeight: 1.5, width: "100%" }}>
              ״{availability.note}״
            </span>
          )}
        </div>
      ) : null}

      {/* Preferences */}
      {(worker.categories?.length > 0 || worker.minWage > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {worker.minWage > 0 && (
            <Badge variant="neutral">₪{worker.minWage}+ לשעה</Badge>
          )}
          {(worker.categories ?? []).map((c) => (
            <Badge key={c} variant="primary">{CATEGORY_LABELS[c] ?? c}</Badge>
          ))}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 11, color: color.danger, fontWeight: 500, marginTop: 8 }}>{error}</div>
      )}

      {/* Offer CTA */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${color.borderSubtle}` }}>
        {activeJobs.length === 0 ? (
          <div style={{ fontSize: 11, color: color.textMuted, textAlign: "center" }}>
            אין לך ג׳סטות פעילות — פרסמו ג׳סטה כדי לשלוח הצעה
          </div>
        ) : allSent ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontSize: 12, color: color.success, fontWeight: 600 }}>
            <Check size={14} strokeWidth={2} /> נשלחה הצעה
          </div>
        ) : (
          <>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setOpen((o) => !o)}
              style={{ width: "100%", height: 40, borderRadius: radius.button, border: "none",
                background: color.primary, color: "#fff", fontSize: 13, fontWeight: 700,
                fontFamily: font.family, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Send size={14} strokeWidth={2} /> שלח הצעת עבודה
              <ChevronDown size={14} strokeWidth={2}
                style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </motion.button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden" }}>
                  <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {offeredJobs.map((job) => (
                      <motion.button key={job.id} whileTap={{ scale: 0.98 }}
                        onClick={() => send(job.id)} disabled={!!sending}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.input,
                          border: `1px solid ${color.borderSubtle}`, background: color.surface2,
                          cursor: "pointer", fontFamily: font.family, textAlign: "right",
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: color.textPrimary,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {job.title}
                        </span>
                        {sending === job.id
                          ? <Loader2 size={14} color={color.primaryText} style={{ animation: "spin 0.7s linear infinite" }} />
                          : <span style={{ fontSize: 11, fontWeight: 700, color: color.primaryText, flexShrink: 0 }}>₪{job.pay}/ש׳</span>}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function JestaWorkerBrowse({ isOpen, onClose, activeJobs = [] }) {
  const [workers,    setWorkers]    = useState([]);
  const [sentJobIds, setSentJobIds] = useState(new Set()); // "jobId:workerId"
  const [status,     setStatus]     = useState("loading");
  const [matchJobId, setMatchJobId] = useState("");        // "" = show everyone

  // Default the match filter to the first active job when the sheet opens
  useEffect(() => {
    if (isOpen) setMatchJobId(activeJobs[0]?.id ?? "");
  }, [isOpen]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStatus("loading");
    Promise.all([
      getAvailableWorkers(matchJobId || undefined),
      getSentOffers().catch(() => []),
    ])
      .then(([list, sent]) => {
        if (cancelled) return;
        setWorkers(list);
        setSentJobIds(new Set(sent.map((o) => `${o.job?.id ?? o.jobId}:${o.worker?.id ?? o.workerId}`)));
        setStatus("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err.status === 403 ? "forbidden" : "error");
      });
    return () => { cancelled = true; };
  }, [isOpen, matchJobId]);

  const handleSent = useCallback((offer, fallback) => {
    const jobId    = offer?.job?.id ?? offer?.jobId ?? fallback?.jobId;
    const workerId = offer?.worker?.id ?? offer?.workerId ?? fallback?.workerId;
    if (jobId && workerId) setSentJobIds((prev) => new Set([...prev, `${jobId}:${workerId}`]));
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="browse-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }} onClick={onClose}
          style={{ position: "absolute", inset: 0, zIndex: 7600,
            background: "rgba(10,10,15,0.72)",
            display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <motion.div dir="rtl"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", ...styles.sheet, height: "86%",
              display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: font.family }}>
            <SheetHandle />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "4px 20px 12px" }}>
              <div>
                <div style={{ fontSize: 17, ...font.heading, display: "flex", alignItems: "center", gap: 8 }}>
                  גיוס ישיר <Sparkles size={15} color={color.primaryText} strokeWidth={1.75} />
                </div>
                <div style={{ fontSize: 12, color: color.textSecondary, marginTop: 2 }}>
                  ג׳סטרים זמינים, לפי Jesta Score
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                style={{ ...styles.iconButton, width: 32, height: 32 }}>
                <X size={15} color={color.textSecondary} strokeWidth={2} />
              </motion.button>
            </div>

            {/* Match filter (System 2): pick a job → matched teenagers only */}
            {activeJobs.length > 0 && (
              <div style={{ padding: "0 20px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <Filter size={13} color={color.textMuted} strokeWidth={2} style={{ flexShrink: 0 }} />
                <select
                  value={matchJobId}
                  onChange={(e) => setMatchJobId(e.target.value)}
                  style={{ flex: 1, height: 36, borderRadius: radius.input,
                    border: `1px solid ${color.borderSubtle}`, background: color.surface3,
                    color: color.textPrimary, fontSize: 12, fontWeight: 500,
                    fontFamily: font.family, padding: "0 10px", outline: "none" }}>
                  <option value="">כל הג׳סטרים הזמינים</option>
                  {activeJobs.map((j) => (
                    <option key={j.id} value={j.id}>מתאימים ל: {j.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              {status === "loading" && (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                  <Loader2 size={26} color={color.primary} style={{ animation: "spin 0.7s linear infinite" }} />
                </div>
              )}
              {status === "forbidden" && (
                <EmptyState icon={Sparkles} title="פיצ׳ר פרו"
                  subtitle="גיוס ישיר זמין למנויי פרו בלבד" />
              )}
              {status === "error" && (
                <div style={{ textAlign: "center", padding: "32px 20px", fontSize: 13,
                  color: color.danger, fontWeight: 500 }}>
                  שגיאה בטעינת הג׳סטרים הזמינים
                </div>
              )}
              {status === "ok" && workers.length === 0 && (
                <EmptyState icon={Users}
                  title={matchJobId ? "אין ג׳סטרים שמתאימים לג׳סטה הזו" : "אין ג׳סטרים זמינים כרגע"}
                  subtitle={matchJobId
                    ? "נסו לבחור ג׳סטה אחרת או להציג את כל הזמינים"
                    : "עובדים שיפתחו פרופיל זמינות יופיעו כאן"} />
              )}
              {status === "ok" && workers.map((w) => (
                <WorkerCard key={w.id} worker={w} activeJobs={activeJobs}
                  sentJobIds={sentJobIds} onSent={handleSent} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
