function StatRow({ label, value }) {
  return (
    <div className="statRow">
      <span className="statLabel">{label}</span>
      <span className="statValue">{value}</span>
    </div>
  );
}

function StackedBar({ studyPct, hobbyPct, bufferPct }) {
  return (
    <div className="stackBar">
      <div className="seg study" style={{ width: `${studyPct}%` }} />
      <div className="seg hobby" style={{ width: `${hobbyPct}%` }} />
      <div className="seg buffer" style={{ width: `${bufferPct}%` }} />
    </div>
  );
}

export default function WeeklyHoursCard() {
  // mock weekly totals (later comes from backend)
  const study = 12.0;
  const hobbies = 4.5;
  const buffer = 3.0;
  const goalStudy = 15.0;

  const total = study + hobbies + buffer;

  // percentages for the stacked bar
  const studyPct = Math.round((study / total) * 100);
  const hobbyPct = Math.round((hobbies / total) * 100);
  const bufferPct = Math.max(0, 100 - studyPct - hobbyPct);

  return (
    <div>
      <div className="hoursBig">
        <div className="hoursBigNum">{study.toFixed(1)}</div>
        <div className="hoursBigLabel">Study hrs planned</div>
      </div>

      <div className="hoursStats">
        <StatRow label="Study" value={`${study.toFixed(1)} hrs`} />
        <StatRow label="Hobbies" value={`${hobbies.toFixed(1)} hrs`} />
        <StatRow label="Buffer" value={`${buffer.toFixed(1)} hrs`} />
      </div>

      <StackedBar studyPct={studyPct} hobbyPct={hobbyPct} bufferPct={bufferPct} />

      <div className="goalLine">
        Planned vs goal: <b>{study.toFixed(0)}</b> / {goalStudy.toFixed(0)} hrs
      </div>
    </div>
  );
}