import { useEffect, useState } from "react";

export default function SubjectsManager({ onChange, hideTitle = false }) {
  const [subjects, setSubjects] = useState(() => {
    const raw = localStorage.getItem("studyflow_subjects");
    return raw ? JSON.parse(raw) : [];
  });

  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState(3);

  useEffect(() => {
    localStorage.setItem("studyflow_subjects", JSON.stringify(subjects));
    onChange?.(subjects);
  }, [subjects, onChange]);

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (subjects.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setName("");
      return;
    }

    setSubjects([...subjects, { name: trimmed, difficulty: Number(difficulty) }]);
    setName("");
    setDifficulty(3);
  }

  function remove(idx) {
    setSubjects(subjects.filter((_, i) => i !== idx));
  }

  function updateDifficulty(idx, val) {
    const next = subjects.map((s, i) =>
      i === idx ? { ...s, difficulty: Number(val) } : s
    );
    setSubjects(next);
  }

  return (
    <div className="subjectsBox">
      {!hideTitle && <div className="subjectsHeader">Subjects</div>}

      <div className="row2">
        <label className="field">
          <div className="label">Subject</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Physics"
          />
        </label>

        <label className="field">
          <div className="label">Difficulty (1–5)</div>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button type="button" className="btnPrimary" onClick={add} disabled={!name.trim()}>
        Add subject
      </button>

      <div className="subjectsList">
        {subjects.length === 0 ? (
          <div className="hintText">Add a few subjects to enable scheduling.</div>
        ) : (
          subjects.map((s, idx) => (
            <div className="subjectRow" key={s.name}>
              <div className="subjectName">{s.name}</div>

              <div className="subjectRight">
                <select
                  className="miniSelect"
                  value={s.difficulty}
                  onChange={(e) => updateDifficulty(idx, e.target.value)}
                >
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      Diff {d}
                    </option>
                  ))}
                </select>

                <button type="button" className="iconBtn" onClick={() => remove(idx)} title="Remove">
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}