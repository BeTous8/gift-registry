# OAuth Provider Setup Guide

This guide will walk you through setting up Google, Apple, and Microsoft OAuth authentication in your Supabase project.

## Prerequisites

- A Supabase account and project
- Access to Google Cloud Console (for Google OAuth)
- Apple Developer account (for Apple Sign In)
- Microsoft Azure account (for Microsoft OAuth)

---

## 1. Google OAuth Setup

### Step 1: Create OAuth Credentials in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** user type
   - Fill in app information (name, support email, developer contact)
   - Add scopes: `email`, `profile`, `openid`
   - Add test users (if in testing mode)
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: Your app name (e.g., "Gift Registry")
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for local development)
     - `https://yourdomain.com` (your production domain)
   - Authorized redirect URIs:
     - `https://fzxemklexjrkgniuyoga.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for local development)
7. Copy the **Client ID** and **Client Secret**

### Step 2: Configure in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Providers**
3. Find **Google** and click to configure
4. Enable Google provider
5. Enter:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
6. Click **Save**

### Step 3: Update Redirect URIs

After enabling in Supabase, copy the exact redirect URI shown in Supabase and add it to Google Cloud Console's authorized redirect URIs if not already added.

---

## 2. Apple Sign In Setup

### Step 1: Create Service ID in Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Go to **Identifiers** > Click **+** to create new
4. Select **Services IDs** > Continue
5. Register a new Services ID:
   - Description: Your app name
   - Identifier: `com.yourcompany.giftregistry` (reverse domain format)
6. Enable **Sign In with Apple** capability
7. Configure Sign In with Apple:
   - Primary App ID: Select your app's App ID
   - Website URLs:
     - Domains: `yourdomain.com` and `[your-project-ref].supabase.co`
     - Return URLs:
       - `https://[your-project-ref].supabase.co/auth/v1/callback`
       - `http://localhost:3000/auth/callback` (for local development)
8. Save the configuration

### Step 2: Create a Key for Sign In with Apple

1. In Apple Developer Portal, go to **Keys**
2. Click **+** to create a new key
3. Configure:
   - Key Name: "Sign In with Apple Key"
   - Enable **Sign In with Apple**
   - Select your Primary App ID
4. Click **Continue** > **Register**
5. Download the key file (`.p8` file) - **You can only download this once!**
6. Note the **Key ID**

### Step 3: Configure in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Providers**
3. Find **Apple** and click to configure
4. Enable Apple provider
5. Enter:
   - **Services ID**: The identifier you created (e.g., `com.yourcompany.giftregistry`)
   - **Secret Key**: Upload the `.p8` key file you downloaded
   - **Key ID**: The Key ID from Apple Developer Portal
   - **Team ID**: Your Apple Developer Team ID (found in top right of Apple Developer Portal)
6. Click **Save**

---

## 3. Microsoft (Azure AD) OAuth Setup

### Step 1: Register Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - Name: Your app name (e.g., "Gift Registry")
   - Supported account types: Choose based on your needs (usually "Accounts in any organizational directory and personal Microsoft accounts")
   - Redirect URI:
     - Platform: **Web**
     - URI: `https://[your-project-ref].supabase.co/auth/v1/callback`
5. Click **Register**
6. Note the **Application (client) ID** and **Directory (tenant) ID**

### Step 2: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add description and expiration
4. Click **Add**
5. **Copy the secret value immediately** (you won't be able to see it again)

### Step 3: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission** > **Microsoft Graph** > **Delegated permissions**
3. Add permissions:
   - `email`
   - `openid`
   - `profile`
   - `User.Read`
4. Click **Add permissions**
5. Click **Grant admin consent** (if you have admin rights)

### Step 4: Configure in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Providers**
3. Find **Microsoft** (or **Azure**) and click to configure
4. Enable Microsoft provider
5. Enter:
   - **Client ID**: Application (client) ID from Azure
   - **Client Secret**: The client secret value from Azure
   - **Tenant ID**: Directory (tenant) ID from Azure (optional, can use "common" for multi-tenant)
6. Click **Save**

---

## 4. Testing OAuth Providers

### Local Development

1. Make sure your redirect URIs include `http://localhost:3000/auth/callback`
2. Start your Next.js dev server: `npm run dev`
3. Navigate to `/login`
4. Click on an OAuth provider button
5. Complete the OAuth flow
6. You should be redirected back to your app and logged in

### Production

1. Ensure your production domain is added to:
   - Google Cloud Console authorized origins/redirects
   - Apple Developer Portal return URLs
   - Azure Portal redirect URIs
2. Update Supabase redirect URI to use your production domain
3. Test the OAuth flow in production

---

## 5. Troubleshooting

### Common Issues

**"Redirect URI mismatch"**
- Ensure the redirect URI in Supabase matches exactly what's configured in the provider's console
- Check for trailing slashes, http vs https, and exact domain matches

**"Invalid client"**
- Verify Client ID and Client Secret are correct
- Check that the provider is enabled in Supabase Dashboard

**"Access denied"**
- For Google: Check OAuth consent screen is configured
- For Apple: Verify Service ID and key are correctly configured
- For Microsoft: Ensure API permissions are granted and admin consent is given

**"Session not found" after redirect**
- Check that the callback route (`/auth/callback`) is working
- Verify Supabase environment variables are set correctly
- Check browser console for errors

### Getting Supabase Project Reference

Your Supabase project reference is found in:
- Supabase Dashboard URL: `https://app.supabase.com/project/[project-ref]`
- Or in your project settings under "Reference ID"

---

## 6. Environment Variables

Make sure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These are already configured if you've set up Supabase previously.

---

## 7. Next Steps

After configuring all providers:

1. Test each OAuth provider individually
2. Verify users can sign in and sign up with each provider
3. Check that user data (email, name) is being captured correctly
4. Test the redirect flow works properly

Once OAuth is working, you can proceed with phone number and email/password authentication implementation.

