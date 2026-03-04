# BuxibanOS — React Native App

## What This Is
BuxibanOS is a two-app SaaS platform for Taiwan cram schools (buxibans). It replaces Line group chats and manual admin with a unified AI-powered system. This repo is the React Native mobile app.

**Two apps, one codebase:**
- **Staff App** — Directors, teachers, admins. AI-powered message triage, 3-tile priority dashboard, voice-to-send.
- **Parent App** — Parents of enrolled students. Messaging with school + Parent Portal Lite (attendance, schedule, fees, documents).

**V1 Pilot:** One school, 5 teachers, ~200 students. Invite-only. No public App Store listing during pilot (TestFlight).

---

## Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React Native + Expo | SDK 52 (PINNED — do NOT upgrade to 53+, breaks supabase-js ws) |
| Styling | NativeWind + Tailwind | NativeWind 4.1.23 + Tailwind 3.4.17 (PINNED — do not upgrade) |
| State | Zustand | v5+ |
| Database | Supabase (PostgreSQL 15) | Latest client |
| Auth | Supabase Auth | Built-in |
| Realtime | Supabase Realtime | WebSocket, built-in |
| Navigation | Expo Router | v3 (file-based) |
| AI | Claude Haiku 4.5 (fast) + Sonnet 4 (deep) | via Anthropic API |
| Voice | Soniox API | Real-time Mandarin STT |
| Push | Expo Notifications | Server-initiated via n8n |
| i18n | react-i18next + expo-localization | zh-TW primary |
| Build | EAS Build + TestFlight | Invite-only distribution |

---

## Project Structure
```
src/
  app/
    (auth)/
      sign-in/          # Email/password + Line Login OAuth
    (staff)/
      (tabs)/
        dashboard.tsx   # 3-tile priority dashboard (HOME SCREEN)
        messages.tsx    # Unified message inbox with priority filter
        tasks.tsx       # AI-generated + manual action items
      messages/[id].tsx # Message detail + reply bar
      briefing/         # Morning AI briefing
      announcements/    # Create/manage announcements
      attendance/       # Record attendance
      students/[id].tsx # Student profile
      fees/             # Fee status management
      documents/        # Document library
    (parent)/
      (tabs)/
        messages.tsx    # 1-to-1 messaging with school
        announcements/  # School broadcast announcements
        schedule/       # Class timetable (read-only)
        fees/           # Fee status (read-only)
        documents/      # Document library (read-only)
      messages/[id].tsx # Message thread
  components/
    messages/           # MessageCard, PriorityFilter, ReplyBar
    dashboard/          # PriorityTile
    common/             # Shared UI primitives
    ui/                 # Base components
  stores/
    auth-store.ts       # Session, role, profile, organizationId
    messages-store.ts   # Messages, realtime subscription, filters
  types/
    database.ts         # Supabase generated types (source of truth)
  lib/
    supabase.ts         # Supabase client singleton
  constants/
    index.ts            # PRIORITY, MESSAGE_TYPES, app constants
  i18n/
    locales/zh-TW.json  # All UI strings in Traditional Chinese
```

---

## Core Product Decisions (DO NOT CHANGE WITHOUT PRD APPROVAL)

### Staff Dashboard
The home screen is a **3-tile priority dashboard** — Urgent / Medium / Low. This is not a tab bar, it is the first screen. Tapping a tile navigates to the filtered message list. The tile shows count of unresponded messages and age of oldest unresponded message in that priority.

### Auth Flow
- **Staff:** Email + password → Supabase Auth → role lookup in `staff` table
- **Parents:** Line Login OAuth2 (identity only, NOT Line chat API) as primary + email/password fallback
- **No self-registration.** Parents receive an invite link from the school. The `(auth)/sign-up` route does NOT exist and must never be created.
- After auth, role determines routing: `parent` → `/(parent)/(tabs)`, all others → `/(staff)/(tabs)`

### Messaging Architecture
BuxibanOS has its **own native messaging system**. It does NOT use Line's messaging API. Messages are stored in Supabase, delivered via Supabase Realtime WebSocket, push notifications via Expo Push API. Line Login is used only for parent identity verification (OAuth2).

### AI Principle
The AI in V1 **analyzes, organizes, prioritizes, and assists — but never sends a message autonomously**. Every outgoing message is written or approved by a human staff member.

### Parent Portal Lite (V1 read-only)
- Attendance calendar
- Class schedule and timetable
- Fee status (outstanding / paid) — display only, no payment processing
- Invoice PDF download
These are read-only views. No payment rails. No Stripe.

### V2 / V3 Features (NOT in scope for V1)
- AI autonomous reply
- Multi-branch management
- Student grades / progress notes
- Photo albums
- Advanced billing analytics
- Animated sticker support

---

## Database Schema Key Points
- Every table has `organization_id` for multi-tenant isolation (V1 = one school)
- `parents.app_user_id` stores Line user ID (from OAuth) OR Supabase UUID for email path
- `messages` table has NO `webhook_source`, NO `raw_payload` — those are old Line fields, do not add them
- `staff` table has NO `line_official_account_id`, NO `line_channel_access_token`
- `fee_records.payment_method` is `cash | bank_transfer | other` — no `line_pay`
- RLS is enabled on all tables — always query within organization scope

---

## Coding Conventions
- **NativeWind only** for styling — no StyleSheet.create(), no inline style objects
- **No `\n` in JSX** — use separate `<Text>` elements or explicit spacing
- **Traditional Chinese** for all user-facing strings — use i18n keys, not hardcoded strings
- **Zustand** for global state — no Redux, no Context for data
- **Supabase client** imported from `@/lib/supabase` — never instantiate a new client
- **`@/`** path alias for all internal imports — never use relative `../../`
- **TypeScript strict** — no `any`, use types from `@/types/database`
- Component files: PascalCase. Utility files: kebab-case.
- Keep components under 200 lines — extract if larger

---

## Version Pin Warnings
These are non-negotiable for V1. Do not upgrade without explicit instruction:

| Package | Pinned | Reason |
|---------|--------|--------|
| expo | ~52.0.x | supabase-js ws breaks on SDK 53+ (supabase-js#1400) |
| nativewind | 4.1.23 | v4.0 had 400% perf regression; v5 pre-release |
| tailwindcss | 3.4.17 | Required for NativeWind 4.1.x |
| react-native-reanimated | ~3.16.1 | Required by NativeWind 4.1.x |

---

## Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
SONIOX_API_KEY=
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
N8N_WEBHOOK_BASE_URL=
EXPO_PUBLIC_APP_ENV=development
```

---

## Key Files to Read Before Editing
1. `src/types/database.ts` — Supabase schema types, source of truth for all data shapes
2. `src/stores/auth-store.ts` — Auth flow, role detection, session management
3. `src/constants/index.ts` — Shared constants, priority config, message type labels
4. `supabase/migrations/00001_initial_schema.sql` — Full DB schema with RLS

---

## What n8n Handles (not this repo)
- AI message analysis and classification (triggered by Supabase DB webhook)
- Morning briefing generation (scheduled 7:00 AM)
- Background scans: stagnant threads, fee overdue checks (every 4 hours)
- Document indexing from Google Drive
- Push notifications via Expo Push API
- Daily summary report (scheduled 6:00 PM)

n8n connects to the same Supabase instance using the service role key. Workflows live in the separate `buxibanos-n8n` project.
