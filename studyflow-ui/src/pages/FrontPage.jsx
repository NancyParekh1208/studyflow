import "./frontpage.css";
import SyncStatusCard from "../components/SyncStatusCard";
import EventList from "../components/EventList";
import { useState } from "react";
import MiniMonthCalendar from "../components/MiniMonthCalendar";

function TopBar() {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brandIcon">🧠</div>
        <div className="brandName">StudyFlow AI</div>
      </div>

      <div className="topActions">
        <button className="btnPrimary">+ Add Event</button>
        <button className="btnGhost">Upload PDF</button>
        <button className="btnGhost">Add Subject</button>
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
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [monthDate, setMonthDate] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  return (
    <div className="shell">
      <TopBar />

            <div className="workspace">

        {/* Left */}
        <Panel title="Schedule" subtitle="Your events and study sessions">
            <MiniMonthCalendar
            monthDate={monthDate}
            selectedDate={selectedDate}
            onChangeMonth={(delta) => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))}
            onSelectDate={(d) => setSelectedDate(d)}
            />
        </Panel>

        {/* Middle */}
        <Panel title="Upcoming Events" subtitle="Google Calendar events">
            <EventList />
        </Panel>

        {/* Right */}
        <Panel
            title="Google Sync"
            subtitle="Connect your calendar for smart scheduling"
        >
            <SyncStatusCard />
        </Panel>

        </div>
    </div>
  );
}