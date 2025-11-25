# Email Deliverability Implementation Status

**Date:** November 24, 2025
**Project:** Memora Gift Registry
**Issue:** Invitation emails going to spam, only deliverable to account owner

---

## Current Problem

### Symptoms
- Emails sent via Resend go to spam folder (not inbox)
- Only the account owner (bn.tousifar86@gmail.com) receives emails
- Other recipients (wife, friends, etc.) do NOT receive emails at all
- Using Resend sandbox domain: `onboarding@resend.dev`

### Root Cause
- Resend sandbox domain (`onboarding@resend.dev`) is flagged by Gmail as spam
- Sandbox domain restricted to account owner's verified email only
- No custom domain authentication (SPF, DKIM, DMARC)
- Email content has spam triggers (emoji, gradients, exclamation marks)

---

## Resend Documentation Guidance

From Resend support team document provided by user:

### Key Points
1. **"Delivered" doesn't mean inbox** - Email providers can route to spam/junk after accepting
2. **Inbox providers don't share filtering info** - Resend only knows initial acceptance
3. **Can't contact every user at scale** - Need proactive optimization

### Recommended Optimizations (for scaling without user contact)
1. ✅ Configure DMARC to build trust
2. ✅ Warm up new domains slowly before large volumes
3. ✅ Change all links to use own domain (matching sender domain)
4. ✅ Turn off open and click tracking
5. ✅ Reduce number of images in email
6. ✅ Improve wording (succinct, clear, avoid spammy words)

---

## User Requirements (Confirmed via Questions)

### Domain
- **Will purchase custom domain** (not using Netlify subdomain)
- Recommended: `memoraapp.com` or `memora.app`

### Approach
- **Comprehensive solution** (not quick fixes)
- Willing to invest time for proper implementation

### Content Priorities
- ✅ Reduce images/styling
- ✅ Improve wording
- Keep brand identity where possible

---

## Current Email Implementation

### Files Involved
1. `app/api/events/[id]/invite/route.js` - Initial invitation email
2. `app/api/events/[id]/invite/resend/route.js` - Reminder/resend email

### Current Email Configuration

**Sender Address:**
```javascript
from: 'Memora <onboarding@resend.dev>'  // Lines 115 and 71
```

**Subject Lines:**
```javascript
// Initial invitation (line 117)
subject: `You're invited to ${event.title}! 🎉`

// Reminder (line 73)
subject: `Reminder: You're invited to ${event.title}! 🎉`
```

**Spam Triggers in Current Email:**
- ❌ Emoji in subject line (🎉)
- ❌ Exclamation marks
- ❌ Heavy gradient styling: `linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6)`
- ❌ Purple background color
- ❌ Gradient buttons
- ❌ Complex HTML with multiple backgrounds
- ❌ Marketing-style language

**Links:**
```javascript
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://memoraapp.netlify.app';
const joinUrl = `${siteUrl}/join/${event.invite_code}`;
```

### Current Environment Variables (from .env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://fzxemklexjrkgniuyoga.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[key present]
STRIPE_SECRET_KEY=sk_test_[key present]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_[key present]
STRIPE_WEBHOOK_SECRET=whsec_[key present]
SUPABASE_SERVICE_ROLE_KEY=[key present]
RESEND_API_KEY=re_atubapNp_Q2XbfLbF4tKpRxNxXaVqXRJi
```

**Missing Variables:**
- ❌ `NEXT_PUBLIC_SITE_URL` (not explicitly set, uses fallback)
- ❌ `RESEND_FROM_EMAIL` (not configured)

---

## Complete Implementation Plan Created

**Location:** `C:\Users\bntou\.claude\plans\abstract-hugging-pebble.md`

### Plan Summary

**Timeline:** 2-3 weeks total
- Setup: 2-3 days
- Domain warming: 7-21 days

**Cost:** $10-130 first year, $10-250/year ongoing

### Implementation Phases

#### Phase 1: Domain Purchase & Setup (Day 1)
- Purchase `memoraapp.com` on Cloudflare (~$10/year)
- Use subdomain strategy: `mail.memoraapp.com` for email sending

#### Phase 2: DNS Configuration (Day 1-2)
- Add domain to Resend
- Configure SPF, DKIM, DMARC records in Cloudflare
- Verify DNS propagation
- Disable open/click tracking in Resend

#### Phase 3: Code Changes (Day 2-3) - **READY TO IMPLEMENT**

**File Changes Required:**

**1. Update Sender Address (both files)**
```javascript
// Change line 115 in invite/route.js, line 71 in resend/route.js
from: 'Memora <invites@mail.memoraapp.com>',
```

**2. Update Subject Lines**
```javascript
// invite/route.js line 117
subject: `${ownerName} invited you to ${event.title}`,

// resend/route.js line 73
subject: `Reminder: ${ownerName} invited you to ${event.title}`,
```

**3. Replace HTML Templates (lines 118-158 and 74-114)**
- Remove all gradients (use solid colors)
- Remove emoji from header
- White background instead of purple
- Simplified structure
- See full template in plan file

**4. Add Plain Text Version**
```javascript
text: `
Hello,

${ownerName} has invited you to their event: ${event.title}

${eventDate ? `Date: ${eventDate}` : ''}
${event.description ? `\n${event.description}` : ''}

View the gift registry and join the event:
${joinUrl}

---
Sent via Memora - ${siteUrl}
`.trim()
```

**5. Update .env.local**
```env
NEXT_PUBLIC_SITE_URL=https://memoraapp.netlify.app
RESEND_FROM_EMAIL=invites@mail.memoraapp.com
```

**6. Update Netlify Environment Variables**
- Add same two variables in Netlify dashboard

#### Phase 4: Testing & Validation (Day 3-4)
- Local testing with `npm run dev`
- Deploy to Netlify
- Multi-provider testing (Gmail, Yahoo, Outlook)
- Verify email authentication (SPF, DKIM, DMARC pass)
- Test spam score at mail-tester.com (target ≥8/10)

#### Phase 5: Domain Warming (Weeks 1-3)
**Critical:** Gradual volume increase to build sender reputation

**Week 1 Schedule:**
| Day | Volume | Action |
|-----|--------|--------|
| 1 | 10-20 | Send to yourself (different providers) |
| 2 | 15-25 | Send to 5-10 friends/family |
| 3 | 20-30 | Expand to 15-20 recipients |
| 4 | 30-50 | First real event (small) |
| 5 | 50-75 | Multiple small events |
| 6 | 75-100 | Regular usage |
| 7 | 100-150 | Increase volume |

**Metrics to Monitor:**
- Bounce rate: MUST stay <4%
- Spam complaints: MUST stay <0.08%
- Open rate: Target 20%+

**Week 2:** 150-500 emails/day
**Week 3:** 500-1,000+ emails/day (fully warmed)

#### Phase 6: DMARC Upgrade (Weeks 4-8)
Gradually strengthen DMARC from `p=none` → `p=quarantine` → `p=reject`

---

## What Has Been Done

### ✅ Completed
1. ✅ Explored current email implementation (3 parallel agents)
2. ✅ Analyzed email content structure and spam triggers
3. ✅ Reviewed domain/DNS configuration status
4. ✅ Examined link construction in emails
5. ✅ Asked user clarifying questions about approach
6. ✅ Created comprehensive implementation plan
7. ✅ Plan approved by user

### ❌ Not Yet Started (Awaiting Implementation)
- ❌ Domain purchase
- ❌ DNS configuration
- ❌ Code changes to email templates
- ❌ Environment variable updates
- ❌ Testing
- ❌ Domain warming

---

## Next Steps (In Order)

### Step 1: Purchase Domain (User Action)
1. Go to https://www.cloudflare.com/products/registrar/
2. Search for `memoraapp.com` (or `memora.app`)
3. Purchase domain (~$10/year)
4. Complete Cloudflare account setup

### Step 2: Configure DNS (User Action)
1. Login to https://resend.com/domains
2. Click "+ Add Domain"
3. Enter: `mail.memoraapp.com`
4. Copy the 3 DNS records Resend provides (SPF, DKIM, DMARC)
5. Add those records in Cloudflare DNS
6. Wait 15-30 minutes
7. Verify in Resend dashboard
8. Disable tracking in Resend settings

### Step 3: Code Changes (Developer Action - Ready to implement)
1. Update both email route files (templates, subject lines, sender address)
2. Add plain text versions
3. Update .env.local
4. Test locally
5. Commit and push to GitHub
6. Update Netlify environment variables
7. Deploy

### Step 4: Testing (Developer Action)
1. Send test emails to Gmail, Yahoo, Outlook
2. Verify inbox placement (not spam)
3. Check email authentication passes
4. Test on mobile devices
5. Verify all links work

### Step 5: Domain Warming (User + Developer)
1. Follow gradual sending schedule (see plan)
2. Monitor Resend dashboard daily
3. Track bounce/spam rates
4. Adjust volume if issues arise
5. Continue for 7-21 days until fully warmed

---

## Key Files Reference

### Code Files
- `C:\Users\bntou\OneDrive\Desktop\gift-registry\app\api\events\[id]\invite\route.js`
- `C:\Users\bntou\OneDrive\Desktop\gift-registry\app\api\events\[id]\invite\resend\route.js`
- `C:\Users\bntou\OneDrive\Desktop\gift-registry\.env.local`

### Documentation Files
- `C:\Users\bntou\OneDrive\Desktop\gift-registry\CLAUDE.md` (main project docs)
- `C:\Users\bntou\.claude\plans\abstract-hugging-pebble.md` (detailed implementation plan)
- `C:\Users\bntou\OneDrive\Desktop\gift-registry\EMAIL_DELIVERABILITY_STATUS.md` (this file)

---

## Critical Resources

### DNS/Domain Tools
- Cloudflare Registrar: https://www.cloudflare.com/products/registrar/
- Resend Dashboard: https://resend.com/domains
- DNS Checker: https://dnschecker.org
- MX Toolbox: https://mxtoolbox.com

### Testing Tools
- Mail Tester: https://www.mail-tester.com
- Google Postmaster: https://postmaster.google.com
- Sender Score: https://senderscore.org

### Documentation
- Resend Deliverability: https://resend.com/docs/knowledge-base/how-do-i-maximize-deliverability-for-supabase-auth-emails
- Domain Warming: https://resend.com/blog/how-to-warm-up-a-new-domain
- SPF/DKIM/DMARC: https://dmarcdkim.com/setup/how-to-setup-resend-spf-dkim-and-dmarc-records

---

## Expected Outcomes

### Before Implementation
- ❌ Emails go to spam
- ❌ Only account owner receives emails
- ❌ Sandbox domain limitations
- ❌ No sender authentication

### After Implementation
- ✅ 90%+ inbox delivery rate
- ✅ Any recipient can receive emails
- ✅ Professional sender domain (`invites@mail.memoraapp.com`)
- ✅ Strong sender reputation
- ✅ SPF/DKIM/DMARC authentication
- ✅ Production-ready email infrastructure
- ✅ Scalable for growth

---

## Important Notes

1. **Domain warming is critical** - Don't skip this step or emails will still go to spam
2. **Monitor daily for first 2 weeks** - Catch issues early
3. **Keep bounce rate <4%** - Remove bad email addresses immediately
4. **Engagement helps** - Ask early recipients to open/click/reply
5. **Be patient** - Full reputation takes 7-21 days to build
6. **Cost is minimal** - ~$10/year for domain is all you need to start

---

## Questions for Next Session

When you open a new chat, you can reference this file and the plan file to continue implementation. Key questions to address:

1. Have you purchased the domain yet?
2. If yes, which domain did you choose? (memoraapp.com or memora.app)
3. Have you configured DNS in Cloudflare/Resend?
4. Are you ready to proceed with code changes?
5. Do you want to test locally first or deploy directly?

---

**Status:** Planning complete, ready for implementation
**Blocker:** Awaiting domain purchase and DNS configuration
**Next Action:** User purchases domain, then developer implements code changes

---

*This document summarizes the complete state of the email deliverability improvement project as of November 24, 2025.*
