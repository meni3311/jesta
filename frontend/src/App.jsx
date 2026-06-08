import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";

import { INITIAL_JOBS }    from "./components/JestaJobsFeed";
import JestaJobsFeed       from "./components/JestaJobsFeed";
import JestaJobDetails     from "./components/JestaJobDetails";
import JestaPending        from "./components/JestaPending";
import JestaSchedule       from "./components/JestaSchedule";
import EmployerDashboard   from "./components/EmployerDashboard";
import JestaSidebar        from "./components/JestaSidebar";
import JestaCreateModal    from "./components/JestaCreateModal";
import JestaPublicProfile  from "./components/JestaPublicProfile";
import JestaChat           from "./components/JestaChat";
import JestaChatInbox, { TOTAL_UNREAD } from "./components/JestaChatInbox";

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

export default function App() {
  // ── Jobs ───────────────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState(INITIAL_JOBS);

  // ── Mode: "worker" | "employer"  ──────────────────────────────────────────
  const [mode, setMode] = useState("worker");

  // ── Approval / rejection state ────────────────────────────────────────────
  const [approvedWorkerIds, setApprovedWorkerIds] = useState(new Set());
  const [rejectedWorkerIds, setRejectedWorkerIds] = useState(new Set());

  const approveWorker = (id) =>
    setApprovedWorkerIds(prev => new Set([...prev, id]));
  const rejectWorker  = (id) =>
    setRejectedWorkerIds(prev => new Set([...prev, id]));

  const cinemaApproved = approvedWorkerIds.has("w-1");

  // ── Worker screen routing ──────────────────────────────────────────────────
  // "feed" | "details" | "pending" | "schedule"
  const [screen,   setScreen]   = useState("feed");
  const [selected, setSelected] = useState(null);
  const [dir,      setDir]      = useState(1);

  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // ── Profile modal ──────────────────────────────────────────────────────────
  const [profileModal, setProfileModal] = useState({ isOpen: false, type: "worker", data: null });

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [chatModal, setChatModal] = useState({ isOpen: false, contract: null, viewerRole: "worker" });
  const [inboxOpen, setInboxOpen] = useState(false);

  const openChat  = (contract, viewerRole = "worker") =>
    setChatModal({ isOpen: true, contract, viewerRole });
  const closeChat = () => setChatModal(p => ({ ...p, isOpen: false }));
  const openChatFromInbox = (convo, viewerRole) =>
    setChatModal({ isOpen: true, contract: { ...convo }, viewerRole });

  const openProfile = (typeOrData, extraData = null) => {
    if (typeof typeOrData === "string") {
      setProfileModal({ isOpen: true, type: typeOrData, data: extraData });
    } else {
      setProfileModal({ isOpen: true, type: typeOrData?.type ?? "worker", data: typeOrData });
    }
  };
  const closeProfile = () => setProfileModal(p => ({ ...p, isOpen: false }));

  // ── Navigation (worker mode only) ─────────────────────────────────────────
  const goTo = (scr, job = null, direction = 1) => {
    setSelected(job); setDir(direction); setScreen(scr); setSidebarOpen(false);
  };
  const goToDetails   = (job) => goTo("details", job, 1);
  const goToPending   = (job) => goTo("pending", job, 1);
  const goToSchedule  = ()    => goTo("schedule", null, 1);
  const goBack        = ()    => goTo("feed", null, -1);

  // ── Mode switch ────────────────────────────────────────────────────────────
  const switchMode = (newMode) => {
    setMode(newMode);
    setSidebarOpen(false);
    if (newMode === "worker") setScreen("feed");
  };

  // ── Publish job ────────────────────────────────────────────────────────────
  const handlePublish = (newJob) => {
    setJobs(prev => [newJob, ...prev]);
    setCreateModalOpen(false);
  };
  const handleOpenCreate = () => {
    setSidebarOpen(false);
    setTimeout(() => setCreateModalOpen(true), 280);
  };

  const pushEnter = dir === -1 ? slide.enterRight : slide.enterLeft;
  const pushExit  = dir === 1  ? slide.exitLeft   : slide.exitRight;

  // FAB hidden when overlays are open
  const showFab = !chatModal.isOpen && !inboxOpen && !sidebarOpen;

  // ── Employer full-screen view ──────────────────────────────────────────────
  const employerView = (
    <motion.div
      key="employer"
      style={{ position: "absolute", inset: 0 }}
      initial={slideUp.enter}
      animate={slideUp.center}
      exit={slideUp.exit}
      transition={txUp}
    >
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

  // ── Worker screen views ────────────────────────────────────────────────────
  const workerView = (
    <>
      {screen === "feed" && (
        <motion.div key="feed" style={{ position: "absolute", inset: 0 }}
          initial={pushEnter} animate={slide.center} exit={pushExit} transition={tx}>
          <JestaJobsFeed jobs={jobs} onJobSelect={goToDetails} onApply={goToPending}
            onOpenSidebar={() => setSidebarOpen(true)} onOpenProfile={openProfile} />
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

        {/* ── Main screen area ── */}
        <AnimatePresence mode="wait" initial={false}>
          {mode === "employer" ? employerView : workerView}
        </AnimatePresence>

        {/* ── Floating Chat FAB ── */}
        <AnimatePresence>
          {showFab && (
            <motion.div
              key="chat-fab"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              style={{ position: "absolute", bottom: 28, left: 18, zIndex: 6000 }}
            >
              {TOTAL_UNREAD > 0 && (
                <motion.div
                  animate={{ scale: [1, 1.55, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "linear-gradient(135deg,#9333ea,#ec4899)",
                    pointerEvents: "none",
                  }}
                />
              )}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setInboxOpen(true)}
                style={{
                  width: 52, height: 52, borderRadius: "50%", border: "none",
                  background: "linear-gradient(135deg,#9333ea,#ec4899)",
                  boxShadow: "0 6px 20px rgba(147,51,234,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", position: "relative",
                }}
              >
                <MessageCircle size={22} color="#fff" strokeWidth={2} />
                {TOTAL_UNREAD > 0 && (
                  <div style={{
                    position: "absolute", top: -3, right: -3,
                    minWidth: 18, height: 18, borderRadius: 9,
                    background: "#fff", border: "2px solid #9333ea",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 900, color: "#9333ea",
                    fontFamily: "'Heebo',system-ui,sans-serif",
                  }}>
                    {TOTAL_UNREAD}
                  </div>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Sidebar ── */}
        <JestaSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onGoToSchedule={() => { switchMode("worker"); goToSchedule(); }}
          onOpenCreateModal={handleOpenCreate}
          onGoToEmployerDashboard={() => switchMode("employer")}
          onSwitchMode={switchMode}
          onOpenProfile={openProfile}
        />

        {/* ── Create modal ── */}
        <JestaCreateModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onPublish={handlePublish}
        />

        {/* ── Public profile ── */}
        <JestaPublicProfile
          isOpen={profileModal.isOpen}
          onClose={closeProfile}
          type={profileModal.type}
          userData={profileModal.data}
        />

        {/* ── Chat inbox ── */}
        <JestaChatInbox
          isOpen={inboxOpen}
          onClose={() => setInboxOpen(false)}
          onOpenChat={openChatFromInbox}
          viewerRole={mode === "employer" ? "employer" : "worker"}
        />

        {/* ── Chat overlay ── */}
        <JestaChat
          isOpen={chatModal.isOpen}
          onClose={closeChat}
          contract={chatModal.contract}
          viewerRole={chatModal.viewerRole}
        />

      </div>
    </div>
  );
}
