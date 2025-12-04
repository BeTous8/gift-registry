"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import supabase from "../lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Desktop: open by default
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile: closed by default
  const [activeFilter, setActiveFilter] = useState("all"); // "all", "upcoming"
  const [activeTab, setActiveTab] = useState("my-events"); // "my-events", "joined"
  const [joinedEvents, setJoinedEvents] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [respondingToInvite, setRespondingToInvite] = useState(null);

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
        } else if (event === "SIGNED_IN" && session?.user) {
          // User signed in, update user and fetch events
          setUser(session.user);
          fetchEvents(session.user.id);
          fetchJoinedEvents(session.user.id);
          fetchPendingInvitations(session.user.id);
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

      // Fetch only the user's events
      const { data, error } = await supabase
        .from("events")
        .select("id, title, slug, event_date, description, items(current_amount_cents)")
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
              .select("id, title, slug, event_date, description, items(current_amount_cents)")
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
    router.push(`/event/${slug}`);
  };

  // Get events to display based on active tab
  const getDisplayEvents = () => {
    if (activeTab === "joined") {
      return joinedEvents;
    }
    // For "my-events" tab, apply filter
    return events.filter((event) => {
      if (activeFilter === "upcoming") {
        if (!event.event_date) return false;
        const eventDate = new Date(event.event_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return eventDate >= today;
      }
      return true;
    });
  };

  const displayEvents = getDisplayEvents();

  // Calculate dashboard statistics
  const stats = {
    totalEvents: events.length,
    upcomingEvents: events.filter((event) => {
      if (!event.event_date) return false;
      const eventDate = new Date(event.event_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return eventDate >= today;
    }).length,
    totalRaised: events.reduce((sum, event) => sum + (event.totalRaised || 0), 0),
    totalItems: events.reduce((sum, event) => sum + (event.itemCount || 0), 0),
  };

  // Helper function to format date with relative time
  const formatEventDate = (dateString) => {
    if (!dateString) return null;
    const eventDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: 'past' };
    } else if (diffDays === 0) {
      return { text: 'Today! 🎉', status: 'today' };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', status: 'upcoming' };
    } else if (diffDays <= 7) {
      return { text: `In ${diffDays} days`, status: 'upcoming' };
    } else {
      return { text: eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: 'future' };
    }
  };

  // Helper function to get gradient class based on event index
  const getEventGradient = (index) => {
    const gradients = [
      'from-pink-50 to-rose-50 border-pink-200',
      'from-purple-50 to-indigo-50 border-purple-200',
      'from-blue-50 to-cyan-50 border-blue-200',
      'from-yellow-50 to-amber-50 border-yellow-200',
      'from-emerald-50 to-teal-50 border-emerald-200',
      'from-orange-50 to-red-50 border-orange-200',
    ];
    return gradients[index % gradients.length];
  };

  // Navigation menu items
  const navItems = [
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
      name: "Contacts",
      href: "/contacts",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      name: "Create Event",
      href: "/create-event",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
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
          bg-white/95 backdrop-blur-sm border-r border-purple-100
          transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${sidebarOpen ? "w-64" : "w-20"}
          flex flex-col
          shadow-lg lg:shadow-none
        `}
      >
        {/* Logo/Brand Section */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-purple-100">
          {sidebarOpen && (
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Memora 🎉
            </h2>
          )}
          <button
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              if (!sidebarOpen) setMobileMenuOpen(false);
            }}
            className="p-2 rounded-md hover:bg-gray-100 transition text-gray-900 hover:text-gray-900"
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

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200 relative
                  ${
                    isActive
                      ? "bg-gradient-to-r from-pink-50 to-purple-50 text-purple-700 font-semibold border-l-4 border-purple-500"
                      : item.highlight
                      ? "text-purple-700 bg-purple-50 hover:bg-purple-100"
                      : "text-gray-900 hover:bg-purple-50 hover:text-purple-700"
                  }
                `}
              >
                <span className={`flex-shrink-0 ${isActive ? "text-purple-600" : item.highlight ? "text-purple-600" : "text-gray-900"}`}>
                  {item.icon}
                </span>
                {sidebarOpen && (
                  <>
                    <span className="text-sm flex-1">{item.name}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span className={`
                        text-xs font-bold px-2 py-0.5 rounded-full
                        ${item.highlight
                          ? "bg-pink-500 text-white animate-pulse"
                          : "bg-gray-200 text-gray-900"}
                      `}>
                        {item.count}
                      </span>
                    )}
                  </>
                )}
                {!sidebarOpen && item.count !== undefined && item.count > 0 && item.highlight && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-pink-500 rounded-full animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-purple-100 p-4">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-md">
                <span className="text-white font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email || "User"}
                </p>
                <p className="text-xs text-gray-900 truncate">Account</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-md">
                <span className="text-white font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-lg
              text-red-600 hover:bg-red-50 transition
              ${!sidebarOpen && "justify-center"}
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span className="text-sm font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white/90 backdrop-blur-sm border-b border-purple-100 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-md hover:bg-purple-50 text-gray-900 transition"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
            {user ? (getFirstName(user) ? `Welcome, ${getFirstName(user)}! 🎉` : 'Dashboard') : 'Dashboard'}
          </h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 min-h-full">
          <div className="p-4 lg:p-8">
            {/* Desktop Header */}
            <div className="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                  {user ? (getFirstName(user) ? `Welcome, ${getFirstName(user)}! 🎉` : 'Dashboard') : 'Dashboard'}
                </h1>
                {user && (
                  <p className="text-gray-900 text-sm mt-2">{user.email}</p>
                )}
              </div>
              <Link
                href="/create-event"
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 mt-4 sm:mt-0 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Event
              </Link>
            </div>

            {/* Stats Cards */}
            {!loading && events.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Total Events Card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-purple-100 hover:shadow-xl transition-all transform hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{stats.totalEvents}</p>
                  <p className="text-sm text-gray-900">Total Events</p>
                </div>

                {/* Upcoming Events Card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-pink-100 hover:shadow-xl transition-all transform hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{stats.upcomingEvents}</p>
                  <p className="text-sm text-gray-900">Upcoming Events</p>
                </div>

                {/* Total Raised Card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-blue-100 hover:shadow-xl transition-all transform hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">${(stats.totalRaised / 100).toFixed(2)}</p>
                  <p className="text-sm text-gray-900">Total Raised</p>
                </div>

                {/* Total Items Card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-yellow-100 hover:shadow-xl transition-all transform hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{stats.totalItems}</p>
                  <p className="text-sm text-gray-900">Total Items</p>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading ? (
              <div className="flex justify-center py-24">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                  <p className="text-lg font-medium text-gray-900">Loading your events...</p>
                </div>
              </div>
            ) : (
              <>
                {/* No events state */}
                {activeTab === "invitations" ? (
                  /* Invitations Tab Content */
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Invitations</h2>
                    {pendingInvitations.length === 0 ? (
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center border border-purple-100">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center">
                          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No pending invitations</h3>
                        <p className="text-gray-900">When someone invites you to their event, it will appear here.</p>
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
                            className="bg-white/90 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-purple-100 hover:shadow-xl transition-all"
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
                                      {new Date(invitation.events.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-700 transition disabled:opacity-50"
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
                ) : displayEvents.length === 0 ? (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-purple-100">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
                      <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {activeTab === "joined" ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        )}
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">
                      {activeTab === "joined"
                        ? "No joined events yet"
                        : activeFilter === "upcoming"
                        ? "No upcoming events"
                        : "Start your first celebration!"}
                    </h2>
                    <p className="text-gray-900 mb-6 max-w-md mx-auto">
                      {activeTab === "joined"
                        ? "When you accept an invitation or join an event, it will appear here."
                        : activeFilter === "upcoming"
                        ? "You don't have any upcoming events. Create one to get started!"
                        : "Create a gift registry and let friends contribute to make your special day unforgettable."}
                    </p>
                    {activeTab !== "joined" && (
                      <Link
                        href="/create-event"
                        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 inline-flex items-center gap-2"
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
                      <h2 className="text-xl font-bold text-gray-900 mb-4">Events You've Joined</h2>
                    )}
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {displayEvents.map((event, index) => {
                        const dateInfo = formatEventDate(event.event_date);
                        const gradientClass = getEventGradient(index);
                        return (
                          <div
                            key={event.id}
                            className={`bg-gradient-to-br ${gradientClass} rounded-2xl p-6 flex flex-col justify-between relative cursor-pointer hover:shadow-2xl transition-all transform hover:-translate-y-2 border-2 group`}
                            onClick={() => handleCardClick(event.slug)}
                          >
                            {/* Delete button - only show for owned events */}
                            {activeTab !== "joined" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(event);
                                }}
                                className="absolute top-3 right-3 bg-white/90 hover:bg-red-500 text-gray-900 hover:text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg transition-all shadow-md z-10 opacity-0 group-hover:opacity-100"
                                title="Delete event"
                                disabled={deletingEventId === event.id}
                              >
                                ×
                              </button>
                            )}
                            {/* Joined badge for joined events */}
                            {activeTab === "joined" && (
                              <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                Joined
                              </div>
                            )}

                            {/* Event Header */}
                            <div className="mb-4">
                              <div className="flex items-start justify-between mb-3">
                                <h3 className="text-xl font-bold text-gray-900 pr-8 line-clamp-2">
                                  {event.title}
                                </h3>
                              </div>
                              
                              {/* Date Badge */}
                              {dateInfo && (
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-3 ${
                                  dateInfo.status === 'today' 
                                    ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white animate-pulse' 
                                    : dateInfo.status === 'upcoming'
                                    ? 'bg-blue-100 text-blue-700'
                                    : dateInfo.status === 'past'
                                    ? 'bg-gray-200 text-gray-900'
                                    : 'bg-purple-100 text-purple-700'
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
                                    <span className="text-lg font-bold text-gray-900">${(event.totalRaised / 100).toFixed(2)}</span>
                                    {event.totalRaised > 0 && (
                                      <span className="text-xs text-green-600 font-semibold">✓</span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-900">Total Raised</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <div className="flex items-center gap-1">
                                    <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                    <span className="text-lg font-bold text-gray-900">{event.itemCount}</span>
                                  </div>
                                  <span className="text-xs text-gray-900">
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
      </div>
    </div>
  );
}
