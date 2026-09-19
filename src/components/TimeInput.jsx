import React from "react";

// A native <input type="time"> renders in the device's own locale, which on many
// phones (especially iOS) means 12-hour AM/PM regardless of what the page does.
// This forces 24-hour display everywhere, on every device, by owning the option labels.
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export default function TimeInput({ value, onChange, "aria-label": ariaLabel, disabled, required, className = "input", style }) {
  const [h = "", m = ""] = String(value || "").split(":");
  const emit = (nextH, nextM) => onChange({ target: { value: nextH && nextM ? `${nextH}:${nextM}` : "" } });
  return (
    <span className="time-select">
      <select aria-label={ariaLabel ? `${ariaLabel} — soat` : undefined} className={className} style={style} disabled={disabled} required={required}
        value={h} onChange={e => emit(e.target.value, m || "00")}>
        <option value="" disabled={required}>--</option>
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span aria-hidden="true" className="time-select-sep">:</span>
      <select aria-label={ariaLabel ? `${ariaLabel} — daqiqa` : undefined} className={className} style={style} disabled={disabled} required={required}
        value={m} onChange={e => emit(h || "00", e.target.value)}>
        <option value="" disabled={required}>--</option>
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </span>
  );
}
