/**
 * JestaChatInbox — slide-up sheet listing all conversations
 *
 * Props:
 *   isOpen      boolean
 *   onClose     fn
 *   onOpenChat  fn(contract, viewerRole)
 *   viewerRole  "worker" | "employer"
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, MessageCircle, ChevronLeft, Loader2 } from "lucide-react";
import { getChats } from "../services/api";

const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Hebrew-friendly relative timestamp for the last message */
function formatLastTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "אתמול";
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}

/** Map a backend Chat record (GET /api/chats) to the row shape the UI renders */
function toConvo(chat) {
  const lastMessage = chat.messages?.[0] ?? null;
  const appStatus   = chat.application?.status;
  return {
    id:            chat.id,
    chatId:        chat.id,
    workerId:      chat.worker?.id,
    workerName:    chat.worker?.fullName   ?? "ג׳סטר",
    workerEmoji:   "🧑",
    employerName:  chat.employer?.fullName ?? "מעסיק",
    employerEmoji: "👨‍💼",
    jobTitle:      chat.application?.job?.title ?? "",
    // Chats only exist after approval; COMPLETED applications go to the archive
    status:        appStatus === "COMPLETED" ? "finished" : "approved",
    lastMsg:       lastMessage?.text ?? "עוד אין הודעות — אמרו שלום! 👋",
    lastTime:      formatLastTime(lastMessage?.createdAt ?? chat.createdAt),
    // TODO: no read-receipt infrastructure yet (needs a message_reads table);
    // unread counts are 0 until that exists.
    unread:        0,
  };
}

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
  const [conversations, setConversations] = useState([]);
  const [status, setStatus]               = useState("loading"); // loading | ok | error

  // Fetch real chats every time the sheet opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStatus("loading");
    getChats()
      .then((data) => {
        if (cancelled) return;
        setConversations(data.map(toConvo));
        setStatus("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Inbox] Failed to load chats:", err.message);
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  const active  = conversations.filter(c => c.status === "approved");
  const past    = conversations.filter(c => c.status !== "approved");

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
              {status === "loading" && (
                <div style={{ display: "flex", justifyContent: "center", padding: "36px 0" }}>
                  <Loader2 size={24} color={VIOLET}
                    style={{ animation: "spin 0.7s linear infinite" }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {status === "error" && (
                <div style={{ textAlign: "center", padding: "32px 20px",
                  fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                  שגיאה בטעינת השיחות. נסה לפתוח שוב.
                </div>
              )}

              {status === "ok" && conversations.length === 0 && (
                <div style={{ textAlign: "center", padding: "36px 20px" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>💬</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: SLATE, marginBottom: 4 }}>
                    עוד אין שיחות
                  </div>
                  <div style={{ fontSize: 12, color: MUTED }}>
                    שיחה נפתחת אוטומטית ברגע שמועמדות מאושרת
                  </div>
                </div>
              )}

              {status === "ok" && active.length > 0 && (
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

              {status === "ok" && past.length > 0 && (
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

// TODO: real unread counts require read-receipt tracking (message_reads table
// + per-message read state). Until that exists the FAB shows no badge.
export const TOTAL_UNREAD = 0;
