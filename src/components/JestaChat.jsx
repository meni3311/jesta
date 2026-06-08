/**
 * JestaChat — In-app messaging between employer and teenager
 *
 * Props:
 *   isOpen        boolean
 *   onClose       fn
 *   contract      { workerId, workerName, workerEmoji, employerName, employerEmoji,
 *                   jobTitle, status }
 *                 status: "approved" | "finished" | "pending" | "rejected"
 *   viewerRole    "worker" | "employer"
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Send, Lock } from "lucide-react";

const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";

// ── Seed messages (demo) ─────────────────────────────────────────────────────
const SEED_MESSAGES = [
  { id: 1, role: "employer", text: "שלום! אנחנו שמחים לאשר אותך לג׳סטה 🎉", time: "15:42" },
  { id: 2, role: "worker",   text: "תודה רבה! כמה עלי להגיע לפני שעת ההתחלה?", time: "15:44" },
  { id: 3, role: "employer", text: "תגיע 10 דקות מוקדם יותר לברייפינג קצר 👍", time: "15:45" },
  { id: 4, role: "worker",   text: "מושלם, מגיע ב-15:50!", time: "15:46" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function nowTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

const isLocked = (status) => status !== "approved";

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
export default function JestaChat({ isOpen, onClose, contract, viewerRole = "worker" }) {
  const [messages, setMessages] = useState(SEED_MESSAGES);
  const [input, setInput]       = useState("");
  const bottomRef               = useRef(null);

  const locked = isLocked(contract?.status);

  // Auto-scroll to bottom when messages change or chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || locked) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: viewerRole, text, time: nowTime() },
    ]);
    setInput("");
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
              disabled={locked || !input.trim()}
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
