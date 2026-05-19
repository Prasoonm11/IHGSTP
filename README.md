# AtomQuest Goal Setting Portal

A Supabase-backed web portal for end-to-end goal setting, approval, quarterly check-ins, and reporting.

## Features Implemented

### Phase 1 (Must-Have)
- Employee goal creation and goal-sheet submission.
- Thrust area selection, goal title/description, UoM, targets, and weightage.
- Validation rules:
  - Max 8 goals per employee.
  - Min 10% weightage per goal.
  - Goal sheet submission only when total weightage is exactly 100%.
- Manager/Admin approval queue:
  - Inline edit of target and weightage.
  - Approve and lock goals.
  - Return goals for rework.
- Shared goal push:
  - Manager/Admin can push KPI goals to multiple employees.
  - Shared goals are linked through `primary_goal_id`.

### Phase 2 (Must-Have)
- Quarterly update form with status: `not_started`, `on_track`, `completed`.
- Progress score auto-calculation for UoM types:
  - Numeric/% min: `achievement / target`
  - Numeric/% max: `target / achievement`
  - Timeline: completed by deadline => 100 else 0
  - Zero-based: actual 0 => 100 else 0
- Completion dashboard by role/team.

### Governance & Reporting
- CSV export for achievement report via `report_goal_progress` view.
- Audit trail trigger for updates to locked goals.

## Tech Stack
- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + RLS

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

Set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Apply database schema in Supabase SQL Editor:
- Run `supabase/schema.sql`

4. Start app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Demo Role Journeys
- Employee: register/login -> create goals -> submit goal sheet -> update quarterly progress.
- Manager: login -> review submitted goals -> edit/approve/rework -> push shared goals.
- Admin: login -> all manager capabilities + completion dashboard + CSV export.

## Notes
- For real production hardening, add stricter RLS policies per manager hierarchy and server-side action auditing.
- The schema seeds departments and thrust areas; create at least one manager and employee account to test approvals.

## Recent Updates
- Enforced shared KPI rules: employees and managers can only edit the weightage of shared KPIs; title/target are read-only.
- Database trigger and RLS updates to prevent non-weightage mutations and deletion of shared KPIs by non-admins.
- Added server-side notifications when admins push shared KPIs to employees.
- When admins push a shared KPI, any employee draft with the same title is converted (updated) to the pushed shared goal to avoid duplicates.
- Admin UI: shared KPI creation now creates locked/submitted shared goals (so they don't appear in employee Draft lists).
- Admin UI: renamed cycle timeline entries and added Goal creation window note (1 May — 30 June).
- Profile menu: "Sign out" label changed to "Logout"; profile details moved to a centered modal with a close button.
- Prevent accidental deletes: typed confirmation and pre-check for pushed/approved child goals before allowing deletion.

## Developed By
Prasoon Mathur

## License & Copyright
© 2026 AlignHQ. All rights reserved.
