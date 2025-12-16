"use client";

import { useState, useEffect } from "react";
import supabase from "../lib/supabase";

export default function LoginPage() {
  const [authMode, setAuthMode] = useState("signin"); // "signin" or "signup"

  // Email/Password states
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Phone states
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  // General states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [oauthLoading, setOauthLoading] = useState(null);
  const [returnUrl, setReturnUrl] = useState('/dashboard');

  // Check for OAuth errors and returnUrl in URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const errorParam = urlParams.get('error');
      const returnUrlParam = urlParams.get('returnUrl');

      if (errorParam) {
        setError(decodeURIComponent(errorParam));
        window.history.replaceState({}, '', '/login');
      }

      if (returnUrlParam) {
        setReturnUrl(decodeURIComponent(returnUrlParam));
      }
    }
  }, []);

  const handleOAuthSignIn = async (provider) => {
    setOauthLoading(provider);
    setError("");

    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}${returnUrl}`,
          skipBrowserRedirect: false,
          ...(isMobile && {
            queryParams: {
              prompt: 'select_account',
              access_type: 'offline',
            }
          })
        }
      });

      if (error) {
        setError(error.message);
        setOauthLoading(null);
      } else if (data?.url) {
        if (isMobile) {
          window.location.replace(data.url);
        } else {
          window.location.href = data.url;
        }
      } else {
        setOauthLoading(null);
      }
    } catch (err) {
      console.error('OAuth error:', err);
      setError(err.message || 'Failed to initiate OAuth sign in');
      setOauthLoading(null);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!otpSent) {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone,
        options: {
          channel: 'sms'
        }
      });

      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setOtpSent(true);
      }
    } else {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: otpCode,
        type: 'sms'
      });

      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        window.location.href = returnUrl;
      }
    }
  };

  const handleEmailPasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (authMode === "signup") {
      if (!username.trim()) {
        setError("Username is required");
        setLoading(false);
        return;
      }

      if (username.length < 3) {
        setError("Username must be at least 3 characters");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}${returnUrl}`,
          data: {
            username: username.trim(),
            display_name: username.trim(),
          }
        }
      });

      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setError("");
        alert("Sign up successful! Please check your email to verify your account.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        window.location.href = returnUrl;
      }
    }
  };

  const resetForm = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setPhone("");
    setOtpSent(false);
    setOtpCode("");
    setError("");
    setShowPhoneAuth(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--lavender-50)] via-[var(--peach-100)] to-[var(--mint-100)] py-8 font-body">
      <div className="bg-white shadow-xl rounded-2xl px-10 py-8 max-w-md w-full border border-[var(--lavender-100)]">
        {/* Header with Logo and Sign In/Sign Up Toggle */}
        <div className="mb-6">
          <div className="flex justify-center mb-4">
            <img src="/memora-logo.png" alt="Memora" className="h-12 w-auto" />
          </div>
          <h1 className="text-2xl font-bold font-display mb-4 text-center text-[var(--charcoal-900)]">
            {authMode === "signin" ? "Welcome Back" : "Create Account"}
          </h1>
          <div className="flex border border-[var(--lavender-200)] rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signin");
                resetForm();
              }}
              className={`flex-1 py-2 px-4 text-sm font-semibold transition ${
                authMode === "signin"
                  ? "bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-500)] text-white"
                  : "bg-white text-[var(--charcoal-900)] hover:bg-[var(--lavender-50)]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                resetForm();
              }}
              className={`flex-1 py-2 px-4 text-sm font-semibold transition ${
                authMode === "signup"
                  ? "bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-500)] text-white"
                  : "bg-white text-[var(--charcoal-900)] hover:bg-[var(--lavender-50)]"
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-[var(--peach-100)] border-2 border-[var(--peach-300)] text-[var(--charcoal-900)] px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Main Content - Email/Password Form or Phone Auth */}
        {!showPhoneAuth ? (
          <>
            {/* Email/Password Form */}
            <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--charcoal-900)]" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--lavender-300)] text-[var(--charcoal-900)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="you@example.com"
                />
              </div>

              {authMode === "signup" && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--charcoal-900)]" htmlFor="username">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--lavender-300)] text-[var(--charcoal-900)]"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    required
                    disabled={loading}
                    placeholder="Choose a username"
                    maxLength="20"
                    minLength="3"
                  />
                  <p className="text-xs text-[var(--charcoal-800)] mt-1">
                    3-20 characters, letters, numbers, underscores, and hyphens only
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--charcoal-900)]" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                  className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--lavender-300)] text-[var(--charcoal-900)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder={authMode === "signin" ? "Enter your password" : "Create a password"}
                />
                {authMode === "signup" && (
                  <p className="text-xs text-[var(--charcoal-800)] mt-1">
                    Must be at least 6 characters
                  </p>
                )}
              </div>

              {authMode === "signup" && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--charcoal-900)]" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--lavender-300)] text-[var(--charcoal-900)]"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Confirm your password"
                  />
                </div>
              )}

              {authMode === "signin" && (
                <div className="text-right">
                  <button
                    type="button"
                    className="text-sm text-[var(--lavender-600)] hover:text-[var(--lavender-700)]"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-600)] text-white py-3 rounded-lg font-semibold hover:from-[var(--lavender-500)] hover:to-[var(--lavender-700)] transition shadow-md hover:shadow-lg disabled:opacity-50"
                disabled={loading}
              >
                {loading
                  ? authMode === "signin"
                    ? "Signing In..."
                    : "Creating Account..."
                  : authMode === "signin"
                  ? "Sign In"
                  : "Create Account"}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--lavender-200)]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-[var(--charcoal-800)]">OR</span>
              </div>
            </div>

            {/* OAuth and Phone Options */}
            <div className="space-y-3">
              <button
                onClick={() => handleOAuthSignIn('google')}
                disabled={oauthLoading !== null}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[var(--lavender-200)] text-[var(--charcoal-900)] py-3 rounded-lg font-semibold hover:bg-[var(--lavender-50)] transition disabled:opacity-50 relative"
              >
                {oauthLoading === 'google' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--lavender-500)]"></div>
                  </div>
                )}
                <svg className={`w-5 h-5 ${oauthLoading === 'google' ? 'opacity-0' : ''}`} viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className={oauthLoading === 'google' ? 'opacity-0' : ''}>Continue with Google</span>
              </button>

              <button
                onClick={() => setShowPhoneAuth(true)}
                className="w-full bg-white border-2 border-[var(--lavender-200)] text-[var(--charcoal-900)] py-3 rounded-lg font-semibold hover:bg-[var(--lavender-50)] transition"
              >
                Continue with Phone Number
              </button>
            </div>
          </>
        ) : (
          /* Phone Number Authentication */
          <form onSubmit={handlePhoneSubmit} className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setShowPhoneAuth(false);
                  setPhone("");
                  setOtpSent(false);
                  setOtpCode("");
                  setError("");
                }}
                className="text-[var(--lavender-600)] hover:text-[var(--lavender-700)]"
              >
                ← Back
              </button>
              <h2 className="text-lg font-semibold text-[var(--charcoal-900)]">Phone Number</h2>
            </div>

            {!otpSent ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--charcoal-900)]" htmlFor="phone">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--lavender-300)] text-[var(--charcoal-900)]"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="+1234567890"
                  />
                  <p className="text-xs text-[var(--charcoal-800)] mt-1">
                    Include country code (e.g., +1 for US)
                  </p>
                </div>
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-600)] text-white py-3 rounded-lg font-semibold hover:from-[var(--lavender-500)] hover:to-[var(--lavender-700)] transition disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Verification Code"}
                </button>
              </>
            ) : (
              <>
                <div className="text-[var(--mint-400)] text-sm mb-4 text-center font-medium">
                  Verification code sent to {phone}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--charcoal-900)]" htmlFor="otp">
                    Enter Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    maxLength="6"
                    className="w-full px-3 py-2 border border-[var(--lavender-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--lavender-300)] text-center text-2xl tracking-widest text-[var(--charcoal-900)]"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    disabled={loading}
                    placeholder="000000"
                  />
                </div>
                <div className="space-y-2">
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-600)] text-white py-3 rounded-lg font-semibold hover:from-[var(--lavender-500)] hover:to-[var(--lavender-700)] transition disabled:opacity-50"
                    disabled={loading || otpCode.length !== 6}
                  >
                    {loading ? "Verifying..." : "Verify Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                      setError("");
                    }}
                    className="w-full text-[var(--lavender-600)] py-2 text-sm hover:text-[var(--lavender-700)]"
                    disabled={loading}
                  >
                    Resend Code
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {loading && !showPhoneAuth && (
          <div className="text-center text-[var(--charcoal-800)] text-sm mt-4">
            Redirecting...
          </div>
        )}
      </div>
    </div>
  );
}
