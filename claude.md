# MEMORA - Gift Registry App Documentation

---

## 📋 CURRENT SESSION TODOS

> **IMPORTANT FOR CLAUDE:** Always check this section first when starting a new session. These are the active tasks that need continuation.

### ✅ COMPLETED - UX Improvements (December 4, 2025)

**Status:** ALL TASKS COMPLETE

#### Completed Tasks:

**Task 1: Amazon Product Auto-Fill** ✅
- ✅ Installed dependencies: `cheerio` and `axios`
- ✅ Created `POST /api/items/add-from-amazon` endpoint
- ✅ Auto-scrapes title, price, image from Amazon product links
- ✅ Fixed URL cleaning to handle browser address bar links
- ✅ Prioritized buybox price selectors for accurate pricing

**Task 2: Delete Accepted Members** ✅
- ✅ Added delete button next to members in event page (owner only)
- ✅ Added confirmation modal (matching item delete style)
- ✅ Wired up existing `DELETE /api/events/[id]/members` endpoint
- ✅ Made delete button always visible (no hover-only on mobile)

**Task 3: Mobile Font Color Fixes** ✅
- ✅ Upgraded all light gray text to text-gray-900 for maximum contrast
- ✅ Fixed washed out labels, headings, and body text
- ✅ Applied across all pages: login, dashboard, events, contacts, modals
- ✅ Tested and confirmed readable on iPhone in bright sunlight

**Additional Fixes:**
- ✅ Fixed InviteFromContactsModal stuck in "Inviting..." state
- ✅ Fixed modal close button calling wrong state setter

### ✅ COMPLETED - Fulfillment System (Revenue Activation)

**Status:** Implementation COMPLETE - E2E testing deferred until after calendar feature
**Documents:** See `SPECIALIST_REVIEW_SUMMARY.md`, `FULFILLMENT_CORRECTIONS_QUICKSTART.md`, `supabase_fulfillment_migration_v2_CORRECTED.sql`

**Completed Timeline:**
- ✅ Day 0: Phase 0 corrections complete (Database + Environment setup)
- ✅ Day 1: Express Connect onboarding endpoints (COMPLETE - December 9, 2025)
- ✅ Day 2: Transfer logic + security (COMPLETE - December 9, 2025)
- ✅ Day 3: UI components - RedemptionModal + Event page integration (COMPLETE - December 10, 2025)
- ✅ Day 4: Dashboard fulfillment history (COMPLETE - December 10, 2025)
- ⏸️ Day 5: E2E testing + production prep (DEFERRED - will test with calendar feature)

**Revenue Impact:** ~$1,800/year (Year 1) → ~$18,000/year (Year 2) [5% platform fee]

---

### 🚨 CURRENT PRIORITY - Calendar & Registry Unification

**Status:** ✅ Phase 6 COMPLETE (Security audit done) → Ready for Phase 0 (Database backup)
**Implementation Plan:** See `C:\Users\bntou\.claude\plans\zany-beaming-scott.md`
**Estimated Time:** 20-30 hours total (7 phases)

**What Changed:**
- ✅ Phases 1-5: Calendar feature fully implemented (`user_events` table, API routes, UI components)
- ✅ Phase 6: Security audit completed - all critical vulnerabilities fixed
- **Decision:** Merge calendar and registry systems into unified `events` table (Option 3: Tight Integration)

**Key Design Decisions:**
1. **Single `events` table** with `registry_enabled` flag (replaces separate `user_events` table)
2. **Recurring events CAN have registries** - but registry is one-time, creates NEW registry each year
3. **Unified creation modal** - same modal for both Dashboard and Calendar
4. **Calendar invitations** - reuse existing `invitations` table for calendar-only events
5. **Annual renewal** - invitations must be renewed yearly (not perpetual)

**Implementation Phases:**
- [ ] Phase 0: Database backup and rollback script (NEXT)
- [ ] Phase 1: Database schema migration (merge user_events → events)
- [ ] Phase 2: API consolidation (unified endpoints with `?type=` parameter)
- [ ] Phase 3: Frontend updates (unified CreateEventModal component)
- [ ] Phase 4: Invitation system extension
- [ ] Phase 5: "Spawn Registry from Recurring" feature
- [ ] Phase 6: Testing (6 manual test cases)
- [ ] Phase 7: Production deployment

**Critical Files:**
- Plan: `C:\Users\bntou\.claude\plans\zany-beaming-scott.md`
- Migration: `supabase_unified_events_migration.sql` (to be created)
- Backup: `supabase_unified_migration_backup.sql` (to be created)
- Security fixes: `supabase_calendar_security_fix.sql` (already applied)

**Next Action:** Create database backup script for Phase 0

---

## 📝 Quick Reference

### Project Info
- **Live URL:** https://memoraapp.netlify.app
- **Tech Stack:** Next.js 16, Supabase, Stripe, Tailwind CSS, Netlify
- **Theme:** Cheerful gradients (blue/yellow/pink), party emojis 🎉

### Key Files & Locations
- **Environment:** `.env.local` (never commit)
- **Database Migrations:** `supabase_*.sql` files
- **Components:** `app/components/`
- **API Routes:** `app/api/`
- **Pages:** `app/` (Next.js 16 app router)

### Important Links
- **Supabase Dashboard:** [Project dashboard]
- **Stripe Dashboard:** [TEST mode - switch to LIVE for production]
- **Netlify Dashboard:** [Deployment & env vars]
- **Resend Dashboard:** [Email sending - mail.mymemoraapp.com]

---

## ⚠️ KNOWN ISSUES

### Critical
- [ ] **Join page auth timing issue** - "Must be logged in" error after successful login
  - User logs in → returns to `/join/[code]` → clicks "Join" → error
  - ReturnURL working, but auth state not ready in time
  - Files: `app/join/[code]/page.jsx`, `app/login/page.jsx`

### Production Environment
- [ ] Update Netlify `RESEND_FROM_EMAIL` to `Memora <invites@mail.mymemoraapp.com>`
- [ ] Switch Stripe from TEST mode to LIVE mode (after testing complete)

---

## 🧪 Pre-Production Checklist

### Before Going Live
- [ ] Fix join page auth issue
- [ ] **Combined E2E Testing (Fulfillment + Calendar):**
  - [ ] Fulfillment flow: Create event → Fund item → Redeem to bank account
  - [ ] Calendar flow: Create recurring event → Verify display → Edit/delete
  - [ ] Test calendar event creation from gift registry events
- [ ] Update Netlify environment variables
- [ ] Switch Stripe to LIVE mode
- [ ] Configure production webhook endpoint
- [ ] Test with real $1 payment (fulfillment redemption)
- [ ] Cross-browser testing (Safari, Firefox, Edge)
- [ ] Mobile device testing (iOS/Android)
- [ ] SEO optimization (meta tags, og:images)
- [ ] Set up error tracking (Sentry)
- [ ] Configure custom domain SSL
- [ ] Google Cloud billing alerts (Places API)

---

## 💡 Notes for Claude Code

### Working on This Project
1. **Preserve user data** - Be careful with database migrations
2. **Mobile-first** - Test on mobile viewports first
3. **Gradient theme** - Follow blue/yellow/pink gradient design
4. **Error handling** - Always provide user feedback
5. **Security first** - RLS policies, input validation, parameterized queries
6. **No emojis** - Unless user explicitly requests them
7. **Update todos** - Keep this section current as you work

### Testing
- **Stripe test card:** `4242 4242 4242 4242`
- **Local dev:** `npm run dev`
- **Webhook testing:** Use Stripe CLI (see ARCHIVE for commands)

### Database
- **RLS is critical** - All tables have Row Level Security
- **Service role key** - Only for webhooks and admin operations
- **Never expose** - SUPABASE_SERVICE_ROLE_KEY must stay secret

### Common Commands
```bash
npm run dev          # Local development server
npm run build        # Production build
git status           # Check uncommitted changes
```

---

## 📚 Additional Documentation

For detailed historical information, see:
- **ARCHIVE_2025_NOV.md** - All completed features and bug fixes
- **FULFILLMENT_*.md** - Fulfillment system architecture and plans
- **AGENT_USAGE_GUIDE.md** - Specialized agent coordination guide
- **DESIGN_DIRECTION_GUIDE.md** - UI/UX design principles

---

## 🔄 Last Updated
**Date:** 2025-12-11
**Status:**
- ✅ Google Places & Event Types COMPLETE
- ✅ Edit Location feature COMPLETE
- ✅ Custom domain email setup COMPLETE
- ✅ UX Improvements COMPLETE (Amazon auto-fill, delete members, mobile font fixes)
- ✅ Next.js Security Upgrade COMPLETE (v16.0.8 - Netlify security fix)
- ✅ Fulfillment System COMPLETE (Implementation done - E2E testing deferred)
  - ✅ Day 0-4: All implementation phases complete
  - ⏸️ Day 5: E2E testing deferred (will test with calendar unification)
- ✅ Calendar Feature COMPLETE (Phases 1-6 done)
  - ✅ Database schema, API routes, UI components, security audit
- 🎯 Calendar & Registry Unification IN PROGRESS (Current priority - 20-30 hours)
  - Detailed plan: `C:\Users\bntou\.claude\plans\zany-beaming-scott.md`
  - Next: Phase 0 (Database backup script)

**Next Action:**
1. Phase 0: Create database backup and rollback script
2. Phase 1-7: Execute unified migration per implementation plan
3. Combined E2E testing for fulfillment + unified events system
4. Production launch prep

---

*For complete feature history, bug fixes, and session notes, see ARCHIVE_2025_NOV.md*
