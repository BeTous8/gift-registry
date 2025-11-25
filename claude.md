# MEMORA - Gift Registry App Documentation

## Project Overview
**App Name:** Memora  
**Description:** A gift registry web app where users create wishlists for special events, share links with friends, and receive monetary contributions towards their wished items.  
**Live URL:** https://memoraapp.netlify.app
**Theme:** Cheerful, celebratory (blue/yellow/pink gradients, party emojis 🎉)

---

## 💰 Revenue Model

### Revenue Streams (3 Sources)

| Stream | Type | Status | Potential |
|--------|------|--------|-----------|
| **Stripe Transaction Fees** | Platform fee (2-5%) on contributions | Ready to implement | Primary income |
| **Amazon Affiliate** | Commission on product purchases | Future (v1.1) | Secondary income |
| **Premium Features** | Monthly subscription ($5/month) | Future (v1.2) | Recurring income |

### Realistic Income Projections

**Year 1 (Building & Growing):**
- Stripe fees (3% on $5,000 contributions): ~$150/month
- Amazon affiliate (25 sales): ~$75/month
- **Total: ~$225/month**

**Year 2 (Established):**
- Stripe fees (3% on $50,000 contributions): ~$1,500/month
- Amazon affiliate (250 sales): ~$500/month
- Premium subs (50 users @ $5): ~$250/month
- **Total: ~$2,250/month**

**Year 3+ (Popular):**
- Stripe fees (3% on $200,000 contributions): ~$6,000/month
- Amazon affiliate (1,000 sales): ~$2,000/month
- Premium subs (500 users @ $5): ~$2,500/month
- **Total: ~$10,500/month**

### Amazon Associates Strategy
1. **Phase 1:** Use Amazon search links (no API needed) - `amazon.com/s?k={item}&tag=affiliate-id`
2. **Phase 2:** After 3 qualifying sales, apply for Product Advertising API
3. **Phase 3:** Full integration with real prices, images, availability

---

## Tech Stack
- **Frontend:** Next.js 16 (React framework)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Authentication:** Supabase Auth (Magic link, OAuth, Phone, Email/Password)
- **Payments:** Stripe (Currently in TEST mode)
- **Styling:** Tailwind CSS
- **Deployment:** Netlify
- **Version Control:** GitHub (Public repository)

## Project Timeline Status
**Current Phase:** Week 2, Day 5 - Group/Invitation Feature
**Total Timeline:** 3 weeks
**Launch Target:** End of Week 3

---

## ✅ COMPLETED FEATURES

### Authentication System
- ✅ Multiple auth methods:
  - Google OAuth (with mobile compatibility fixes)
  - Email/Password with username
  - Phone number with OTP verification
  - Magic link login
- ✅ Session management with auto-refresh
- ✅ Mobile-friendly OAuth flow with proper redirects
- ✅ Auth state persistence across tabs
- ✅ Proper sign-out handling

### Core Pages
- ✅ **Landing Page** (`/`)
  - Memora branding with gradient design
  - Call-to-action for sign up
  
- ✅ **Login Page** (`/login`)
  - Toggle between Sign In/Sign Up
  - Multiple auth method selection
  - Error handling and display
  - Mobile-optimized UI
  
- ✅ **Dashboard** (`/dashboard`)
  - Sidebar navigation (collapsible)
  - User's events display with cards
  - Statistics cards (total events, upcoming, total raised, total items)
  - Event filtering (all/upcoming)
  - Delete event functionality with confirmation
  - Mobile responsive with hamburger menu
  - User greeting with first name extraction
  
- ✅ **Create Event** (`/create-event`)
  - Event title, date, description fields
  - Automatic slug generation with timestamp
  - Form validation
  - Protected route (requires auth)
  
- ✅ **Public Event Page** (`/event/[slug]`)
  - No login required for viewing
  - Event details display
  - Items grid with progress bars
  - Share button with clipboard copy
  - Owner detection for edit capabilities
  - Contribute modal for visitors
  - Edit/Delete items (owner only)
  - Add new items form (owner only)
  - Total progress visualization

### Database Structure
```sql
-- Events table
events {
  id: uuid (PK)
  user_id: uuid (FK to auth.users)
  title: text
  slug: text (unique)
  description: text
  event_date: date
  invite_code: text (unique) -- NEW: for shareable invite links
  is_private: boolean (default: false) -- NEW: private events require invite
  created_at: timestamp
}

-- Items table
items {
  id: uuid (PK)
  event_id: uuid (FK to events)
  title: text
  price_cents: integer
  current_amount_cents: integer (default: 0)
  product_link: text
  image_url: text
  created_at: timestamp
}

-- Contributions table
contributions {
  id: uuid (PK)
  item_id: uuid (FK to items)
  contributor_name: text
  contributor_email: text
  amount_cents: integer
  stripe_session_id: text (unique)
  status: text ('pending', 'completed', 'failed')
  created_at: timestamp
}

-- Event Invitations table (NEW - for group feature)
event_invitations {
  id: uuid (PK)
  event_id: uuid (FK to events)
  email: text
  status: text ('pending', 'accepted', 'declined')
  created_at: timestamp
  responded_at: timestamp
  UNIQUE(event_id, email)
}

-- Event Members table (NEW - for group feature)
event_members {
  id: uuid (PK)
  event_id: uuid (FK to events)
  user_id: uuid (FK to auth.users)
  joined_at: timestamp
  UNIQUE(event_id, user_id)
}
```

### RLS Policies
- ✅ Users can only see/edit/delete their own events
- ✅ Public can view public events and items
- ✅ Service role key for webhook operations
- ✅ Event members can view private events they've joined
- ✅ Event owners can manage invitations
- ✅ Users can view/respond to their own invitations
- ✅ Users can join events and leave events

### Payment System (Stripe)
- ✅ Stripe Checkout integration
- ✅ Webhook endpoint for payment confirmation
- ✅ Payment verification API endpoint
- ✅ Contribution tracking in database
- ✅ Progress bar updates after payment
- ✅ Idempotency checks (prevent duplicate processing)
- ✅ Test mode configuration with test cards

### Payment Flow Features
- ✅ **Success Flow:**
  - Payment verification on return
  - Success banner with amount
  - Database update fallback if webhook delayed
  - Auto-dismiss after 10 seconds
  
- ✅ **Error Handling:**
  - Card declined messages
  - Insufficient funds handling
  - Expired card detection
  - Network error recovery
  - User-friendly error messages
  - Cancel payment handling
  
- ✅ **UI Components:**
  - Contribute modal with quick amount selection
  - Loading states during payment
  - Toast notifications (global provider)
  - Progress indicators

### UI/UX Features
- ✅ Responsive design (mobile-first)
- ✅ Gradient themed cards
- ✅ Animation effects (hover, transitions)
- ✅ Loading spinners
- ✅ Success/error banners
- ✅ Toast notification system
- ✅ Confirmation dialogs for destructive actions

---

## 🔄 IN PROGRESS - Group/Invitation Feature

### Phase 1: Database Setup ✅ COMPLETED
- ✅ Added `invite_code` column to events table (unique, auto-generated)
- ✅ Added `is_private` column to events table (default: false)
- ✅ Created `event_invitations` table for email-based invites
- ✅ Created `event_members` table for tracking joined users
- ✅ Set up RLS policies for all new tables
- ✅ **SQL Migration:** `supabase_invitees_migration.sql` (already run in Supabase)

### Phase 2: API Endpoints ✅ COMPLETED (with bugs to fix)
| Endpoint | Method | Purpose | File |
|----------|--------|---------|------|
| `/api/events/[id]/invite` | POST | Send email invitation | `app/api/events/[id]/invite/route.js` |
| `/api/events/[id]/invite` | GET | List event invitations (owner) | `app/api/events/[id]/invite/route.js` |
| `/api/events/[id]/members` | GET | List event members | `app/api/events/[id]/members/route.js` |
| `/api/events/[id]/members` | DELETE | Remove a member | `app/api/events/[id]/members/route.js` |
| `/api/events/join/[code]` | GET | Preview event by invite code | `app/api/events/join/[code]/route.js` |
| `/api/events/join/[code]` | POST | Join event via invite code | `app/api/events/join/[code]/route.js` |
| `/api/invitations` | GET | List user's pending invitations | `app/api/invitations/route.js` |
| `/api/invitations/[id]/respond` | POST | Accept/decline invitation | `app/api/invitations/[id]/respond/route.js` |

**🐛 Bugs Found (Code Review) - ✅ FIXED:**
- ✅ **`app/api/events/[id]/invite/route.js`** - Changed `.single()` to `.maybeSingle()` for invitation and member checks
- ✅ **`app/api/events/[id]/members/route.js`** - Replaced `listUsers()` with targeted `getUserById()` calls using Promise.all

### Phase 3: Event Page UI ✅ COMPLETED
- ✅ Members sidebar showing owner and members
- ✅ Pending invitations list (visible to owner)
- ✅ "Invite by Email" button and modal
- ✅ "Copy Invite Link" button
- ✅ Members fetching from API
- **File:** `app/event/[slug]/page.jsx`

### Phase 4: Dashboard Integration ✅ COMPLETED
- ✅ Show "Events I'm a member of" section (Joined Events tab)
- ✅ Tab navigation: "My Events" | "Joined Events" | "Invitations"
- ✅ Notification badge for pending invitations (animated pulse)
- ✅ Accept/Decline invitation UI with loading states
- **File:** `app/dashboard/page.jsx`

### Phase 5: Join Page ✅ COMPLETED
**File:** `app/join/[code]/page.jsx`

**Features Implemented:**
- ✅ Create `/join/[code]` page for invite link landing
- ✅ Show event preview before joining (title, date, host, description)
- ✅ Login prompt for unauthenticated users (redirects with returnUrl)
- ✅ "Join Event" button for authenticated users
- ✅ Handle edge cases (invalid code, already member, owner)
- ✅ Success/error states with redirects
- ✅ Matching gradient theme design

**Logic Flow:**
```
User clicks invite link: https://memoraapp.netlify.app/join/abc123xyz456
                              │
                              ▼
              ┌───────────────────────────────┐
              │  GET /api/events/join/[code]  │
              │  Fetch event preview          │
              └───────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
          INVALID         VALID CODE      ALREADY
           CODE               │            MEMBER
              │               │               │
              ▼               ▼               ▼
         Show error     Display event    Redirect to
          message       preview card     /event/[slug]
                              │
                              ▼
                    User clicks "Join"
                              │
                    ┌─────────┴─────────┐
                    │                   │
              LOGGED IN            NOT LOGGED IN
                    │                   │
                    ▼                   ▼
        POST /api/events/       Redirect to /login
        join/[code]             ?returnUrl=/join/[code]
                    │                   │
                    ▼                   ▼
              On Success:         After login:
              Redirect to         Return to /join/[code]
              /event/[slug]       and auto-join
```

**Edge Cases:**
- Invalid/expired invite code → Show friendly error
- User is event owner → Show "You own this event" message
- User already a member → Redirect to event page
- Private event → Only accessible via valid invite code

**State Management:**
```javascript
const [event, setEvent] = useState(null)      // Event preview data
const [loading, setLoading] = useState(true)  // Initial load
const [joining, setJoining] = useState(false) // Join button loading
const [error, setError] = useState(null)      // Error messages
const [user, setUser] = useState(null)        // Current auth user
```

**API Endpoints Used:**
| Action | Endpoint | Auth Required |
|--------|----------|---------------|
| Load preview | `GET /api/events/join/[code]` | No |
| Join event | `POST /api/events/join/[code]` | Yes |

---

## 📋 TODO - Remaining Development

### Group Feature Completion
- [x] **Fix API Bugs (Priority):** ✅ DONE
  - [x] Fix `.single()` → `.maybeSingle()` in `app/api/events/[id]/invite/route.js`
  - [x] Optimize `listUsers()` performance in `app/api/events/[id]/members/route.js`
- [x] Dashboard integration (Phase 4) ✅ DONE
- [x] Join page `/join/[code]` (Phase 5) ✅ DONE
- [x] Email notifications for invitations ✅ DONE (via Resend)
- [ ] End-to-end testing of invite flow

### ✅ COMPLETED - Email Notifications Feature (with Known Limitations)

**Status:** Email notifications are working! Emails are being sent successfully via Resend.

**Files Modified:**
1. ✅ `app/api/events/[id]/invite/route.js` - Modified Resend initialization to be runtime instead of build-time
2. ✅ `app/event/[slug]/page.jsx` - Added "Delete" and "Resend" buttons to pending invitations
3. ✅ `app/api/events/[id]/invite/resend/route.js` - NEW file for resending invitation emails
4. ✅ `app/api/invitations/[id]/route.js` - NEW file for deleting invitations
5. ✅ `app/dashboard/page.jsx` - Fixed 400 error by passing `userId` instead of `email` to `/api/invitations`

**What Was Fixed:**
- Changed `const resend = new Resend(process.env.RESEND_API_KEY)` to a `getResendClient()` function to fix build-time initialization issue
- Added delete functionality for pending invitations
- Added resend button next to pending invitations
- Fixed dashboard invitation fetching error (was passing email instead of userId)

**🚨 IMPORTANT LIMITATION - Resend Sandbox Domain:**

**Issue:** Using `onboarding@resend.dev` (Resend's sandbox domain) has restrictions:
- ✅ Emails ARE being sent successfully
- ⚠️ Emails go to SPAM folder (not inbox) - Gmail marks them as suspicious
- ❌ Emails can ONLY be delivered to the account owner's verified email (bn.tousifar86@gmail.com)
- ❌ Other recipients (wife, friends) will NOT receive emails until domain is verified

**Why This Happens:**
- Sandbox domain (`onboarding@resend.dev`) is flagged by Gmail as spam
- Resend restricts sandbox emails to only the account owner's email for security
- Adding emails to "Audience" doesn't bypass this restriction

**SOLUTION - Required for Production:**

To send emails to ANY recipient and avoid spam folder:

1. **Add Custom Domain in Resend:**
   - Go to: https://resend.com/domains
   - Click "+ Add Domain"
   - Add your domain (e.g., `memoraapp.com` or purchase one)
   - Add DNS records (SPF, DKIM, DMARC) to your domain provider
   - Wait for verification (usually takes a few minutes)

2. **Update Code to Use Custom Domain:**
   - In `app/api/events/[id]/invite/route.js` line 115, change:
     ```javascript
     from: 'Memora <onboarding@resend.dev>',  // OLD
     ```
     to:
     ```javascript
     from: 'Memora <noreply@yourdomain.com>',  // NEW
     ```
   - Same change in `app/api/events/[id]/invite/resend/route.js` line 71

3. **Benefits:**
   - ✅ Emails will be delivered to ANY email address
   - ✅ Better inbox delivery (less likely to go to spam)
   - ✅ Professional sender address
   - ✅ Better email reputation

**Current Workaround for Testing:**
- Test invitations using your own email (bn.tousifar86@gmail.com)
- Check SPAM folder for emails
- Verify links and functionality work correctly
- Before launch, MUST add custom domain

**Environment Variables Needed:**
- `RESEND_API_KEY` must be in both `.env.local` (local) AND Netlify dashboard (production)

### Edge Cases (Deferred)
- [ ] Over-funding prevention (contribution > remaining amount)
- [ ] Concurrent contribution race conditions
- [ ] Item deletion while payment in progress

### Week 2 Completion
- [ ] Complete group feature
- [ ] Cross-browser testing (Safari, Firefox, Edge)
- [ ] Performance audit and optimization
- [ ] Security review of all endpoints

### Week 3 - Production Launch
**Day 1-2: Production Setup**
- [ ] Switch to Stripe LIVE mode
- [ ] Configure production webhook endpoint
- [ ] Update Netlify environment variables
- [ ] Test with real $1 payment
- [ ] Security audit checklist

**Day 3: Polish & Features**
- [ ] SEO optimization (meta tags, og:images)
- [ ] Email notifications setup (optional)
- [ ] Analytics integration (optional)
- [ ] Error tracking setup (Sentry)

**Day 4: Testing & QA**
- [ ] Full end-to-end testing checklist
- [ ] Load testing with multiple users
- [ ] Mobile device testing (iOS/Android)
- [ ] Accessibility testing
- [ ] Create user documentation

**Day 5: Launch**
- [ ] Custom domain configuration
- [ ] DNS propagation verification
- [ ] Launch announcement preparation
- [ ] Monitor initial user activity
- [ ] Gather feedback

---

## 🚀 FUTURE FEATURES (Post-Launch)

### Version 1.1 (Priority Features)

#### 🤖 AI Gift Suggestions (Key Feature)
**Goal:** AI analyzes event type and suggests relevant items with Amazon purchase links

**How It Works:**
```
Event Created → AI Auto-Suggests Top 3 Items → User can "Get More" (one-time deep dive)
```

**User Flow:**
1. User creates event (e.g., "Summer Camping Trip")
2. AI automatically suggests top 3 most relevant items with:
   - Item name
   - Estimated price range
   - Amazon link (affiliate)
   - [+ Add to Registry] button
3. User can click "Get More AI Suggestions" (one-time only)
4. AI deep dives and returns 10+ additional suggestions
5. Button becomes disabled: "Suggestions Generated ✓"

**Technical Implementation:**
- **AI Provider:** OpenAI GPT-4 API
- **Trigger:** Auto on event creation + "Get More" button
- **Amazon Links:** Start with search links (`amazon.com/s?k={item}&tag=affiliate-id`)
- **Rate Limiting:** One deep dive per event to control API costs
- **Event Detection:** AI detects event type from title/description

**API Endpoints Needed:**
- `POST /api/ai/suggestions` - Get initial 3 suggestions
- `POST /api/ai/suggestions/deep` - Get extended suggestions (one-time)

**Database Changes:**
- Add `ai_suggestions_used: boolean` to events table
- Store suggestions in `ai_suggestions` table for caching

**Monetization:** Amazon affiliate commission (1-10% per sale)

---

**Other v1.1 Features:**
- [ ] Email notifications for contributions
- [ ] Thank you notes to contributors
- [ ] Export contributions list (CSV)
- [ ] Social sharing buttons

### Version 1.2 (Enhanced Features)
- [ ] User profiles with avatar
- [ ] Event templates (birthday, wedding, baby shower)
- [ ] Multiple currency support
- [ ] Gift categories and filtering
- [ ] Contribution messages from givers

### Version 2.0 (Major Updates)
- [ ] Mobile app (React Native)
- [ ] Recurring contributions
- [ ] Group gifting coordination
- [ ] Wishlist import from Amazon/other sites
- [ ] Virtual thank you cards
- [ ] Event reminders

### Long-term Considerations
- [ ] International payment methods
- [ ] Multi-language support
- [ ] Business accounts for organizations
- [ ] API for third-party integrations
- [ ] White-label solution

---

## Environment Variables

### Required in `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Email (Resend)
RESEND_API_KEY=re_xxxxx

# Site URL (for production)
NEXT_PUBLIC_SITE_URL=https://memoraapp.netlify.app
```

### Netlify Environment Variables:
- All above variables must be configured in Netlify dashboard
- Webhook endpoint: `https://memoraapp.netlify.app/api/webhook`

---

## Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Test production build locally
npm run start
```

### Stripe Webhook Testing (Local)
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Forward webhooks
cd Downloads/stripe_X.X.X_windows_x86_64
./stripe listen --forward-to localhost:3000/api/webhook

# Terminal 3: Trigger test events (optional)
./stripe trigger checkout.session.completed
```

### Testing Payment Flow
1. Use test card: `4242 4242 4242 4242`
2. Any future expiry date
3. Any 3-digit CVC
4. Any 5-digit ZIP

---

## API Endpoints

### Public Endpoints
- `GET /` - Landing page
- `GET /login` - Authentication page
- `GET /event/[slug]` - Public event view

### Protected Endpoints (Require Auth)
- `GET /dashboard` - User dashboard
- `GET /create-event` - Create event form
- `GET /event/[slug]/edit` - Edit event (owner only)

### API Routes
**Payment:**
- `POST /api/create-checkout` - Create Stripe session
- `POST /api/webhook` - Stripe webhook handler
- `POST /api/verify-payment` - Verify payment status

**Auth:**
- `GET /api/auth/callback` - OAuth callback

**Group/Invitation Feature (NEW):**
- `POST /api/events/[id]/invite` - Send email invitation
- `GET /api/events/[id]/invite` - List event invitations
- `GET /api/events/[id]/members` - List event members
- `DELETE /api/events/[id]/members` - Remove a member
- `GET /api/events/join/[code]` - Preview event by invite code
- `POST /api/events/join/[code]` - Join event via invite code
- `GET /api/invitations` - List user's pending invitations
- `POST /api/invitations/[id]/respond` - Accept/decline invitation

---

## Known Issues & Fixes

### Resolved Issues
- ✅ Dashboard privacy bug (showing all events) - Fixed with user_id filter
- ✅ Webhook 500 error - Fixed with service role key
- ✅ Progress bars not updating - Fixed with proper state management
- ✅ Mobile OAuth issues - Fixed with proper redirect handling
- ✅ Session refresh on mobile - Fixed with localStorage config

### Current Limitations
- Stripe TEST mode only (no real payments yet)
- No email notifications yet
- No contribution history page
- Single currency (USD) only
- No recurring payments

---

## Security Considerations

### Implemented
- ✅ RLS policies on all tables
- ✅ Webhook signature verification
- ✅ HTTPS only in production
- ✅ Input sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention

### To Implement
- [ ] Rate limiting on API endpoints
- [ ] CORS configuration
- [ ] Content Security Policy headers
- [ ] Audit logging
- [ ] PII data encryption

---

## Performance Metrics Goals

### Target Metrics
- Page Load: < 3 seconds
- Time to Interactive: < 5 seconds
- Lighthouse Score: > 90
- Database queries: < 100ms
- Payment processing: < 10 seconds

### Monitoring
- Uptime monitoring (via Netlify)
- Error tracking (planned: Sentry)
- Performance monitoring (planned: Web Vitals)
- User analytics (planned: Google Analytics)

---

## Testing Checklist

### Unit Tests (Planned)
- [ ] Component rendering tests
- [ ] Form validation tests
- [ ] API endpoint tests
- [ ] Database operation tests

### Integration Tests
- [ ] Complete payment flow
- [ ] Auth flow (all methods)
- [ ] Event creation to sharing flow
- [ ] Contribution tracking

### User Acceptance Tests
- [ ] Create account → Create event → Add items
- [ ] Share event → Contribute → Verify payment
- [ ] Edit event → Delete items → Delete event
- [ ] Mobile user complete flow

---

## Support & Documentation

### User Documentation Needed
- [ ] How to create an event
- [ ] How to add items to registry
- [ ] How to share your registry
- [ ] How to contribute to someone's registry
- [ ] FAQ section
- [ ] Troubleshooting guide

### Developer Documentation
- This file (claude.md)
- Code comments
- API documentation
- Database schema docs

---

## Contact & Resources

### Important Links
- **Live App:** https://memoraapp.netlify.app
- **GitHub Repo:** [Public repository]
- **Supabase Dashboard:** [Project dashboard]
- **Stripe Dashboard:** [TEST mode dashboard]
- **Netlify Dashboard:** [Deployment settings]

### Development Notes
- Always test payment flows in TEST mode first
- Check Supabase logs for RLS policy errors
- Monitor Stripe webhook events for failures
- Review Netlify function logs for API errors

---

## Version History

### Current Version: 0.9.5 (Pre-launch)
- Core functionality complete
- Payment system integrated
- Error handling implemented
- Mobile responsive design
- Group/Invitation feature in progress

### Changelog
- v0.9.5 - Group/Invitation feature (DB + API + Event Page UI complete)
- v0.9.0 - Payment verification and error handling
- v0.8.0 - Stripe integration complete
- v0.7.0 - Dashboard and event management
- v0.6.0 - Authentication system
- v0.5.0 - Initial project setup

---

## Notes for Claude Code

When working on this project:
1. **Always preserve user data** - Be careful with database migrations
2. **Test payment flows** - Use Stripe TEST mode
3. **Mobile-first approach** - Test on mobile viewports
4. **Maintain consistent styling** - Follow gradient theme
5. **Error handling is critical** - Always provide user feedback
6. **Security first** - Validate all inputs, use RLS policies
7. **Performance matters** - Optimize queries and images
8. **Document changes** - Update this file as you progress

Remember: The goal is a delightful, reliable gift registry experience that brings joy to special occasions! 🎉

---

*Last Updated: Week 2, Day 5 - Group/Invitation Feature COMPLETE (All 5 Phases Done!) - Email notification bug in progress*