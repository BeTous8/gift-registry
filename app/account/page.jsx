"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AccountPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [message, setMessage] = useState({ type: "", text: "" });

  // Profile form state
  const [profile, setProfile] = useState({
    display_name: "",
    birthday: "",
    phone: "",
    email: "",
    provider: "email",
    profile_photo_url: null
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUser(user);
    await fetchProfile(user.id);
    setLoading(false);
  }

  async function fetchProfile(userId) {
    try {
      const res = await fetch(`/api/account/profile?userId=${userId}`);
      const data = await res.json();
      if (data.profile) {
        setProfile({
          display_name: data.profile.display_name || "",
          birthday: data.profile.birthday || "",
          phone: data.profile.phone || "",
          email: data.profile.email || "",
          provider: data.profile.provider || "email",
          profile_photo_url: data.profile.profile_photo_url || null
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          display_name: profile.display_name,
          birthday: profile.birthday || null,
          phone: profile.phone
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Profile saved successfully!" });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save profile" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "File too large. Maximum size is 2MB." });
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: "error", text: "Invalid file type. Only JPEG, PNG, and WebP are allowed." });
      return;
    }

    setUploadingPhoto(true);
    setMessage({ type: "", text: "" });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);

      const res = await fetch("/api/account/photo", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        setProfile(prev => ({ ...prev, profile_photo_url: data.url }));
        setMessage({ type: "success", text: "Photo uploaded successfully!" });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to upload photo" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred uploading photo" });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;

    setUploadingPhoto(true);
    try {
      const res = await fetch(`/api/account/photo?userId=${user.id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (data.success) {
        setProfile(prev => ({ ...prev, profile_photo_url: null }));
        setMessage({ type: "success", text: "Photo removed" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to remove photo" });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setChangingPassword(true);
    setMessage({ type: "", text: "" });

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Password changed successfully!" });
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to change password" });
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--cloud-50)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--lavender-500)]"></div>
      </div>
    );
  }

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "preferences", label: "Preferences" },
    { id: "plan", label: "Plan" },
    { id: "security", label: "Security" }
  ];

  return (
    <div className="min-h-screen bg-[var(--cloud-50)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--lavender-200)] px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 rounded-lg hover:bg-[var(--lavender-50)] transition"
          >
            <svg className="w-5 h-5 text-[var(--charcoal-900)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-[var(--charcoal-900)]">Account Settings</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Profile Photo & Name Preview */}
        <div className="bg-white rounded-xl border border-[var(--lavender-200)] p-6 mb-6 flex items-center gap-4">
          <div className="relative">
            {profile.profile_photo_url ? (
              <img
                src={profile.profile_photo_url}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--lavender-400)] to-[var(--peach-400)] flex items-center justify-center">
                <span className="text-white font-semibold text-xl">
                  {profile.display_name?.charAt(0)?.toUpperCase() || profile.email?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-[var(--charcoal-900)]">
              {profile.display_name || profile.email?.split("@")[0] || "User"}
            </p>
            <p className="text-sm text-[var(--charcoal-800)]/60">{profile.email}</p>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--lavender-50)] p-1 rounded-lg overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white text-[var(--charcoal-900)] shadow-sm"
                  : "text-[var(--charcoal-800)]/60 hover:text-[var(--charcoal-900)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-[var(--lavender-200)] p-6">

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-2">
                  Profile Photo
                </label>
                <div className="flex items-center gap-4">
                  {profile.profile_photo_url ? (
                    <img
                      src={profile.profile_photo_url}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--lavender-400)] to-[var(--peach-400)] flex items-center justify-center">
                      <span className="text-white font-semibold text-2xl">
                        {profile.display_name?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="px-4 py-2 text-sm font-medium text-[var(--lavender-600)] border border-[var(--lavender-300)] rounded-lg hover:bg-[var(--lavender-50)] transition disabled:opacity-50"
                    >
                      {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                    </button>
                    {profile.profile_photo_url && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={uploadingPhoto}
                        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-[var(--charcoal-800)]/60">
                  JPG, PNG, or WebP. Max 2MB.
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profile.display_name}
                  onChange={e => setProfile(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--lavender-200)] focus:border-[var(--lavender-400)] focus:ring-2 focus:ring-[var(--lavender-100)] outline-none transition"
                />
              </div>

              {/* Birthday */}
              <div>
                <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-2">
                  Birthday
                </label>
                <input
                  type="date"
                  value={profile.birthday}
                  onChange={e => setProfile(prev => ({ ...prev, birthday: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--lavender-200)] focus:border-[var(--lavender-400)] focus:ring-2 focus:ring-[var(--lavender-100)] outline-none transition"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--lavender-200)] focus:border-[var(--lavender-400)] focus:ring-2 focus:ring-[var(--lavender-100)] outline-none transition"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--lavender-200)] bg-[var(--cloud-50)] text-[var(--charcoal-800)]/60 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-[var(--charcoal-800)]/60">
                  Email cannot be changed
                </p>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-[var(--lavender-400)] to-[var(--peach-400)] text-white font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}

          {/* Preferences Tab */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-[var(--charcoal-900)] mb-4">Appearance</h3>
                <div className="flex items-center justify-between p-4 bg-[var(--cloud-50)] rounded-lg">
                  <div>
                    <p className="font-medium text-[var(--charcoal-900)]">Dark Mode</p>
                    <p className="text-sm text-[var(--charcoal-800)]/60">Switch between light and dark themes</p>
                  </div>
                  <div className="relative">
                    <button
                      disabled
                      className="w-12 h-6 bg-[var(--lavender-200)] rounded-full cursor-not-allowed opacity-50"
                    >
                      <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow"></span>
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-[var(--lavender-600)]">
                  Coming soon
                </p>
              </div>

              <div className="border-t border-[var(--lavender-100)] pt-6">
                <h3 className="text-lg font-medium text-[var(--charcoal-900)] mb-4">Notifications</h3>
                <p className="text-sm text-[var(--charcoal-800)]/60">
                  Notification preferences coming soon
                </p>
              </div>
            </div>
          )}

          {/* Plan Tab */}
          {activeTab === "plan" && (
            <div className="space-y-6">
              <div className="p-4 bg-gradient-to-r from-[var(--lavender-50)] to-[var(--peach-50)] rounded-lg border border-[var(--lavender-200)]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-[var(--lavender-500)] text-white text-xs font-medium rounded-full">
                    FREE
                  </span>
                  <h3 className="text-lg font-semibold text-[var(--charcoal-900)]">Free Plan</h3>
                </div>
                <p className="text-sm text-[var(--charcoal-800)]/70">
                  You're currently on the free plan with full access to all features.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-[var(--charcoal-900)] mb-3">What's included:</h4>
                <ul className="space-y-2">
                  {[
                    "Unlimited gift registries",
                    "Unlimited event invitations",
                    "Amazon product auto-fill",
                    "Calendar integration",
                    "Email reminders"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-[var(--charcoal-800)]">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-[var(--lavender-100)] pt-6">
                <p className="text-sm text-[var(--charcoal-800)]/60">
                  Premium plans with additional features coming soon.
                </p>
                <button
                  disabled
                  className="mt-3 px-4 py-2 text-sm font-medium text-[var(--lavender-600)] border border-[var(--lavender-300)] rounded-lg opacity-50 cursor-not-allowed"
                >
                  Upgrade (Coming Soon)
                </button>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Connected Accounts */}
              <div>
                <h3 className="text-lg font-medium text-[var(--charcoal-900)] mb-4">Connected Accounts</h3>
                <div className="p-4 bg-[var(--cloud-50)] rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {profile.provider === "google" ? (
                      <>
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-[var(--charcoal-900)]">Google</p>
                          <p className="text-sm text-[var(--charcoal-800)]/60">Connected</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-[var(--lavender-100)] rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-[var(--lavender-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-[var(--charcoal-900)]">Email & Password</p>
                          <p className="text-sm text-[var(--charcoal-800)]/60">{profile.email}</p>
                        </div>
                      </>
                    )}
                  </div>
                  <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                    Active
                  </span>
                </div>
              </div>

              {/* Change Password - Only for email users */}
              {profile.provider === "email" && (
                <div className="border-t border-[var(--lavender-100)] pt-6">
                  <h3 className="text-lg font-medium text-[var(--charcoal-900)] mb-4">Change Password</h3>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                        minLength={6}
                        className="w-full px-4 py-2.5 rounded-lg border border-[var(--lavender-200)] focus:border-[var(--lavender-400)] focus:ring-2 focus:ring-[var(--lavender-100)] outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                        minLength={6}
                        className="w-full px-4 py-2.5 rounded-lg border border-[var(--lavender-200)] focus:border-[var(--lavender-400)] focus:ring-2 focus:ring-[var(--lavender-100)] outline-none transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="px-6 py-2.5 rounded-lg bg-[var(--lavender-500)] text-white font-medium hover:bg-[var(--lavender-600)] transition disabled:opacity-50"
                    >
                      {changingPassword ? "Changing..." : "Change Password"}
                    </button>
                  </form>
                </div>
              )}

              {profile.provider === "google" && (
                <div className="border-t border-[var(--lavender-100)] pt-6">
                  <p className="text-sm text-[var(--charcoal-800)]/60">
                    You signed in with Google. Password management is handled through your Google account.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
