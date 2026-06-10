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
import { color, font, styles } from "../design-system";
import { Avatar, Badge, EmptyState, SheetHandle, SectionLabel } from "./ui";

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
    employerName:  chat.employer?.fullName ?? "מעסיק",
    jobTitle:      chat.application?.job?.title ?? "",
    // Chats only exist after approval; COMPLETED applications go to the archive
    status:        appStatus === "COMPLETED" ? "finished" : "approved",
    lastMsg:       lastMessage?.text ?? "עוד אין הודעות — אמרו שלום!",
    lastTime:      formatLastTime(lastMessage?.createdAt ?? chat.createdAt),
    // TODO: no read-receipt infrastructure yet (needs a message_reads table);
    // unread counts are 0 until that exists.
    unread:        0,
  };
}

function ConvoRow({ convo, viewerRole, onOpenChat }) {
  const locked = convo.status !== "approved";
  const name   = viewerRole === "worker" ? convo.employerName : convo.workerName;

  return (
    <motion.div
      whileTap={{ scale: 0.985, backgroundColor: color.surface2 }}
      onClick={() => onOpenChat(convo, viewerRole)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 20px", cursor: "pointer",
        borderBottom: `1px solid ${color.borderSubtle}`,
        background: "transparent",
        opacity: locked ? 0.6 : 1,
      }}
    >
      {/* Avatar */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar size={44} employer={viewerRole === "worker"} surface={color.surface1} />
        {convo.unread > 0 && (
          <div style={{
            position: "absolute", top: -2, insetInlineEnd: -2,
            minWidth: 16, height: 16, borderRadius: 8,
            background: color.primary,
            border: `2px solid ${color.surface1}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "#fff",
            boxSizing: "content-box",
          }}>
            {convo.unread}
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
          <span style={{
            fontSize: 14, fontWeight: convo.unread > 0 ? 700 : 600,
            color: color.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {name}
          </span>
          {locked && (
            <Lock size={10} color={color.textMuted} strokeWidth={2} style={{ flexShrink: 0 }} />
          )}
        </div>
        <div style={{
          fontSize: 12, color: convo.unread > 0 ? color.primaryText : color.textSecondary,
          fontWeight: convo.unread > 0 ? 600 : 400,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {convo.jobTitle}
        </div>
        <div style={{
          fontSize: 11, color: color.textMuted, marginTop: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {convo.lastMsg}
        </div>
      </div>

      {/* Time + chevron */}
      <div style={{ flexShrink: 0, textAlign: "left", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span style={{ fontSize: 10, color: color.textMuted }}>{convo.lastTime}</span>
        <ChevronLeft size={14} color={color.textMuted} strokeWidth={2} />
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
              background: "rgba(10,10,15,0.6)",
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
              ...styles.sheet,
              maxHeight: "82%",
              display: "flex", flexDirection: "column",
              fontFamily: font.family,
            }}
            dir="rtl"
          >
            <SheetHandle />

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 20px 12px",
              borderBottom: `1px solid ${color.borderSubtle}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={18} color={color.primaryText} strokeWidth={1.75} />
                <span style={{ fontSize: 17, ...font.heading }}>שיחות</span>
                {totalUnread > 0 && (
                  <Badge variant="primary">{totalUnread} חדשות</Badge>
                )}
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                style={{ ...styles.iconButton, width: 32, height: 32 }}>
                <X size={15} color={color.textSecondary} strokeWidth={2} />
              </motion.button>
            </div>

            {/* List */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {status === "loading" && (
                <div style={{ display: "flex", justifyContent: "center", padding: "36px 0" }}>
                  <Loader2 size={24} color={color.primary}
                    style={{ animation: "spin 0.7s linear infinite" }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {status === "error" && (
                <div style={{ textAlign: "center", padding: "32px 20px",
                  fontSize: 13, color: color.danger, fontWeight: 500 }}>
                  שגיאה בטעינת השיחות. נסה לפתוח שוב.
                </div>
              )}

              {status === "ok" && conversations.length === 0 && (
                <EmptyState
                  icon={MessageCircle}
                  title="עוד אין שיחות"
                  subtitle="שיחה נפתחת אוטומטית ברגע שמועמדות מאושרת"
                />
              )}

              {status === "ok" && active.length > 0 && (
                <>
                  <SectionLabel style={{ padding: "12px 20px 0", marginBottom: 4 }}>פעילות</SectionLabel>
                  {active.map(c => (
                    <ConvoRow key={c.id} convo={c} viewerRole={viewerRole}
                      onOpenChat={(convo, role) => { onClose(); setTimeout(() => onOpenChat(convo, role), 200); }} />
                  ))}
                </>
              )}

              {status === "ok" && past.length > 0 && (
                <>
                  <SectionLabel style={{ padding: "16px 20px 0", marginBottom: 4 }}>ארכיון</SectionLabel>
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
