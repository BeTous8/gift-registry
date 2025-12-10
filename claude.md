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

### 🚨 NEXT PRIORITY - Fulfillment System (Revenue Activation)

**Status:** Specialist reviews COMPLETE - Critical corrections required before implementation
**Documents:** See `SPECIALIST_REVIEW_SUMMARY.md`, `FULFILLMENT_CORRECTIONS_QUICKSTART.md`, `supabase_fulfillment_migration_v2_CORRECTED.sql`

**Phase 0: Apply Critical Corrections (REQUIRED FIRST)**
- [x] @security-auditor - Review COMPLETE (5 critical + 5 high priority issues found)
- [x] @stripe-specialist - Review COMPLETE (CRITICAL: Must use Express Connect, NOT Standard)
- [x] @database-expert - Review COMPLETE (3 race conditions fixed)
- [x] User reviewed and approved corrections
- [x] Ran corrected database migration (`supabase_fulfillment_migration_v2_FIXED.sql`)
- [x] Updated environment variables (`.env.local` and Netlify)
- [x] Stripe Connect enabled (Marketplace model, v1 API)
- [x] **Day 1 COMPLETE - Express Connect onboarding endpoints implemented**

**Critical Findings:**
1. ⚠️ **WRONG Stripe Connect Type** - Must use Express (not Standard) - 4 hours to fix
2. ⚠️ **Platform Fee Loses Money** - Increase from 3% to 5% - 1 hour to fix
3. ⚠️ **Race Condition in Fulfillment** - Use atomic function - 3 hours to fix
4. ⚠️ **Missing RLS on Audit Log** - Critical security gap - 1 hour to fix
5. ⚠️ **No Webhook Deduplication** - Can process duplicates - 2 hours to fix

**Total Fix Time:** ~11 hours (P0 blockers only)

**Revised Timeline (after corrections):**
- ✅ Day 0: Phase 0 corrections complete (Database + Environment setup)
- ✅ Day 1: Express Connect onboarding endpoints (COMPLETE - December 9, 2025)
- ✅ Day 2: Transfer logic + security (COMPLETE - December 9, 2025)
- ✅ Day 3: UI components - RedemptionModal + Event page integration (COMPLETE - December 10, 2025)
- ✅ Day 4: Dashboard fulfillment history (COMPLETE - December 10, 2025)
- **→ Day 5: E2E testing + production prep** (NEXT - Launch Ready)

**Revenue Impact:** ~$1,800/year (Year 1) → ~$18,000/year (Year 2) [Updated with 5% fee]

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
- [ ] End-to-end test: Create event → Invite → Join → Contribute
- [ ] Update Netlify environment variables
- [ ] Switch Stripe to LIVE mode
- [ ] Configure production webhook endpoint
- [ ] Test with real $1 payment
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
**Date:** 2025-12-10
**Status:**
- ✅ Google Places & Event Types COMPLETE
- ✅ Edit Location feature COMPLETE
- ✅ Custom domain email setup COMPLETE
- ✅ UX Improvements COMPLETE (Amazon auto-fill, delete members, mobile font fixes)
- ✅ Next.js Security Upgrade COMPLETE (v16.0.8 - Netlify security fix)
- ✅ Fulfillment Day 0 COMPLETE (Database migration + Environment setup)
- ✅ Fulfillment Day 1 COMPLETE (Express Connect onboarding endpoints)
- ✅ Fulfillment Day 2 COMPLETE (Transfer logic, webhooks, security)
- ✅ Fulfillment Day 3 COMPLETE (RedemptionModal, event page integration, fulfillment status display)
- ✅ Fulfillment Day 4 COMPLETE (Dashboard redemption history with status tracking)
- 🎯 Fulfillment Day 5 NEXT (E2E testing + production prep)

**Next Action:** End-to-end testing of full redemption flow + prepare for production launch

---

*For complete feature history, bug fixes, and session notes, see ARCHIVE_2025_NOV.md*
