# LeetReps — Spaced Repetition for LeetCode

A full-stack web application that implements a spaced repetition system for LeetCode problems. Built with Next.js (App Router), TypeScript, PostgreSQL, Prisma, and deployed on Vercel's free tier.

## How It Works

1. **Submit a problem** — Enter a LeetCode problem title and difficulty (Easy, Medium, Hard).
2. **Automatic scheduling** — Each problem enters a review queue using fixed intervals: **1 → 3 → 7 → 14 → 30 days**.
3. **Daily reviews** — The dashboard shows problems due for today. Mark each as **Pass** or **Fail**.
4. **Pass** — Advances to the next interval. Beyond 30 days → moved to the **Finished** list.
5. **Fail** — Drops one interval (minimum 1 day).
6. **Overdue** — Missed problems become overdue. Passing an overdue problem keeps the same interval; failing decreases it.
7. **Scheduling constraint** — Max 2 Medium/Hard problems per day. If more are due, the most recently submitted are pushed forward.
8. **Pull from delayed** — You can pull delayed problems to review early. If not completed that day, they return to their original schedule.

## Tech Stack

| Layer         | Technology                           |
|---------------|--------------------------------------|
| Framework     | Next.js 16 (App Router)              |
| Language      | TypeScript                           |
| Database      | PostgreSQL                           |
| ORM           | Prisma 7                             |
| Auth          | Better Auth                          |
| Validation    | Zod                                  |
| UI            | Tailwind CSS v4 + shadcn/ui          |
| Unit Tests    | Vitest + React Testing Library       |
| E2E Tests     | Playwright                           |
| Deployment    | Vercel                               |

## Getting Started

### Prerequisites

- Node.js 20.19+
- PostgreSQL database (local or hosted, e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Vercel Postgres](https://vercel.com/storage/postgres))

### Setup

```bash
# Clone and install
git clone <your-repo-url> leet-reps
cd leet-reps
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and a random BETTER_AUTH_SECRET

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to create an account and start tracking.

### Running Tests

```bash
# Unit tests
npm test

# Unit tests in watch mode
npm run test:watch

# E2E tests (requires running dev server or Playwright will start one)
npm run test:e2e
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Sign in / sign up pages
│   ├── (app)/            # Authenticated app shell
│   │   └── dashboard/    # Main dashboard page
│   ├── api/auth/         # Better Auth API routes
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Redirects to dashboard or sign-in
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── navbar.tsx         # App navigation bar
│   ├── problem-card.tsx   # Problem display card
│   └── add-problem-dialog.tsx
├── lib/
│   ├── actions/           # Server actions (problems CRUD)
│   ├── auth.ts            # Better Auth config
│   ├── auth-client.ts     # Client-side auth
│   ├── prisma.ts          # Prisma client singleton
│   ├── scheduler.ts       # Core scheduling algorithm
│   ├── schemas.ts         # Zod validation schemas
│   ├── constants.ts       # Shared constants
│   └── utils.ts           # Utility functions
├── proxy.ts               # Auth / route protection (Next.js proxy)
└── __tests__/             # Unit tests

e2e/                       # Playwright E2E tests
prisma/
└── schema.prisma          # Database schema
```

## Scheduling Algorithm

The scheduler enforces a hard limit of **2 medium/hard problems per day** (easy problems are unlimited). When conflicts arise:

1. Problems are grouped by their intended due date
2. For each date, medium/hard problems are sorted by creation date (oldest first)
3. Problems exceeding the daily cap are pushed to the next available day
4. This cascades forward until all constraints are satisfied

After any problem is completed, the schedule is **rebalanced** — delayed problems are moved as close to their intended dates as possible while respecting constraints.

## Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)
4. Deploy

The app works with Vercel's free tier including Vercel Postgres for the database.
