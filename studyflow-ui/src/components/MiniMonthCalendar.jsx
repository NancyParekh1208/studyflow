import { useMemo } from "react";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function sameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function MiniMonthCalendar({
  monthDate,
  selectedDate,
  onChangeMonth,
  onSelectDate,
}) {
  const { label, cells } = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const label = monthStart.toLocaleDateString([], {
      month: "long",
      year: "numeric",
    });

    // How many empty cells before the 1st?
    const leading = monthStart.getDay(); // 0=Sun
    const daysInMonth = monthEnd.getDate();

    const cells = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
    }
    return { label, cells };
  }, [monthDate]);

  return (
    <div className="miniCal">
      <div className="miniCalHeader">
        <button className="miniCalNav" onClick={() => onChangeMonth(-1)}>
          ‹
        </button>
        <div className="miniCalTitle">{label}</div>
        <button className="miniCalNav" onClick={() => onChangeMonth(1)}>
          ›
        </button>
      </div>

      <div className="miniCalDow">
        {DOW.map((d) => (
          <div key={d} className="miniCalDowCell">
            {d}
          </div>
        ))}
      </div>

      <div className="miniCalGrid">
        {cells.map((d, idx) => {
          if (!d) return <div key={idx} className="miniCalCell empty" />;

          const isSelected = sameDay(d, selectedDate);
          const isToday = sameDay(d, new Date());

          return (
            <button
              key={ymd(d)}
              className={`miniCalCell day ${isSelected ? "selected" : ""} ${
                isToday ? "today" : ""
              }`}
              onClick={() => onSelectDate(d)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}