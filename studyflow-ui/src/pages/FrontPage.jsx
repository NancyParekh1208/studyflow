import "./frontpage.css";
import SyncStatusCard from "../components/SyncStatusCard";
import EventList from "../components/EventList";
import { useEffect, useState } from "react";
import MiniMonthCalendar from "../components/MiniMonthCalendar";
import AddClassForm from "../components/AddClassForm";
import SubjectsManager from "../components/SubjectsManager";
import WeekTimeBoxCalendar from "../components/WeekTimeBoxCalendar";


function TopBar() {
    return (
        <div className="topbar">
            <div className="brand">
                <div className="brandIcon">🧠</div>
                <div className="brandName">StudyFlow AI</div>
            </div>

            <div className="topActions">
                <button className="btnPrimary">+ Add Event</button>
            </div>

            <div className="userArea">
                <div className="userName">Demo User</div>
                <div className="avatar">N</div>
            </div>
        </div>
    );
}

function Panel({ title, subtitle, children }) {
    return (
        <div className="panel">
            <div className="panelHeader">
                <div className="panelTitle">{title}</div>
                {subtitle ? <div className="panelSubtitle">{subtitle}</div> : null}
            </div>
            <div className="panelBody">{children}</div>
        </div>
    );
}

export default function FrontPage() {

    const [planPreview, setPlanPreview] = useState(null); // { plan_id, weekly_study_plan, summary, window }
    
    const [loadingPlan, setLoadingPlan] = useState(false);
    const [committingPlan, setCommittingPlan] = useState(false);
    const [activePlanId, setActivePlanId] = useState(() => localStorage.getItem("studyflow_active_plan_id") || null);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [monthDate, setMonthDate] = useState(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    );

    const generateWeeklyPlan = async () => {
        try {
            setLoadingPlan(true);

            const payload = {
                useCalendar: true,
                subjects: subjects.map((s) => ({
                    title: s.name,
                    difficulty: s.difficulty,
                    // examDate, weakTopics can be added later
                })),
            };

            console.log("Generating weekly plan... payload:", payload);

            const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/study-plan/preview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            console.log("Preview status:", resp.status);

            const data = await resp.json();
            console.log("Preview response data:", data);
            if (!resp.ok) throw new Error(data.error || "Failed to generate plan");

            setPlanPreview(data);
        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setLoadingPlan(false);
        }
    };

    const acceptAndCommitPlan = async () => {
        if (!planPreview) return;

        try {
            setCommittingPlan(true);

            const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/study-plan/commit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    plan_id: planPreview.plan_id,
                    weekly_study_plan: planPreview.weekly_study_plan,
                }),
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || "Failed to commit plan");

            setActivePlanId(planPreview.plan_id);
            localStorage.setItem("studyflow_active_plan_id", planPreview.plan_id);

            alert(`✅ Added ${data.inserted} study sessions to your calendar`);
        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setCommittingPlan(false);
        }
    };

    const replaceCommittedPlan = async () => {
        try {
            setCommittingPlan(true);

            const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/study-plan/recalculate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    previous_plan_id: activePlanId,
                    mode: "replace_committed",
                    subjects: subjects.map((s) => ({
                        title: s.name,
                        difficulty: s.difficulty,
                    })),
                }),
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || "Failed to replace plan");

            setActivePlanId(data.new_plan_id);
            localStorage.setItem("studyflow_active_plan_id", data.new_plan_id);

            alert(`♻️ Replaced old plan. Deleted ${data.deleted}, inserted ${data.inserted}.`);
        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setCommittingPlan(false);
        }
    };

    const [suggestions, setSuggestions] = useState(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    const generateSuggestions = async () => {
        try {
            setLoadingSuggestions(true);

            const resp = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/study-plan/suggestions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ useCalendar: true }),
                }
            );

            const data = await resp.json();
            setSuggestions(data.suggestions);
        } catch (err) {
            console.error("Failed to get suggestions:", err);
        } finally {
            setLoadingSuggestions(false);
        }
    };



    // ✅ ADD THIS
    const [subjects, setSubjects] = useState([]);

    const [calendarEvents, setCalendarEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
   
    useEffect(() => {
  const raw = localStorage.getItem("studyflow_subjects");
  if (raw) {
    try {
      setSubjects(JSON.parse(raw));
    } catch (e) {
      console.error("Bad subjects in localStorage", e);
    }
  }
}, []);
    useEffect(() => {
    (async () => {
        try {
        setLoadingEvents(true);
        const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/calendar/events`, {
            credentials: "include",
        });
        const data = await resp.json();
        if (resp.ok) setCalendarEvents(data.items || []);
        } catch (e) {
        console.error("Failed to load calendar events", e);
        } finally {
        setLoadingEvents(false);
        }
    })();
    }, []);

    return (
        <div className="shell">
            <TopBar />
        {/* DEBUG BOX — remove later */}
<div>
  <div><b>planPreview:</b> {planPreview ? "✅ set" : "❌ null"}</div>
  <div><b>sessions:</b> {planPreview?.weekly_study_plan?.length ?? 0}</div>
  <div><b>subjects:</b> {subjects.length}</div>
  <div><b>keys:</b> {planPreview ? Object.keys(planPreview).join(", ") : "-"}</div>
</div>
        <div className="workspace2">
  {/* LEFT = Hero */}
  <Panel title="Weekly Schedule" subtitle="Your calendar + study plan">
    <SyncStatusCard />
<hr className="hr" />
  <div style={{ marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                            className="btnPrimary"
                            onClick={() => {
                                if (subjects.length === 0) {
                                    alert("Add at least 1 subject in Setup first.");
                                    return;
                                }
                                generateWeeklyPlan();
                            }}
                            disabled={loadingPlan}
                        >
      {loadingPlan ? "Generating..." : "Generate Weekly Plan"}
    </button>

    <button className="btnPrimary" onClick={acceptAndCommitPlan} disabled={!planPreview || committingPlan}>
      {committingPlan ? "Adding..." : "Accept & Add to Calendar"}
    </button>

    {activePlanId && (
      <button className="btnGhost" onClick={replaceCommittedPlan} disabled={committingPlan}>
        {committingPlan ? "Replacing..." : "Replace Existing Plan"}
      </button>
    )}
  </div>

  <div style={{ height: 720, overflow: "hidden" }}>
    <WeekTimeBoxCalendar
      anchorDate={new Date(planPreview?.window?.start || Date.now())}
      sessions={planPreview?.weekly_study_plan || []}
      events={calendarEvents || []} // only if you have this state; otherwise remove
    />
  </div>

  {!planPreview && (
    <div className="hintText" style={{ marginTop: 10 }}>
      Generate a plan to see suggested study blocks placed into your real availability.
    </div>
  )}
</Panel>

  {/* RIGHT = Everything else for now */}
  <div className="rightStack">
    <div className="rightColumn">
    <Panel title="Upcoming Events" subtitle="Google Calendar events">
      <EventList />
      <hr className="hr" />

      <button
        className="btnPrimary"
        onClick={generateWeeklyPlan}
        disabled={loadingPlan || subjects.length === 0}
      >
        {loadingPlan ? "Generating..." : "Generate Weekly Plan"}
      </button>

      {planPreview && (
        <div style={{ marginTop: 15 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btnPrimary" onClick={acceptAndCommitPlan} disabled={committingPlan}>
              {committingPlan ? "Adding..." : "Accept & Add to Calendar"}
            </button>

            {activePlanId && (
              <button className="btnGhost" onClick={replaceCommittedPlan} disabled={committingPlan}>
                {committingPlan ? "Replacing..." : "Replace Existing Plan"}
              </button>
            )}
          </div>

          <h3 style={{ marginTop: 16 }}>Why this plan?</h3>
          {Object.entries(planPreview.summary || {}).map(([subject, info]) => (
            <div key={subject} style={{ marginBottom: 10 }}>
              <strong>{subject}</strong>{" "}
              <span style={{ opacity: 0.75 }}>
                ({info.total_study_hours}h, {info.sessions} sessions, priority {info.priority ?? "—"})
              </span>
              <div style={{ opacity: 0.9 }}>{info.suggestion}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>

    <Panel title="Setup" subtitle="Add subjects and sync class times">
                            <details className="accordion" open>
                                <summary className="accordionSummary">
                                    <div>
                                        <div>Subjects</div>
                                        <div className="accordionHint">Add & set difficulty</div>
                                    </div>
                                    <span className="chev">▾</span>
                                </summary>
                                <div className="accordionBody">
                                    <SubjectsManager onChange={setSubjects} hideTitle />
                                </div>
                            </details>

                            <details className="accordion">
                                <summary className="accordionSummary">
                                    <span>Add Class / Subject Schedule</span>
                                    <span className="accordionHint">Optional</span>
                                </summary>
                                <div className="accordionBody">
                                    <AddClassForm subjects={subjects} hideTitle />
                                </div>
                            </details>
</Panel>
  </div>
  </div>
</div>
        </div>
    );
}