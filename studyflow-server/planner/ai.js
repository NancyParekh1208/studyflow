// planner/ai.js
export function difficultyToBand(d) {
  const n = Number(d);
  if (n <= 2) return "Easy";
  if (n === 3) return "Medium";
  return "Hard";
}

export function defaultMinutesForDifficulty(d) {
  const n = Number(d);
  if (n <= 2) return 120;   // 2h
  if (n === 3) return 240;  // 4h
  return 360;              // 6h
}

function buildOptimizerPrompt({ subjects, windowStartISO, windowEndISO }) {
  return `
You are an academic time-allocation optimizer.

Plan ONLY within:
start: ${windowStartISO}
end: ${windowEndISO}

Return ONLY valid JSON. No reasoning.

Rules:
- difficulty 1-2 baseline: 120 minutes
- difficulty 3 baseline: 240 minutes
- difficulty 4-5 baseline: 360 minutes
- If exam within 7 days: allow up to +50%
- If exam within 14 days: allow up to +25%

Output schema:
{
  "subjects": [
    {
      "title": "string",
      "priority": 0-100,
      "target_minutes": number,
      "strategy": {
        "prefer_after_class": true/false,
        "distribution": "front_load | spaced | end_load",
        "review_ratio": 0.0-0.5
      },
      "one_line_tip": "max 12 words"
    }
  ]
}

Subjects:
${JSON.stringify(subjects, null, 2)}
`.trim();
}

export async function aiOptimizeAllocation({ subjects, windowStartISO, windowEndISO, openaiKey }) {
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

  const enriched = subjects.map((s) => ({
    title: s.title,
    difficulty: s.difficulty,
    examDate: s.examDate,
    weakTopics: s.weakTopics,
    baseline_minutes: defaultMinutesForDifficulty(s.difficulty),
  }));

  const prompt = buildOptimizerPrompt({ subjects: enriched, windowStartISO, windowEndISO });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return ONLY JSON. No reasoning." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned empty content");
  return JSON.parse(raw);
}