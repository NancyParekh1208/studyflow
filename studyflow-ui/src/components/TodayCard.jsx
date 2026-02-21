const mockToday = [
  { id: "e1", time: "9:00–9:50", title: "Math — Practice Set", tag: "Deep work" },
  { id: "e2", time: "10:10–10:55", title: "Physics — Review notes", tag: "Light" },
  { id: "e3", time: "12:30–1:15", title: "Gym", tag: "Hobby" },
  { id: "e4", time: "3:00–4:30", title: "Project — Implement feature X", tag: "Deep work" },
];

function Tag({ children }) {
  return <span className="tag">{children}</span>;
}

function TodayRow({ item, isNext }) {
  return (
    <div className={`todayRow ${isNext ? "next" : ""}`}>
      <div className="todayTime">{item.time}</div>
      <div className="todayMain">
        <div className="todayTitle">{item.title}</div>
        <Tag>{item.tag}</Tag>
      </div>
    </div>
  );
}

export default function TodayCard() {
  const nextItem = mockToday[0];

  return (
    <div>
      {/* Next up */}
      <div className="nextUp">
        <div className="nextUpLabel">Next up</div>
        <div className="nextUpTitle">{nextItem.title}</div>
        <div className="nextUpMeta">{nextItem.time} • {nextItem.tag}</div>
      </div>

      {/* Timeline */}
      <div className="todayList">
        {mockToday.map((item, idx) => (
          <TodayRow key={item.id} item={item} isNext={idx === 0} />
        ))}
      </div>

      {/* Actions */}
      <div className="todayActions">
        <button className="btn solid small">Mark done</button>
        <button className="btn ghost small">Move</button>
        <button className="btn ghost small">Skip</button>
      </div>
    </div>
  );
}