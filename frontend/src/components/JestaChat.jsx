/**
 * JestaChat — In-app messaging between employer and teenager
 *
 * Real data: messages are loaded via GET /api/chats/:id/messages, sent via
 * POST /api/chats/:id/messages, and live updates arrive over the Supabase
 * Realtime broadcast channel `chat:{chatId}` (event "new-message", sent by
 * the NestJS backend after persisting each message).
 *
 * Props:
 *   isOpen        boolean
 *   onClose       fn
 *   contract      { chatId, workerName, workerEmoji, employerName, employerEmoji,
 *                   jobTitle, status }
 *                 status: "approved" | "finished" | "pending" | "rejected"
 *   viewerRole    "worker" | "employer"
 *   currentUserId string — the logged-in user's id (to mark own messages)
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Send, Lock } from "lucide-react";
import { getChatMessages, sendChatMessage } from "../services/api";
import { supabase } from "../lib/supabaseClient";

const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

const isLocked = (status) => status !== "approved";

/** Map a backend Message record to the bubble shape the UI renders */
function toBubble(msg, currentUserId, viewerRole) {
  const otherRole = viewerRole === "worker" ? "employer" : "worker";
  return {
    id:   msg.id,
    role: msg.senderId === currentUserId ? viewerRole : otherRole,
    text: msg.text,
    time: formatTime(msg.createdAt),
  };
}

// ── MessageBubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg, viewerRole }) {
  // "mine" = sent by the current viewer
  const isMine = msg.role === viewerRole;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      style={{
        display: "flex",
        justifyContent: isMine ? "flex-start" : "flex-end",
        marginBottom: 8,
        paddingInline: 14,
      }}
    >
      <div style={{ maxWidth: "76%" }}>
        <div
          style={{
            background: isMine ? "#f1f5f9" : "#f5f3ff",
            color: SLATE,
            borderRadius: isMine
              ? "18px 18px 18px 4px"
              : "18px 18px 4px 18px",
            padding: "10px 14px",
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {msg.text}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: "#94a3b8",
            marginTop: 3,
            textAlign: isMine ? "right" : "left",
            paddingInline: 4,
          }}
        >
          {msg.time}
        </div>
      </div>
    </motion.div>
  );
}

// ── JestaChat ─────────────────────────────────────────────────────────────────
export default function JestaChat({ isOpen, onClose, contract, viewerRole = "worker", currentUserId = null }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const bottomRef               = useRef(null);

  const chatId = contract?.chatId ?? null;
  // No chatId = no real chat exists yet (application not approved) → locked
  const locked = isLocked(contract?.status) || !chatId;

  // Append a message, deduping by id (REST response + broadcast can overlap)
  const appendMessage = useCallback((bubble) => {
    setMessages((prev) =>
      prev.some((m) => m.id === bubble.id) ? prev : [...prev, bubble]);
  }, []);

  // ── Load history + subscribe to realtime when the chat opens ──────────────
  useEffect(() => {
    if (!isOpen || !chatId) { setMessages([]); return; }

    let cancelled = false;
    getChatMessages(chatId)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.map((m) => toBubble(m, currentUserId, viewerRole)));
      })
      .catch((err) => console.error("[JestaChat] Failed to load messages:", err.message));

    // Supabase Realtime: backend broadcasts "new-message" on chat:{chatId}
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on("broadcast", { event: "new-message" }, ({ payload }) => {
        if (payload?.message) {
          appendMessage(toBubble(payload.message, currentUserId, viewerRole));
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [isOpen, chatId, currentUserId, viewerRole, appendMessage]);

  // Auto-scroll to bottom when messages change or chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || locked || sending) return;
    setSending(true);
    try {
      const saved = await sendChatMessage(chatId, text);
      appendMessage(toBubble(saved, currentUserId, viewerRole));
      setInput("");
    } catch (err) {
      console.error("[JestaChat] Send failed:", err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Counterparty info
  const counterName  = viewerRole === "worker"
    ? contract?.employerName  ?? "מעסיק"
    : contract?.workerName    ?? "מועמד";
  const counterEmoji = viewerRole === "worker"
    ? contract?.employerEmoji ?? "🏢"
    : contract?.workerEmoji   ?? "🧑";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="jesta-chat"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0,       opacity: 1 }}
          exit={{   y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 36 }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 8000,
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
          }}
          dir="rtl"
        >
          {/* ── Header ── */}
          <div
            style={{
              background: "#fff",
              padding: "48px 16px 14px",
              borderBottom: "1.5px solid #ede9fe",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "#f1f5f9", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              <ArrowRight size={18} color={SLATE} strokeWidth={2.5} />
            </motion.button>

            {/* Avatar */}
            <div
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "linear-gradient(135deg,#a78bfa,#7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0,
              }}
            >
              {counterEmoji}
            </div>

            {/* Name + Job */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                style={{
                  fontSize: 15, fontWeight: 800, color: SLATE,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {counterName}
              </div>
              <div
                style={{
                  fontSize: 12, color: VIOLET, fontWeight: 600,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {contract?.jobTitle ?? ""}
              </div>
            </div>

            {/* Lock badge when chat is locked */}
            {locked && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 20, padding: "4px 10px", flexShrink: 0,
                }}
              >
                <Lock size={11} color="#ef4444" strokeWidth={2.5} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>נעול</span>
              </div>
            )}
          </div>

          {/* ── Messages ── */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              paddingTop: 16,
              paddingBottom: 8,
              background: "#fafafa",
            }}
          >
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} viewerRole={viewerRole} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* ── Locked overlay message ── */}
          {locked && (
            <div
              style={{
                background: "#fff7ed",
                borderTop: "1.5px solid #fed7aa",
                padding: "10px 16px",
                textAlign: "center",
                fontSize: 12.5,
                color: "#92400e",
                fontWeight: 600,
                lineHeight: 1.5,
                flexShrink: 0,
              }}
            >
              הצ׳אט נעול. ניתן להתכתב רק עם מועמדים שאושרו וכל עוד הג׳סטה פעילה.
            </div>
          )}

          {/* ── Input bar ── */}
          <div
            style={{
              background: "#fff",
              borderTop: locked ? "none" : "1.5px solid #ede9fe",
              padding: "10px 14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <input
              disabled={locked}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={locked ? "" : "כתוב הודעה..."}
              style={{
                flex: 1,
                height: 42,
                borderRadius: 21,
                border: "1.5px solid",
                borderColor: locked ? "#e2e8f0" : "#ddd6fe",
                padding: "0 16px",
                fontSize: 14,
                fontFamily: "inherit",
                background: locked ? "#f8fafc" : "#fff",
                color: SLATE,
                outline: "none",
                direction: "rtl",
                transition: "border-color 0.2s",
                cursor: locked ? "not-allowed" : "text",
                opacity: locked ? 0.5 : 1,
              }}
              onFocus={(e) => {
                if (!locked) e.target.style.borderColor = VIOLET;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = locked ? "#e2e8f0" : "#ddd6fe";
              }}
            />
            <motion.button
              whileTap={locked ? {} : { scale: 0.88 }}
              onClick={handleSend}
              disabled={locked || sending || !input.trim()}
              style={{
                width: 42, height: 42,
                borderRadius: "50%",
                border: "none",
                background:
                  locked || !input.trim()
                    ? "#e2e8f0"
                    : "linear-gradient(135deg,#9333ea,#ec4899)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: locked || !input.trim() ? "not-allowed" : "pointer",
                flexShrink: 0,
                transition: "background 0.2s",
                boxShadow:
                  !locked && input.trim()
                    ? "0 3px 10px rgba(147,51,234,0.35)"
                    : "none",
              }}
            >
              <Send
                size={17}
                color={locked || !input.trim() ? "#94a3b8" : "#fff"}
                strokeWidth={2}
                style={{ transform: "scaleX(-1)" }}
              />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
