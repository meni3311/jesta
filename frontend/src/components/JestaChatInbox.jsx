/**
 * JestaChatInbox — slide-up sheet listing all conversations
 *
 * Props:
 *   isOpen      boolean
 *   onClose     fn
 *   onOpenChat  fn(contract, viewerRole)
 *   viewerRole  "worker" | "employer"
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, MessageCircle, ChevronLeft } from "lucide-react";

const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";

// ── Mock conversation threads ─────────────────────────────────────────────────
// status: "approved" = active & open | "finished" | "pending" = locked
const CONVERSATIONS = [
  {
    id: "c-1",
    workerName:    "יובל כהן",
    workerEmoji:   "🧑",
    employerName:  "סינמה סיטי",
    employerEmoji: "🍿",
    jobTitle:      "סינמה סיטי - עוזר בדוכן פופקורן",
    status:        "approved",
    lastMsg:       "מגיע ב-15:50!",
    lastTime:      "15:46",
    unread:        2,
  },
  {
    id: "c-2",
    workerName:    "תמר לוי",
    workerEmoji:   "👩",
    employerName:  "מגה ספורט",
    employerEmoji: "🏃",
    jobTitle:      "מגה ספורט - מוכר/ת בחנות",
    status:        "finished",
    lastMsg:       "תודה על העבודה הנהדרת! 🙏",
    lastTime:      "אתמול",
    unread:        0,
  },
  {
    id: "c-3",
    workerName:    "אריאל גולן",
    workerEmoji:   "👦",
    employerName:  "קפה גרג",
    employerEmoji: "☕",
    jobTitle:      "קפה גרג - עוזר ברסטוראן",
    status:        "approved",
    lastMsg:       "האם יש חניה בסביבה?",
    lastTime:      "14:22",
    unread:        1,
  },
  {
    id: "c-4",
    workerName:    "נועה שמיר",
    workerEmoji:   "👧",
    employerName:  "זארה",
    employerEmoji: "👗",
    jobTitle:      "זארה - קיפול ומיון בגדים",
    status:        "finished",
    lastMsg:       "אוקיי, נדבר לפני המשמרת הבאה.",
    lastTime:      "לפני 3 ימים",
    unread:        0,
  },
];

function ConvoRow({ convo, viewerRole, onOpenChat }) {
  const locked   = convo.status !== "approved";
  const avatar   = viewerRole === "worker" ? convo.employerEmoji : convo.workerEmoji;
  const name     = viewerRole === "worker" ? convo.employerName  : convo.workerName;

  return (
    <motion.div
      whileTap={{ scale: 0.985, backgroundColor: "#f5f3ff" }}
      onClick={() => onOpenChat(convo, viewerRole)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 16px", cursor: "pointer",
        borderBottom: "1px solid #f1f0fb",
        background: "#fff",
        opacity: locked ? 0.72 : 1,
      }}
    >
      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          background: locked
            ? "linear-gradient(135deg,#cbd5e1,#94a3b8)"
            : "linear-gradient(135deg,#a78bfa,#7c3aed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>
          {avatar}
        </div>
        {convo.unread > 0 && (
          <div style={{
            position: "absolute", top: -2, right: -2,
            width: 17, height: 17, borderRadius: "50%",
            background: "#ec4899",
            border: "2px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 800, color: "#fff",
          }}>
            {convo.unread}
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <span style={{
            fontSize: 14, fontWeight: convo.unread > 0 ? 800 : 600,
            color: SLATE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {name}
          </span>
          {locked && (
            <Lock size={10} color="#94a3b8" strokeWidth={2.5} style={{ flexShrink: 0 }} />
          )}
        </div>
        <div style={{
          fontSize: 12, color: convo.unread > 0 ? VIOLET : MUTED,
          fontWeight: convo.unread > 0 ? 600 : 400,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {convo.jobTitle}
        </div>
        <div style={{
          fontSize: 11.5, color: MUTED, marginTop: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {convo.lastMsg}
        </div>
      </div>

      {/* Time + chevron */}
      <div style={{ flexShrink: 0, textAlign: "left", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span style={{ fontSize: 10.5, color: MUTED }}>{convo.lastTime}</span>
        <ChevronLeft size={14} color="#c4b5fd" strokeWidth={2} />
      </div>
    </motion.div>
  );
}

export default function JestaChatInbox({ isOpen, onClose, onOpenChat, viewerRole = "worker" }) {
  const totalUnread = CONVERSATIONS.reduce((s, c) => s + c.unread, 0);
  const active  = CONVERSATIONS.filter(c => c.status === "approved");
  const past    = CONVERSATIONS.filter(c => c.status !== "approved");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="inbox-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "absolute", inset: 0, zIndex: 7500,
              background: "rgba(15,23,42,0.35)",
            }}
          />

          {/* Sheet */}
          <motion.div
            key="inbox-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              zIndex: 7600,
              background: "#fff",
              borderRadius: "24px 24px 0 0",
              maxHeight: "82%",
              display: "flex", flexDirection: "column",
              fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
            }}
            dir="rtl"
          >
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e2e8f0" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px 10px",
              borderBottom: "1px solid #ede9fe",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={18} color={VIOLET} strokeWidth={2} />
                <span style={{ fontSize: 17, fontWeight: 900, color: SLATE }}>שיחות</span>
                {totalUnread > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: "#fff",
                    background: "#ec4899", borderRadius: 20, padding: "1px 8px",
                  }}>
                    {totalUnread} חדשות
                  </span>
                )}
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "#f1f5f9", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}>
                <X size={15} color={SLATE} strokeWidth={2.5} />
              </motion.button>
            </div>

            {/* List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {active.length > 0 && (
                <>
                  <div style={{
                    fontSize: 10.5, fontWeight: 700, color: MUTED,
                    padding: "10px 16px 4px",
                    textTransform: "uppercase", letterSpacing: 0.6,
                  }}>
                    פעילות
                  </div>
                  {active.map(c => (
                    <ConvoRow key={c.id} convo={c} viewerRole={viewerRole}
                      onOpenChat={(convo, role) => { onClose(); setTimeout(() => onOpenChat(convo, role), 200); }} />
                  ))}
                </>
              )}

              {past.length > 0 && (
                <>
                  <div style={{
                    fontSize: 10.5, fontWeight: 700, color: MUTED,
                    padding: "14px 16px 4px",
                    textTransform: "uppercase", letterSpacing: 0.6,
                  }}>
                    ארכיון
                  </div>
                  {past.map(c => (
                    <ConvoRow key={c.id} convo={c} viewerRole={viewerRole}
                      onOpenChat={(convo, role) => { onClose(); setTimeout(() => onOpenChat(convo, role), 200); }} />
                  ))}
                </>
              )}

              <div style={{ height: 24 }} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Export unread count so FAB can read it without duplicating data
export const TOTAL_UNREAD = 3;
