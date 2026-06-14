/**
 * JestaOffers — "הצעות אישיות" (System 3, worker side)
 *
 * Direct job offers sent by Pro employers. Accept → instant approval + chat.
 *
 * Props:
 *   onBack()
 *   onOpenChat(contract)
 *   onChanged() — an offer was answered (parent may refresh badges)
 */
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, Clock, MapPin, Calendar, Loader2,
  Check, X, MessageCircle, Inbox,
} from "lucide-react";
import { getMyOffers, acceptOffer, declineOffer } from "../services/api";
import { color, radius, font, styles } from "../design-system";
import { Avatar, Badge, EmptyState, RatingStars } from "./ui";

function fmtDay(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
}
function fmtTime(s, e) {
  const f = (iso) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return e ? `${f(s)}-${f(e)}` : f(s);
}

function OfferCard({ offer, onAccept, onDecline, onOpenChat }) {
  const [acting, setActing]   = useState(null);   // "accept" | "decline" | null
  const [local,  setLocal]    = useState(offer.status);
  const [chatId, setChatId]   = useState(null);
  const [error,  setError]    = useState(null);

  const job = offer.job ?? {};
  const employer = offer.employer ?? {};

  const handle = async (kind) => {
    if (acting) return;
    setActing(kind); setError(null);
    try {
      if (kind === "accept") {
        const res = await onAccept(offer.id);
        setLocal("ACCEPTED");
        if (res?.chat?.id) setChatId(res.chat.id);
      } else {
        await onDecline(offer.id);
        setLocal("DECLINED");
      }
    } catch (err) {
      if (err.status === 409) setError("ההצעה כבר לא בתוקף");
      else if (err.status === 403) setError(err.message || "לא ניתן לקבל את ההצעה כרגע");
      else setError("הפעולה נכשלה, נסו שוב");
    } finally {
      setActing(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{ ...styles.card, padding: 16, marginBottom: 12,
        opacity: local === "DECLINED" ? 0.55 : 1 }}>

      {/* Employer row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Avatar size={44} src={employer.avatarUrl} employer surface={color.surface1} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: color.textPrimary }}>{employer.fullName}</div>
          <RatingStars rating={employer.rating ?? 0} count={employer.ratingCount} size={10} />
        </div>
        <Badge variant="primary" icon={Sparkles}>הצעה אישית</Badge>
      </div>

      {/* Job */}
      <div style={{ fontSize: 15, fontWeight: 700, color: color.textPrimary, marginBottom: 6 }}>
        {job.title}
      </div>
      {offer.message && (
        <div style={{ fontSize: 12, color: color.textSecondary, lineHeight: 1.5,
          background: color.surface2, borderRadius: radius.input, padding: "8px 12px", marginBottom: 10 }}>
          ״{offer.message}״
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: color.textSecondary }}>
          <Calendar size={12} color={color.textMuted} strokeWidth={2} /> {fmtDay(job.startTime)}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: color.textSecondary }}>
          <Clock size={12} color={color.textMuted} strokeWidth={2} /> {fmtTime(job.startTime, job.endTime)}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: color.textSecondary,
          maxWidth: 140, overflow: "hidden" }}>
          <MapPin size={12} color={color.textMuted} strokeWidth={2} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.address}</span>
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 12, borderTop: `1px solid ${color.borderSubtle}` }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: color.primaryText }}>₪{job.pay}/ש׳</span>

        {local === "ACCEPTED" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge variant="approved" icon={Check}>התקבלה</Badge>
            {chatId && (
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => onOpenChat?.({
                  chatId, employerName: employer.fullName, jobTitle: job.title, status: "approved",
                })}
                style={{ ...styles.iconBox(32), border: "none", cursor: "pointer" }}>
                <MessageCircle size={15} color={color.primaryText} strokeWidth={1.75} />
              </motion.button>
            )}
          </div>
        ) : local === "DECLINED" ? (
          <Badge variant="rejected">נדחתה</Badge>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => handle("decline")}
              style={{ height: 38, padding: "0 14px", borderRadius: radius.button,
                border: `1px solid ${color.borderStrong}`, background: color.surface2,
                color: color.danger, fontSize: 12, fontWeight: 600, fontFamily: font.family,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {acting === "decline"
                ? <Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} />
                : <><X size={13} strokeWidth={2.5} /> לא הפעם</>}
            </motion.button>
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => handle("accept")}
              style={{ height: 38, padding: "0 18px", borderRadius: radius.button, border: "none",
                background: color.primary, color: "#fff", fontSize: 12, fontWeight: 700,
                fontFamily: font.family, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4 }}>
              {acting === "accept"
                ? <Loader2 size={14} color="#fff" style={{ animation: "spin 0.7s linear infinite" }} />
                : <><Check size={13} strokeWidth={2.5} /> אני בפנים!</>}
            </motion.button>
          </div>
        )}
      </div>
      {error && (
        <div style={{ fontSize: 11, color: color.danger, fontWeight: 500, marginTop: 8 }}>{error}</div>
      )}
    </motion.div>
  );
}

export default function JestaOffers({ onBack, onOpenChat, onChanged }) {
  const [offers, setOffers] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    getMyOffers()
      .then((data) => { if (!cancelled) { setOffers(data); setStatus("ok"); } })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const handleAccept = useCallback(async (id) => {
    const res = await acceptOffer(id);
    onChanged?.();
    return res;
  }, [onChanged]);

  const handleDecline = useCallback(async (id) => {
    const res = await declineOffer(id);
    onChanged?.();
    return res;
  }, [onChanged]);

  const pending = offers.filter((o) => o.status === "PENDING").length;

  return (
    <div dir="rtl" style={styles.screen}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: color.surface1, padding: "48px 20px 16px",
        borderBottom: `1px solid ${color.borderSubtle}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} style={styles.iconButton}>
            <ArrowRight size={18} color={color.textPrimary} strokeWidth={2} />
          </motion.button>
          <div>
            <div style={{ fontSize: 20, ...font.heading, display: "flex", alignItems: "center", gap: 8 }}>
              הצעות אישיות <Sparkles size={17} color={color.primaryText} strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 13, color: color.textSecondary, fontWeight: 400 }}>
              {status === "ok" ? `${pending} הצעות ממתינות` : " "}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        {status === "loading" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 size={26} color={color.primary} style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        )}
        {status === "error" && (
          <div style={{ textAlign: "center", padding: "32px 20px", fontSize: 13,
            color: color.danger, fontWeight: 500 }}>
            שגיאה בטעינת ההצעות. נסו שוב מאוחר יותר
          </div>
        )}
        {status === "ok" && offers.length === 0 && (
          <EmptyState icon={Inbox} title="עוד אין הצעות אישיות"
            subtitle="מעסיקי פרו יכולים להזמין אותך אישית לג׳סטות. פתחו את פרופיל הזמינות בהגדרות כדי להופיע ברשימה" />
        )}
        {status === "ok" && offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer}
            onAccept={handleAccept} onDecline={handleDecline} onOpenChat={onOpenChat} />
        ))}
      </div>
    </div>
  );
}
