import { useEffect, useMemo, useState } from "react";
import { fetchEvents } from "../lib/api";

function isAllDay(iso) {
  return iso && iso.length === 10; // YYYY-MM-DD
}

function formatTime(iso) {
  if (!iso) return "";
  if (isAllDay(iso)) return "All day";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso) {
  // Use start date for grouping
  const d = isAllDay(iso) ? new Date(iso + "T00:00:00") : new Date(iso);
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function dayKey(iso) {
  const d = isAllDay(iso) ? new Date(iso + "T00:00:00") : new Date(iso);
  // YYYY-MM-DD local
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function EventList() {
  const [items, setItems] = useState([]);
  console.log(items)
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetchEvents(); // next 7 days
        setItems(res.items || []);
      } catch (e) {
        setErr("Could not load events. Try reconnecting.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const ev of items) {
      const k = dayKey(ev.start);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    }
    // sort by day
    const days = Array.from(map.keys()).sort();
    return days.map((k) => ({
      key: k,
      label: formatDayLabel(map.get(k)[0].start),
      events: map.get(k),
    }));
  }, [items]);

  if (loading) return <div className="placeholderBox">Loading events…</div>;
  if (err) return <div className="placeholderBox">{err}</div>;
  if (!items.length) return <div className="placeholderBox">No upcoming events.</div>;

  return (
    <div className="eventGroupList">
      {grouped.map((group) => (
        <div key={group.key} className="eventDayGroup">
          <div className="eventDayHeader">{group.label}</div>

          <div className="eventList">
            {group.events.map((ev) => (
              <div key={ev.id} className="eventRow">
                <div className="eventTime">
                  {formatTime(ev.start)} – {formatTime(ev.end)}
                </div>
                <div className="eventTitle">{ev.title}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}