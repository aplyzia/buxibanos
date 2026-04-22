---
name: EddyFlow Project Overview
description: Taiwan cram school SaaS — mobile app + Supabase backend + AI, currently in V1 pilot with one school
type: project
---

EddyFlow is a mobile SaaS for Taiwan cram schools (buxibans). Replaces LINE group chaos with AI-powered priority messaging, attendance, fees, announcements, and VoIP emergency calls.

**Why:** Taiwan cram schools rely on fragmented LINE chats. EddyFlow provides a unified, AI-organized platform.

**How to apply:** All work targets V1 pilot (1 school, 5 teachers, ~200 students). Keep scope tight — no V2/V3 features unless explicitly requested. TestFlight distribution only.

**Tech:** Expo SDK 54 (pinned), NativeWind, Supabase (Postgres + RLS + Edge Functions), Zustand, Claude AI (Haiku 4.5 + Sonnet 4), LiveKit VoIP, n8n workflows, react-i18next (zh-TW primary).

**Roles:** Staff (director/teacher/admin/front_desk), Parent (LINE OAuth invite-only). Three route groups: (staff), (parent), (teacher).
