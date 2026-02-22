// src/components/WeekTimeBoxCalendar.jsx
import React, { useMemo } from "react";

const START_HOUR = 8;
const END_HOUR = 22;
const PX_PER_HOUR = 60; // adjust: 50-80 looks good

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function minutesSinceStartHour(date) {
  return (date.getHours() - START_HOUR) * 60 + date.getMinutes();
}

function blockStyle(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);

  // minutes from START_HOUR
  const startMin = minutesSinceStartHour(start);
  const endMin = minutesSinceStartHour(end);

  // clamp to visible range
  const minVisible = 0;
  const maxVisible = (END_HOUR - START_HOUR) * 60;

  const topMin = clamp(startMin, minVisible, maxVisible);
  const bottomMin = clamp(endMin, minVisible, maxVisible);

  const topPx = (topMin / 60) * PX_PER_HOUR;
  const heightPx = Math.max(18, ((bottomMin - topMin) / 60) * PX_PER_HOUR); // min height

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
  };
}

export default function WeekTimeBoxCalendar({
  anchorDate = new Date(),         // any date inside the week
  sessions = [],                   // study blocks
  events = [],                     // optional busy blocks
  onSelectBlock,                   // optional click handler
}) {
  const weekStart = useMemo(() => {
    // Sunday-start week (change if you want Monday-start)
    const d = startOfDay(anchorDate);
    const day = d.getDay(); // 0=Sun
    return addDays(d, -day);
  }, [anchorDate]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const hourLabels = useMemo(() => {
    const out = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) out.push(h);
    return out;
  }, []);

  // Group items by day
  const sessionsByDay = useMemo(() => {
    return days.map((day) =>
      sessions.filter((s) => sameDay(new Date(s.start), day))
    );
  }, [days, sessions]);

  const eventsByDay = useMemo(() => {
    return days.map((day) =>
      events.filter((e) => sameDay(new Date(e.start), day))
    );
  }, [days, events]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8 }}>
      {/* Left time column */}
      <div>
        <div style={{ height: 44 }} /> {/* spacer for header */}
        <div style={{ position: "relative", height: (END_HOUR - START_HOUR) * PX_PER_HOUR }}>
          {hourLabels.map((h) => (
            <div key={h} style={{ height: PX_PER_HOUR, fontSize: 12, color: "#666" }}>
              {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
            </div>
          ))}
        </div>
      </div>

      {/* 7 day columns */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(160px, 1fr))", gap: 8 }}>
          {days.map((day, idx) => {
            const label = day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

            return (
              <div key={day.toISOString()} style={{ border: "1px solid #eee", borderRadius: 10, background: "white" }}>
                {/* header */}
                <div style={{ padding: "10px 10px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
                  {label}
                </div>

                {/* grid area */}
                <div
                  style={{
                    position: "relative",
                    height: (END_HOUR - START_HOUR) * PX_PER_HOUR,
                    background:
                      "linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
                    backgroundSize: `100% ${PX_PER_HOUR}px`,
                  }}
                >
                  {/* Busy events (optional) */}
                  {/* Busy events (optional) */}
                    {eventsByDay[idx].map((ev, i) => (
                    <div
                        key={`${ev.id || ev.title}-${i}`}
                        className="timeBlock timeBlockEvent"
                        title={`${ev.title}\n${new Date(ev.start).toLocaleTimeString()} - ${new Date(ev.end).toLocaleTimeString()}`}
                        style={{
                        position: "absolute",
                        left: 8,
                        right: 8,
                        ...blockStyle(ev.start, ev.end),
                        }}
                    >
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ev.title}
                      </div>
                    </div>
                  ))}

                  {/* Study sessions */}
                  {sessionsByDay[idx].map((s, i) => (
                      <div
                          key={`${s.title}-${s.start}-${i}`}
                          className={`timeBlock timeBlockStudy ${onSelectBlock ? "clickable" : ""}`}
                          onClick={() => onSelectBlock?.(s)}
                          title={`${s.title}\n${new Date(s.start).toLocaleTimeString()} - ${new Date(s.end).toLocaleTimeString()}`}
                          style={{
                              position: "absolute",
                              left: 8,
                              right: 8,
                              ...blockStyle(s.start, s.end),
                          }}
  
                    >
                      <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.title}
                      </div>
                      <div style={{ opacity: 0.8 }}>
                        {s.meta?.kind || "study"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}