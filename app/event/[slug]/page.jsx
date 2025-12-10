"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../lib/supabase";
import { useToast } from "../../components/ToastProvider";
import LocationSearchModal from "../../components/LocationSearchModal";
import InviteFromContactsModal from "../../components/InviteFromContactsModal";
import AddItemModal from "../../components/AddItemModal";
import RedemptionModal from "../../components/RedemptionModal";

export default function ViewEventPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [event, setEvent] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);
  const [cancelBanner, setCancelBanner] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  // Location editing states
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [newLocation, setNewLocation] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Edit mode states
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Edit item form fields (for inline editing)
  const [itemTitle, setItemTitle] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemProductLink, setItemProductLink] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState("");

  // Delete member states
  const [deleteMemberDialogOpen, setDeleteMemberDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [deletingMember, setDeletingMember] = useState(false);

  // Redemption states
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [itemToRedeem, setItemToRedeem] = useState(null);

  // Members and invitations states
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [eventOwner, setEventOwner] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [showInviteFromContactsModal, setShowInviteFromContactsModal] = useState(false);

  // Add a useEffect to set mounted to true after the initial render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch event data
  const fetchEventData = async () => {
    setLoading(true);
    setNotFound(false);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    if (session?.user) {
      setUser(session.user);
    } else {
      setUser(null);
      setIsOwner(false);
    }

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select(
        "id, title, slug, description, event_date, event_type, location, user_id, invite_code, items(id, title, price_cents, current_amount_cents, product_link, image_url, is_fulfilled, fulfilled_at)"
      )
      .eq("slug", slug)
      .single();

    if (eventError || !eventData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setEvent(eventData);
    setItems(eventData.items || []);

    const userIsOwner = session?.user && eventData.user_id === session.user.id;
    setIsOwner(userIsOwner);

    // Fetch members and invitations
    if (session?.user) {
      fetchMembersAndInvitations(eventData.id, session.user.id);
    }

    setLoading(false);
  };

  // Fetch members and invitations (for event owners)
  const fetchMembersAndInvitations = async (eventId, userId) => {
    if (!eventId || !userId) return;

    try {
      // Fetch members
      const membersResponse = await fetch(`/api/events/${eventId}/members`);
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setMembers(membersData.members || []);
        setEventOwner(membersData.owner);
      }

      // Fetch invitations (owner only)
      const invitationsResponse = await fetch(`/api/events/${eventId}/invite?userId=${userId}`);
      if (invitationsResponse.ok) {
        const invitationsData = await invitationsResponse.json();
        setInvitations(invitationsData.invitations || []);
      }
    } catch (error) {
      console.error('Error fetching members/invitations:', error);
    }
  };

  // Handle sending invitation
  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !event?.id || !user?.id) return;

    setInviteLoading(true);
    setInviteError("");

    try {
      const response = await fetch(`/api/events/${event.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          userId: user.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setInviteError(data.error || 'Failed to send invitation');
      } else {
        showToast('Invitation sent successfully!', 'success');
        setInviteEmail("");
        setShowInviteModal(false);
        // Refresh invitations list
        fetchMembersAndInvitations(event.id, user.id);
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      setInviteError('Failed to send invitation. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  // Handle copying invite link
  const handleCopyInviteLink = async () => {
    if (!event?.invite_code) return;
    const inviteUrl = `${window.location.origin}/join/${event.invite_code}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInviteLink(true);
      setTimeout(() => setCopiedInviteLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
    }
  };


  // ... after handleCopyInviteLink, before verifyPaymentSession

  // Handle updating the event location via API
  // In app/event/[slug]/page.jsx

  const handleUpdateLocation = async (locationData) => {
    // 1. CRITICAL CHECK: Ensure event data is loaded
    if (!event || !event.id) {
        showToast("Error: Event data is not fully loaded. Cannot update location.", "error");
        setShowLocationModal(false);
        return; // Stop execution if event data is missing
    }
    
    // Close the modal immediately for better UX
    setShowLocationModal(false); 
    setLoading(true);

    try {
        // ... (Your existing session and authentication logic)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
            throw new Error('User session not found. Please log in again.');
        }
        
        const authToken = session.access_token;
        
        // 2. USE THE VALID ID
        const response = await fetch(`/api/events/${event.id}`, { 
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`, 
            },
            body: JSON.stringify({
                location: locationData,
            }),
        });

        // ... (Rest of your error handling and state update logic)
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update location.'); 
        }

        const { event: updatedEvent } = await response.json();
        
        setEvent(prevEvent => ({
            ...prevEvent,
            location: updatedEvent.location,
            theme: updatedEvent.theme || prevEvent.theme,
        }));

        showToast("Location updated successfully!", "success");

    } catch (error) {
        console.error('Update Location Error:', error);
        showToast(error.message || "An unknown error occurred while updating location.", "error");
    } finally {
        setLoading(false);
    }
  };
  // ...

  // Verify payment session
  const verifyPaymentSession = async (sessionId) => {
    if (!sessionId) return null;

    setVerifyingPayment(true);
    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      setVerifyingPayment(false);
      return data;
    } catch (error) {
      console.error('Error verifying payment:', error);
      setVerifyingPayment(false);
      return { valid: false, error: 'Failed to verify payment' };
    }
  };

  // Helper function to get user-friendly error message
  const getErrorMessage = (errorType, defaultMessage) => {
    const errorMessages = {
      'card_declined': 'Your card was declined. Please contact your card issuer or try a different payment method.',
      'insufficient_funds': 'Insufficient funds in your account. Please use a different payment method or contact your bank.',
      'expired_card': 'Your card has expired. Please update your payment information and try again.',
      'incorrect_cvc': 'The CVV code entered is incorrect. Please verify and try again.',
      'incorrect_zip': 'The ZIP code entered is incorrect. Please verify and try again.',
      'generic_decline': 'Your bank has rejected the transaction. Please contact your bank for more details or try a different payment method.',
      'payment_failed': 'Payment failed. Please try again or contact support if the problem persists.'
    };

    return errorMessages[errorType] || defaultMessage || 'Payment failed. Please try again or contact support if the problem persists.';
  };

  // Handle payment success/cancel from URL
  useEffect(() => {
    if (typeof window === 'undefined' || paymentVerified) return;

    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const sessionId = urlParams.get('session_id');

    // Only process payment verification if URL params are present
    if (!success && !canceled) return;

    // Handle canceled payment
    if (canceled === 'true') {
      setCancelBanner(true);
      setPaymentVerified(true);
      // Clean URL
      router.replace(`/event/${slug}`, { scroll: false });
      // Auto-dismiss after 8 seconds
      setTimeout(() => setCancelBanner(false), 8000);
      return;
    }

    // Handle successful payment (or failed payment that Stripe redirected to success URL)
    if (success === 'true') {
      setPaymentVerified(true);
      if (sessionId) {
        // Verify the payment session
        verifyPaymentSession(sessionId).then((result) => {
          if (!result) return;

          if (!result.valid) {
            // Invalid or expired session
            showToast(
              result.error || 'Invalid or expired payment session',
              'error'
            );
            router.replace(`/event/${slug}`, { scroll: false });
            return;
          }

          // Check if payment failed
          if (result.failed) {
            // Payment failed - show error banner
            const errorMessage = getErrorMessage(result.errorType, result.errorMessage);
            setErrorBanner({
              message: errorMessage,
              errorType: result.errorType
            });
            // Clean URL
            router.replace(`/event/${slug}`, { scroll: false });
            // Auto-dismiss after 10 seconds
            setTimeout(() => setErrorBanner(null), 10000);
            return;
          }

          if (result.completed) {
            // Payment completed successfully
            setSuccessBanner({
              message: 'Thank you for your contribution! Your payment has been processed.',
              amount: result.amount ? (result.amount / 100).toFixed(2) : null
            });
            // Refresh event data to show updated progress
            fetchEventData();
            // Clean URL
            router.replace(`/event/${slug}`, { scroll: false });
            // Auto-dismiss after 10 seconds
            setTimeout(() => setSuccessBanner(null), 10000);
          } else {
            // Payment received but webhook not processed yet
            showToast(
              'Payment received! Your contribution is being processed and will appear shortly.',
              'warning',
              8000
            );
            // Refresh data after a delay
            setTimeout(() => fetchEventData(), 3000);
            router.replace(`/event/${slug}`, { scroll: false });
          }
        });
      } else {
        // Success parameter but no session ID - show generic success
        setSuccessBanner({
          message: 'Thank you for your contribution! Your payment has been processed.'
        });
        fetchEventData();
        router.replace(`/event/${slug}`, { scroll: false });
        setTimeout(() => setSuccessBanner(null), 10000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, router, showToast, paymentVerified]);

  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (ignore) return;
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setIsOwner(false);
      }

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select(
          "id, title, slug, description, event_date, event_type, location, user_id, invite_code, items(id, title, price_cents, current_amount_cents, product_link, image_url, is_fulfilled, fulfilled_at)"
        )
        .eq("slug", slug)
        .single();

      if (eventError || !eventData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setEvent(eventData);
      setItems(eventData.items || []);

      const userIsOwner = session?.user && eventData.user_id === session.user.id;
      setIsOwner(userIsOwner);

      // Fetch members and invitations
      if (session?.user) {
        fetchMembersAndInvitations(eventData.id, session.user.id);
      }

      setLoading(false);
    }

    fetchData();

    // Listen for sign-out in other tabs (exact same as edit page - minimal, no state updates except on signout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (authEvent, session) => {
      if (ignore) return;
      if (authEvent === "SIGNED_OUT") {
        setUser(null);
        setIsOwner(false);
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [slug]);

  let totalGoal = 0;
  let totalRaised = 0;
  if (items.length > 0) {
    totalGoal = items.reduce(
      (sum, item) => sum + (item.price_cents || 0),
      0
    );
    totalRaised = items.reduce(
      (sum, item) => sum + (item.current_amount_cents || 0),
      0
    );
  }

  const isFullyFunded =
    items.length > 0 &&
    items.every(
      (item) =>
        (item.current_amount_cents || 0) >= (item.price_cents || 0)
    );

  function formatDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const handleShare = async () => {
    const eventUrl = `${window.location.origin}/event/${slug}`;
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };


  // ... after handleShare function

  // Location edit handler - opens the modal
  const handleEditLocation = () => {
    // Use the existing location as the default value if available
    if (event?.location) {
      setNewLocation(event.location);
    } else {
      setNewLocation(null);
    }
    setShowLocationModal(true);
  };

  // ... existing Edit mode handlers (handleShowAddItem, handleEditItem, etc.)

  // Callback when item is added from modal
  const handleItemAdded = (newItem) => {
    setItems((prev) => [...prev, newItem]);
    showToast('Item added successfully!', 'success');
  };

  const handleEditItem = (item) => {
    setEditingItemId(item.id);
    setItemTitle(item.title);
    setItemPrice((item.price_cents / 100).toFixed(2));
    setItemProductLink(item.product_link || "");
    setItemImageUrl(item.image_url || "");
    setItemError("");
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setItemTitle("");
    setItemPrice("");
    setItemProductLink("");
    setItemImageUrl("");
    setItemError("");
  };

  // Update item
  const handleUpdateItem = async (e) => {
    e.preventDefault();
    setItemError("");
    setItemLoading(true);

    try {
      // Validation (same as add)
      if (!itemTitle.trim()) {
        setItemError("Title is required.");
        setItemLoading(false);
        return;
      }
      const priceNum = Number(itemPrice);
      if (Number.isNaN(priceNum) || priceNum < 0.01) {
        setItemError("Valid price is required.");
        setItemLoading(false);
        return;
      }
      if (itemProductLink && itemProductLink.length > 0) {
        try {
          new URL(itemProductLink);
        } catch {
          setItemError("Product link must be a valid URL.");
          setItemLoading(false);
          return;
        }
      }
      if (itemImageUrl && itemImageUrl.length > 0) {
        try {
          new URL(itemImageUrl);
        } catch {
          setItemError("Image URL must be a valid URL.");
          setItemLoading(false);
          return;
        }
      }

      // Update in db
      const { data, error: updateError } = await supabase
        .from("items")
        .update({
          title: itemTitle.trim(),
          price_cents: Math.round(Number(itemPrice) * 100),
          product_link: itemProductLink.trim() || null,
          image_url: itemImageUrl.trim() || null,
        })
        .eq("id", editingItemId)
        .select()
        .single();

      if (updateError) {
        if (updateError.message?.includes("row-level security policy")) {
          setItemError(
            "Permission denied. Please ensure you have the correct database policies set up."
          );
        } else {
          setItemError(updateError.message || "Failed to update item.");
        }
        setItemLoading(false);
        return;
      }

      // Refresh items list
      setItems((prev) =>
        prev.map((item) => (item.id === editingItemId ? data : item))
      );
      handleCancelEdit();
      setItemLoading(false);
    } catch (error) {
      console.error("Error updating item:", error);
      setItemError(error.message || "An unexpected error occurred. Please try again.");
      setItemLoading(false);
    }
  };

  // Delete item handlers
  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  // Redemption handlers
  const handleRedeemClick = (item) => {
    setItemToRedeem(item);
    setShowRedemptionModal(true);
  };

  const handleCloseRedemptionModal = () => {
    setShowRedemptionModal(false);
    setItemToRedeem(null);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    
    setItemLoading(true);
    const { error: deleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", itemToDelete.id);

    if (deleteError) {
      setItemError("Failed to delete item.");
      setItemLoading(false);
      handleCloseDeleteDialog();
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== itemToDelete.id));
    setItemLoading(false);
    handleCloseDeleteDialog();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-blue-50 py-10">
      <div className="max-w-6xl mx-auto px-4">
        {/* Success Banner */}
        {successBanner && (
          <div className="mb-6 bg-green-100 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">✓</span>
              <div>
                <p className="font-semibold text-lg">{successBanner.message}</p>
                {successBanner.amount && (
                  <p className="text-sm mt-1">Amount: ${successBanner.amount}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-green-700 hover:text-green-900 font-bold text-xl ml-4 flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Cancel Banner */}
        {cancelBanner && (
          <div className="mb-6 bg-blue-100 border-2 border-blue-400 text-blue-800 px-6 py-4 rounded-lg flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">ℹ</span>
              <p className="font-semibold">Payment was canceled. You can try again anytime.</p>
            </div>
            <button
              onClick={() => setCancelBanner(false)}
              className="text-blue-700 hover:text-blue-900 font-bold text-xl ml-4 flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorBanner && (
          <div className="mb-6 bg-red-100 border-2 border-red-500 text-red-800 px-6 py-4 rounded-lg flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">✕</span>
              <div>
                <p className="font-semibold text-lg">Payment Failed</p>
                <p className="text-sm mt-1">{errorBanner.message}</p>
              </div>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-red-700 hover:text-red-900 font-bold text-xl ml-4 flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Payment Verification Loading */}
        {verifyingPayment && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 px-6 py-3 rounded-lg flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="font-medium">Verifying your payment...</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="text-gray-900 text-lg animate-pulse">Loading event...</div>
          </div>
        ) : notFound ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="bg-white rounded-lg shadow p-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
              <p className="text-gray-900 mb-2">
                Sorry, we couldn't find this event.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header with Dashboard, Title, and Share in one row */}
            <div className="mb-8">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4 mb-4">
                {/* Left: Dashboard button */}
                {user && (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-blue-50 transition border border-blue-200 self-start"
                  >
                    ← Dashboard
                  </Link>
                )}

                {/* Center: Title, Date, Event Type */}
                <div className="flex-1 text-center">
                  <h1 className="text-3xl lg:text-4xl font-bold text-blue-900 mb-2">{event.title}</h1>
                  {event.event_date && (
                    <div className="text-blue-600 text-md font-medium mb-2">
                      {formatDate(event.event_date)}
                    </div>
                  )}
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      (event.event_type !== 'casual-meetup')
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {(event.event_type !== 'casual-meetup') ? '🎁 Gift Registry' : '📍 Casual Meetup'}
                    </span>
                  </div>
                </div>

                {/* Right: Share button */}
                {user && (
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 bg-white text-blue-700 px-4 py-2 rounded-lg font-semibold shadow-md hover:bg-blue-50 transition border border-blue-200 self-start"
                    title="Copy link to share"
                  >
                    {copied ? (
                      <>
                        <span>✓</span>
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <span>🔗</span>
                        <span>Share Event</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Description below the header */}
              {event.description && (
                <div className="mx-auto max-w-3xl text-center text-gray-800 text-lg mt-4">
                  {event.description}
                </div>
              )}
            </div>

            {/* Two-column layout: Sidebar + Main Content */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Sidebar - Members & Invitees */}
              <div className="w-full lg:w-72 flex-shrink-0">
                <div className="bg-white rounded-lg shadow-md p-4 sticky top-4">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Members
                  </h3>

                  {/* Owner */}
                  {eventOwner && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {eventOwner.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{eventOwner.name}</p>
                          <p className="text-xs text-blue-600">Owner</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Members List */}
                  {members.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {members.map((member) => (
                        <div key={member.id} className="group flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {member.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 text-sm truncate">{member.name}</p>
                            <p className="text-xs text-gray-900">Member</p>
                          </div>
                          {isOwner && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMemberToDelete(member);
                                setDeleteMemberDialogOpen(true);
                              }}
                              className="text-red-500 hover:text-red-700 p-1 transition"
                              title="Remove member"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {members.length === 0 && !eventOwner && (
                    <p className="text-gray-900 text-sm mb-4">No members yet</p>
                  )}

                  {/* Pending Invitations (Owner only) */}
                  {isOwner && invitations.length > 0 && (
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <h4 className="font-semibold text-gray-900 text-sm mb-2">Pending Invites</h4>
                      <div className="space-y-2">
                        {invitations.filter(inv => inv.status === 'pending').map((invite) => (
                          <div key={invite.id} className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
                            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              ✉
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{invite.email}</p>
                              <p className="text-xs text-yellow-600">Pending</p>
                            </div>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Delete invitation for ${invite.email}?`)) return;
                                try {
                                  const res = await fetch(`/api/invitations/${invite.id}`, {
                                    method: 'DELETE',
                                  });
                                  if (res.ok) {
                                    setInvitations(invitations.filter(inv => inv.id !== invite.id));
                                  } else {
                                    alert('Failed to delete invitation');
                                  }
                                } catch (err) {
                                  alert('Error deleting invitation');
                                }
                              }}
                              className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded font-medium transition"
                            >
                              Delete
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const btn = e.currentTarget;
                                btn.disabled = true;
                                btn.textContent = '...';
                                try {
                                  const res = await fetch(`/api/events/${event.id}/invite/resend`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: invite.email, userId: user.id }),
                                  });
                                  if (res.ok) {
                                    btn.textContent = '✓';
                                    btn.className = 'text-xs bg-green-500 text-white px-2 py-1 rounded font-medium';
                                  } else {
                                    btn.textContent = '✗';
                                    btn.className = 'text-xs bg-red-500 text-white px-2 py-1 rounded font-medium';
                                  }
                                } catch (err) {
                                  btn.textContent = '✗';
                                }
                                setTimeout(() => {
                                  btn.disabled = false;
                                  btn.textContent = 'Resend';
                                  btn.className = 'text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded font-medium transition';
                                }, 2000);
                              }}
                              className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded font-medium transition"
                            >
                              Resend
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invite Actions (Owner only) */}
                  {isOwner && (
                    <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Invite by Email
                      </button>

                      <button
                        onClick={() => setShowInviteFromContactsModal(true)}
                        className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg font-semibold text-sm hover:bg-purple-700 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Invite from Contacts
                      </button>

                      {event?.invite_code && (
                        <button
                          onClick={handleCopyInviteLink}
                          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-900 px-3 py-2 rounded-lg font-semibold text-sm hover:bg-gray-200 transition"
                        >
                          {copiedInviteLink ? (
                            <>
                              <span>✓</span>
                              <span>Link Copied!</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>Copy Invite Link</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Content */}
              <div className="flex-1">
                {/* Location Display - for casual meetups */}
                {event.event_type === 'casual-meetup' && event.location && (
                  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Location
                    </h3>

                    {/* Photos */}
                    {event.location.photos && event.location.photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {event.location.photos.slice(0, 3).map((photo, index) => (
                          <img
                            key={index}
                            src={`/api/places/photo?photo_reference=${encodeURIComponent(photo.photo_reference)}&maxwidth=400`}
                            alt={`${event.location.name} photo ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    )}

                    {/* Place Info */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6">
                      <h4 className="text-2xl font-bold text-gray-800 mb-2">{event.location.name}</h4>

                      {/* Rating */}
                      {event.location.rating && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-5 h-5 ${i < Math.floor(event.location.rating) ? 'text-yellow-400' : 'text-gray-900'}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{event.location.rating.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Address */}
                      <div className="flex items-start gap-2 mb-4">
                        <svg className="w-5 h-5 text-gray-800 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-gray-900">{event.location.formatted_address}</p>
                      </div>

                      {/* Google Maps Link */}
                      {/* Location Buttons - Visible only if location data exists */}
                      {event.location && (
                        <div className={`mt-6 ${isOwner ? 'flex flex-col sm:flex-row gap-4' : ''}`}>
                          
                          {/* Google Maps Link */}
                          {event.location.geometry && (
                            <a
                              // FIX: The URL structure was incorrect. Using the standard maps link.
                              href={`https://www.google.com/maps/search/?api=1&query=${event.location.geometry.lat},${event.location.geometry.lng}&query_place_id=${event.location.place_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-block ${isOwner ? 'flex-1' : 'w-full'} px-4 py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-blue-700 transition text-center`}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Open in Google Maps
                              </div>
                            </a>
                          )}

                          {/* Edit Location Button - Visible only to Owner */}
                          {isOwner && (
                            <button
                              onClick={handleEditLocation} // Use the new function name
                              className={`inline-block ${!event.location.geometry ? 'w-full' : 'flex-1'} px-4 py-3 border-2 border-gray-400 text-gray-800 rounded-lg font-medium hover:bg-gray-100 transition text-center`}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.232 5.232z" />
                                </svg>
                                Edit Location
                              </div>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Items Grid - only for gift registries (or old events without event_type) */}
                {(event.event_type !== 'casual-meetup') && (
                  <>
                    {/* Add Item Button - shown for owners */}
                    {isOwner && !editingItemId && (
                  <div className="mb-6 bg-white rounded-lg shadow-md p-6 border-2 border-blue-200">
                      <button
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-purple-700 transition shadow-lg"
                        onClick={() => setShowAddItemModal(true)}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Quick Add (Amazon Link)
                      </button>
              </div>
            )}

                    {/* Edit Item Form - shown when editing */}
                    {isOwner && editingItemId && (
                      <div className="mb-6 bg-white rounded-lg shadow-md p-6 border-2 border-blue-200">
                        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
                          <h4 className="font-semibold mb-3 text-gray-800">
                            Edit Item
                          </h4>
                          <form onSubmit={handleUpdateItem} className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-900" htmlFor="item-title">
                                Item Title <span className="text-red-500">*</span>
                              </label>
                              <input
                                id="item-title"
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-blue-200"
                                value={itemTitle}
                                onChange={(e) => setItemTitle(e.target.value)}
                                required
                                disabled={itemLoading}
                                placeholder="Title of the item"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-900" htmlFor="item-price">
                                Price (USD) <span className="text-red-500">*</span>
                              </label>
                              <input
                                id="item-price"
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-blue-200"
                                value={itemPrice}
                                onChange={(e) => setItemPrice(e.target.value)}
                                required
                                disabled={itemLoading}
                                placeholder="e.g. 50.00"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-900" htmlFor="item-link">
                                Product Link
                              </label>
                              <input
                                id="item-link"
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-blue-200"
                                value={itemProductLink}
                                onChange={(e) => setItemProductLink(e.target.value)}
                                disabled={itemLoading}
                                placeholder="https://example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-900" htmlFor="item-img">
                                Image URL
                              </label>
                              <input
                                id="item-img"
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-blue-200"
                                value={itemImageUrl}
                                onChange={(e) => setItemImageUrl(e.target.value)}
                                disabled={itemLoading}
                                placeholder="https://example.com/image.jpg"
                              />
                            </div>
                            {itemError && (
                              <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                                {itemError}
                              </div>
                            )}
                            <div className="flex gap-2 mt-2">
                              <button
                                type="submit"
                                className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                                disabled={itemLoading}
                              >
                                {itemLoading
                                  ? editingItemId
                                    ? "Updating..."
                                    : "Adding..."
                                  : editingItemId
                                  ? "Update Item"
                                  : "Add Item"}
                              </button>
                              <button
                                type="button"
                                className="bg-gray-300 text-gray-900 px-4 py-2 rounded font-semibold hover:bg-gray-400 transition"
                                onClick={handleCancelEdit}
                                disabled={itemLoading}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}

                <div className="grid gap-6 md:grid-cols-2">
                  {items.length === 0 ? (
                    <div className="col-span-full text-center text-gray-900 italic">
                      {isOwner
                        ? "No items yet. Use 'Add Item' to add one."
                        : "No items found for this event."}
                    </div>
                  ) : (
                    items.map((item) => {
                      const price = item.price_cents || 0;
                      const raised = item.current_amount_cents || 0;
                      const itemFunded = raised >= price && price > 0;
                      const isFulfilled = item.is_fulfilled;
                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-lg shadow-md flex flex-col min-h-[350px] relative"
                        >
                          {/* Fulfilled badge */}
                          {isFulfilled && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10 flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Redeemed
                            </div>
                          )}
                          {item.image_url ? (
                            <div className="h-44 w-full bg-gray-100 rounded-t-lg flex items-center justify-center overflow-hidden">
                              <img
                                src={item.image_url}
                                alt={item.title}
                                className="max-h-full max-w-full object-contain rounded-t-lg"
                              />
                            </div>
                          ) : (
                            <div className="h-44 flex items-center justify-center bg-gray-100 rounded-t-lg text-gray-900 text-5xl">
                              <span className="material-symbols-outlined">image</span>
                            </div>
                          )}
                          <div className="p-4 flex flex-1 flex-col justify-between">
                            <div>
                              <h2 className="text-xl font-semibold text-blue-800 mb-1">
                                {item.title}
                              </h2>
                              <div className="text-lg font-bold text-gray-900 mb-2">
                                ${ (price / 100).toFixed(2) }
                              </div>
                              {item.product_link && (
                                <a
                                  href={item.product_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 transition"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  View Product
                                </a>
                              )}
                              <div className="w-full mb-2">
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div
                                    className={`h-3 rounded-full transition-all duration-500 ${
                                      itemFunded
                                        ? "bg-green-500"
                                        : "bg-blue-400"
                                    }`}
                                    style={{
                                      width: price
                                        ? `${Math.min(100, Math.round((raised / price) * 100))}%`
                                        : "0%",
                                    }}
                                  ></div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-900 mt-0.5">
                                  <span>
                                    Raised: ${ (raised / 100).toFixed(2) }
                                  </span>
                                  <span>
                                    {itemFunded ? (
                                      <span className="text-green-700 font-semibold">Fully Funded!</span>
                                    ) : (
                                      <>Goal: ${ (price / 100).toFixed(2) }</>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 mt-4">
                              {isOwner ? (
                                <>
                                  {/* Redeem button - shown only when fully funded and not yet redeemed */}
                                  {itemFunded && !isFulfilled && (
                                    <button
                                      onClick={() => handleRedeemClick(item)}
                                      className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:from-green-600 hover:to-blue-700 transition shadow-lg flex items-center justify-center gap-2"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Redeem ${((raised / 100) * 0.95).toFixed(2)}
                                    </button>
                                  )}
                                  {/* Already redeemed message */}
                                  {isFulfilled && (
                                    <div className="w-full bg-green-50 border-2 border-green-500 text-green-800 px-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Funds Redeemed
                                    </div>
                                  )}
                                  {/* Edit/Delete buttons */}
                                  <div className="flex gap-2 w-full">
                                    <button
                                      onClick={() => handleEditItem(item)}
                                      disabled={itemLoading || editingItemId === item.id}
                                      className="flex-1 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-2 rounded font-semibold text-sm transition disabled:opacity-50"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteClick(item)}
                                      disabled={itemLoading || editingItemId === item.id}
                                      className="flex-1 bg-red-100 text-red-700 hover:bg-red-200 px-3 py-2 rounded font-semibold text-sm transition disabled:opacity-50"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  onClick={() => setSelectedItem(item)}
                                  disabled={itemFunded}
                                  className={`flex-1 px-4 py-2 rounded-md font-semibold transition ${
                                    itemFunded
                                      ? 'bg-gray-300 text-gray-900 cursor-not-allowed'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {itemFunded ? 'Fully Funded' : 'Contribute'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        {/* --- Location Search Modal --- */}
        {mounted && showLocationModal && (
            <LocationSearchModal
                // The modal component should be conditionally rendered,
                // so we don't need to rely on the internal 'isOpen' check.
                isOpen={true}
                onClose={() => setShowLocationModal(false)}
                onLocationSelected={handleUpdateLocation}
                initialLocation={event?.location}
            />
        )}

        {/* --- Invite from Contacts Modal --- */}
        {mounted && showInviteFromContactsModal && (
            <InviteFromContactsModal
                isOpen={true}
                onClose={() => setShowInviteFromContactsModal(false)}
                eventId={event?.id}
                eventTitle={event?.title}
                onInviteSuccess={(message) => {
                  showToast(message, 'success');
                  fetchMembersAndInvitations(event.id, user.id);
                }}
            />
        )}

        {/* --- Add Item Modal --- */}
        {mounted && showAddItemModal && (
            <AddItemModal
                isOpen={true}
                onClose={() => setShowAddItemModal(false)}
                eventId={event?.id}
                userId={user?.id}
                onItemAdded={handleItemAdded}
            />
        )}

        {/* --- Redemption Modal --- */}
        {mounted && showRedemptionModal && itemToRedeem && (
            <RedemptionModal
                isOpen={true}
                onClose={handleCloseRedemptionModal}
                item={itemToRedeem}
                eventId={event?.id}
                userId={user?.id}
            />
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4">Invite Someone</h3>
            <form onSubmit={handleSendInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="friend@example.com"
                  required
                  disabled={inviteLoading}
                />
              </div>
              {inviteError && (
                <div className="mb-4 text-red-600 text-sm bg-red-50 p-2 rounded">
                  {inviteError}
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail("");
                    setInviteError("");
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300 transition"
                  disabled={inviteLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  disabled={inviteLoading || !inviteEmail.trim()}
                >
                  {inviteLoading ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedItem && (
        <ContributeModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && itemToDelete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCloseDeleteDialog}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Item</h3>
            <p className="text-gray-800 mb-4">
              Are you sure you want to delete <span className="font-semibold">"{itemToDelete.title}"</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseDeleteDialog}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded font-semibold hover:bg-gray-300 transition"
                disabled={itemLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition disabled:opacity-50"
                disabled={itemLoading}
              >
                {itemLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation Dialog */}
      {deleteMemberDialogOpen && memberToDelete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setDeleteMemberDialogOpen(false);
            setMemberToDelete(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-2">Remove Member</h3>
            <p className="text-gray-800 mb-4">
              Are you sure you want to remove <span className="font-semibold">{memberToDelete.name}</span> from this event?
              They will no longer have access to the event.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteMemberDialogOpen(false);
                  setMemberToDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded font-semibold hover:bg-gray-300 transition"
                disabled={deletingMember}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!memberToDelete) return;
                  setDeletingMember(true);
                  try {
                    const res = await fetch(`/api/events/${event.id}/members`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: user.id,
                        memberUserId: memberToDelete.user_id
                      })
                    });
                    if (res.ok) {
                      setMembers(members.filter(m => m.id !== memberToDelete.id));
                      showToast('Member removed successfully', 'success');
                    } else {
                      const data = await res.json();
                      showToast(data.error || 'Failed to remove member', 'error');
                    }
                  } catch (err) {
                    console.error('Error removing member:', err);
                    showToast('Error removing member', 'error');
                  } finally {
                    setDeletingMember(false);
                    setDeleteMemberDialogOpen(false);
                    setMemberToDelete(null);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition disabled:opacity-50"
                disabled={deletingMember}
              >
                {deletingMember ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ContributeModal({ item, onClose }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const remaining = (item.price_cents - item.current_amount_cents) / 100;
  const suggestedAmounts = [25, 50, 100];

  async function handleContribute() {
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    if (!name.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          amount: Math.round(parseFloat(amount) * 100),
          contributorName: name.trim(),
          contributorEmail: email.trim()
        })
      });

      const data = await response.json();

      if (data.error) {
        showToast(data.error || 'Failed to create payment session', 'error');
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      console.error('Payment error:', err);
      showToast('Network error. Please check your connection and try again.', 'error');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Contribute</h3>
          <button
            onClick={onClose}
            className="text-gray-800 hover:text-gray-800 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold text-lg mb-2 text-gray-900">{item.title}</h4>
          <div className="text-sm text-gray-900 space-y-1">
            <p>Price: <span className="font-semibold text-gray-900">${(item.price_cents / 100).toFixed(2)}</span></p>
            <p>Already raised: <span className="font-semibold text-gray-900">${(item.current_amount_cents / 100).toFixed(2)}</span></p>
            <p className="text-green-700 font-semibold">Remaining: ${remaining.toFixed(2)}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-900">Quick Select:</label>
          <div className="grid grid-cols-4 gap-2">
            {suggestedAmounts.map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                className="py-2 border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition font-semibold text-gray-900"
              >
                ${amt}
              </button>
            ))}
            <button
              onClick={() => setAmount(remaining.toFixed(2))}
              className="py-2 border-2 border-green-200 rounded-lg hover:bg-green-50 hover:border-green-400 transition font-semibold text-gray-900"
            >
              Full
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-900">Amount (USD) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
            placeholder="25.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-900">Your Name *</label>
          <input
            type="text"
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-900">Email (optional)</label>
          <input
            type="email"
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
            placeholder="john@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleContribute}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Processing...' : 'Continue to Payment'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition"
          >
            Cancel
          </button>
        </div>
        
      </div>
    </div>
  );
}