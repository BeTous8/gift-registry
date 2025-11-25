"use client";

import { useState, useEffect } from "react";
import supabase from "../lib/supabase";

export default function LoginPage() {
  const [authMode, setAuthMode] = useState("signin"); // "signin" or "signup"
  const [selectedMethod, setSelectedMethod] = useState(null); // "oauth", "phone", "email"
  
  // Email/Password states
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Phone states
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  
  // General states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [oauthLoading, setOauthLoading] = useState(null); // Track which OAuth provider is loading
  const [returnUrl, setReturnUrl] = useState('/dashboard'); // Default to dashboard

  // Check for OAuth errors and returnUrl in URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const errorParam = urlParams.get('error');
      const returnUrlParam = urlParams.get('returnUrl');

      if (errorParam) {
        setError(decodeURIComponent(errorParam));
        // Clean URL
        window.history.replaceState({}, '', '/login');
      }

      // Store returnUrl in state for use in redirects
      if (returnUrlParam) {
        setReturnUrl(decodeURIComponent(returnUrlParam));
      }
    }
  }, []);

  const handleOAuthSignIn = async (provider) => {
    setOauthLoading(provider);
    setError("");
    
    try {
      // Detect if we're on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}${returnUrl}`,
          skipBrowserRedirect: false,
          // For mobile, ensure proper redirect handling
          ...(isMobile && {
            queryParams: {
              // Force account selection to avoid passkey issues
              prompt: 'select_account',
              // Disable passkey/autofill on mobile
              access_type: 'offline',
            }
          })
        }
      });
      
      if (error) {
        setError(error.message);
        setOauthLoading(null);
      } else if (data?.url) {
        // For mobile, use replace to avoid back button issues
        // For desktop, use href for better UX
        if (isMobile) {
          window.location.replace(data.url);
        } else {
          window.location.href = data.url;
        }
        // Don't set loading to false as we're redirecting
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
      // Send OTP
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
      // Verify OTP
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
      // Validate username
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

      // Validate password confirmation
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
      // Sign in
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
    setSelectedMethod(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="bg-white shadow-md rounded-lg px-10 py-8 max-w-md w-full">
        {/* Header with Sign In/Sign Up Toggle */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4 text-center">
            {authMode === "signin" ? "Sign In" : "Sign Up"}
          </h1>
          <div className="flex border border-gray-300 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signin");
                resetForm();
              }}
              className={`flex-1 py-2 px-4 text-sm font-semibold transition ${
                authMode === "signin"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
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
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* OAuth Providers Section */}
        {!selectedMethod && (
          <>
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleOAuthSignIn('google')}
                disabled={oauthLoading !== null}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-md font-semibold hover:bg-gray-50 transition disabled:opacity-50 relative"
              >
                {oauthLoading === 'google' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
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
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            {/* Method Selection Buttons */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => setSelectedMethod("phone")}
                className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-md font-semibold hover:bg-gray-50 transition"
              >
                Continue with Phone Number
              </button>
              <button
                onClick={() => setSelectedMethod("email")}
                className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition shadow-md hover:shadow-lg"
              >
                {authMode === "signup" ? "Create Account with Email" : "Sign In with Email"}
              </button>
            </div>
          </>
        )}

        {/* Phone Number Authentication */}
        {selectedMethod === "phone" && (
          <form onSubmit={handlePhoneSubmit} className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setSelectedMethod(null);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                ← Back
              </button>
              <h2 className="text-lg font-semibold">Phone Number</h2>
            </div>

            {!otpSent ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="phone">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="+1234567890"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Include country code (e.g., +1 for US)
                  </p>
                </div>
                {error && (
                  <div className="text-red-600 text-sm text-center">{error}</div>
                )}
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Verification Code"}
                </button>
              </>
            ) : (
              <>
                <div className="text-green-600 text-sm mb-4 text-center">
                  Verification code sent to {phone}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="otp">
                    Enter Verification Code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    maxLength="6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200 text-center text-2xl tracking-widest"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    disabled={loading}
                    placeholder="000000"
                  />
                </div>
                {error && (
                  <div className="text-red-600 text-sm text-center">{error}</div>
                )}
                <div className="space-y-2">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold hover:bg-blue-700 transition disabled:opacity-50"
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
                    className="w-full text-gray-600 py-2 text-sm hover:text-gray-800"
                    disabled={loading}
                  >
                    Resend Code
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Email/Password Authentication */}
        {selectedMethod === "email" && (
          <form onSubmit={handleEmailPasswordSubmit} className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setSelectedMethod(null);
                }}
                className="text-gray-600 hover:text-gray-800"
              >
                ← Back
              </button>
              <h2 className="text-lg font-semibold">
                {authMode === "signin" ? "Email & Password" : "Create Account"}
              </h2>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="you@example.com"
              />
            </div>
            {authMode === "signup" && (
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  required
                  disabled={loading}
                  placeholder="Enter your username"
                  maxLength="20"
                  minLength="3"
                />
                <p className="text-xs text-gray-500 mt-1">
                  3-20 characters, letters, numbers, underscores, and hyphens only
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder={authMode === "signin" ? "Enter your password" : "Create a password"}
              />
              {authMode === "signup" && (
                <p className="text-xs text-gray-500 mt-1">
                  Must be at least 6 characters
                </p>
              )}
            </div>

            {authMode === "signup" && (
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
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
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm text-center">{error}</div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading
                ? authMode === "signin"
                  ? "Signing In..."
                  : "Creating Account..."
                : authMode === "signin"
                ? "Sign In"
                : "Sign Up"}
            </button>
          </form>
        )}

        {loading && selectedMethod === null && (
          <div className="text-center text-gray-600 text-sm mt-4">
            Redirecting to {authMode === "signin" ? "sign in" : "sign up"}...
          </div>
        )}
      </div>
    </div>
  );
}



