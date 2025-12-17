# MEMORA - Gift Registry App Documentation

---

## 📋 CURRENT SESSION TODOS

> **IMPORTANT FOR CLAUDE:** Always check this section first when starting a new session. These are the active tasks that need continuation.

### ✅ COMPLETED - Frontend Redesign "Soft Celebration" (December 16, 2025)

**Status:** ALL TASKS COMPLETE
**Branch:** `feature/landing-page-redesign`

**New Color Palette (inspired by new Memora logo):**
- Lavender: `#B8A9E8` (primary)
- Peach: `#FFCDB2` (accent)
- Buttercream: `#FFF3CD` (highlight)
- Mint: `#B5EAD7` (secondary)
- Cloud: `#F8F7FF` (background)
- Charcoal: `#2D2A3E` (text)

**Completed Updates:**
- ✅ **Landing Page** - Complete redesign with animated blobs, staggered reveals, 3D card effects
- ✅ **Dashboard Page** - New color palette, updated sidebar with logo, Home tab action cards
- ✅ **Login Page** - Redesigned with email/password form directly visible, new styling
- ✅ **Event Slug Page** - Added two-tab system for special events:
  - Gift Registry tab (items + Amazon Quick Add)
  - Location tab (view/add venue with Google Maps integration)
- ✅ **Casual Meetup Tabs** - Added two-tab system for casual meetups:
  - In Person tab (add/view physical location via Google Places)
  - Online tab (add/view Zoom, Google Meet, or Teams links)
- ✅ **CreateEventModal** - Updated with new color palette
- ✅ **CasualMeetupModal** - Updated with new color palette
- ✅ **globals.css** - Added CSS variables for entire color palette
- ✅ **layout.js** - Added Inter + Outfit fonts via Next.js font system

**Key Files Modified:**
- `app/page.jsx` - Landing page
- `app/dashboard/page.jsx` - Dashboard
- `app/login/page.jsx` - Login page
- `app/event/[slug]/page.jsx` - Event page with tabs
- `app/components/CreateEventModal.jsx`
- `app/components/CasualMeetupModal.jsx`
- `app/globals.css` - Color palette variables
- `app/layout.js` - Font configuration
- `public/memora-logo.png` - New logo

---

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

### ✅ COMPLETED - Calendar & Registry Unification (December 2025)

**Status:** ALL PHASES COMPLETE
**Branch:** `feature/calendar-unification` (merged to main)

**What's Working:**
- ✅ Unified `events` table (calendar + registry in one table)
- ✅ Calendar events created via `/api/calendar/events` (`registry_enabled=false`)
- ✅ Dashboard shows only registries (filters `registry_enabled=true`)
- ✅ MiniCalendar shows all events with colored dots
- ✅ Full Calendar page displays all events correctly
- ✅ Unified Event Creation Modal (used by Dashboard and Calendar)
- ✅ "Spawn Registry from Recurring Event" feature

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

## 🚀 Future Improvements

### Event Chatbox (Telegram-style)
Add a real-time chatbox to event slug pages so invited members can:
- Send messages to other guests
- Vote on options (e.g., "Which restaurant should we go to?")
- React to messages with emojis
- Create polls for group decisions
Similar to Telegram group chat functionality. Would require:
- New `event_messages` table with RLS policies
- Real-time subscriptions via Supabase
- Message components with reactions/voting UI

---

## 📚 Additional Documentation

For detailed historical information, see:
- **ARCHIVE_2025_NOV.md** - All completed features and bug fixes
- **FULFILLMENT_*.md** - Fulfillment system architecture and plans
- **AGENT_USAGE_GUIDE.md** - Specialized agent coordination guide
- **DESIGN_DIRECTION_GUIDE.md** - UI/UX design principles

---

## 🔄 Last Updated
**Date:** 2025-12-16
**Status:**
- ✅ Google Places & Event Types COMPLETE
- ✅ Edit Location feature COMPLETE
- ✅ Custom domain email setup COMPLETE
- ✅ UX Improvements COMPLETE (Amazon auto-fill, delete members, mobile font fixes)
- ✅ Next.js Security Upgrade COMPLETE (v16.0.8 - Netlify security fix)
- ✅ Fulfillment System COMPLETE (Implementation done - E2E testing deferred)
- ✅ Calendar & Registry Unification COMPLETE (Phases 1-6)
- ✅ **Casual Meetup 2-Tab System COMPLETE** (December 16, 2025)
  - In Person tab: Physical location with Google Places integration
  - Online tab: Zoom/Google Meet/Teams link support
  - Database: Added `online_meeting_url` and `online_meeting_type` columns
  - API: Updated PATCH endpoint with URL validation and type detection

---

*For complete feature history, bug fixes, and session notes, see ARCHIVE_2025_NOV.md*
