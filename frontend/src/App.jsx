import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

import { getJobs, applyToJob }     from "./services/api";
import AuthScreen                  from "./components/AuthScreen";
import GuestPromptModal            from "./components/GuestPromptModal";
import JestaJobsFeed               from "./components/JestaJobsFeed";
import JestaJobDetails             from "./components/JestaJobDetails";
import JestaPending                from "./components/JestaPending";
import JestaSchedule               from "./components/JestaSchedule";
import EmployerDashboard           from "./components/EmployerDashboard";
import JestaSidebar                from "./components/JestaSidebar";
import JestaCreateModal            from "./components/JestaCreateModal";
import JestaPublicProfile          from "./components/JestaPublicProfile";
import JestaChat                   from "./components/JestaChat";
import JestaChatInbox, { TOTAL_UNREAD } from "./components/JestaChatInbox";
import JestaProfileSettings        from "./components/JestaProfileSettings";

// ── Animation variants ────────────────────────────────────────────────────────
const slide = {
  enterLeft:  { x: "-100%", opacity: 0 },
  enterRight: { x: "100%",  opacity: 0 },
  center:     { x: 0,       opacity: 1 },
  exitLeft:   { x: "-100%", opacity: 0 },
  exitRight:  { x: "100%",  opacity: 0 },
};
const slideUp = {
  enter:  { y: "60%", opacity: 0 },
  center: { y: 0,     opacity: 1 },
  exit:   { y: "60%", opacity: 0 },
};
const tx   = { type: "tween",  ease: [0.32, 0, 0.1, 1], duration: 0.38 };
const txUp = { type: "spring", stiffness: 320, damping: 34 };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a shift's startTime + endTime ISO strings into Hebrew display text */
function formatShift(start, end) {
  if (!start) return "";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const today    = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const sameDay  = (a, b) => a.toDateString() === b.toDateString();

  const dayLabel = sameDay(s, today)    ? "היום"
                 : sameDay(s, tomorrow) ? "מחר"
                 : s.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });

  const timeStr = s.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const endStr  = e ? `–${e.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : "";
  return `${dayLabel}, ${timeStr}${endStr}`;
}

/** Normalise a backend job record to the shape the UI components expect */
function normaliseJob(j, idx) {
  return {
    ...j,
    pay:            `₪${j.pay}`,
    payRaw:         j.pay,
    employer:       j.employer?.fullName ?? "מעסיק",
    employerRating: j.employer?.rating   ?? 0,
    time:           formatShift(j.startTime, j.endTime),
    dist:           j.address,
    perks:          j.perks ?? [],
    slideIndex:     idx % 3,
  };
}

/** Persist auth session to localStorage */
function saveSession(session) {
  localStorage.setItem('jesta_session', JSON.stringify(session));
}

/** Clear localStorage auth session */
function clearSession() {
  localStorage.removeItem('jesta_session');
}

/** Try to restore a saved session from localStorage */
function restoreSession() {
  try {
    const raw = localStorage.getItem('jesta_session');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Maps a backend UserRole to the app's mode string.
 * EMPLOYER → "employer"   (lands on EmployerDashboard)
 * WORKER / anything else → "worker"  (lands on JobsFeed)
 */
function roleToMode(role) {
  return role === "EMPLOYER" ? "employer" : "worker";
}

// ── Phone shell ───────────────────────────────────────────────────────────────
function PhoneShell({ children }) {
  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      minHeight: "100vh", background: "#06030f", padding: "24px 0", overflow: "hidden",
    }}>
      <div style={{
        width: 360, height: 780, borderRadius: 44, overflow: "hidden",
        position: "relative", border: "1.5px solid #1e1040",
        boxShadow: "0 0 0 7px #0d0824, 0 40px 80px rgba(0,0,0,0.8)",
      }}>
        {children}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {

  // ── Auth state ─────────────────────────────────────────────────────────────
  // null         → checking storage (splash)
  // false        → signed out → show AuthScreen
  // "guest"      → browsing as guest (view-only)
  // { user, token } → authenticated via NestJS
  const [authState, setAuthState] = useState(null);

  // Restore session from localStorage on first mount.
  // Set mode BEFORE authState so the first render already shows the right view.
  useEffect(() => {
    const saved = restoreSession();
    if (saved?.user?.role) setMode(roleToMode(saved.user.role));
    setAuthState(saved ?? false);
  }, []);

  // Listen for 401 events dispatched by the axios interceptor
  useEffect(() => {
    const handle = () => { clearSession(); setAuthState(false); };
    window.addEventListener('jesta:unauthorized', handle);
    return () => window.removeEventListener('jesta:unauthorized', handle);
  }, []);

  const handleAuth = useCallback((data) => {
    // data = { user, token } from NestJS /auth/login or /auth/register
    saveSession(data);
    // Route employers straight to their dashboard; workers get the jobs feed.
    setMode(roleToMode(data?.user?.role));
    setAuthState(data);
  }, []);

  const handleSignOut = useCallback(() => {
    clearSession();
    setMode("worker");   // reset for whoever logs in next
    setScreen("feed");
    setAuthState(false);
  }, []);

  // ── Jobs ───────────────────────────────────────────────────────────────────
  const [jobs,       setJobs]       = useState([]);
  const [jobsStatus, setJobsStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setJobsStatus("loading");
    getJobs()
      .then((data) => {
        if (cancelled) return;
        setJobs(data.map(normaliseJob));
        setJobsStatus("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Jesta] Failed to load jobs:", err);
        setJobsStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  // ── Core app state ─────────────────────────────────────────────────────────
  const [mode, setMode] = useState("worker");

  const [approvedWorkerIds, setApprovedWorkerIds] = useState(new Set());
  const [rejectedWorkerIds, setRejectedWorkerIds] = useState(new Set());
  const approveWorker  = (id) => setApprovedWorkerIds(p => new Set([...p, id]));
  const rejectWorker   = (id) => setRejectedWorkerIds(p => new Set([...p, id]));
  const cinemaApproved = approvedWorkerIds.has("w-1");

  const [screen,   setScreen]   = useState("feed");
  const [selected, setSelected] = useState(null);
  const [dir,      setDir]      = useState(1);

  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [profileModal, setProfileModal] = useState({ isOpen: false, type: "worker", data: null });

  const [chatModal, setChatModal] = useState({ isOpen: false, contract: null, viewerRole: "worker" });
  const [inboxOpen, setInboxOpen] = useState(false);

  // ── Profile settings screen ────────────────────────────────────────────────
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);

  const handleUserUpdate = useCallback((updatedUser) => {
    setAuthState(prev => {
      if (!prev || prev === "guest") return prev;
      const next = { ...prev, user: { ...prev.user, ...updatedUser } };
      saveSession(next);
      return next;
    });
  }, []);

  // Check ?verified= param on mount and show a brief banner
  const [verifiedBanner, setVerifiedBanner] = useState(null);  // "success" | "invalid" | "expired"
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("verified");
    if (v) {
      setVerifiedBanner(v);
      // Strip the param from URL without reload
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
      setTimeout(() => setVerifiedBanner(null), 4500);
    }
  }, []);

  // ── Guest prompt modal ─────────────────────────────────────────────────────
  const [guestModal, setGuestModal] = useState(false);

  const isGuest = authState === "guest";

  /**
   * Wraps any protected action.
   * If the user is a guest, shows the sign-up modal instead of running `action`.
   */
  const withAuth = useCallback((action) => (...args) => {
    if (isGuest) { setGuestModal(true); return; }
    return action(...args);
  }, [isGuest]);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const goTo = (scr, job = null, direction = 1) => {
    setSelected(job); setDir(direction); setScreen(scr); setSidebarOpen(false);
  };
  const goToDetails  = (job) => goTo("details", job, 1);
  const goToSchedule = ()    => goTo("schedule", null, 1);
  const goBack       = ()    => goTo("feed", null, -1);

  // "אני בפנים! ⚡" — guarded + fires API
  const goToPending = withAuth(async (job) => {
    goTo("pending", job, 1);                          // optimistic navigation
    const userId = authState?.user?.id;
    if (userId && job?.id) {
      applyToJob(job.id, userId).catch((err) =>
        console.warn("[Jesta] Apply error (non-fatal):", err.message),
      );
    }
  });

  const openChat = withAuth((contract, viewerRole = "worker") =>
    setChatModal({ isOpen: true, contract, viewerRole }),
  );
  const closeChat = () => setChatModal(p => ({ ...p, isOpen: false }));
  const openChatFromInbox = withAuth((convo, viewerRole) =>
    setChatModal({ isOpen: true, contract: { ...convo }, viewerRole }),
  );

  const openProfile = (typeOrData, extraData = null) => {
    if (typeof typeOrData === "string") {
      setProfileModal({ isOpen: true, type: typeOrData, data: extraData });
    } else {
      setProfileModal({ isOpen: true, type: typeOrData?.type ?? "worker", data: typeOrData });
    }
  };
  const closeProfile = () => setProfileModal(p => ({ ...p, isOpen: false }));

  const switchMode = (newMode) => {
    setMode(newMode);
    setSidebarOpen(false);
    if (newMode === "worker") setScreen("feed");
  };

  const handlePublish = withAuth((newJob) => {
    setJobs(p => [normaliseJob(newJob, p.length), ...p]);
    setCreateModalOpen(false);
  });

  const handleOpenCreate = withAuth(() => {
    setSidebarOpen(false);
    setTimeout(() => setCreateModalOpen(true), 280);
  });

  const pushEnter = dir === -1 ? slide.enterRight : slide.enterLeft;
  const pushExit  = dir === 1  ? slide.exitLeft   : slide.exitRight;
  const showFab   = !chatModal.isOpen && !inboxOpen && !sidebarOpen;

  // ── Splash while checking localStorage ────────────────────────────────────
  if (authState === null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "100vh", background: "#06030f" }}>
        <motion.div animate={{ rotate: 360 }}
          transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
          style={{ width: 28, height: 28, borderRadius: "50%",
            border: "3px solid #7c3aed", borderTopColor: "transparent" }} />
      </div>
    );
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  const isAuthed = authState === "guest" || (authState && authState !== false);

  if (!isAuthed) {
    return (
      <PhoneShell>
        <AuthScreen
          onAuth={handleAuth}
          onGuest={() => setAuthState("guest")}
        />
      </PhoneShell>
    );
  }

  // ── Employer view ──────────────────────────────────────────────────────────
  const employerView = (
    <motion.div key="employer" style={{ position: "absolute", inset: 0 }}
      initial={slideUp.enter} animate={slideUp.center} exit={slideUp.exit} transition={txUp}>
      <EmployerDashboard
        onOpenCreate={handleOpenCreate}
        onApproveWorker={approveWorker}
        onRejectWorker={rejectWorker}
        approvedWorkerIds={approvedWorkerIds}
        rejectedWorkerIds={rejectedWorkerIds}
        onOpenProfile={openProfile}
        onOpenChat={(contract) => openChat(contract, "employer")}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
    </motion.div>
  );

  // ── Worker view ────────────────────────────────────────────────────────────
  const workerView = (
    <>
      {screen === "feed" && (
        <motion.div key="feed" style={{ position: "absolute", inset: 0 }}
          initial={pushEnter} animate={slide.center} exit={pushExit} transition={tx}>
          {jobsStatus === "loading" ? (
            <div style={{ width: "100%", height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center", background: "#06030f" }}>
              <motion.div animate={{ rotate: 360 }}
                transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
                style={{ width: 32, height: 32, borderRadius: "50%",
                  border: "3px solid #7c3aed", borderTopColor: "transparent" }} />
            </div>
          ) : (
            <JestaJobsFeed jobs={jobs} onJobSelect={goToDetails} onApply={goToPending}
              onOpenSidebar={() => setSidebarOpen(true)} onOpenProfile={openProfile} />
          )}
        </motion.div>
      )}
      {screen === "details" && (
        <motion.div key="details" style={{ position: "absolute", inset: 0 }}
          initial={dir === 1 ? slide.enterLeft : slide.enterRight}
          animate={slide.center}
          exit={dir === -1 ? slide.exitRight : slide.exitLeft}
          transition={tx}>
          <JestaJobDetails job={selected} onBack={goBack}
            onApply={goToPending} onOpenProfile={openProfile} />
        </motion.div>
      )}
      {screen === "pending" && (
        <motion.div key="pending" style={{ position: "absolute", inset: 0 }}
          initial={slide.enterLeft} animate={slide.center} exit={slide.exitRight} transition={tx}>
          <JestaPending job={selected} onBack={goBack} />
        </motion.div>
      )}
      {screen === "schedule" && (
        <motion.div key="schedule" style={{ position: "absolute", inset: 0 }}
          initial={slideUp.enter} animate={slideUp.center} exit={slideUp.exit} transition={txUp}>
          <JestaSchedule
            onBack={goBack}
            isApproved={cinemaApproved}
            onLocalApprove={() => approveWorker("w-1")}
            onOpenChat={(contract) => openChat(contract, "worker")}
          />
        </motion.div>
      )}
    </>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <PhoneShell>
      <AnimatePresence mode="wait" initial={false}>
        {mode === "employer" ? employerView : workerView}
      </AnimatePresence>

      {/* Floating Chat FAB */}
      <AnimatePresence>
        {showFab && (
          <motion.div key="chat-fab"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{ position: "absolute", bottom: 28, left: 18, zIndex: 6000 }}>
            {TOTAL_UNREAD > 0 && (
              <motion.div
                animate={{ scale: [1, 1.55, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ position: "absolute", inset: 0, borderRadius: "50%",
                  background: "linear-gradient(135deg,#9333ea,#ec4899)", pointerEvents: "none" }} />
            )}
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => isGuest ? setGuestModal(true) : setInboxOpen(true)}
              style={{
                width: 52, height: 52, borderRadius: "50%", border: "none",
                background: "linear-gradient(135deg,#9333ea,#ec4899)",
                boxShadow: "0 6px 20px rgba(147,51,234,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative",
              }}>
              <MessageCircle size={22} color="#fff" strokeWidth={2} />
              {TOTAL_UNREAD > 0 && (
                <div style={{ position: "absolute", top: -3, right: -3,
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: "#fff", border: "2px solid #9333ea",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 900, color: "#9333ea",
                  fontFamily: "'Heebo',system-ui,sans-serif" }}>
                  {TOTAL_UNREAD}
                </div>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <JestaSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onGoToSchedule={() => { switchMode("worker"); goToSchedule(); }}
        onOpenCreateModal={handleOpenCreate}
        onGoToEmployerDashboard={() => withAuth(() => switchMode("employer"))()}
        onSwitchMode={switchMode}
        onOpenProfile={openProfile}
        onSignOut={handleSignOut}
        isGuest={isGuest}
        user={authState?.user ?? null}
        mode={mode}
        onOpenProfileSettings={() => { setSidebarOpen(false); setProfileSettingsOpen(true); }}
      />

      <JestaCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onPublish={handlePublish}
      />

      <JestaPublicProfile
        isOpen={profileModal.isOpen}
        onClose={closeProfile}
        type={profileModal.type}
        userData={profileModal.data}
      />

      <JestaChatInbox
        isOpen={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onOpenChat={openChatFromInbox}
        viewerRole={mode === "employer" ? "employer" : "worker"}
      />

      <JestaChat
        isOpen={chatModal.isOpen}
        onClose={closeChat}
        contract={chatModal.contract}
        viewerRole={chatModal.viewerRole}
      />

      {/* Guest prompt modal — rendered above everything */}
      <GuestPromptModal
        isOpen={guestModal}
        onClose={() => setGuestModal(false)}
        onSignUp={() => { setGuestModal(false); setAuthState(false); }}
      />

      {/* Profile settings — full-screen slide-over */}
      <AnimatePresence>
        {profileSettingsOpen && (
          <motion.div key="profile-settings"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "tween", ease: [0.32, 0, 0.1, 1], duration: 0.38 }}
            style={{ position: "absolute", inset: 0, zIndex: 9000 }}>
            <JestaProfileSettings
              user={authState?.user ?? null}
              onBack={() => setProfileSettingsOpen(false)}
              onUserUpdate={handleUserUpdate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email verified / invalid banner */}
      <AnimatePresence>
        {verifiedBanner && (
          <motion.div key="verified-banner"
            initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              zIndex: 9999, whiteSpace: "nowrap",
              background: verifiedBanner === "success"
                ? "linear-gradient(135deg,#4ade80,#16a34a)"
                : "rgba(239,68,68,0.92)",
              color: "#fff", fontSize: 13, fontWeight: 800,
              padding: "10px 20px", borderRadius: 50,
              boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
              fontFamily: "'Heebo',system-ui,sans-serif",
            }}>
            {verifiedBanner === "success"
              ? "✅ המייל אומת בהצלחה!"
              : verifiedBanner === "expired"
              ? "⏰ קישור האימות פג תוקף"
              : "❌ קישור אימות לא תקין"}
          </motion.div>
        )}
      </AnimatePresence>
    </PhoneShell>
  );
}
