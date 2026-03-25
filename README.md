# EddyFlow — AI-Powered Cram School Management

SaaS platform for Taiwan cram schools (補習班/buxibans). Replaces LINE group chat with structured, AI-powered communication between school staff and parents.

## Tech Stack

- **Mobile app**: React Native + Expo SDK 54 + NativeWind
- **Backend**: Supabase (Postgres + RLS + Auth + pgvector)
- **AI**: Claude Haiku (routine tasks) / Claude Sonnet (deep analysis)
- **Voice**: Soniox ASR (speech-to-text), LiveKit (VoIP emergency calls)
- **Automation**: n8n self-hosted workflows (WF1–WF6)
- **Notifications**: Expo Push + Apple PushKit + FCM
- **State**: Zustand stores, react-i18next (en + zh-TW)

## Getting Started

```bash
npm install
npx expo start
```

### Supabase (local dev)

```bash
supabase start
supabase db push        # apply migrations
supabase functions serve # run edge functions locally
```

### Environment

Copy `.env.example` (if present) or set:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`
- `SONIOX_API_KEY`

## Project Structure

```
src/
  app/
    (auth)/         # Sign-in / sign-up
    (staff)/        # Director & admin screens
    (parent)/       # Parent portal
    (teacher)/      # Teacher portal
  hooks/            # Custom React hooks
  stores/           # Zustand state stores
  lib/              # Supabase client, LiveKit, notifications
  i18n/             # en.json + zh-TW.json
  theme/            # Dark + light theme colors

supabase/
  migrations/       # Postgres schema + RPCs
  functions/        # Edge Functions (Deno)
    _shared/        # Shared auth module
    agent-*         # Agent API (7 endpoints)
    create-emergency-room/
    generate-briefing/
    generate-invoice/
    line-auth/
    redeem-invite/
  seed/             # Pilot seed data

scripts/
  check-ui.ts       # Playwright screenshot tool
  onboard-school.ts # Provision new school org
  import-school.ts  # Bulk import school data
  scan-school-docs.ts # Scan & index school documents

docs/
  SOP-school-onboarding.md

infra/              # Infrastructure config
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run check-ui` | Screenshot the staff dashboard via Playwright |
| `npm run check-ui /announcements` | Screenshot a specific route |
| `npm run onboard-school` | Provision a new school in Supabase |
| `npm run import-school` | Bulk import students, classes, parents |
| `npm run scan-docs` | Scan school documents into AI context |

## Agent API

Seven Supabase Edge Functions provide a validated API for agents and integrations. Auth via `x-api-key` header (per-org keys) or Bearer token.

| Endpoint | Purpose |
|----------|---------|
| `agent-manage-keys` | Create/list/revoke API keys (director only) |
| `agent-send-message` | Parent/teacher message (auto-triggers WF1) |
| `agent-send-announcement` | Create announcement + populate recipients |
| `agent-reply-to-parent` | Staff reply with thread linkage |
| `agent-create-task` | Create task with name resolution |
| `agent-record-attendance` | Bulk attendance via RPC |
| `agent-get-dashboard` | Read-only org summary |

Generate an API key:
```bash
curl -X POST $SUPABASE_URL/functions/v1/agent-manage-keys \
  -H "Authorization: Bearer <director_token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "create", "label": "my-agent"}'
```

Use it:
```bash
curl -X POST $SUPABASE_URL/functions/v1/agent-send-message \
  -H "x-api-key: ef_..." \
  -H "Content-Type: application/json" \
  -d '{"sender_name":"陳志明", "sender_type":"parent", ...}'
```

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Director | `director@xiong-buxiban.com` | `DevPass123!` |

## Related Repos

- **Cram-sim** — n8n AI simulation agents for testing and demos (separate repo)
