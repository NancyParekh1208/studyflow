// planner/subjects.js
export function normalizeSubjects(subjects) {
  return (subjects || [])
    .map((s) => ({
      title: (s.title || s.name || "").trim(),
      difficulty: Number(s.difficulty ?? 3),
      examDate: s.examDate ?? null,
      weakTopics: Array.isArray(s.weakTopics) ? s.weakTopics : [],
    }))
    .filter((s) => s.title.length > 0)
    .map((s) => ({
      ...s,
      difficulty: Math.min(5, Math.max(1, s.difficulty)),
    }));
}