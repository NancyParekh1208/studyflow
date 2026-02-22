import "./frontpage.css";
import SyncStatusCard from "../components/SyncStatusCard";
import EventList from "../components/EventList";
import { useState } from "react";
import MiniMonthCalendar from "../components/MiniMonthCalendar";
import AddClassForm from "../components/AddClassForm";
import SubjectsManager from "../components/SubjectsManager";


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

            const resp = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/study-plan/preview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            const data = await resp.json();
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

    return (
        <div className="shell">
            <TopBar />

            <div className="workspace">
                {/* Left */}
                <Panel title="Schedule" subtitle="Your events and study sessions">
                    <MiniMonthCalendar
                        monthDate={monthDate}
                        selectedDate={selectedDate}
                        onChangeMonth={(delta) =>
                            setMonthDate(
                                (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
                            )
                        }
                        onSelectDate={(d) => setSelectedDate(d)}
                    />
                </Panel>

                {/* Middle */}
                <Panel title="Upcoming Events" subtitle="Google Calendar events">
                    <EventList />
                    <hr className="hr" />

                    <hr className="hr" />

                    <button className="btnPrimary" onClick={generateWeeklyPlan} disabled={loadingPlan || subjects.length === 0}>
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

                            <h3 style={{ marginTop: 16 }}>Plan Preview</h3>

                            {planPreview.weekly_study_plan.map((s, idx) => (
                                <div key={idx} style={{ marginBottom: 10, padding: 10, border: "1px solid #eee", borderRadius: 8 }}>
                                    <strong>{s.title}</strong>
                                    <div style={{ fontSize: 13, opacity: 0.85 }}>
                                        {new Date(s.start).toLocaleString()} → {new Date(s.end).toLocaleString()}
                                        {s.meta?.kind ? ` · ${s.meta.kind}` : ""}
                                    </div>
                                </div>
                            ))}

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

                    {loadingSuggestions && <p style={{ marginTop: 10 }}>Generating suggestions...</p>}

                    {suggestions && (
                        <div style={{ marginTop: 15 }}>
                            {Object.entries(suggestions).map(([subject, text]) => (
                                <div key={subject} style={{ marginBottom: 12 }}>
                                    <strong>{subject}</strong>
                                    <p>{text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>

                {/* Right (combined) */}
                <Panel title="Connect Calendar" subtitle="Add subjects and sync class times">
                    <SyncStatusCard />
                    <hr className="hr" />
                    <SubjectsManager onChange={setSubjects} />
                    <hr className="hr" />
                    <AddClassForm subjects={subjects} />
                </Panel>
            </div>
        </div>
    );
}