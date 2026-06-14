/**
 * JestaEditJobModal — edit an active (published) Jesta
 *
 * Editable fields: title, description, wage (pay), required workers count,
 * start time, end time.
 *
 * Lock rule: once a worker has been APPROVED for the job, the Jesta can no
 * longer be edited — the shift terms are a commitment to that worker. The
 * backend enforces this with a 409; this modal also shows the locked state
 * up-front so the employer understands why.
 *
 * Props:
 *   isOpen    boolean
 *   job       raw backend job object ({ id, title, description, pay,
 *             requiredWorkers, startTime, endTime, applications, ... })
 *   onClose   fn
 *   onSaved   fn(updatedJob) — called with the API response after a save
 */
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Loader2, AlertCircle, Lock, Pencil } from "lucide-react";
import { updateJob } from "../services/api";
import { color, radius, shadow, font, styles } from "../design-system";

const inputStyle = { ...styles.input, direction: "rtl" };
const labelStyle = { fontSize: 12, fontWeight: 500, color: color.textSecondary, marginBottom: 8, display: "block" };
const focusOn  = (e) => (e.target.style.borderColor = color.primary);
const focusOff = (e) => (e.target.style.borderColor = color.borderSubtle);

function Field({ label, children }) {
  return <div style={{ marginBottom: 16 }}><label style={labelStyle}>{label}</label>{children}</div>;
}

/** ISO string → { date: "YYYY-MM-DD", time: "HH:mm" } in local time */
function isoToLocal(iso) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d)) return { date: "", time: "" };
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default function JestaEditJobModal({ isOpen, job, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [locked, setLocked] = useState(false);
  const [data,   setData]   = useState({
    title: "", description: "", pay: 50, requiredWorkers: 1,
    date: "", startTime: "", endTime: "",
  });

  // (Re)hydrate the form whenever a job is opened
  useEffect(() => {
    if (!isOpen || !job) return;
    const start = isoToLocal(job.startTime);
    const end   = isoToLocal(job.endTime);
    setData({
      title:           job.title ?? "",
      description:     job.description ?? "",
      pay:             job.payRaw ?? job.pay ?? 50,
      requiredWorkers: job.requiredWorkers ?? 1,
      date:            start.date,
      startTime:       start.time,
      endTime:         end.time,
    });
    setError(null);
    setSaving(false);
    // Locked once any applicant was APPROVED — terms are a commitment
    setLocked((job.applications ?? []).some((a) => a.status === "APPROVED"));
  }, [isOpen, job]);

  const canSave = useMemo(() =>
    data.title.trim() !== "" &&
    Number(data.pay) >= 1 &&
    Number(data.requiredWorkers) >= 1 &&
    data.date !== "" && data.startTime !== "" && data.endTime !== "",
  [data]);

  const handleSave = async () => {
    if (saving || !canSave || !job?.id) return;
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title:           data.title.trim(),
        description:     data.description.trim() || undefined,
        pay:             Number(data.pay),
        requiredWorkers: Number(data.requiredWorkers),
        startTime:       new Date(`${data.date}T${data.startTime}:00`).toISOString(),
        endTime:         new Date(`${data.date}T${data.endTime}:00`).toISOString(),
      };
      const updated = await updateJob(job.id, payload);
      onSaved?.(updated);   // parent updates its state → UI reflects immediately
      onClose?.();
    } catch (err) {
      if (err?.status === 409) {
        // Approved while the modal was open — show the lock explanation
        setLocked(true);
      } else {
        setError(err.message ?? "השמירה נכשלה, נסו שוב");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="edit-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{ position: "absolute", inset: 0, zIndex: 6000, background: "rgba(10,10,15,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.div key="edit-modal" dir="rtl"
            initial={{ scale: 0.9, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "91%", maxHeight: "86%", zIndex: 6001,
              background: color.surface1, borderRadius: radius.sheet,
              border: `1px solid ${color.borderSubtle}`, boxShadow: shadow.card,
              display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: font.family }}>

            {/* Header */}
            <div style={{ padding: "20px 20px 12px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={styles.iconBox(32)}>
                  {locked
                    ? <Lock size={15} color={color.warning} strokeWidth={1.75} />
                    : <Pencil size={15} color={color.primaryText} strokeWidth={1.75} />}
                </div>
                <div>
                  <div style={{ fontSize: 16, ...font.heading, lineHeight: 1.2 }}>עריכת ג׳סטה</div>
                  <div style={{ fontSize: 11, color: color.textSecondary, fontWeight: 400, marginTop: 2,
                    maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {job?.title}
                  </div>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
                style={{ ...styles.iconButton, width: 32, height: 32 }}>
                <X size={16} color={color.textSecondary} strokeWidth={2} />
              </motion.button>
            </div>

            {locked ? (
              /* ── Locked state — clear explanation, no form ── */
              <div style={{ padding: "8px 20px 24px" }}>
                <div style={{ ...styles.card, padding: 20, textAlign: "center",
                  borderColor: color.borderStrong }}>
                  <Lock size={28} color={color.warning} strokeWidth={1.5} style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: color.textPrimary, marginBottom: 8 }}>
                    הג׳סטה נעולה לעריכה
                  </div>
                  <div style={{ fontSize: 13, color: color.textSecondary, fontWeight: 400, lineHeight: 1.7 }}>
                    עובד כבר אושר למשמרת הזו, ולכן לא ניתן לשנות את תנאיה.
                    שינוי שכר, שעות או דרישות אחרי שאישרתם מישהו אינו הוגן כלפי העובד.
                    אם משהו השתנה — דברו איתו בצ׳אט, או פרסמו ג׳סטה חדשה.
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
                  style={{ ...styles.buttonSecondary, width: "100%", marginTop: 16, fontSize: 14 }}>
                  הבנתי
                </motion.button>
              </div>
            ) : (
              <>
                {/* ── Form ── */}
                <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 8px" }}>
                  <Field label="כותרת הג׳סטה *">
                    <input style={inputStyle} value={data.title}
                      onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
                      onFocus={focusOn} onBlur={focusOff} />
                  </Field>
                  <Field label="תיאור">
                    <textarea style={{ ...inputStyle, minHeight: 72, resize: "none", lineHeight: 1.6 }}
                      value={data.description}
                      onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
                      onFocus={focusOn} onBlur={focusOff} />
                  </Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>שכר לשעה (₪) *</label>
                      <input type="number" min={1} style={inputStyle} value={data.pay}
                        onChange={(e) => setData((d) => ({ ...d, pay: e.target.value }))}
                        onFocus={focusOn} onBlur={focusOff} />
                    </div>
                    <div>
                      <label style={labelStyle}>כמה עובדים? *</label>
                      <input type="number" min={1} style={inputStyle} value={data.requiredWorkers}
                        onChange={(e) => setData((d) => ({ ...d, requiredWorkers: e.target.value }))}
                        onFocus={focusOn} onBlur={focusOff} />
                    </div>
                  </div>
                  <Field label="תאריך המשמרת *">
                    <input type="date" style={inputStyle} value={data.date}
                      onChange={(e) => setData((d) => ({ ...d, date: e.target.value }))}
                      onFocus={focusOn} onBlur={focusOff} />
                  </Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>שעת התחלה *</label>
                      <input type="time" style={inputStyle} value={data.startTime}
                        onChange={(e) => setData((d) => ({ ...d, startTime: e.target.value }))}
                        onFocus={focusOn} onBlur={focusOff} />
                    </div>
                    <div>
                      <label style={labelStyle}>שעת סיום *</label>
                      <input type="time" style={inputStyle} value={data.endTime}
                        onChange={(e) => setData((d) => ({ ...d, endTime: e.target.value }))}
                        onFocus={focusOn} onBlur={focusOff} />
                    </div>
                  </div>
                </div>

                {/* ── Footer ── */}
                <div style={{ padding: "12px 20px 20px", borderTop: `1px solid ${color.borderSubtle}`,
                  flexShrink: 0, background: color.surface1 }}>
                  {error && (
                    <div style={{ marginBottom: 12, padding: "8px 16px", borderRadius: radius.input,
                      background: color.surface2, border: `1px solid ${color.borderSubtle}`,
                      fontSize: 12, fontWeight: 500, color: color.danger, textAlign: "center",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <AlertCircle size={14} strokeWidth={2} /> {error}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12 }}>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={onClose} disabled={saving}
                      style={{ ...styles.buttonSecondary, width: "auto", padding: "0 16px", fontSize: 14,
                        opacity: saving ? 0.5 : 1 }}>
                      ביטול
                    </motion.button>
                    <motion.button
                      whileTap={(canSave && !saving) ? { scale: 0.98 } : undefined}
                      onClick={handleSave}
                      disabled={!canSave || saving}
                      style={{
                        ...styles.buttonPrimary, flex: 1, width: "auto",
                        ...(!(canSave && !saving) && {
                          background: color.surface3, color: color.textMuted,
                          boxShadow: "none", cursor: "not-allowed",
                        }),
                      }}>
                      {saving
                        ? <><Loader2 size={15} strokeWidth={2} style={{ animation: "spin 0.7s linear infinite" }} /> שומר...</>
                        : <><Save size={15} strokeWidth={2} /> שמור שינויים</>}
                    </motion.button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
