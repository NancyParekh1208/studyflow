🧠 StudyFlow – Adaptive Study Optimizer

AI-powered, time-aware weekly study planning integrated with Google Calendar.

StudyFlow is an intelligent scheduling system that transforms real calendar availability into structured, optimized study plans. It dynamically allocates study time based on subject difficulty, strategic distribution rules, and calendar constraints — ensuring realistic, sustainable planning.

🚀 Overview

StudyFlow converts your real weekly availability into an optimized 7-day study plan.

Instead of manually deciding when and how long to study, StudyFlow:

Reads your Google Calendar

Understands subject difficulty

Uses AI to allocate study time

Applies hard scheduling constraints

Inserts study blocks directly into your calendar

The result is a practical, balanced, and realistic plan.

✨ Core Features
📅 Google Calendar Integration

OAuth-based Google login

Reads upcoming calendar events

Creates recurring class events with difficulty tagging

Inserts study sessions directly into your calendar

Safely replaces existing weekly plans

🎯 Difficulty-Aware Allocation

Each subject has a difficulty level (1–5). StudyFlow converts that into weekly study targets:

| Difficulty | Weekly Target |
|:----------:|:-------------:|
| 1–2        | 2 hours       |
| 3          | 4 hours       |
| 4–5        | 6 hours       |

Allocation is then refined using AI-based priority scoring.

🤖 AI Optimization Layer

StudyFlow uses a GPT-based optimizer to:

Assign subject priority scores (0–100)

Determine target study minutes

Select scheduling strategies:

front_load

spaced

end_load

Prefer study sessions after class events

Optionally add review sessions

AI decides how much to study.
The scheduler decides when.

🗓 Constraint-Safe Scheduling Engine

The backend scheduler enforces strict constraints:

No overlap with existing calendar events

Study window: 8:00 AM – 10:00 PM

Max 2 hours per study block

Max 4 total study hours per day

Minimum 30-minute buffer between sessions

Avoid multiple sessions of the same subject in one day (initial pass)

Balanced distribution across the week

This ensures plans are realistic and prevent burnout.

🔄 Preview → Accept → Commit Workflow

Generate weekly plan

Preview time-grid layout

Review allocation summary

Accept and add to Google Calendar

Optionally replace existing plan

All calendar changes require explicit user approval.

🏗 Architecture
Frontend (React + Vite)

Weekly time-grid calendar view

Study task summary panel

Subject setup interface

Google connection status

Plan preview UI

Backend (Node.js + Express)

Google Calendar API integration

OpenAI-based allocation optimizer

Deterministic scheduling engine

Plan commit and replacement logic

Plan ID tracking for safe overwrites

🔄 System Flow
Step 1 – Setup (One-Time)

Add subjects and assign difficulty levels.

Step 2 – Generate Plan

Backend:

Fetches next 7 days of calendar events

Runs AI allocation optimizer

Computes free time slots

Applies scheduling constraints

Builds weekly study sessions

Step 3 – Preview

Frontend displays:

Weekly time-grid

Study task list

“Why this plan?” allocation explanation

Step 4 – Commit

Study sessions are inserted into Google Calendar as real events.

📂 Project Structure
frontend/
  components/
    WeekTimeBoxCalendar.jsx
    StudyPlanTasks.jsx
    SubjectsManager.jsx
    AddClassForm.jsx
  pages/
    FrontPage.jsx

backend/
  index.js
  planner/
    subjects.js
    ai.js
    scheduler.js
    calendarWrite.js
⚙️ Environment Setup
Backend .env
CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
REDIRECT_URI=http://localhost:5000/auth/google/callback
FRONTEND_URL=http://localhost:5173
OPENAI_API_KEY=your_openai_key
PORT=5000
🛠 Installation
Backend
npm install
node index.js
Frontend
npm install
npm run dev
🔐 Google API Requirements

Enable:

Google Calendar API

OAuth 2.0 credentials

Required scope:

https://www.googleapis.com/auth/calendar.events

Redirect URI must match your backend callback URL.

🧠 Design Philosophy

StudyFlow separates intelligence from constraints:

Layer	Responsibility
AI Optimizer	Decide allocation and strategy
Scheduler	Enforce time constraints and spacing
Calendar	Represent real-world time
User	Final approval

This hybrid design prevents unrealistic AI-generated schedules.

📌 Why StudyFlow?

Most study planners:

Ignore real calendar availability

Stack sessions back-to-back

Require manual adjustments

Create unrealistic workloads

StudyFlow:

Uses real availability

Enforces spacing and limits

Prevents overload

Produces immediately actionable plans

🔮 Future Enhancements

Performance-based adaptive difficulty

Exam countdown weighting

Energy-aware scheduling

Multi-week planning

Study streak analytics

Auto-rescheduling when calendar changes

Mobile optimization