/**
 * JestaRatingModal — mutual post-gesta rating (System 1)
 *
 * Shows a queue of pending ratings (one card at a time): 1-5 stars +
 * optional comment (max 100 chars). Submits via POST /ratings.
 *
 * Props:
 *   isOpen     boolean
 *   pending    [{ jobId, jobTitle, completedAt, toUser: { id, fullName, avatarUrl, role } }]
 *   onClose    fn — dismiss (remaining ratings stay pending for next time)
 *   onSubmitted fn(jobId) — called after each successful submit
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Loader2, CheckCircle2 } from "lucide-react";
import { submitRating } from "../services/api";
import { color, radius, font, styles } from "../design-system";
import { Avatar, PrimaryButton } from "./ui";

const MAX_COMMENT = 100;

export default function JestaRatingModal({ isOpen, pending = [], onClose, onSubmitted }) {
  // Snapshot the queue when the modal opens, so the parent may freely update
  // its own pending list (badges etc.) without shifting our indices.
  const [queue,      setQueue]      = useState([]);
  const [idx,        setIdx]        = useState(0);
  const [score,      setScore]      = useState(0);
  const [hover,      setHover]      = useState(0);
  const [comment,    setComment]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [justSent,   setJustSent]   = useState(false);

  // Reset per open
  useEffect(() => {
    if (isOpen) {
      setQueue(pending);
      setIdx(0); setScore(0); setHover(0); setComment(""); setError(null); setJustSent(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const item = queue[idx];
  if (!item && isOpen && !justSent) return null;

  const isWorkerTarget = item?.toUser?.role === "WORKER";

  const advance = () => {
    if (idx + 1 < queue.length) {
      setIdx(idx + 1); setScore(0); setHover(0); setComment(""); setError(null); setJustSent(false);
    } else {
      onClose?.();
    }
  };

  const handleSubmit = async () => {
    if (!score || submitting) return;
    setSubmitting(true); setError(null);
    try {
      await submitRating({
        jobId: item.jobId,
        toUserId: item.toUser.id,
        score,
        ...(comment.trim() && { comment: comment.trim().slice(0, MAX_COMMENT) }),
      });
      onSubmitted?.(item.jobId);
      setJustSent(true);
      setTimeout(advance, 900);
    } catch (err) {
      // 409 — already rated (e.g. double tap / another device): just move on
      if (err.status === 409) { onSubmitted?.(item.jobId); advance(); }
      else setError("שליחת הדירוג נכשלה. נסו שוב");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="rating-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{ position: "absolute", inset: 0, zIndex: 8200,
            background: "rgba(10,10,15,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <motion.div dir="rtl"
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            style={{ ...styles.card, width: "100%", maxWidth: 320, padding: 20,
              fontFamily: font.family, position: "relative" }}>

            {/* Close (skip for now — stays pending) */}
            <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
              style={{ ...styles.iconButton, width: 30, height: 30,
                position: "absolute", top: 12, insetInlineStart: 12 }}>
              <X size={14} color={color.textSecondary} strokeWidth={2} />
            </motion.button>

            {justSent ? (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <CheckCircle2 size={44} color={color.success} strokeWidth={1.5} />
                <div style={{ fontSize: 16, fontWeight: 700, color: color.textPrimary, marginTop: 12 }}>
                  הדירוג נשלח!
                </div>
              </div>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div style={{ ...font.overline, marginBottom: 12 }}>
                    {queue.length > 1 ? `דירוג ${idx + 1} מתוך ${queue.length}` : "הג׳סטה הושלמה"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                    <Avatar size={56} src={item?.toUser?.avatarUrl} employer={!isWorkerTarget} surface={color.surface1} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: color.textPrimary }}>
                    {isWorkerTarget ? "איך היה העובד?" : "איך היה המעסיק?"}
                  </div>
                  <div style={{ fontSize: 12, color: color.textSecondary, marginTop: 4 }}>
                    {item?.toUser?.fullName} · {item?.jobTitle}
                  </div>
                </div>

                {/* Stars */}
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}
                  onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((s) => {
                    const active = s <= (hover || score);
                    return (
                      <motion.button key={s} whileTap={{ scale: 0.8 }}
                        onClick={() => setScore(s)} onMouseEnter={() => setHover(s)}
                        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
                        <Star size={32} strokeWidth={1.5}
                          fill={active ? color.warning : "transparent"}
                          color={active ? color.warning : color.textMuted} />
                      </motion.button>
                    );
                  })}
                </div>

                {/* Comment (optional, max 100) */}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
                  placeholder="הערה קצרה (לא חובה)..."
                  style={{ ...styles.input, direction: "rtl", minHeight: 56, resize: "none",
                    lineHeight: 1.5, marginBottom: 4 }} />
                <div style={{ fontSize: 10, color: color.textMuted, textAlign: "left", marginBottom: 12 }}>
                  {comment.length}/{MAX_COMMENT}
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: color.danger, fontWeight: 500,
                    textAlign: "center", marginBottom: 10 }}>{error}</div>
                )}

                <PrimaryButton onClick={handleSubmit} disabled={!score || submitting}
                  style={{ height: 46, fontSize: 14 }}>
                  {submitting
                    ? <Loader2 size={18} color="#fff" style={{ animation: "spin 0.7s linear infinite" }} />
                    : "שלח דירוג"}
                </PrimaryButton>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
