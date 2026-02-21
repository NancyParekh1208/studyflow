import "./dashboard.css";
import TodayCard from "../components/TodayCard";
import WeeklyHoursCard from "../components/WeeklyHoursCard";

function Card({ title, children }) {
  return (
    <div className="card">
      <div className="cardTitle">{title}</div>
      <div>{children}</div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="page">
      <div className="header">
        <div>
          <h1 className="h1">StudyFlowAI</h1>
          <p className="sub">Your week at a glance</p>
        </div>

        <div className="headerActions">
          <button className="btn ghost">Re-plan week</button>
          <button className="btn solid">Push to Calendar</button>
        </div>
      </div>

      {/* TOP ROW */}
      <div className="gridTop">
        <Card title="Today">
          <TodayCard></TodayCard>
        </Card>
        <Card title="Weekly Hours">
          <WeeklyHoursCard/>
        </Card>
        <Card title="Sync Status">
          <div className="placeholder">Google sync controls go here</div>
        </Card>
      </div>

      {/* MIDDLE ROW */}
      <div className="gridMid">
        <div className="span2">
          <Card title="Recommendations">
            <div className="placeholder">Study/hobby recommendations go here</div>
          </Card>
        </div>
        <Card title="Fatigue">
          <div className="placeholder">Fatigue bars go here</div>
        </Card>
      </div>

      {/* BOTTOM ROW */}
      <div className="gridBottom">
        <div className="span2">
          <Card title="Deadlines Timeline">
            <div className="placeholder">Upcoming deadlines list/timeline</div>
          </Card>
        </div>
        <Card title="Course Progress">
          <div className="placeholder">Course progress cards go here</div>
        </Card>
      </div>
    </div>
  );
}