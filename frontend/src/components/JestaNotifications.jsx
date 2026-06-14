/**
 * JestaNotifications — notification center, right-side slide-in panel (System 3)
 *
 * Action buttons by type:
 *   PRE_SHIFT_REMINDER / CONFIRM_SHIFT(_URGENT) → "אישור הגעה" (confirmArrival)
 *   NO_SHOW_FALLBACK / JOB_REOPENED             → "אני בפנים!" (claimReopened)
 *   RATING_REQUEST / RATE_REQUEST               → opens the rating modal
 *
 * Tapping any card navigates to its relevant screen (onNavigate) and marks
 * it read.
 *
 * Props:
 *   isOpen          boolean
 *   onClose         fn
 *   onOpenRating    fn — open the pending-ratings modal
 *   onChanged       fn — notify parent that unread count likely changed
 *   onNavigate      fn(notification) — route to the relevant screen by type
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Bell, BellRing, Clock, AlertTriangle, Zap, Star,
  Sparkles, Loader2, CheckCircle2, Check, Users, Siren, UserCheck,
} from "lucide-react";
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  confirmArrival, claimReopened,
} from "../services/api";
import { color, radius, font, styles } from "../design-system";
import { EmptyState } from "./ui";

const TYPE_META = {
  // System 3 spec types
  NEW_APPLICANT:        { icon: Users,         tint: color.primaryText },
  APPLICATION_APPROVED: { icon: CheckCircle2,  tint: color.success },
  PRE_SHIFT_REMINDER:   { icon: Clock,         tint: color.primaryText },
  SHIFT_CONFIRMED:      { icon: UserCheck,     tint: color.success },
  NO_SHOW_FALLBACK:     { icon: Zap,           tint: color.success },
  DIRECT_OFFER:         { icon: Sparkles,      tint: color.primaryText },
  RATING_REQUEST:       { icon: Star,          tint: color.warning },
  EMERGENCY_GESTA:      { icon: Siren,         tint: color.danger },
  // Legacy values (old rows)
  CONFIRM_SHIFT:        { icon: Clock,         tint: color.primaryText },
  CONFIRM_SHIFT_URGENT: { icon: AlertTriangle, tint: color.warning },
  JOB_REOPENED:         { icon: Zap,           tint: color.success },
  RATE_REQUEST:         { icon: Star,          tint: color.warning },
  OFFER_RESPONSE:       { icon: Bell,          tint: color.textSecondary },
  GENERAL:              { icon: Bell,          tint: color.textSecondary },
};

const CONFIRM_TYPES = ["PRE_SHIFT_REMINDER", "CONFIRM_SHIFT", "CONFIRM_SHIFT_URGENT"];
const CLAIM_TYPES   = ["NO_SHOW_FALLBACK", "JOB_REOPENED"];
const RATING_TYPES  = ["RATING_REQUEST", "RATE_REQUEST"];

function timeAgo(iso) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  if (m < 1)   return "עכשיו";
  if (m < 60)  return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24)  return `לפני ${h} שע׳`;
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

function NotificationCard({ n, onAction, onMarkRead, onNavigate }) {
  const [acting,  setActing]  = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState(null);
  const meta = TYPE_META[n.type] ?? TYPE_META.GENERAL;
  const Icon = meta.icon;

  const needsConfirm = CONFIRM_TYPES.includes(n.type) && n.applicationId;
  const needsClaim   = CLAIM_TYPES.includes(n.type) && n.applicationId;
  const needsRating  = RATING_TYPES.includes(n.type);

  const act = async (fn, successMsg) => {
    if (acting) return;
    setActing(true); setError(null);
    try {
      await fn();
      setDone(successMsg);
      onMarkRead?.(n, { silent: true });
    } catch (err) {
      setError(err.status === 409
        ? (needsClaim ? "מישהו אחר כבר תפס את המשמרת" : "הפעולה כבר בוצעה")
        : "הפעולה נכשלה, נסו שוב");
    } finally {
      setActing(false);
    }
  };

  return (
    <div
      onClick={() => {
        if (!n.isRead) onMarkRead?.(n);
        onNavigate?.(n);   // tap → relevant screen (System 3)
      }}
      style={{ ...styles.card, padding: 14, marginBottom: 10, cursor: "pointer",
        borderColor: n.isRead ? color.borderSubtle : color.borderStrong,
        opacity: n.isRead && !needsConfirm && !needsClaim ? 0.75 : 1, position: "relative" }}>
      {!n.isRead && (
        <div style={{ position: "absolute", top: 14, insetInlineEnd: 14, width: 8, height: 8,
          borderRadius: "50%", background: color.primary }} />
      )}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={styles.iconBox(38)}>
          <Icon size={17} color={meta.tint} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: color.textPrimary, lineHeight: 1.35 }}>
            {n.title}
          </div>
          {n.body && (
            <div style={{ fontSize: 12, color: color.textSecondary, marginTop: 3, lineHeight: 1.5 }}>
              {n.body}
            </div>
          )}
          <div style={{ fontSize: 10, color: color.textMuted, marginTop: 4 }}>{timeAgo(n.createdAt)}</div>

          {error && (
            <div style={{ fontSize: 11, color: color.danger, fontWeight: 500, marginTop: 6 }}>{error}</div>
          )}

          {done ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8,
              fontSize: 12, color: color.success, fontWeight: 600 }}>
              <CheckCircle2 size={13} strokeWidth={2} /> {done}
            </div>
          ) : (needsConfirm || needsClaim || needsRating) && (
            <motion.button whileTap={{ scale: 0.96 }}
              onClick={(e) => {
                e.stopPropagation();
                if (needsRating) { onAction?.("rating"); return; }
                if (needsConfirm) act(() => confirmArrival(n.applicationId), "הגעה אושרה!");
                else if (needsClaim) act(() => claimReopened(n.applicationId), "המשמרת שלך! אושרת אוטומטית");
              }}
              style={{ marginTop: 8, height: 36, padding: "0 16px",
                borderRadius: radius.button, border: "none",
                background: needsClaim ? color.success : color.primary, color: "#fff",
                fontSize: 12, fontWeight: 700, fontFamily: font.family, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6 }}>
              {acting
                ? <Loader2 size={14} color="#fff" style={{ animation: "spin 0.7s linear infinite" }} />
                : needsRating ? <><Star size={13} strokeWidth={2} /> דרגו עכשיו</>
                : needsClaim  ? <><Zap size={13} strokeWidth={2} /> אני בפנים!</>
                : <><Check size={13} strokeWidth={2.5} /> אישור הגעה</>}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JestaNotifications({ isOpen, onClose, onOpenRating, onChanged, onNavigate }) {
  const [items,  setItems]  = useState([]);
  const [status, setStatus] = useState("loading");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await getNotifications();
      setItems(data.items ?? []);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const markRead = useCallback(async (n, { silent = false } = {}) => {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    try { await markNotificationRead(n.id); onChanged?.(); } catch { /* cosmetic */ }
    void silent;
  }, [onChanged]);

  const markAll = useCallback(async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    try { await markAllNotificationsRead(); onChanged?.(); } catch { /* cosmetic */ }
  }, [onChanged]);

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="notif-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }} onClick={onClose}
          style={{ position: "absolute", inset: 0, zIndex: 7500,
            background: "rgba(10,10,15,0.72)" }}>
          {/* Right-side slide-in panel (System 3 spec) */}
          <motion.div dir="rtl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "88%",
              background: color.surface1,
              borderLeft: `1px solid ${color.borderSubtle}`,
              boxShadow: "-12px 0 48px rgba(0,0,0,0.5)",
              display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: font.family }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "52px 20px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BellRing size={17} color={color.primaryText} strokeWidth={1.75} />
                <span style={{ fontSize: 17, ...font.heading }}>התראות</span>
                {unread > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: color.primary,
                    borderRadius: radius.chip, padding: "2px 8px" }}>{unread}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {unread > 0 && (
                  <button onClick={markAll}
                    style={{ background: "transparent", border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, color: color.primaryText, fontFamily: font.family }}>
                    סמן הכל כנקרא
                  </button>
                )}
                <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                  style={{ ...styles.iconButton, width: 32, height: 32 }}>
                  <X size={15} color={color.textSecondary} strokeWidth={2} />
                </motion.button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>
              {status === "loading" && (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                  <Loader2 size={26} color={color.primary} style={{ animation: "spin 0.7s linear infinite" }} />
                </div>
              )}
              {status === "error" && (
                <div style={{ textAlign: "center", padding: "32px 20px", fontSize: 13,
                  color: color.danger, fontWeight: 500 }}>
                  שגיאה בטעינת ההתראות
                </div>
              )}
              {status === "ok" && items.length === 0 && (
                <EmptyState icon={Bell} title="אין התראות"
                  subtitle="עדכונים על משמרות, דירוגים והצעות יופיעו כאן" />
              )}
              {status === "ok" && items.map((n) => (
                <NotificationCard key={n.id} n={n}
                  onMarkRead={markRead}
                  onNavigate={(notif) => { onClose?.(); onNavigate?.(notif); }}
                  onAction={(kind) => { if (kind === "rating") { onClose?.(); onOpenRating?.(); } }} />
              ))}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
