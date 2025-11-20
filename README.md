# Memora - Gift Registry Platform

A modern, celebratory gift registry platform that helps users create wishlists for special events, share them with friends and family, and receive monetary contributions towards their wished items.

**Live Demo:** [https://memoraapp.netlify.app](https://memoraapp.netlify.app)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Payment Flow](#payment-flow)
- [Development](#development)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)

## Features

### Core Functionality
- **Multi-Method Authentication** - Google OAuth, Email/Password, Phone OTP, and Magic Links
- **Event Management** - Create, edit, and delete gift registry events with custom descriptions and dates
- **Item Tracking** - Add items with prices, images, and product links
- **Group Contributions** - Multiple people can contribute to single items
- **Real-Time Progress** - Visual funding progress bars for each item and event
- **Secure Payments** - Stripe-powered payment processing with comprehensive error handling
- **Shareable Links** - Public event pages with unique URLs (no login required to view)
- **Mobile Optimized** - Responsive design with mobile-first OAuth flow

### Dashboard Features
- **Analytics Overview** - Track total events, upcoming events, total raised, and item counts
- **Event Cards** - Beautiful gradient-themed cards with key metrics
- **Filtering** - View all events or filter to upcoming events only
- **Quick Actions** - Share, edit, or delete events directly from the dashboard

### User Experience
- **Toast Notifications** - Real-time feedback for all actions
- **Payment Confirmation** - Success banners with contribution amounts
- **Error Handling** - User-friendly error messages for payment failures
- **Loading States** - Clear feedback during async operations
- **Confirmation Dialogs** - Prevent accidental deletions

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **Tailwind CSS 4** - Utility-first CSS framework
- **JavaScript/JSX** - Primary language

### Backend
- **Next.js API Routes** - Serverless functions
- **Supabase** - PostgreSQL database with real-time capabilities
- **Supabase Auth** - Authentication service

### Payments
- **Stripe** - Payment processing
- **Stripe Checkout** - Hosted checkout pages
- **Stripe Webhooks** - Payment event handling

### Deployment
- **Netlify** - Hosting and continuous deployment

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Supabase account (free tier available)
- Stripe account (test mode is sufficient for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd gift-registry
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory with the following variables:

   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Stripe Configuration
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
   STRIPE_SECRET_KEY=sk_test_your_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

   # Site URL (for production)
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. **Set up the database**

   - Log in to your Supabase dashboard
   - Navigate to the SQL Editor
   - Run the SQL commands in `SUPABASE_RLS_POLICIES.sql` to create tables and security policies

5. **Configure OAuth (Optional)**

   - Follow instructions in `OAUTH_SETUP_GUIDE.md` for Google OAuth setup
   - Add authorized redirect URIs in Google Cloud Console
   - Configure OAuth provider in Supabase Auth settings

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open the application**

   Visit [http://localhost:3000](http://localhost:3000) in your browser

### Testing Payments Locally

To test Stripe webhooks locally:

1. **Install Stripe CLI**
   - Download from [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)

2. **Forward webhooks to localhost**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook
   ```

3. **Use test cards**
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Any future expiry date, any CVC, any ZIP

## Project Structure

```
gift-registry/
├── app/
│   ├── api/                          # Backend API routes
│   │   ├── create-checkout/         # Create Stripe checkout session
│   │   ├── verify-payment/          # Verify payment status
│   │   ├── webhook/                 # Handle Stripe webhooks
│   │   └── auth/callback/           # OAuth callback handler
│   ├── components/                  # Reusable React components
│   │   ├── ClientToastProvider.jsx  # Client-side toast wrapper
│   │   └── ToastProvider.jsx        # Toast notification system
│   ├── lib/
│   │   └── supabase.js              # Supabase client configuration
│   ├── dashboard/                   # User dashboard page
│   ├── create-event/                # Event creation page
│   ├── event/[slug]/                # Public event view
│   ├── login/                       # Authentication page
│   ├── page.jsx                     # Landing page
│   ├── layout.js                    # Root layout
│   └── globals.css                  # Global styles
├── public/                          # Static assets
├── OAUTH_SETUP_GUIDE.md            # OAuth configuration guide
├── PAYMENT_ERROR_HANDLING.md       # Payment error documentation
├── SUPABASE_RLS_POLICIES.sql       # Database security policies
├── next.config.mjs                  # Next.js configuration
├── tailwind.config.js               # Tailwind CSS configuration
└── package.json                     # Dependencies
```

## Database Schema

### Events Table

Stores user-created gift registry events.

```sql
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  event_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Items Table

Stores wishlist items for each event.

```sql
CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  current_amount_cents INTEGER DEFAULT 0,
  product_link TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Contributions Table

Tracks monetary contributions from visitors.

```sql
CREATE TABLE contributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items ON DELETE CASCADE NOT NULL,
  contributor_name TEXT NOT NULL,
  contributor_email TEXT,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** All monetary values are stored in cents to avoid floating-point precision issues.

## API Endpoints

### POST `/api/create-checkout`

Creates a Stripe checkout session for contributions.

**Request Body:**
```json
{
  "itemId": "uuid-of-item",
  "amount": 2500,
  "contributorName": "John Doe",
  "contributorEmail": "john@example.com"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### POST `/api/verify-payment`

Verifies payment status after Stripe redirect. Implements fallback database update if webhook is delayed.

**Request Body:**
```json
{
  "sessionId": "cs_test_..."
}
```

**Response:**
```json
{
  "status": "complete",
  "amount": 2500,
  "alreadyProcessed": false,
  "error": null
}
```

### POST `/api/webhook`

Handles Stripe webhook events. Requires valid signature.

**Supported Events:**
- `checkout.session.completed` - Updates item amounts and records contributions
- `payment_intent.payment_failed` - Logs payment failures

**Headers:**
- `stripe-signature` - Webhook signature for verification

## Authentication

### Supported Methods

1. **Google OAuth**
   - One-click sign in with Google account
   - Mobile-optimized with PKCE flow
   - Automatic session management

2. **Email/Password**
   - Account creation with username
   - Email verification required
   - Password confirmation validation

3. **Phone OTP**
   - SMS-based verification
   - 6-digit code authentication
   - Country code support

4. **Magic Links**
   - Passwordless email authentication
   - One-click sign-in links

### Session Management

- Auto-refresh tokens
- Cross-tab session synchronization
- LocalStorage persistence
- Proper cleanup on sign-out

## Payment Flow

1. **Contribution Initiation**
   - Visitor views public event page
   - Clicks "Contribute" on an item
   - Modal opens with contribution form

2. **Payment Setup**
   - User selects or enters amount (minimum $0.01)
   - Provides name and optional email
   - Validates that amount doesn't exceed remaining needed

3. **Stripe Checkout**
   - System creates Stripe checkout session
   - User redirected to secure Stripe payment page
   - Enters payment details

4. **Payment Processing**
   - Stripe processes the payment
   - Webhook event sent to `/api/webhook`
   - Database updated with new contribution

5. **Confirmation**
   - User redirected back to event page
   - Success banner displays contribution amount
   - Progress bars update in real-time
   - URL parameters cleaned up

### Error Handling

The system handles various payment scenarios:

- **Card Declined** - User-friendly message with suggestion to try another card
- **Insufficient Funds** - Clear explanation and retry option
- **Expired Card** - Prompt to use different card
- **Network Errors** - Graceful fallback and retry logic
- **Webhook Delays** - Fallback verification via `/api/verify-payment`
- **Duplicate Processing** - Idempotency checks prevent double-charging

See `PAYMENT_ERROR_HANDLING.md` for comprehensive error documentation.

## Development

### Available Scripts

```bash
# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```

### Path Aliases

The project uses `@/*` path alias configured in `jsconfig.json`:

```javascript
// Instead of this:
import { supabase } from '../../lib/supabase'

// Use this:
import { supabase } from '@/app/lib/supabase'
```

### Key Files to Know

- **`app/lib/supabase.js`** - Supabase client with PKCE flow and auto-refresh
- **`app/components/ToastProvider.jsx`** - Global toast notification system
- **`app/event/[slug]/page.jsx`** - Most complex page with contribute modal and owner controls
- **`app/api/webhook/route.js`** - Critical payment processing logic

## Deployment

### Deploying to Netlify

1. **Connect Repository**
   - Push code to GitHub
   - Connect repository to Netlify
   - Select main branch for deployment

2. **Configure Environment Variables**

   Add all variables from `.env.local` to Netlify dashboard:
   - Go to Site Settings → Environment Variables
   - Add each variable (without `NEXT_PUBLIC_SITE_URL` or set to production URL)

3. **Configure Stripe Webhook**

   After first deployment:
   - Go to Stripe Dashboard → Webhooks
   - Add endpoint: `https://your-app.netlify.app/api/webhook`
   - Select events: `checkout.session.completed`, `payment_intent.payment_failed`
   - Copy signing secret to `STRIPE_WEBHOOK_SECRET` environment variable
   - Redeploy site

4. **Test Production Deployment**
   - Create test event
   - Add test item
   - Make test contribution with Stripe test card
   - Verify webhook receipt in Stripe dashboard

### Switching to Live Mode

When ready for real payments:

1. Switch Stripe API keys from test (`sk_test_...`) to live (`sk_live_...`)
2. Update webhook endpoint with live mode signing secret
3. Test with small real payment ($0.50)
4. Monitor Stripe dashboard for issues

## Security

### Authentication Security

- **PKCE Flow** - Secure OAuth for mobile devices
- **Token Refresh** - Automatic session renewal
- **Session Validation** - Server-side checks on protected routes
- **Secure Storage** - LocalStorage with auto-cleanup

### Database Security

- **Row-Level Security (RLS)** - Users can only access their own events
- **Public Read Access** - Events and items viewable by anyone with link
- **Service Role Isolation** - Only webhooks use service role key
- **Cascade Deletes** - Proper cleanup when events deleted

### Payment Security

- **Webhook Verification** - Signature validation on all webhook events
- **Idempotency** - Prevents duplicate payment processing
- **Metadata Validation** - Ensures payment matches intended item
- **Cents Storage** - Avoids floating-point arithmetic errors
- **PCI Compliance** - Stripe handles all sensitive card data

### Additional Measures

- Input sanitization on all forms
- SQL injection prevention via parameterized queries
- XSS prevention through React's built-in escaping
- HTTPS enforcement in production
- No sensitive data in client-side code

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (especially payment flows)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Testing Checklist

Before submitting a PR:

- [ ] All pages load without errors
- [ ] Authentication works for all methods
- [ ] Events can be created, edited, and deleted
- [ ] Items can be added, edited, and deleted
- [ ] Payment flow completes successfully
- [ ] Webhook processes correctly
- [ ] Mobile responsive design maintained
- [ ] No console errors or warnings

## Support & Documentation

### Additional Resources

- **OAuth Setup** - See `OAUTH_SETUP_GUIDE.md`
- **Payment Errors** - See `PAYMENT_ERROR_HANDLING.md`
- **Database Setup** - See `SUPABASE_RLS_POLICIES.sql`

### Troubleshooting

**Payment not updating after contribution:**
- Check Stripe webhook logs for failures
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Ensure `/api/webhook` endpoint is accessible
- Check Supabase logs for RLS policy errors

**OAuth not working:**
- Verify redirect URIs match exactly in Google Console
- Check that OAuth provider is enabled in Supabase
- Ensure `NEXT_PUBLIC_SUPABASE_URL` is correct

**Session expiring immediately:**
- Check that Supabase project URL is correct
- Verify PKCE flow is enabled in `lib/supabase.js`
- Clear browser localStorage and cookies

## License

This project is proprietary. All rights reserved.

---

Built with Next.js, Supabase, and Stripe | [Live Demo](https://memoraapp.netlify.app)
