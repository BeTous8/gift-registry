"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import supabase from "../lib/supabase";
import MiniCalendar from "../components/MiniCalendar";
import CreateEventModal from "../components/CreateEventModal";
import CasualMeetupModal from "../components/CasualMeetupModal";
import EventTypeModal from "../components/EventTypeModal";
import EventWizardModal from "../components/EventWizardModal";
import { parseLocalDate, formatDateString, getDaysUntil, isWithinDays } from "../lib/dateUtils";

function DashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Desktop: open by default
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile: closed by default
  const [activeFilter, setActiveFilter] = useState("all"); // "all", "upcoming"
  const [activeTab, setActiveTab] = useState("home"); // "home", "my-events", "joined", "fulfillments", "invitations"
  const [joinedEvents, setJoinedEvents] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [respondingToInvite, setRespondingToInvite] = useState(null);
  const [fulfillments, setFulfillments] = useState([]);
  const [loadingFulfillments, setLoadingFulfillments] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showCasualMeetupModal, setShowCasualMeetupModal] = useState(false);
  const [showEventTypeModal, setShowEventTypeModal] = useState(false);
  const [showEventWizard, setShowEventWizard] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState(null); // "birthday" or "casual"
  const [openMenuId, setOpenMenuId] = useState(null); // Track which event's menu is open
  const [editingEvent, setEditingEvent] = useState(null); // Event being edited
  const [pinnedEvents, setPinnedEvents] = useState(new Set()); // Track pinned event IDs
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null); // User's profile photo

  // Load pinned events from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pinnedEvents');
      if (saved) {
        const parsed = JSON.parse(saved);
        setPinnedEvents(new Set(parsed));
      }
    } catch (e) {
      console.error('Failed to load pinned events:', e);
    }
  }, []);

  // Handle tab query parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['home', 'my-events', 'upcoming', 'joined', 'invitations', 'fulfillments'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (openMenuId !== null) {
        setOpenMenuId(null);
      }
    }

    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  // Toggle pin status for an event
  function togglePin(eventId) {
    setPinnedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      // Persist to localStorage
      try {
        localStorage.setItem('pinnedEvents', JSON.stringify([...newSet]));
      } catch (e) {
        console.error('Failed to save pinned events:', e);
      }
      return newSet;
    });
  }

  // Helper function to get user's first name
  function getFirstName(user) {
    if (!user) return null;
    
    // For OAuth (Google), use given_name
    if (user.user_metadata?.given_name) {
      return user.user_metadata.given_name;
    }
    
    // For email/password signups, use username or display_name
    const username = user.user_metadata?.username || user.user_metadata?.display_name;
    if (username) {
      // If username has spaces, take first word; otherwise use entire username
      return username.split(' ')[0];
    }
    
    // Fallback: try to extract first name from full_name (OAuth)
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name.split(' ')[0];
    }
    
    // Last resort: extract from email (everything before @)
    if (user.email) {
      return user.email.split('@')[0].split('.')[0];
    }
    
    return null;
  }

  // Fetch user session on mount and redirect if not logged in
  useEffect(() => {
    let ignore = false;

    async function getUserSession() {
      try {
        // Check if this is a redirect from OAuth (mobile compatibility)
        const urlParams = new URLSearchParams(window.location.search);
        const authSuccess = urlParams.get('auth');
        
        // If auth success param exists, wait a bit for cookies to be set (mobile fix)
        if (authSuccess === 'success') {
          // Clean URL
          window.history.replaceState({}, '', '/dashboard');
          // Small delay to ensure cookies are processed on mobile
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Get the current session first
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        
        if (ignore) return;
        
        // If no session, redirect to login
        if (!session?.user) {
          router.replace("/login");
          return;
        }
        
        // Try to refresh the session to ensure it's still valid
        // This will use the refresh token if the access token is expired
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (ignore) return;
        
        // Use refreshed session if available, otherwise use original session
        const currentSession = refreshData?.session || session;
        
        if (!currentSession?.user) {
          router.replace("/login");
          return;
        }
        
        setUser(currentSession.user);

        // Fetch all data in parallel
        fetchEvents(currentSession.user.id);
        fetchJoinedEvents(currentSession.user.id);
        fetchPendingInvitations(currentSession.user.id);
        fetchFulfillments();
        fetchProfilePhoto(currentSession.user.id);
      } catch (error) {
        console.error('Error getting session:', error);
        if (!ignore) {
          router.replace("/login");
        }
      }
    }

    getUserSession();

    // Listen for auth changes to handle sign out and token refresh
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (ignore) return;
        
        if (event === "SIGNED_OUT") {
          router.replace("/login");
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          // Session was refreshed, update user and refetch events
          setUser(session.user);
          fetchEvents(session.user.id);
          fetchJoinedEvents(session.user.id);
          fetchPendingInvitations(session.user.id);
          fetchFulfillments();
        } else if (event === "SIGNED_IN" && session?.user) {
          // User signed in, update user and fetch events
          setUser(session.user);
          fetchEvents(session.user.id);
          fetchJoinedEvents(session.user.id);
          fetchPendingInvitations(session.user.id);
          fetchFulfillments();
        }
      }
    );

    return () => {
      ignore = true;
      listener.subscription?.unsubscribe?.();
    };
    // We want router to be available always
    // eslint-disable-next-line
  }, []);

  async function fetchEvents(userId) {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      // Verify session is still valid before fetching
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        // Session expired, redirect to login
        router.replace("/login");
        setLoading(false);
        return;
      }

      // Fetch all user's events (both registries and casual meetups)
      const { data, error } = await supabase
        .from("events")
        .select("id, title, slug, event_date, description, event_category, registry_enabled, location, items(current_amount_cents)")
        .eq("user_id", userId)
        .order("event_date", { ascending: false });

      if (error) {
        console.error('Error fetching events:', error);
        // If it's an auth error, try refreshing session
        if (error.message?.includes('JWT') || error.message?.includes('token') || error.message?.includes('expired')) {
          const { data: refreshData } = await supabase.auth.refreshSession();
          if (refreshData?.session?.user) {
            // Retry with refreshed session
            const { data: retryData, error: retryError } = await supabase
              .from("events")
              .select("id, title, slug, event_date, description, event_category, registry_enabled, location, items(current_amount_cents)")
              .eq("user_id", refreshData.session.user.id)
              .order("event_date", { ascending: false });
            
            if (retryError) {
              setEvents([]);
              setLoading(false);
              return;
            }
            
            const mapped = (retryData || []).map((event) => {
              const items = event.items || [];
              const totalRaised = items.reduce(
                (sum, item) => sum + (item.current_amount_cents || 0),
                0
              );
              return {
                ...event,
                totalRaised,
                itemCount: items.length,
              };
            });
            
            setEvents(mapped);
            setLoading(false);
            return;
          } else {
            // Session refresh failed, redirect to login
            router.replace("/login");
            setLoading(false);
            return;
          }
        }
        
        setEvents([]);
        setLoading(false);
        return;
      }

      // Calculate total raised per event and item count
      const mapped = (data || []).map((event) => {
        const items = event.items || [];
        const totalRaised = items.reduce(
          (sum, item) => sum + (item.current_amount_cents || 0),
          0
        );
        return {
          ...event,
          totalRaised,
          itemCount: items.length,
        };
      });

      setEvents(mapped);
    } catch (error) {
      console.error('Unexpected error fetching events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch events user has joined (not owned)
  async function fetchJoinedEvents(userId) {
    if (!userId) return;

    try {
      // Get events where user is a member (not owner)
      const { data: membershipData, error: membershipError } = await supabase
        .from("event_members")
        .select(`
          id,
          joined_at,
          event_id,
          events (
            id,
            title,
            slug,
            event_date,
            description,
            user_id,
            items(current_amount_cents)
          )
        `)
        .eq("user_id", userId);

      if (membershipError) {
        console.error('Error fetching joined events:', membershipError);
        setJoinedEvents([]);
        return;
      }

      // Filter out events where user is the owner and map data
      const mapped = (membershipData || [])
        .filter(m => m.events && m.events.user_id !== userId)
        .map((membership) => {
          const event = membership.events;
          const items = event.items || [];
          const totalRaised = items.reduce(
            (sum, item) => sum + (item.current_amount_cents || 0),
            0
          );
          return {
            ...event,
            totalRaised,
            itemCount: items.length,
            joinedAt: membership.joined_at,
          };
        });

      setJoinedEvents(mapped);
    } catch (error) {
      console.error('Unexpected error fetching joined events:', error);
      setJoinedEvents([]);
    }
  }

  // Fetch pending invitations for the user
  async function fetchPendingInvitations(userId) {
    console.log('fetchPendingInvitations called with userId:', userId);
    if (!userId) {
      console.log('No userId, skipping fetch');
      setPendingInvitations([]);
      return;
    }

    try {
      console.log('Fetching invitations from API...');
      const response = await fetch(`/api/invitations?userId=${userId}`);
      console.log('API response status:', response.status, response.ok);

      if (!response.ok) {
        console.warn('Could not fetch invitations - user may not be fully authenticated yet');
        setPendingInvitations([]);
        return;
      }

      const data = await response.json();
      console.log('Pending invitations data:', data);
      console.log('Number of invitations:', data.invitations?.length || 0);
      if (data.invitations && data.invitations.length > 0) {
        console.log('First invitation structure:', data.invitations[0]);
      }
      setPendingInvitations(data.invitations || []);
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
      setPendingInvitations([]);
    }
  }

  async function fetchFulfillments() {
    setLoadingFulfillments(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setFulfillments([]);
        setLoadingFulfillments(false);
        return;
      }

      const response = await fetch('/api/fulfillments', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        console.warn('Could not fetch fulfillments');
        setFulfillments([]);
        setLoadingFulfillments(false);
        return;
      }

      const data = await response.json();
      setFulfillments(data.fulfillments || []);
    } catch (error) {
      console.error('Error fetching fulfillments:', error);
      setFulfillments([]);
    } finally {
      setLoadingFulfillments(false);
    }
  }

  // Fetch user's profile photo
  async function fetchProfilePhoto(userId) {
    try {
      const response = await fetch(`/api/account/profile?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.profile?.profile_photo_url) {
          setProfilePhotoUrl(data.profile.profile_photo_url);
        }
      }
    } catch (error) {
      console.error('Error fetching profile photo:', error);
    }
  }

  // Handle invitation response (accept/decline)
  async function handleInvitationResponse(invitationId, action) {
    setRespondingToInvite(invitationId);

    try {
      const response = await fetch(`/api/invitations/${invitationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, response: action }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to respond to invitation');
        return;
      }

      // Remove from pending list
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      // If accepted, refresh joined events
      if (action === 'accepted' && user) {
        fetchJoinedEvents(user.id);
      }
    } catch (error) {
      console.error('Error responding to invitation:', error);
      alert('Failed to respond to invitation');
    } finally {
      setRespondingToInvite(null);
    }
  }

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // Handle delete event
  const handleDeleteClick = (event) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setEventToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!eventToDelete || !user) return;

    setDeletingEventId(eventToDelete.id);
    
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventToDelete.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error deleting event:", error);
        alert("Failed to delete event. Please try again.");
        setDeletingEventId(null);
        return;
      }

      // Remove event from local state
      setEvents(events.filter((e) => e.id !== eventToDelete.id));
      setDeleteDialogOpen(false);
      setEventToDelete(null);
      setDeletingEventId(null);
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event. Please try again.");
      setDeletingEventId(null);
    }
  };

  // Handle card click to navigate to event
  const handleCardClick = (slug) => {
    router.push(`/event/${slug}?from=${activeTab}`);
  };

  // Get events to display based on active tab
  const getDisplayEvents = () => {
    let filteredEvents = [];

    if (activeTab === "joined") {
      filteredEvents = joinedEvents;
    } else if (activeTab === "upcoming") {
      // Show events within the next 7 days
      filteredEvents = events.filter((event) => {
        if (!event.event_date) return false;
        return isWithinDays(event.event_date, 7);
      });
    } else {
      // For "my-events" tab, show all events
      filteredEvents = events;
    }

    // Sort: pinned events first, then by original order
    return filteredEvents.sort((a, b) => {
      const aIsPinned = pinnedEvents.has(a.id);
      const bIsPinned = pinnedEvents.has(b.id);

      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      return 0;
    });
  };

  const displayEvents = getDisplayEvents();

  // Calculate dashboard statistics
  const stats = {
    totalEvents: events.length,
    upcomingEvents: events.filter((event) => {
      if (!event.event_date) return false;
      return isWithinDays(event.event_date, 7);
    }).length,
    totalRaised: events.reduce((sum, event) => sum + (event.totalRaised || 0), 0),
    totalItems: events.reduce((sum, event) => sum + (event.itemCount || 0), 0),
  };

  // Helper function to format date with relative time
  const formatEventDate = (dateString) => {
    if (!dateString) return null;
    const diffDays = getDaysUntil(dateString);

    if (diffDays < 0) {
      return { text: formatDateString(dateString), status: 'past' };
    } else if (diffDays === 0) {
      return { text: 'Today! 🎉', status: 'today' };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', status: 'upcoming' };
    } else if (diffDays <= 7) {
      return { text: `In ${diffDays} days`, status: 'upcoming' };
    } else {
      return { text: formatDateString(dateString), status: 'future' };
    }
  };

  // Helper function to get styling based on event category
  const getEventStyling = (eventCategory) => {
    if (eventCategory === 'casual') {
      return 'from-[var(--mint-100)] to-[var(--mint-200)] border-[var(--mint-300)]';
    }
    // Default: gift-registry or special ceremony (event_category: "other", "birthday", "anniversary", "wedding")
    return 'from-[var(--lavender-50)] to-[var(--peach-100)] border-[var(--lavender-200)]';
  };

  // Navigation menu items
  const navItems = [
    {
      name: "Home",
      href: "/dashboard",
      tab: "home",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: "My Events",
      href: "/dashboard",
      tab: "my-events",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      count: events.length,
    },
    {
      name: "Upcoming Events",
      href: "/dashboard",
      tab: "upcoming",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      count: stats.upcomingEvents,
      highlight: stats.upcomingEvents > 0,
    },
    {
      name: "Joined Events",
      href: "/dashboard",
      tab: "joined",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      count: joinedEvents.length,
    },
    {
      name: "Invitations",
      href: "/dashboard",
      tab: "invitations",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      count: pendingInvitations.length,
      highlight: pendingInvitations.length > 0,
    },
    {
      name: "Redemptions",
      href: "/dashboard",
      tab: "fulfillments",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      count: fulfillments.length,
    },
    {
      name: "Contacts",
      href: "/contacts",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="h-screen bg-[var(--cloud-50)] flex overflow-hidden font-body">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          bg-white/95 backdrop-blur-sm border-r border-[var(--lavender-200)]
          transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${sidebarOpen ? "w-64" : "w-20"}
          flex flex-col h-screen
          shadow-lg lg:shadow-none
        `}
      >
        {/* Logo/Brand Section */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--lavender-200)] flex-shrink-0">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <img src="/memora-logo.png" alt="Memora" className="h-8 w-auto" />
              <span className="text-lg font-bold font-display text-[var(--charcoal-900)]">Memora</span>
            </div>
          )}
          <button
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              if (!sidebarOpen) setMobileMenuOpen(false);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 transition text-gray-900 hover:text-gray-900"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Navigation Items - Fixed height, no scroll */}
        <nav className="px-3 py-3 space-y-0.5 flex-shrink-0">
          {navItems.map((item) => {
            const isActive = item.tab
              ? activeTab === item.tab
              : pathname === item.href && !item.tab;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={(e) => {
                  if (item.tab) {
                    e.preventDefault();
                    setActiveTab(item.tab);
                  }
                  setMobileMenuOpen(false);
                }}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded-lg
                  transition-all duration-200 relative
                  ${
                    isActive
                      ? "bg-gradient-to-r from-[var(--lavender-50)] to-[var(--peach-100)] text-[var(--lavender-700)] font-semibold border-l-4 border-[var(--lavender-500)]"
                      : item.highlight
                      ? "text-[var(--lavender-700)] bg-[var(--lavender-50)] hover:bg-[var(--lavender-100)]"
                      : "text-[var(--charcoal-900)] hover:bg-[var(--lavender-50)] hover:text-[var(--lavender-700)]"
                  }
                `}
              >
                <span className={`flex-shrink-0 ${isActive ? "text-[var(--lavender-600)]" : item.highlight ? "text-[var(--lavender-600)]" : "text-[var(--charcoal-800)]"}`}>
                  {item.icon}
                </span>
                {sidebarOpen && (
                  <>
                    <span className="text-sm flex-1">{item.name}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span className={`
                        text-xs font-bold px-2 py-0.5 rounded-full
                        ${item.highlight
                          ? "bg-[var(--peach-400)] text-white animate-pulse"
                          : "bg-[var(--cloud-100)] text-[var(--charcoal-900)]"}
                      `}>
                        {item.count}
                      </span>
                    )}
                  </>
                )}
                {!sidebarOpen && item.count !== undefined && item.count > 0 && item.highlight && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--peach-400)] rounded-full animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Spacer to push MiniCalendar and User Profile to bottom */}
        <div className="flex-1"></div>

        {/* Mini Calendar - Always visible at bottom */}
        <div className="flex-shrink-0">
          <MiniCalendar sidebarOpen={sidebarOpen} />
        </div>

        {/* User Profile Section - Always visible at bottom */}
        <div className="border-t border-[var(--lavender-200)] p-3 flex-shrink-0">
          {sidebarOpen ? (
            <button
              onClick={() => router.push("/account")}
              className="w-full flex items-center gap-2.5 mb-2 p-2 rounded-lg hover:bg-[var(--lavender-50)] transition text-left"
            >
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt="Profile"
                  className="w-9 h-9 rounded-full object-cover shadow-md"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--lavender-400)] to-[var(--peach-400)] flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold text-sm">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--charcoal-900)] truncate">
                  {user?.email || "User"}
                </p>
                <p className="text-xs text-[var(--charcoal-800)]/60 truncate">Account Settings</p>
              </div>
              <svg className="w-4 h-4 text-[var(--charcoal-800)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => router.push("/account")}
              className="w-full flex justify-center mb-2 p-2 rounded-lg hover:bg-[var(--lavender-50)] transition"
            >
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt="Profile"
                  className="w-9 h-9 rounded-full object-cover shadow-md"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--lavender-400)] to-[var(--peach-400)] flex items-center justify-center shadow-md">
                  <span className="text-white font-semibold text-sm">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
              )}
            </button>
          )}
          <button
            onClick={handleSignOut}
            className={`
              w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg
              text-red-600 hover:bg-red-50 transition text-sm
              ${!sidebarOpen && "justify-center"}
            `}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white/90 backdrop-blur-sm border-b border-[var(--lavender-200)] px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-md hover:bg-[var(--lavender-50)] text-[var(--charcoal-900)] transition"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold font-display bg-gradient-to-r from-[var(--lavender-500)] via-[var(--peach-400)] to-[var(--mint-400)] bg-clip-text text-transparent">
            {user ? (getFirstName(user) ? `Welcome, ${getFirstName(user)}!` : 'Dashboard') : 'Dashboard'}
          </h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </header>

        {/* Desktop Header - Fixed */}
        <header className="hidden lg:flex bg-gradient-to-br from-[var(--lavender-50)] via-[var(--peach-100)] to-[var(--mint-100)] px-8 py-6 border-b border-[var(--lavender-200)]/50 flex-shrink-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full">
            <div>
              <h1 className="text-4xl font-bold font-display bg-gradient-to-r from-[var(--lavender-500)] via-[var(--peach-400)] to-[var(--mint-400)] bg-clip-text text-transparent">
                {user ? (getFirstName(user) ? `Welcome, ${getFirstName(user)}!` : 'Dashboard') : 'Dashboard'}
              </h1>
              {user && (
                <p className="text-[var(--charcoal-800)] text-sm mt-2">{user.email}</p>
              )}
            </div>
          </div>
        </header>

        {/* Main Content - Scrollable */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-[var(--lavender-50)] via-[var(--peach-100)] to-[var(--mint-100)]">
          <div className="p-4 lg:p-8">
            {/* Loading state */}
            {loading ? (
              <div className="flex justify-center py-24">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-[var(--lavender-200)] border-t-[var(--lavender-500)] rounded-full animate-spin"></div>
                  <p className="text-lg font-medium text-[var(--charcoal-900)]">Loading your events...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Tab Content */}
                {activeTab === "home" ? (
                  /* Home Tab Content - Single Start Button */
                  <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                      <motion.h2
                        className="text-3xl sm:text-4xl font-bold font-display text-[var(--charcoal-900)] mb-3"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      >
                        Ready to plan something?
                      </motion.h2>
                      <motion.p
                        className="text-[var(--charcoal-800)] mb-12 text-lg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      >
                        Tap the button to get started
                      </motion.p>

                      {/* Circular Start Button with Ripple Effect */}
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          {/* Ripple waves */}
                          <motion.div
                            className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--lavender-400)] to-[var(--peach-400)]"
                            animate={{
                              scale: [1, 1.8, 1.8],
                              opacity: [0.6, 0, 0]
                            }}
                            transition={{
                              duration: 10,
                              repeat: Infinity,
                              times: [0, 0.1, 1],
                              ease: "easeOut"
                            }}
                          />
                          <motion.div
                            className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--lavender-400)] to-[var(--peach-400)]"
                            animate={{
                              scale: [1, 1.5, 1.5],
                              opacity: [0.4, 0, 0]
                            }}
                            transition={{
                              duration: 10,
                              repeat: Infinity,
                              times: [0, 0.08, 1],
                              ease: "easeOut",
                              delay: 0.05
                            }}
                          />
                          {/* Main button */}
                          <motion.button
                            onClick={() => setShowEventTypeModal(true)}
                            className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-[var(--lavender-400)] to-[var(--peach-400)] border-[3px] border-white shadow-[0_8px_32px_rgba(184,169,232,0.4)] flex items-center justify-center text-white hover:shadow-[0_12px_40px_rgba(184,169,232,0.5)] focus:outline-none focus:ring-4 focus:ring-[var(--lavender-200)] transition-shadow duration-300"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{
                              scale: [1, 1.08, 1, 1, 1, 1, 1, 1, 1, 1],
                              rotate: 0
                            }}
                            transition={{
                              scale: { duration: 10, repeat: Infinity, ease: "easeInOut", times: [0, 0.05, 0.1, 0.15, 0.2, 0.4, 0.6, 0.8, 0.9, 1] },
                              rotate: { type: "spring", stiffness: 200, damping: 15 }
                            }}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <svg className="w-10 h-10 lg:w-12 lg:h-12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          </motion.button>
                        </div>
                        <motion.span
                          className="text-[var(--charcoal-900)] font-medium text-sm uppercase tracking-wide"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          Start Planning
                        </motion.span>
                      </div>
                    </div>
                  </div>
                ) : activeTab === "invitations" ? (
                  /* Invitations Tab Content */
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold font-display text-[var(--charcoal-900)] mb-4">Pending Invitations</h2>
                    {pendingInvitations.length === 0 ? (
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center border border-[var(--lavender-200)]">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--lavender-200)] to-[var(--peach-200)] flex items-center justify-center">
                          <svg className="w-8 h-8 text-[var(--lavender-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--charcoal-900)] mb-2">No pending invitations</h3>
                        <p className="text-[var(--charcoal-800)]">When someone invites you to their event, it will appear here.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {pendingInvitations.map((invitation) => {
                          console.log('Rendering invitation:', invitation);
                          console.log('Has events?', !!invitation.events);
                          console.log('Owner name:', invitation.events?.owner_name);
                          return (
                          <div
                            key={invitation.id}
                            className="bg-white/90 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-[var(--lavender-200)] hover:shadow-xl transition-all"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900 mb-1">
                                  {invitation.events?.title || "Event"}
                                </h3>
                                <div className="flex flex-wrap gap-3 text-sm text-gray-900">
                                  {invitation.events?.event_date && (
                                    <span className="flex items-center gap-1">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      {formatDateString(invitation.events.event_date)}
                                    </span>
                                  )}
                                  {invitation.events?.owner_name && (
                                    <span className="flex items-center gap-1">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                      Hosted by {invitation.events?.owner_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleInvitationResponse(invitation.id, 'declined')}
                                  disabled={respondingToInvite === invitation.id}
                                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 transition disabled:opacity-50"
                                >
                                  Decline
                                </button>
                                <button
                                  onClick={() => handleInvitationResponse(invitation.id, 'accepted')}
                                  disabled={respondingToInvite === invitation.id}
                                  className="px-4 py-2 bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-600)] text-white rounded-lg font-medium hover:from-[var(--lavender-500)] hover:to-[var(--lavender-700)] transition disabled:opacity-50"
                                >
                                  {respondingToInvite === invitation.id ? 'Joining...' : 'Accept & Join'}
                                </button>
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : activeTab === "fulfillments" ? (
                  /* Fulfillments Tab Content */
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold font-display text-[var(--charcoal-900)] mb-4">Redemption History</h2>
                    {loadingFulfillments ? (
                      <div className="flex justify-center py-12">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                          <p className="text-sm font-medium text-gray-900">Loading redemptions...</p>
                        </div>
                      </div>
                    ) : fulfillments.length === 0 ? (
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center border border-green-100">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-200 to-blue-200 flex items-center justify-center">
                          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No redemptions yet</h3>
                        <p className="text-gray-900">When you redeem funds from fully funded items, they will appear here.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {fulfillments.map((fulfillment) => {
                          const statusConfig = {
                            pending: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800', icon: '⏳', label: 'Pending' },
                            processing: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', icon: '🔄', label: 'Processing' },
                            completed: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800', icon: '✅', label: 'Completed' },
                            failed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800', icon: '❌', label: 'Failed' }
                          };
                          const config = statusConfig[fulfillment.status] || statusConfig.pending;

                          return (
                            <div
                              key={fulfillment.id}
                              className={`${config.bg} backdrop-blur-sm rounded-xl p-5 shadow-lg border ${config.border} hover:shadow-xl transition-all`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-lg font-bold text-gray-900">
                                      {fulfillment.item?.title || "Item"}
                                    </h3>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.badge}`}>
                                      {config.icon} {config.label}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-900 mb-2">
                                    <span className="font-medium">Event:</span> {fulfillment.event?.title || "Unknown"}
                                  </p>
                                  <div className="flex flex-wrap gap-3 text-sm text-gray-900">
                                    <span className="flex items-center gap-1">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Net: <span className="font-semibold text-green-700">${(fulfillment.net_amount_cents / 100).toFixed(2)}</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      {formatDateString(fulfillment.requested_at.split('T')[0])}
                                    </span>
                                    {fulfillment.completed_at && (
                                      <span className="flex items-center gap-1 text-green-700">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Completed {formatDateString(fulfillment.completed_at.split('T')[0], { month: 'short', day: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-gray-900">
                                    ${(fulfillment.net_amount_cents / 100).toFixed(2)}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Fee: ${(fulfillment.platform_fee_cents / 100).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : displayEvents.length === 0 ? (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-[var(--lavender-200)]">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[var(--lavender-200)] to-[var(--peach-200)] flex items-center justify-center">
                      <svg className="w-10 h-10 text-[var(--lavender-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {activeTab === "joined" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        ) : activeTab === "upcoming" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        )}
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold font-display text-[var(--charcoal-900)] mb-3">
                      {activeTab === "joined"
                        ? "No joined events yet"
                        : activeTab === "upcoming"
                        ? "No events in the next 7 days"
                        : "Start your first celebration!"}
                    </h2>
                    <p className="text-[var(--charcoal-800)] mb-6 max-w-md mx-auto">
                      {activeTab === "joined"
                        ? "When you accept an invitation or join an event, it will appear here."
                        : activeTab === "upcoming"
                        ? "You don't have any events coming up within the next 7 days."
                        : "Create a gift registry and let friends contribute to make your special day unforgettable."}
                    </p>
                    {activeTab !== "joined" && activeTab !== "upcoming" && (
                      <Link
                        href="/create-event"
                        className="bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-600)] text-white px-8 py-3 rounded-xl font-semibold hover:from-[var(--lavender-500)] hover:to-[var(--lavender-700)] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 inline-flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Your First Event
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Section Header for Joined Events */}
                    {activeTab === "joined" && (
                      <h2 className="text-xl font-bold font-display text-[var(--charcoal-900)] mb-4">Events You've Joined</h2>
                    )}
                    {/* Section Header for Upcoming Events */}
                    {activeTab === "upcoming" && (
                      <h2 className="text-xl font-bold font-display text-[var(--charcoal-900)] mb-4">Upcoming Events (Next 7 Days)</h2>
                    )}
                    <div className="grid gap-6 md:grid-cols-2">
                      {displayEvents.map((event, index) => {
                        const dateInfo = formatEventDate(event.event_date);
                        const gradientClass = getEventStyling(event.event_category);
                        return (
                          <div
                            key={event.id}
                            className={`bg-gradient-to-br ${gradientClass} rounded-2xl p-6 flex flex-col justify-between relative cursor-pointer hover:shadow-2xl transition-all transform hover:-translate-y-2 border-2 group`}
                            onClick={() => handleCardClick(event.slug)}
                          >
                            {/* Three-dot menu - only show for owned events */}
                            {activeTab !== "joined" && (
                              <div className="absolute top-3 right-3 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(openMenuId === event.id ? null : event.id);
                                  }}
                                  className="bg-white/90 hover:bg-white text-gray-900 rounded-full w-8 h-8 flex items-center justify-center transition-all shadow-md"
                                  title="More options"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                  </svg>
                                </button>

                                {/* Dropdown Menu */}
                                {openMenuId === event.id && (
                                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                        setEditingEvent(event);
                                        // Route to correct modal based on event category
                                        if (event.event_category === "casual") {
                                          setShowCasualMeetupModal(true);
                                        } else {
                                          setShowCreateEventModal(true);
                                        }
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-[var(--charcoal-900)] hover:bg-[var(--lavender-50)] flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      Edit Event
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                        togglePin(event.id);
                                      }}
                                      className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--lavender-50)] flex items-center gap-2 ${
                                        pinnedEvents.has(event.id) ? 'text-[var(--peach-500)]' : 'text-[var(--charcoal-900)]'
                                      }`}
                                    >
                                      <svg className="w-4 h-4" fill={pinnedEvents.has(event.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                      </svg>
                                      {pinnedEvents.has(event.id) ? 'Unpin' : 'Pin to Top'}
                                    </button>
                                    <hr className="my-1 border-gray-200" />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                        handleDeleteClick(event);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Delete Event
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Pinned badge */}
                            {pinnedEvents.has(event.id) && activeTab !== "joined" && (
                              <div className="absolute top-3 left-3 z-10">
                                <svg className="w-6 h-6 text-[var(--peach-500)] drop-shadow-md" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                              </div>
                            )}

                            {/* Joined badge for joined events */}
                            {activeTab === "joined" && (
                              <div className="absolute top-3 right-3 bg-[var(--mint-400)] text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                Joined
                              </div>
                            )}

                            {/* Event Header */}
                            <div className={`mb-4 ${pinnedEvents.has(event.id) && activeTab !== "joined" ? 'pl-6' : ''}`}>
                              <div className="flex items-start justify-between mb-3">
                                <h3 className="text-xl font-bold text-gray-900 pr-8 line-clamp-2">
                                  {event.title}
                                </h3>
                              </div>
                              
                              {/* Date Badge */}
                              {dateInfo && (
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-3 ${
                                  dateInfo.status === 'today'
                                    ? 'bg-gradient-to-r from-[var(--buttercream-100)] to-[var(--peach-300)] text-[var(--charcoal-900)] animate-pulse'
                                    : dateInfo.status === 'upcoming'
                                    ? 'bg-[var(--mint-100)] text-[var(--charcoal-900)]'
                                    : dateInfo.status === 'past'
                                    ? 'bg-[var(--cloud-100)] text-[var(--charcoal-800)]'
                                    : 'bg-[var(--lavender-100)] text-[var(--lavender-700)]'
                                }`}>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {dateInfo.text}
                                </div>
                              )}

                              {/* Description */}
                              <p className="text-gray-900 text-sm mb-4 line-clamp-2">
                                {event.description || <span className="italic text-gray-900">No description provided.</span>}
                              </p>
                            </div>

                            {/* Stats Footer */}
                            <div className="pt-4 border-t border-white/50">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1">
                                    <span className="text-lg font-bold text-[var(--charcoal-900)]">${(event.totalRaised / 100).toFixed(2)}</span>
                                    {event.totalRaised > 0 && (
                                      <span className="text-xs text-[var(--mint-400)] font-semibold">✓</span>
                                    )}
                                  </div>
                                  <span className="text-xs text-[var(--charcoal-800)]">Total Raised</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4 text-[var(--charcoal-800)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                    <span className="text-lg font-bold text-[var(--charcoal-900)]">{event.itemCount}</span>
                                  </div>
                                  <span className="text-xs text-[var(--charcoal-800)]">
                                    Item{event.itemCount === 1 ? "" : "s"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>

        {/* Delete Confirmation Dialog */}
        {deleteDialogOpen && eventToDelete && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={handleCloseDeleteDialog}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Event</h3>
              <p className="text-gray-900 mb-4">
                Are you sure you want to delete <span className="font-semibold">"{eventToDelete.title}"</span>?
                This action cannot be undone and will delete all associated items and contributions.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCloseDeleteDialog}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded font-semibold hover:bg-gray-300 transition"
                  disabled={deletingEventId === eventToDelete.id}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition disabled:opacity-50"
                  disabled={deletingEventId === eventToDelete.id}
                >
                  {deletingEventId === eventToDelete.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Event Modal */}
        {showCreateEventModal && (
          <CreateEventModal
            defaultMode="registry"
            prefillData={editingEvent ? {
              title: editingEvent.title,
              event_date: editingEvent.event_date,
              event_time: editingEvent.event_time,
              description: editingEvent.description,
              event_type: editingEvent.event_category === "casual" ? "casual-meetup" : "gift-registry",
              location: editingEvent.location,
              registry_enabled: editingEvent.registry_enabled,
              is_recurring: editingEvent.is_recurring,
              add_to_calendar: true // Assume calendar is enabled if editing
            } : {}}
            isEditing={!!editingEvent}
            eventId={editingEvent?.id}
            onClose={() => {
              setShowCreateEventModal(false);
              setEditingEvent(null);
            }}
            onSuccess={(newEvent) => {
              // Refresh events after creation/edit
              if (user) {
                fetchEvents(user.id);
              }
              setEditingEvent(null);
              // If registry was created (not editing), redirect to the event page
              if (!editingEvent && newEvent.slug) {
                router.push(`/event/${newEvent.slug}?from=my-events`);
              }
            }}
          />
        )}

        {/* Casual Meetup Modal */}
        {showCasualMeetupModal && (
          <CasualMeetupModal
            onClose={() => {
              setShowCasualMeetupModal(false);
              setEditingEvent(null);
            }}
            onSuccess={(newEvent) => {
              // Refresh events after creation/edit
              if (user) {
                fetchEvents(user.id);
              }
              setEditingEvent(null);
              // Navigate to the event page only for new events
              if (!editingEvent && newEvent?.slug) {
                router.push(`/event/${newEvent.slug}?from=my-events`);
              }
            }}
            prefillData={editingEvent ? {
              title: editingEvent.title,
              event_date: editingEvent.event_date,
              event_time: editingEvent.event_time,
              location: editingEvent.location,
            } : {}}
            isEditing={!!editingEvent}
            eventId={editingEvent?.id}
          />
        )}

        {/* Event Type Selection Modal */}
        {showEventTypeModal && (
          <EventTypeModal
            onClose={() => setShowEventTypeModal(false)}
            onSelectType={(type) => {
              setSelectedEventType(type);
              setShowEventTypeModal(false);
              setShowEventWizard(true);
            }}
          />
        )}

        {/* Event Creation Wizard */}
        {showEventWizard && selectedEventType && (
          <EventWizardModal
            eventType={selectedEventType}
            onClose={() => {
              setShowEventWizard(false);
              setSelectedEventType(null);
            }}
            onSuccess={(newEvent) => {
              // Refresh events after creation
              if (user) {
                fetchEvents(user.id);
              }
              // Navigate to the event page
              if (newEvent?.slug) {
                router.push(`/event/${newEvent.slug}?from=my-events`);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[var(--cloud-50)] via-white to-[var(--lavender-50)] flex items-center justify-center">
        <div className="text-[var(--charcoal-800)]">Loading...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
