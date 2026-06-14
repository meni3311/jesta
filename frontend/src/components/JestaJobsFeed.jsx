/**
 * JestaJobsFeed — Full-screen map + draggable bottom sheet + advanced filters
 *
 * Interaction model:
 *   • Map pin tap   → navigate directly to JestaJobDetails (same as card tap)
 *   • Card tap      → navigate to full JestaJobDetails screen (onJobSelect)
 *   • Apply button  → lives only in JestaJobDetails
 *
 * Filter chain: keyword → radius (Haversine) → minWage → minRating
 *
 * Props:
 *   jobs            Job[]
 *   onJobSelect(job) card tap / pin tap → Details
 *   onApply(job)     kept in signature for Details screen usage
 *   onOpenSidebar()  avatar tap → Sidebar
 *   onOpenProfile()  employer name tap → PublicProfile
 */
import {
  useState, useRef, useEffect, useMemo, useCallback,
} from "react";
import {
  motion, AnimatePresence, useMotionValue, animate,
} from "framer-motion";
import {
  Clock, MapPin, CheckCircle2, Zap, Search, SearchX,
  SlidersHorizontal, Star, X as IconX, ChevronLeft, Briefcase, Banknote,
} from "lucide-react";
import { color, radius, shadow, font, styles } from "../design-system";
import { Avatar, Badge, EmptyState as DSEmptyState, SheetHandle, EmergencyBadge, BellButton } from "./ui";

// ─── Constants ────────────────────────────────────────────────────────────────
const SNAP       = { OPEN: 150, PEEK: 490, MIN: 690 };
const MAP_CENTER = [32.030, 34.800];
const MAP_ZOOM   = 11;
// TODO: replace with navigator.geolocation (with user permission) — for now
// the radius filter measures from a fixed central point in Gush Dan.
const USER_LAT   = 32.0608;
const USER_LNG   = 34.7874;

const FILTER_DEFAULTS = { radius: 50, minWage: 40, minRating: 0, keyword: "" };

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Leaflet price icon ───────────────────────────────────────────────────────
function createPriceIcon(pay, isActive, isNew = false, isEmergency = false) {
  let bg     = isActive ? color.primaryHover : color.surface2;
  let text   = isActive ? "#ffffff" : color.textPrimary;
  let border = isActive ? color.primary : color.borderStrong;
  let boxShadow = isActive
    ? "0 0 20px rgba(124,58,237,0.45), 0 4px 12px rgba(0,0,0,0.5)"
    : "0 2px 8px rgba(0,0,0,0.5)";
  // Emergency pins (System 1): red-bordered + glow so they pop on the map
  if (isEmergency) {
    border    = color.danger;
    text      = isActive ? "#ffffff" : color.danger;
    boxShadow = "0 0 18px rgba(248,113,113,0.5), 0 4px 12px rgba(0,0,0,0.5)";
    if (isActive) bg = "#b91c1c";
  }
  const newAnim = isNew
    ? "@keyframes jp{0%{transform:scale(0) translateY(-12px);opacity:0}60%{transform:scale(1.15) translateY(2px);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}"
    : "";
  const newStyle = isNew ? "animation:jp .55s cubic-bezier(.34,1.56,.64,1) both;" : "";
  return window.L.divIcon({
    className: "",
    iconSize: [56, 46], iconAnchor: [28, 46],
    html: `<style>${newAnim}</style>
      <div style="background:${bg};color:${text};
        font-family:${font.family};font-size:13px;font-weight:700;
        padding:6px 12px;border-radius:${radius.button}px;
        border:1px solid ${border};
        white-space:nowrap;box-shadow:${boxShadow};
        display:inline-block;letter-spacing:-0.02em;
        transform:${isActive ? "scale(1.08)" : "scale(1)"};
        transition:transform .2s;position:relative;${newStyle}">
        ${pay}
        <div style="position:absolute;bottom:-8px;left:50%;
          transform:translateX(-50%);width:0;height:0;
          border-left:6px solid transparent;border-right:6px solid transparent;
          border-top:8px solid ${isActive ? color.primaryHover : color.surface2};"></div>
      </div>`,
  });
}

// ─── Live Leaflet map ─────────────────────────────────────────────────────────
function LiveMap({ jobs, activePin, onPinClick, visibleJobIds }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});

  useEffect(() => {
    if (!containerRef.current || !window.L || mapRef.current) return;
    const L = window.L;
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
    const map = L.map(containerRef.current, {
      center: MAP_CENTER, zoom: MAP_ZOOM,
      scrollWheelZoom: false, zoomControl: false, attributionControl: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);
    L.circleMarker([USER_LAT, USER_LNG], { radius: 8,  fillColor: "#60a5fa", color: "#fff", weight: 2.5, fillOpacity: 1 }).addTo(map);
    L.circleMarker([USER_LAT, USER_LNG], { radius: 16, fillColor: "#3b82f6", color: "transparent", fillOpacity: 0.18 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markersRef.current = {}; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    jobs.forEach((job) => {
      if (markersRef.current[job.id]) return;
      const marker = window.L.marker([job.lat, job.lng], {
        icon: createPriceIcon(job.pay, activePin === job.id, !!job.isNew, !!job.isEmergency),
        ...(job.isEmergency && { zIndexOffset: 1000 }),   // emergency pins on top
      }).addTo(mapRef.current);
      marker.on("click", () => onPinClick(job));
      markersRef.current[job.id] = marker;
      if (job.isNew) mapRef.current.flyTo([job.lat, job.lng], 14, { animate: true, duration: 1.1 });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  useEffect(() => {
    jobs.forEach((job) => {
      markersRef.current[job.id]?.setIcon(
        createPriceIcon(job.pay, activePin === job.id, false, !!job.isEmergency),
      );
    });
    if (activePin && mapRef.current) {
      const a = jobs.find((j) => j.id === activePin);
      if (a) mapRef.current.panTo([a.lat, a.lng], { animate: true, duration: 0.6 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePin]);

  useEffect(() => {
    if (!mapRef.current) return;
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      marker.setOpacity(visibleJobIds.has(Number(id)) ? 1 : 0.15);
    });
  }, [visibleJobIds]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0, background: color.bg }} />
  );
}

// ─── Filter panels (float over map tiles) ─────────────────────────────────────
const PANEL_STYLE = {
  background: "rgba(19,19,26,0.96)",   // surface-1 @ 96%
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.card,
  padding: "16px",
  boxShadow: shadow.card,
};

function SliderRow({ value, min, max, step, onChange, formatLabel }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: color.textMuted, fontWeight: 500 }}>
          {min === 0 ? "ללא הגבלה" : formatLabel(min)}
        </span>
        <motion.span key={value} initial={{ scale: 1.15 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          style={{ fontSize: 15, fontWeight: 700, color: color.primaryText }}>
          {formatLabel(value)}
        </motion.span>
        <span style={{ fontSize: 12, color: color.textMuted, fontWeight: 500 }}>
          {formatLabel(max)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color.primary, height: 4 }} />
    </div>
  );
}

function PanelLabel({ icon: Icon, children }) {
  return (
    <div style={{ ...font.overline, display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: color.textSecondary }}>
      <Icon size={13} color={color.primaryText} strokeWidth={2} />
      {children}
    </div>
  );
}

function RadiusPanel({ value, onChange }) {
  return (
    <div>
      <PanelLabel icon={MapPin}>רדיוס חיפוש מהמיקום שלי</PanelLabel>
      <SliderRow value={value} min={1} max={50} step={1} onChange={onChange} formatLabel={(v) => `${v} ק״מ`} />
      <div style={{ fontSize: 11, color: color.textMuted, marginTop: 8, fontWeight: 500 }}>מציג ג׳סטות עד {value} ק״מ מהמיקום שלך</div>
    </div>
  );
}

function WagePanel({ value, onChange }) {
  return (
    <div>
      <PanelLabel icon={Banknote}>שכר מינימלי לשעה</PanelLabel>
      <SliderRow value={value} min={30} max={120} step={5} onChange={onChange} formatLabel={(v) => v >= 120 ? "₪120+" : `₪${v}`} />
      <div style={{ fontSize: 11, color: color.textMuted, marginTop: 8, fontWeight: 500 }}>
        {value >= 120 ? "מציג את כל הג׳סטות" : `מציג ג׳סטות עם שכר של ₪${value}+ לשעה`}
      </div>
    </div>
  );
}

function RatingPanel({ value, onChange }) {
  return (
    <div>
      <PanelLabel icon={Star}>דירוג מעסיק מינימלי</PanelLabel>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button key={star} whileTap={{ scale: 0.85 }}
            onClick={() => onChange(value === star ? 0 : star)}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, lineHeight: 1, display: "flex" }}>
            <Star size={26} strokeWidth={1.5}
              fill={star <= value ? color.warning : "transparent"}
              color={star <= value ? color.warning : color.textMuted} />
          </motion.button>
        ))}
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: color.textSecondary, marginTop: 12, fontWeight: 500 }}>
        {value === 0 ? "כל הדירוגים" : `${value} כוכבים ומעלה`}
      </div>
    </div>
  );
}

function FilterPill({ icon: Icon, label, isModified, isOpen, onClick }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick}
      style={{
        flexShrink: 0, padding: "8px 12px", borderRadius: radius.chip,
        background: isOpen ? color.surface3 : "rgba(19,19,26,0.9)",
        color: isOpen || isModified ? color.primaryText : color.textSecondary,
        fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: font.family, whiteSpace: "nowrap",
        border: `1px solid ${isOpen || isModified ? color.primary : color.borderStrong}`,
        display: "flex", alignItems: "center", gap: 4,
        transition: "background 0.2s, border-color 0.2s, color 0.2s",
      }}>
      <Icon size={13} strokeWidth={2} />
      {label}
      {isModified && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          style={{ width: 6, height: 6, borderRadius: "50%", background: color.primary, marginInlineStart: 2 }} />
      )}
    </motion.button>
  );
}

// ─── Job preview card — full card tappable, no apply button ───────────────────
function JobCard({ job, isActive, onJobSelect, onViewEmployer }) {
  return (
    <motion.div
      whileTap={{ scale: 0.985 }}
      onClick={() => onJobSelect(job)}
      style={{
        ...styles.card,
        cursor: "pointer",
        borderColor: job.isEmergency
          ? "rgba(248,113,113,0.45)"
          : isActive ? color.primary : color.borderSubtle,
        padding: 16,
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.18s, background 0.18s",
      }}
    >
      {/* Active accent — 3px solid primary on the leading edge */}
      {isActive && (
        <div style={{ position: "absolute", top: 0, insetInlineStart: 0, width: 3, height: "100%",
          background: job.isEmergency ? color.danger : color.primary }} />
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Employer + pay */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <motion.div whileTap={{ scale: 0.95 }}
              onClick={(e) => { e.stopPropagation(); onViewEmployer?.(); }}
              style={{ ...font.overline, color: color.primaryText, cursor: "pointer" }}>
              {job.employer}
            </motion.div>
            <div style={{ textAlign: "left", flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: color.textPrimary, lineHeight: 1 }}>
                {job.pay}
                <span style={{ fontSize: 11, fontWeight: 400, color: color.textSecondary }}> / שעה</span>
              </div>
              {/* Emergency wage breakdown (System 1): original + bonus */}
              {job.isEmergency && job.basePay != null && (
                <div style={{ fontSize: 10, color: color.danger, fontWeight: 600, marginTop: 3 }}>
                  ₪{job.basePay} + 20% בונוס חירום
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div style={{ fontSize: 16, ...font.heading, lineHeight: 1.3, marginBottom: 8 }}>
            {job.title}
          </div>

          {/* Emergency badge (System 1) — styled component, pinned jobs */}
          {job.isEmergency && (
            <div style={{ marginBottom: 8 }}><EmergencyBadge size="sm" /></div>
          )}

          {/* New badge */}
          {job.isNew && (
            <Badge variant="approved" style={{ marginBottom: 8 }}>ג׳סטה חדשה</Badge>
          )}

          {/* Rating */}
          {job.employerRating ? (
            <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 8 }}>
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={10} strokeWidth={1.5}
                  fill={s <= Math.round(job.employerRating) ? color.warning : "transparent"}
                  color={s <= Math.round(job.employerRating) ? color.warning : color.textMuted} />
              ))}
              <span style={{ fontSize: 11, color: color.textSecondary, fontWeight: 500, marginInlineStart: 4 }}>{job.employerRating}</span>
            </div>
          ) : null}

          {/* Meta */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: color.textSecondary, fontWeight: 400 }}>
              <Clock size={12} color={color.textMuted} strokeWidth={2} /> {job.time}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: color.textSecondary, fontWeight: 400 }}>
              <MapPin size={12} color={color.textMuted} strokeWidth={2} /> {job.dist}
            </div>
          </div>

          {/* Perks */}
          {job.perks?.length > 0 && (
            <div style={{ display: "flex", gap: 12 }}>
              {job.perks.slice(0, 2).map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: color.textSecondary, fontWeight: 400 }}>
                  <CheckCircle2 size={11} color={color.success} strokeWidth={2} /> {p}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trailing icon container — 32×32, surface-2, radius 8 */}
        <div style={styles.iconBox(32)}>
          <Briefcase size={16} color={color.primaryText} strokeWidth={1.75} />
        </div>
      </div>

      {/* Tap-to-view hint */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${color.borderSubtle}` }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: color.primaryText }}>לפרטים מלאים</span>
        <ChevronLeft size={13} color={color.primaryText} strokeWidth={2} />
      </div>
    </motion.div>
  );
}

// ─── Draggable bottom sheet ───────────────────────────────────────────────────
function BottomSheet({ filteredJobs, allCount, activePin, onJobSelect, cardRefs, onOpenProfile, onResetFilters, onRegisterSnap }) {
  const y = useMotionValue(SNAP.PEEK);

  const snapTo = useCallback((target) => {
    animate(y, target, { type: "spring", stiffness: 320, damping: 34, mass: 0.85 });
  }, [y]);

  useEffect(() => {
    onRegisterSnap?.(() => snapTo(SNAP.PEEK));
  }, [snapTo, onRegisterSnap]);

  const handleDragEnd = (_, { velocity }) => {
    const cur = y.get();
    if (velocity.y < -300) { snapTo(SNAP.OPEN); return; }
    if (velocity.y >  300) { snapTo(cur > 590 ? SNAP.MIN : SNAP.PEEK); return; }
    const nearest = [SNAP.OPEN, SNAP.PEEK, SNAP.MIN].reduce((a, b) => Math.abs(b - cur) < Math.abs(a - cur) ? b : a);
    snapTo(nearest);
  };

  const isEmpty = filteredJobs.length === 0;

  return (
    <motion.div
      style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "100%",
        y, zIndex: 800,
        ...styles.sheet,
        display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "none",
      }}
      drag="y"
      dragConstraints={{ top: SNAP.OPEN, bottom: SNAP.MIN }}
      dragElastic={{ top: 0.06, bottom: 0.06 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      {/* Drag handle */}
      <div style={{ cursor: "grab", flexShrink: 0 }}
        onPointerDown={(e) => e.stopPropagation()}>
        <SheetHandle />
      </div>

      {/* Header */}
      <div style={{ padding: "4px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 15, ...font.heading }}>גיגים קרובים אליך</div>
        <Badge variant={isEmpty ? "locked" : "primary"}>
          {isEmpty ? "אין תוצאות" : `${filteredJobs.length} מתוך ${allCount}`}
        </Badge>
      </div>

      {/* Cards */}
      <div
        style={{ flex: 1, overflowY: "auto", padding: isEmpty ? "8px 20px 24px" : "0 16px 24px",
          display: "flex", flexDirection: "column", gap: isEmpty ? 0 : 12 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {isEmpty ? (
          <DSEmptyState
            icon={SearchX}
            title="אין ג׳סטות שעונות על הסינון"
            subtitle="נסה להרחיב את הרדיוס, להוריד את שכר המינימום או לאפס את הסינון"
            action={onResetFilters}
            actionLabel="אפס סינונים"
          />
        ) : (
          <AnimatePresence>
            {filteredJobs.map((job) => (
              <motion.div key={job.id} layout
                initial={job.isNew ? { opacity: 0, y: -18, scale: 0.96 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                ref={(el) => { if (cardRefs) cardRefs.current[job.id] = el; }}
              >
                <JobCard
                  job={job}
                  isActive={activePin === job.id}
                  onJobSelect={onJobSelect}
                  onViewEmployer={() => onOpenProfile?.("employer", { name: job.employer })}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
const FILTER_DEFS = [
  { key: "radius",    icon: MapPin,   label: (f) => `${f.radius} ק״מ`, isModified: (f) => f.radius < 50 },
  { key: "minWage",   icon: Banknote, label: (f) => `₪${f.minWage}+`,  isModified: (f) => f.minWage > 40 },
  { key: "minRating", icon: Star,     label: (f) => f.minRating > 0 ? `${f.minRating} כוכבים` : "כל דירוג", isModified: (f) => f.minRating > 0 },
];

function FiltersBar({ filters, setFilters }) {
  const [openFilter, setOpenFilter] = useState(null);
  const toggleFilter = (key) => setOpenFilter((prev) => (prev === key ? null : key));
  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const hasAnyModified = FILTER_DEFS.some(({ isModified }) => isModified(filters));

  return (
    <div style={{ pointerEvents: "auto" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, paddingBottom: 4 }}>
        {FILTER_DEFS.map(({ key, icon, label, isModified }) => (
          <FilterPill key={key} icon={icon} label={label(filters)} isModified={isModified(filters)}
            isOpen={openFilter === key} onClick={() => toggleFilter(key)} />
        ))}
        {hasAnyModified && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setFilters(FILTER_DEFAULTS); setOpenFilter(null); }}
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
              border: `1px solid ${color.borderStrong}`, background: "rgba(19,19,26,0.9)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconX size={13} color={color.textSecondary} strokeWidth={2} />
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {openFilter && (
          <motion.div key={openFilter}
            initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            style={{ ...PANEL_STYLE, marginTop: 8, position: "relative" }}>
            {openFilter === "radius"    && <RadiusPanel value={filters.radius}    onChange={(v) => updateFilter("radius", v)} />}
            {openFilter === "minWage"   && <WagePanel   value={filters.minWage}   onChange={(v) => updateFilter("minWage", v)} />}
            {openFilter === "minRating" && <RatingPanel value={filters.minRating} onChange={(v) => updateFilter("minRating", v)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main feed ────────────────────────────────────────────────────────────────
export default function JestaJobsFeed({
  jobs = [], onJobSelect, onApply, onOpenSidebar, onOpenProfile,
  unreadCount = 0, onOpenNotifications,
}) {
  const [activePin, setActivePin] = useState(jobs[0]?.id ?? 1);
  const [filters, setFilters]     = useState(FILTER_DEFAULTS);
  const cardRefs                  = useRef({});
  const snapSheetToPeekRef        = useRef(null);

  const filteredJobs = useMemo(() => {
    const kw = filters.keyword.toLowerCase().trim();
    const visible = jobs.filter((job) => {
      if (kw && !job.title.toLowerCase().includes(kw) && !job.employer.toLowerCase().includes(kw)) return false;
      if (haversine(USER_LAT, USER_LNG, job.lat, job.lng) > filters.radius) return false;
      if (job.payRaw < filters.minWage) return false;
      if ((job.employerRating ?? 5) < filters.minRating) return false;
      return true;
    });
    // Feed priority (System 1): emergency gestas pinned first (newest first),
    // then the rest in the order the backend sent (distance / recency).
    const emergency = visible.filter((j) => j.isEmergency)
      .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
    const regular = visible.filter((j) => !j.isEmergency);
    return [...emergency, ...regular];
  }, [jobs, filters]);

  const visibleJobIds = useMemo(() => new Set(filteredJobs.map((j) => j.id)), [filteredJobs]);

  // Pin tap → navigate to details (same as card tap)
  const handlePinClick = useCallback((job) => {
    setActivePin(job.id);
    onJobSelect(job);
  }, [onJobSelect]);

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: font.family,
        position: "relative", width: "100%", height: "100%", overflow: "hidden",
        background: color.bg,
      }}
    >
      <LiveMap jobs={jobs} activePin={activePin} onPinClick={handlePinClick} visibleJobIds={visibleJobIds} />

      {/* Floating header over map */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          zIndex: 1000, padding: "36px 16px 16px",
          background: "linear-gradient(to bottom, rgba(10,10,15,0.92) 0%, rgba(10,10,15,0.6) 72%, transparent 100%)",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, pointerEvents: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 24, ...font.heading }}>גסטה</span>
            <Zap size={16} color={color.primaryText} strokeWidth={2} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Notification bell (System 3) */}
            {onOpenNotifications && (
              <BellButton unreadCount={unreadCount} onClick={onOpenNotifications} />
            )}
            <Avatar size={36} online onClick={onOpenSidebar} surface={color.bg} />
          </div>
        </div>

        <div style={{ pointerEvents: "auto" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(19,19,26,0.94)",
            border: `1px solid ${color.borderStrong}`, borderRadius: radius.input, padding: "12px 16px",
            boxShadow: shadow.card,
          }}>
            <Search size={15} color={color.textMuted} strokeWidth={2} />
            <input
              type="text" value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="חפש עבודה או מעסיק..." dir="rtl"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: color.textPrimary, fontWeight: 400, fontFamily: "inherit", caretColor: color.primaryText }}
            />
            {filters.keyword && (
              <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.88 }}
                onClick={() => setFilters((f) => ({ ...f, keyword: "" }))}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <IconX size={14} color={color.textSecondary} strokeWidth={2} />
              </motion.button>
            )}
            <div style={{ width: 1, height: 16, background: color.borderStrong }} />
            <SlidersHorizontal size={14} color={color.primaryText} strokeWidth={2} />
          </div>
          <FiltersBar filters={filters} setFilters={setFilters} />
        </div>
      </div>

      <BottomSheet
        filteredJobs={filteredJobs}
        allCount={jobs.length}
        activePin={activePin}
        onJobSelect={onJobSelect}
        cardRefs={cardRefs}
        onOpenProfile={onOpenProfile}
        onResetFilters={() => setFilters(FILTER_DEFAULTS)}
        onRegisterSnap={(fn) => { snapSheetToPeekRef.current = fn; }}
      />
    </div>
  );
}
