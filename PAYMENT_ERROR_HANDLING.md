# Payment Error Handling Documentation

## Overview

This document describes the failed payment handling system implemented in the gift registry application. The system provides immediate user feedback when payments fail, displaying specific error messages based on the failure type.

## Architecture

The payment error handling system uses a combination of:
1. **Verify Payment API** - Checks payment status immediately when users return from Stripe checkout
2. **Stripe Webhooks** - Receives asynchronous notifications about payment failures
3. **Error Banner UI** - Displays user-friendly error messages on the event page

## Flow Diagram

```
User attempts payment
    ↓
Stripe Checkout Session created
    ↓
Payment fails (card declined, insufficient funds, etc.)
    ↓
User redirected to success URL (with session_id)
    ↓
Event page verifies payment via /api/verify-payment
    ↓
API detects failure and returns error details
    ↓
Error banner displayed with specific message
```

## API Endpoints

### POST `/api/verify-payment`

Verifies a Stripe checkout session and detects payment failures.

**Request:**
```json
{
  "sessionId": "cs_test_..."
}
```

**Response (Success):**
```json
{
  "valid": true,
  "status": "paid",
  "amount": 2500,
  "completed": true,
  "failed": false,
  "currency": "usd"
}
```

**Response (Failed Payment):**
```json
{
  "valid": true,
  "status": "unpaid",
  "amount": 2500,
  "completed": false,
  "failed": true,
  "errorType": "card_declined",
  "errorMessage": "Your card was declined. Please contact your card issuer or try a different payment method.",
  "currency": "usd"
}
```

**Response (Invalid Session):**
```json
{
  "valid": false,
  "error": "Invalid or expired session",
  "status": "invalid"
}
```

### POST `/api/webhook`

Handles Stripe webhook events, including payment failures.

**Supported Events:**
- `checkout.session.completed` - Successful payment
- `payment_intent.payment_failed` - Failed payment

**Webhook Handler:**
- Logs failed payment details including:
  - Payment intent ID
  - Item ID (if available)
  - Amount and currency
  - Decline code
  - Error message and type
  - Customer ID

## Error Types and Messages

The system maps Stripe decline codes to user-friendly error messages:

| Error Type | Decline Code | User Message |
|------------|--------------|--------------|
| `card_declined` | `card_declined` | Your card was declined. Please contact your card issuer or try a different payment method. |
| `insufficient_funds` | `insufficient_funds` | Insufficient funds in your account. Please use a different payment method or contact your bank. |
| `expired_card` | `expired_card` | Your card has expired. Please update your payment information and try again. |
| `incorrect_cvc` | `incorrect_cvc` | The CVV code entered is incorrect. Please verify and try again. |
| `incorrect_zip` | `incorrect_zip` | The ZIP code entered is incorrect. Please verify and try again. |
| `generic_decline` | `generic_decline` | Your bank has rejected the transaction. Please contact your bank for more details or try a different payment method. |
| `payment_failed` | (default) | Payment failed. Please try again or contact support if the problem persists. |

## Implementation Details

### Error Detection

The verify-payment API checks for failed payments by:
1. Examining `payment_intent.last_payment_error` for error details
2. Checking `payment_status === 'unpaid'` as a fallback
3. Extracting decline codes and error messages from Stripe's response

### Error Banner Component

Located in `app/event/[slug]/page.jsx`:
- Red background (`bg-red-100`) with red border (`border-red-500`)
- Displays error icon (✕) and "Payment Failed" heading
- Shows specific error message below
- Auto-dismisses after 10 seconds
- Can be manually closed with × button

### Error Message Mapping

The `getErrorMessage()` function in the event page maps error types to user-friendly messages. If an error type isn't mapped, it falls back to:
1. Stripe's error message (if available)
2. Default generic message

## Testing

### Testing Failed Payments

To test failed payment handling:

1. **Using Stripe Test Cards:**
   - Use Stripe's test card numbers that are designed to fail
   - Example: `4000000000000002` (card declined)
   - Example: `4000000000009995` (insufficient funds)

2. **Manual Testing:**
   - Create a checkout session
   - Use a test card that will decline
   - Complete the payment flow
   - Verify error banner appears with correct message

3. **Webhook Testing:**
   - Use Stripe CLI to forward webhooks locally
   - Trigger `payment_intent.payment_failed` events
   - Verify webhook handler logs the failure correctly

### Stripe CLI Testing

```bash
# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhook

# Trigger a test payment failure
stripe trigger payment_intent.payment_failed
```

## Troubleshooting

### Error Banner Not Showing

1. **Check URL Parameters:**
   - Ensure `?success=true&session_id=...` is present in URL
   - Verify session ID is valid

2. **Check API Response:**
   - Inspect network tab for `/api/verify-payment` response
   - Verify `failed: true` is present in response

3. **Check Console:**
   - Look for JavaScript errors
   - Verify `errorBanner` state is being set

### Webhook Not Receiving Events

1. **Verify Webhook Secret:**
   - Check `STRIPE_WEBHOOK_SECRET` environment variable
   - Ensure it matches Stripe dashboard webhook secret

2. **Check Webhook Endpoint:**
   - Verify webhook URL is accessible
   - Check Stripe dashboard for webhook delivery status

3. **Verify Event Types:**
   - Ensure `payment_intent.payment_failed` is enabled in Stripe dashboard

### Generic Error Messages

If generic error messages appear instead of specific ones:

1. **Check Error Type:**
   - Verify `errorType` is being returned from API
   - Check if error type exists in mapping function

2. **Check Stripe Response:**
   - Inspect `last_payment_error` object
   - Verify `decline_code` or `code` is present

## Code Locations

- **Verify Payment API:** `app/api/verify-payment/route.js`
- **Webhook Handler:** `app/api/webhook/route.js`
- **Error Banner UI:** `app/event/[slug]/page.jsx`
- **Error Message Mapping:** `getErrorMessage()` function in event page

## Environment Variables

Required environment variables:
- `STRIPE_SECRET_KEY` - Stripe secret key for API calls
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification secret
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for webhooks)

## Future Enhancements

Potential improvements:
- Retry payment button in error banner
- Failed payment analytics/logging in database
- Email notifications for failed payments
- Additional error types and messages
- Payment method suggestions based on error type

## References

- [Stripe Decline Codes](https://stripe.com/docs/declines)
- [Stripe Payment Intents API](https://stripe.com/docs/api/payment_intents)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)

