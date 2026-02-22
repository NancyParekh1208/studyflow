import { useEffect, useMemo, useState } from "react";
import { createClassEvent } from "../lib/api";

const DOW = [
  { label: "Mon", val: "MO" },
  { label: "Tue", val: "TU" },
  { label: "Wed", val: "WE" },
  { label: "Thu", val: "TH" },
  { label: "Fri", val: "FR" },
  { label: "Sat", val: "SA" },
  { label: "Sun", val: "SU" },
];

export default function AddClassForm({ subjects = [], hideTitle = false }) {
  const [subjectName, setSubjectName] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("MO");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [startDate, setStartDate] = useState("2026-02-21");
  const [untilDate, setUntilDate] = useState("2026-05-01");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // When subjects load/change, auto-select first subject
  useEffect(() => {
    if (!subjectName && subjects.length > 0) {
      setSubjectName(subjects[0].name);
    }
  }, [subjects, subjectName]);

  const selectedDifficulty = useMemo(() => {
    const found = subjects.find((s) => s.name === subjectName);
    return found ? Number(found.difficulty) : 3;
  }, [subjects, subjectName]);

  async function onSubmit(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setStatus("");

      await createClassEvent({
        title: subjectName,
        difficulty: selectedDifficulty,
        dayOfWeek,
        startTime,
        endTime,
        startDate,
        untilDate,
        timezone: "America/New_York",
        // calendarId omitted because server defaults to DEMO_CALENDAR_ID
      });

      setStatus(`✅ Synced: ${subjectName} (Diff ${selectedDifficulty})`);
    } catch (err) {
      setStatus(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="formBox">
      {!hideTitle && <div className="formTitle">Add Class / Subject Schedule</div>}

      <label className="field">
        <div className="label">Subject</div>
        <select
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          disabled={subjects.length === 0}
        >
          {subjects.length === 0 ? (
            <option value="">Add a subject first</option>
          ) : (
            subjects.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} (Diff {s.difficulty})
              </option>
            ))
          )}
        </select>
      </label>

      {/* Optional: show difficulty preview */}
      {subjects.length > 0 && (
        <div className="hintText">Difficulty saved: {selectedDifficulty}</div>
      )}

      <label className="field">
        <div className="label">Day of week</div>
        <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
          {DOW.map((d) => (
            <option key={d.val} value={d.val}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <div className="row2">
        <label className="field">
          <div className="label">Start</div>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </label>
        <label className="field">
          <div className="label">End</div>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </label>
      </div>

      <div className="row2">
        <label className="field">
          <div className="label">First class date</div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="field">
          <div className="label">Until (semester end)</div>
          <input
            type="date"
            value={untilDate}
            onChange={(e) => setUntilDate(e.target.value)}
          />
        </label>
      </div>

      <button className="btnPrimary" disabled={loading || !subjectName}>
        {loading ? "Syncing..." : "Sync to Google Calendar"}
      </button>

      {status ? <div className="statusLine">{status}</div> : null}
    </form>
  );
}