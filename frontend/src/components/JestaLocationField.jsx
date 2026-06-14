/**
 * JestaLocationField — address autocomplete + "use my current location"
 *
 * Returns BOTH a human-readable address AND lat/lng coordinates via onChange,
 * so jobs are stored with real coordinates and map pins land in the right place.
 *
 * Providers:
 *   1. Google Places Autocomplete + Geocoder — used when a key is configured.
 *      // REQUIRES: GOOGLE_MAPS_API_KEY in .env
 *      (frontend env name: VITE_GOOGLE_MAPS_API_KEY — see frontend/.env)
 *   2. OpenStreetMap Nominatim — automatic keyless fallback so the feature
 *      still works end-to-end in development without a Google key.
 *
 * Props:
 *   value     { address, lat, lng }
 *   onChange  fn({ address, lat, lng })  — lat/lng are null until the user
 *             picks a suggestion or uses the current-location button
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, LocateFixed, Loader2, AlertCircle } from "lucide-react";
import { color, radius, font, styles } from "../design-system";

// REQUIRES: GOOGLE_MAPS_API_KEY in .env  →  exposed to Vite as VITE_GOOGLE_MAPS_API_KEY
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const NOMINATIM = "https://nominatim.openstreetmap.org";

// ── Google Maps JS API loader (script injected once) ──────────────────────────
let googlePromise = null;
function loadGoogle() {
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (googlePromise) return googlePromise;
  googlePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places&language=he&region=IL`;
    s.async = true;
    s.onload  = () => resolve(window.google);
    s.onerror = () => { googlePromise = null; reject(new Error("Google Maps script failed to load")); };
    document.head.appendChild(s);
  });
  return googlePromise;
}

// ── Provider-agnostic helpers ─────────────────────────────────────────────────

/** Autocomplete suggestions: [{ id, label, lat?, lng?, placeId? }] */
async function fetchSuggestions(query) {
  if (GOOGLE_KEY) {
    const google = await loadGoogle();
    const svc = new google.maps.places.AutocompleteService();
    const predictions = await new Promise((resolve) =>
      svc.getPlacePredictions(
        { input: query, componentRestrictions: { country: "il" } },
        (res, status) =>
          resolve(status === google.maps.places.PlacesServiceStatus.OK ? (res ?? []) : []),
      ),
    );
    return predictions.map((p) => ({ id: p.place_id, label: p.description, placeId: p.place_id }));
  }
  // Nominatim fallback (no key required)
  const res = await fetch(
    `${NOMINATIM}/search?format=json&limit=5&countrycodes=il&accept-language=he&q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Nominatim search failed (${res.status})`);
  const rows = await res.json();
  return rows.map((r) => ({
    id: String(r.place_id), label: r.display_name,
    lat: parseFloat(r.lat), lng: parseFloat(r.lon),
  }));
}

/** Resolve a suggestion to coordinates (Google needs a geocode round-trip) */
async function resolveSuggestion(sug) {
  if (sug.lat != null && sug.lng != null) return { address: sug.label, lat: sug.lat, lng: sug.lng };
  const google = await loadGoogle();
  const geocoder = new google.maps.Geocoder();
  const { results } = await geocoder.geocode({ placeId: sug.placeId });
  if (!results?.[0]) throw new Error("Place could not be geocoded");
  const loc = results[0].geometry.location;
  return { address: sug.label, lat: loc.lat(), lng: loc.lng() };
}

/** Forward-geocode free text → { address, lat, lng } | null */
export async function geocodeAddress(text) {
  try {
    if (GOOGLE_KEY) {
      const google = await loadGoogle();
      const geocoder = new google.maps.Geocoder();
      const { results } = await geocoder.geocode({ address: text, region: "il" });
      if (!results?.[0]) return null;
      const loc = results[0].geometry.location;
      return { address: results[0].formatted_address ?? text, lat: loc.lat(), lng: loc.lng() };
    }
    const res = await fetch(
      `${NOMINATIM}/search?format=json&limit=1&countrycodes=il&accept-language=he&q=${encodeURIComponent(text)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows[0]) return null;
    return { address: text, lat: parseFloat(rows[0].lat), lng: parseFloat(rows[0].lon) };
  } catch {
    return null;
  }
}

/** Reverse-geocode coordinates → readable address (falls back to "lat, lng") */
async function reverseGeocode(lat, lng) {
  try {
    if (GOOGLE_KEY) {
      const google = await loadGoogle();
      const geocoder = new google.maps.Geocoder();
      const { results } = await geocoder.geocode({ location: { lat, lng } });
      if (results?.[0]?.formatted_address) return results[0].formatted_address;
    } else {
      const res = await fetch(
        `${NOMINATIM}/reverse?format=json&accept-language=he&lat=${lat}&lon=${lng}`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const row = await res.json();
        if (row?.display_name) return row.display_name;
      }
    }
  } catch { /* fall through to coordinate string */ }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const inputStyle = { ...styles.input, direction: "rtl" };

export default function JestaLocationField({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open,        setOpen]        = useState(false);
  const [searching,   setSearching]   = useState(false);
  const [locating,    setLocating]    = useState(false);
  const [error,       setError]       = useState(null);
  const debounceRef = useRef(null);
  const seqRef      = useRef(0);      // guards against out-of-order responses

  const address = value?.address ?? "";
  const hasCoords = value?.lat != null && value?.lng != null;

  // Debounced autocomplete
  const handleInput = (text) => {
    // Typing invalidates previously selected coordinates
    onChange?.({ address: text, lat: null, lng: null });
    setError(null);
    clearTimeout(debounceRef.current);
    if (text.trim().length < 3) { setSuggestions([]); setOpen(false); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      try {
        const sugs = await fetchSuggestions(text.trim());
        if (seq !== seqRef.current) return;   // stale response
        setSuggestions(sugs);
        setOpen(sugs.length > 0);
      } catch (err) {
        if (seq !== seqRef.current) return;
        console.warn("[Location] autocomplete failed:", err.message);
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, 350);
  };

  const handlePick = async (sug) => {
    setOpen(false);
    setError(null);
    try {
      const picked = await resolveSuggestion(sug);
      onChange?.(picked);
    } catch (err) {
      console.warn("[Location] geocode failed:", err.message);
      setError("לא הצלחנו לאתר את הכתובת הזו, נסו כתובת אחרת");
    }
  };

  // "Use my current location" — browser Geolocation API + reverse geocoding
  const handleUseMyLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("הדפדפן שלכם לא תומך באיתור מיקום");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        const addr = await reverseGeocode(lat, lng);
        onChange?.({ address: addr, lat, lng });
        setOpen(false);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "אין הרשאה למיקום — אפשרו גישה בהגדרות הדפדפן או הקלידו כתובת"
            : err.code === err.TIMEOUT
            ? "איתור המיקום לקח יותר מדי זמן, נסו שוב"
            : "לא הצלחנו לאתר את המיקום שלכם, הקלידו כתובת במקום",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div style={{ position: "relative" }}>
      {/* Input + inline status icon */}
      <div style={{ position: "relative" }}>
        <input
          style={{ ...inputStyle, paddingInlineEnd: 38 }}
          placeholder='לדוגמה: "קניון עזריאלי, תל אביב"'
          value={address}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={(e) => { e.target.style.borderColor = color.primary; if (suggestions.length) setOpen(true); }}
          onBlur={(e) => { e.target.style.borderColor = color.borderSubtle; setTimeout(() => setOpen(false), 180); }}
        />
        <div style={{ position: "absolute", top: "50%", insetInlineEnd: 12, transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
          {searching
            ? <Loader2 size={15} color={color.textMuted} style={{ animation: "spin 0.7s linear infinite" }} />
            : <MapPin size={15} color={hasCoords ? color.success : color.textMuted} strokeWidth={2} />}
        </div>
      </div>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            style={{ position: "absolute", top: "calc(100% + 6px)", insetInlineStart: 0, insetInlineEnd: 0, zIndex: 50,
              background: color.surface2, border: `1px solid ${color.borderStrong}`,
              borderRadius: radius.input, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.55)" }}>
            {suggestions.map((sug) => (
              <div key={sug.id}
                onMouseDown={(e) => { e.preventDefault(); handlePick(sug); }}
                style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px",
                  cursor: "pointer", borderBottom: `1px solid ${color.borderSubtle}`,
                  fontFamily: font.family }}
                onMouseEnter={(e) => (e.currentTarget.style.background = color.surface3)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <MapPin size={13} color={color.primaryText} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: color.textPrimary, fontWeight: 400, lineHeight: 1.5 }}>{sug.label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Use my current location */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={handleUseMyLocation} disabled={locating} type="button"
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10,
          background: "transparent", border: "none", cursor: locating ? "default" : "pointer",
          padding: 0, fontFamily: font.family }}>
        {locating
          ? <Loader2 size={14} color={color.primaryText} strokeWidth={2} style={{ animation: "spin 0.7s linear infinite" }} />
          : <LocateFixed size={14} color={color.primaryText} strokeWidth={2} />}
        <span style={{ fontSize: 12, fontWeight: 600, color: color.primaryText }}>
          {locating ? "מאתרים אתכם..." : "השתמשו במיקום הנוכחי שלי"}
        </span>
      </motion.button>

      {/* Coordinates confirmation / error */}
      {hasCoords && !error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <MapPin size={11} color={color.success} strokeWidth={2} />
          <span style={{ fontSize: 11, color: color.success, fontWeight: 500 }}>
            המיקום אותר — הסיכה תוצב במקום המדויק על המפה
          </span>
        </div>
      )}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <AlertCircle size={12} color={color.danger} strokeWidth={2} />
          <span style={{ fontSize: 11, color: color.danger, fontWeight: 500 }}>{error}</span>
        </div>
      )}
    </div>
  );
}
