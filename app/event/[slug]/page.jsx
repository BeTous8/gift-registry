"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../lib/supabase";
import { useToast } from "../../components/ToastProvider";
import LocationSearchModal from "../../components/LocationSearchModal";
import InviteFromContactsModal from "../../components/InviteFromContactsModal";
import AddItemModal from "../../components/AddItemModal";
import RedemptionModal from "../../components/RedemptionModal";
import AddToCalendarButton from "../../components/AddToCalendarButton";
import EventRemindersPanel from "../../components/EventRemindersPanel";
import { parseLocalDate } from "../../lib/dateUtils";
import { addAffiliateTag } from "../../utils/affiliateLinks";

export default function ViewEventPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  // Get the source tab for back navigation (default to my-events)
  const fromTab = searchParams.get('from') || 'my-events';
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
  const [activeFulfillments, setActiveFulfillments] = useState({}); // Map of item_id -> fulfillment status

  // Page tab for special events (Registry vs Location)
  const [pageTab, setPageTab] = useState("registry");

  // Tab for casual meetups (In Person vs Online)
  const [casualTab, setCasualTab] = useState("in-person");

  // Online meeting editing states
  const [editingMeetingUrl, setEditingMeetingUrl] = useState(false);
  const [meetingUrlInput, setMeetingUrlInput] = useState("");
  const [meetingUrlError, setMeetingUrlError] = useState("");
  const [savingMeetingUrl, setSavingMeetingUrl] = useState(false);

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

  // SMS invite states
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState("");

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
      .select("*, items(id, title, price_cents, current_amount_cents, product_link, image_url, is_fulfilled, fulfilled_at)")
      .eq("slug", slug)
      .single();

    console.log('Supabase query result:', { eventData, eventError });

    if (eventError || !eventData) {
      console.log('Event not found or error:', eventError);
      setNotFound(true);
      setLoading(false);
      return;
    }

    console.log('Event data fetched:', {
      online_meeting_url: eventData.online_meeting_url,
      online_meeting_type: eventData.online_meeting_type,
      event_category: eventData.event_category,
      registry_enabled: eventData.registry_enabled
    });
    setEvent(eventData);
    setItems(eventData.items || []);

    const userIsOwner = session?.user && eventData.user_id === session.user.id;
    setIsOwner(userIsOwner);

    // Fetch members and invitations
    if (session?.user) {
      fetchMembersAndInvitations(eventData.id, session.user.id);
      // Fetch active fulfillments for owner
      if (userIsOwner) {
        fetchActiveFulfillments(eventData.id);
      }
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

  // Handle sending SMS invite
  const handleSendSmsInvite = async (e) => {
    e.preventDefault();
    if (!invitePhone.trim() || !event?.id || !user?.id) return;

    setSmsLoading(true);
    setSmsError("");

    try {
      const response = await fetch(`/api/events/${event.id}/invite-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: invitePhone.trim(),
          userId: user.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setSmsError(data.error || 'Failed to send SMS invitation');
      } else {
        showToast(data.smsSkipped ? 'Invitation created (SMS not configured)' : 'SMS invitation sent!', 'success');
        setInvitePhone("");
        setShowSmsModal(false);
        // Refresh invitations list
        fetchMembersAndInvitations(event.id, user.id);
      }
    } catch (error) {
      console.error('Error sending SMS invitation:', error);
      setSmsError('Failed to send SMS. Please try again.');
    } finally {
      setSmsLoading(false);
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

  // Fetch fulfillments for event items (for owner only)
  const fetchActiveFulfillments = async (eventId) => {
    if (!eventId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/fulfillments?eventId=${eventId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Create a map of item_id -> fulfillment for quick lookup
        // Include pending, processing, AND completed for showing details
        const fulfillmentMap = {};
        (data.fulfillments || []).forEach(f => {
          if (f.status === 'pending' || f.status === 'processing' || f.status === 'completed') {
            fulfillmentMap[f.item.id] = f;
          }
        });
        setActiveFulfillments(fulfillmentMap);
      }
    } catch (error) {
      console.error('Error fetching fulfillments:', error);
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

  // Handle updating the online meeting URL via API
  const handleUpdateMeetingUrl = async () => {
    if (!event || !event.id) {
      showToast("Error: Event data is not fully loaded.", "error");
      return;
    }

    setSavingMeetingUrl(true);
    setMeetingUrlError("");

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('User session not found. Please log in again.');
      }

      const authToken = session.access_token;

      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          online_meeting_url: meetingUrlInput.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update meeting URL.');
      }

      const { event: updatedEvent } = await response.json();

      setEvent(prevEvent => ({
        ...prevEvent,
        online_meeting_url: updatedEvent.online_meeting_url,
        online_meeting_type: updatedEvent.online_meeting_type,
      }));

      setEditingMeetingUrl(false);
      showToast("Meeting link updated successfully!", "success");

    } catch (error) {
      console.error('Update Meeting URL Error:', error);
      setMeetingUrlError(error.message || "Failed to update meeting link.");
    } finally {
      setSavingMeetingUrl(false);
    }
  };

  // Helper to get meeting type icon and label
  const getMeetingTypeInfo = (type) => {
    switch (type) {
      case 'zoom':
        return { label: 'Zoom Meeting', color: 'text-blue-600', bgColor: 'bg-blue-50' };
      case 'google_meet':
        return { label: 'Google Meet', color: 'text-green-600', bgColor: 'bg-green-50' };
      case 'teams':
        return { label: 'Microsoft Teams', color: 'text-purple-600', bgColor: 'bg-purple-50' };
      default:
        return { label: 'Video Call', color: 'text-[var(--lavender-600)]', bgColor: 'bg-[var(--lavender-50)]' };
    }
  };

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
    fetchEventData();

    // Listen for sign-out in other tabs
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (authEvent, session) => {
      if (authEvent === "SIGNED_OUT") {
        setUser(null);
        setIsOwner(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const date = parseLocalDate(dateStr);
    if (!date) return null;
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

  // Determine if this is a casual meetup
  const isCasualMeetup = event?.event_category === 'casual' || event?.registry_enabled === false;

  return (
    <div className={`min-h-screen py-10 font-body ${
      isCasualMeetup
        ? 'bg-gradient-to-br from-[var(--mint-100)] via-[var(--mint-200)] to-[var(--cloud-50)]'
        : 'bg-gradient-to-br from-[var(--lavender-50)] via-[var(--peach-100)] to-[var(--mint-100)]'
    }`}>
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
                {/* Left: Back button - returns to source tab */}
                {user && (
                  <Link
                    href={`/dashboard?tab=${fromTab}`}
                    className={`inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg font-semibold shadow-md transition self-start ${
                      isCasualMeetup
                        ? 'text-[var(--mint-400)] hover:bg-[var(--mint-100)] border border-[var(--mint-200)]'
                        : 'text-[var(--lavender-600)] hover:bg-[var(--lavender-50)] border border-[var(--lavender-200)]'
                    }`}
                  >
                    ← {fromTab === 'joined' ? 'Joined Events' :
                       fromTab === 'upcoming' ? 'Upcoming' :
                       fromTab === 'invitations' ? 'Invitations' :
                       fromTab === 'home' ? 'Home' : 'My Events'}
                  </Link>
                )}

                {/* Center: Title, Date, Event Type */}
                <div className="flex-1 text-center">
                  <h1 className={`text-3xl lg:text-4xl font-bold font-display mb-2 ${
                    isCasualMeetup ? 'text-[var(--charcoal-900)]' : 'text-[var(--charcoal-900)]'
                  }`}>{event.title}</h1>
                  {event.event_date && (
                    <div className={`text-md font-medium mb-2 ${
                      isCasualMeetup ? 'text-[var(--mint-400)]' : 'text-[var(--lavender-600)]'
                    }`}>
                      {formatDate(event.event_date)}
                      {event.event_time && (() => {
                        const [hours, minutes] = event.event_time.split(':');
                        const date = new Date();
                        date.setHours(parseInt(hours), parseInt(minutes));
                        return ` at ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
                      })()}
                    </div>
                  )}
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      isCasualMeetup
                        ? 'bg-[var(--mint-100)] text-[var(--charcoal-900)]'
                        : 'bg-[var(--lavender-100)] text-[var(--lavender-700)]'
                    }`}>
                      {isCasualMeetup ? '☕ Casual Meetup' : '🎁 Gift Registry'}
                    </span>
                  </div>

                  {/* Location - prominent for casual meetups, clickable for directions */}
                  {isCasualMeetup && event.location && (
                    <a
                      href={event.location.geometry
                        ? `https://www.google.com/maps/dir/?api=1&destination=${event.location.geometry.lat},${event.location.geometry.lng}&destination_place_id=${event.location.place_id}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location.formatted_address)}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-md border border-[var(--mint-200)] hover:bg-[var(--mint-50)] hover:border-[var(--mint-300)] transition-colors cursor-pointer"
                    >
                      <svg className="w-5 h-5 text-[var(--mint-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div className="text-left">
                        <p className="font-medium text-[var(--charcoal-900)]">{event.location.name}</p>
                        <p className="text-sm text-[var(--charcoal-800)]">{event.location.formatted_address}</p>
                      </div>
                    </a>
                  )}
                </div>

                {/* Right: Action buttons */}
                <div className="flex flex-col sm:flex-row gap-2 self-start">
                  {/* Add to Calendar button */}
                  {event.event_date && (
                    <AddToCalendarButton
                      eventId={event.id}
                      eventTitle={event.title}
                      eventDate={event.event_date}
                      eventDescription={event.description}
                      eventLocation={event.location}
                    />
                  )}

                  {/* Share button */}
                  {user && (
                    <button
                      onClick={handleShare}
                      className={`inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg font-semibold shadow-md transition ${
                        isCasualMeetup
                          ? 'text-[var(--mint-400)] hover:bg-[var(--mint-100)] border border-[var(--mint-200)]'
                          : 'text-[var(--lavender-600)] hover:bg-[var(--lavender-50)] border border-[var(--lavender-200)]'
                      }`}
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
              </div>

              {/* Description below the header */}
              {event.description && (
                <div className="mx-auto max-w-3xl text-center text-[var(--charcoal-800)] text-lg mt-4">
                  {event.description}
                </div>
              )}

              {/* Tab Navigation for Special Events */}
              {!isCasualMeetup && (
                <div className="mt-6 flex justify-center">
                  <div className="inline-flex bg-white rounded-xl p-1 shadow-md border border-[var(--lavender-100)]">
                    <button
                      onClick={() => setPageTab("registry")}
                      className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                        pageTab === "registry"
                          ? "bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-500)] text-white shadow-md"
                          : "text-[var(--charcoal-800)] hover:bg-[var(--lavender-50)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                        </svg>
                        Gift Registry
                      </span>
                    </button>
                    <button
                      onClick={() => setPageTab("location")}
                      className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                        pageTab === "location"
                          ? "bg-gradient-to-r from-[var(--mint-300)] to-[var(--mint-400)] text-white shadow-md"
                          : "text-[var(--charcoal-800)] hover:bg-[var(--mint-100)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Location
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Navigation for Casual Meetups */}
              {isCasualMeetup && (
                <div className="mt-6 flex justify-center">
                  <div className="inline-flex bg-white rounded-xl p-1 shadow-md border border-[var(--mint-100)]">
                    <button
                      onClick={() => setCasualTab("in-person")}
                      className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                        casualTab === "in-person"
                          ? "bg-gradient-to-r from-[var(--mint-300)] to-[var(--mint-400)] text-white shadow-md"
                          : "text-[var(--charcoal-800)] hover:bg-[var(--mint-100)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        In Person
                      </span>
                    </button>
                    <button
                      onClick={() => setCasualTab("online")}
                      className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                        casualTab === "online"
                          ? "bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-500)] text-white shadow-md"
                          : "text-[var(--charcoal-800)] hover:bg-[var(--lavender-50)]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Online
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Two-column layout: Sidebar + Main Content */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Sidebar - Members & Invitees */}
              <div className="w-full lg:w-72 flex-shrink-0">
                <div className="bg-white rounded-xl shadow-md p-4 sticky top-4 border border-[var(--lavender-100)]">
                  <h3 className="font-bold text-[var(--charcoal-900)] mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--lavender-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Members
                  </h3>

                  {/* Owner */}
                  {eventOwner && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 p-2 bg-[var(--lavender-50)] rounded-lg">
                        <div className="w-8 h-8 bg-gradient-to-br from-[var(--lavender-400)] to-[var(--lavender-500)] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {eventOwner.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--charcoal-900)] text-sm truncate">{eventOwner.name}</p>
                          <p className="text-xs text-[var(--lavender-600)]">Owner</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Members List */}
                  {members.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {members.map((member) => (
                        <div key={member.id} className="group flex items-center gap-2 p-2 bg-[var(--cloud-50)] rounded-lg hover:bg-[var(--mint-100)] transition">
                          <div className="w-8 h-8 bg-gradient-to-br from-[var(--mint-300)] to-[var(--mint-400)] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {member.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[var(--charcoal-900)] text-sm truncate">{member.name}</p>
                            <p className="text-xs text-[var(--charcoal-800)]">Member</p>
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
                    <p className="text-[var(--charcoal-800)] text-sm mb-4">No members yet</p>
                  )}

                  {/* Pending Invitations (Owner only) */}
                  {isOwner && invitations.length > 0 && (
                    <div className="border-t border-[var(--lavender-100)] pt-3 mt-3">
                      <h4 className="font-semibold text-[var(--charcoal-900)] text-sm mb-2">Pending Invites</h4>
                      <div className="space-y-2">
                        {invitations.filter(inv => inv.status === 'pending').map((invite) => (
                          <div key={invite.id} className="flex items-center gap-2 p-2 bg-[var(--buttercream-50)] rounded-lg">
                            <div className="w-8 h-8 bg-[var(--peach-300)] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                              ✉
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[var(--charcoal-900)] text-sm truncate">{invite.email}</p>
                              <p className="text-xs text-[var(--peach-400)]">Pending</p>
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
                    <div className="border-t border-[var(--lavender-100)] pt-3 mt-3 space-y-2">
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-500)] text-white px-3 py-2 rounded-lg font-semibold text-sm hover:from-[var(--lavender-500)] hover:to-[var(--lavender-600)] transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Invite by Email
                      </button>

                      <button
                        onClick={() => setShowSmsModal(true)}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-2 rounded-lg font-semibold text-sm hover:from-green-600 hover:to-green-700 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Invite by SMS
                      </button>

                      <button
                        onClick={() => setShowInviteFromContactsModal(true)}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--peach-300)] to-[var(--peach-400)] text-white px-3 py-2 rounded-lg font-semibold text-sm hover:from-[var(--peach-400)] hover:to-[var(--peach-500)] transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Invite from Contacts
                      </button>

                      {event?.invite_code && (
                        <button
                          onClick={handleCopyInviteLink}
                          className="w-full flex items-center justify-center gap-2 bg-[var(--cloud-100)] text-[var(--charcoal-800)] px-3 py-2 rounded-lg font-semibold text-sm hover:bg-[var(--lavender-100)] transition"
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

                {/* Event Reminders Panel (Owner only) */}
                {isOwner && event && (
                  <div className="mt-4">
                    <EventRemindersPanel
                      eventId={event.id}
                      eventDate={event.event_date}
                      isOwner={isOwner}
                    />
                  </div>
                )}
              </div>

              {/* Right Content */}
              <div className="flex-1">
                {/* In Person Tab Content - for casual meetups */}
                {isCasualMeetup && casualTab === "in-person" && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-[var(--mint-100)]">
                    <h3 className="text-2xl font-bold font-display text-[var(--charcoal-900)] mb-6 flex items-center gap-3">
                      <svg className="w-7 h-7 text-[var(--mint-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Meeting Location
                    </h3>

                    {event.location ? (
                      <>
                        {/* Photos */}
                        {event.location.photos && event.location.photos.length > 0 && (
                          <div className="grid grid-cols-3 gap-3 mb-6">
                            {event.location.photos.slice(0, 3).map((photo, index) => (
                              <img
                                key={index}
                                src={`/api/places/photo?photo_reference=${encodeURIComponent(photo.photo_reference)}&maxwidth=400`}
                                alt={`${event.location.name} photo ${index + 1}`}
                                className="w-full h-32 object-cover rounded-xl"
                              />
                            ))}
                          </div>
                        )}

                        {/* Place Info */}
                        <div className="bg-gradient-to-br from-[var(--mint-100)] to-[var(--cloud-50)] rounded-xl p-6">
                          <h4 className="text-2xl font-bold text-[var(--charcoal-900)] mb-3">{event.location.name}</h4>

                          {/* Rating */}
                          {event.location.rating && (
                            <div className="flex items-center gap-2 mb-4">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-5 h-5 ${i < Math.floor(event.location.rating) ? 'text-[var(--buttercream-200)]' : 'text-[var(--cloud-100)]'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <span className="text-sm font-medium text-[var(--charcoal-800)]">{event.location.rating.toFixed(1)}</span>
                            </div>
                          )}

                          {/* Address */}
                          <div className="flex items-start gap-3 mb-6">
                            <svg className="w-5 h-5 text-[var(--charcoal-800)] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-[var(--charcoal-800)]">{event.location.formatted_address}</p>
                          </div>

                          {/* Action Buttons */}
                          <div className={`${isOwner ? 'flex flex-col sm:flex-row gap-4' : ''}`}>
                            {/* Google Maps Link */}
                            {event.location.geometry && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${event.location.geometry.lat},${event.location.geometry.lng}&query_place_id=${event.location.place_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-block ${isOwner ? 'flex-1' : 'w-full'} px-4 py-3 bg-gradient-to-r from-[var(--mint-300)] to-[var(--mint-400)] text-white rounded-lg font-medium hover:from-[var(--mint-400)] hover:to-[var(--lavender-400)] transition text-center`}
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

                            {/* Edit Location Button - Owner only */}
                            {isOwner && (
                              <button
                                onClick={handleEditLocation}
                                className={`inline-block ${!event.location.geometry ? 'w-full' : 'flex-1'} px-4 py-3 border-2 border-[var(--mint-200)] text-[var(--charcoal-800)] rounded-lg font-medium hover:bg-[var(--mint-100)] transition text-center`}
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
                        </div>
                      </>
                    ) : (
                      /* No location set - show empty state */
                      <div className="text-center py-12">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[var(--mint-100)] to-[var(--cloud-50)] flex items-center justify-center">
                          <svg className="w-10 h-10 text-[var(--mint-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <h4 className="text-xl font-semibold text-[var(--charcoal-900)] mb-2">No location set</h4>
                        <p className="text-[var(--charcoal-800)] mb-6 max-w-md mx-auto">
                          {isOwner
                            ? "Add a meeting place so your friends know where to go."
                            : "The host hasn't added a location yet."}
                        </p>
                        {isOwner && (
                          <button
                            onClick={handleEditLocation}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--mint-300)] to-[var(--mint-400)] text-white rounded-xl font-semibold hover:from-[var(--mint-400)] hover:to-[var(--lavender-400)] transition shadow-lg"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Location
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Online Tab Content - for casual meetups */}
                {isCasualMeetup && casualTab === "online" && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-[var(--lavender-100)]">
                    <h3 className="text-2xl font-bold font-display text-[var(--charcoal-900)] mb-6 flex items-center gap-3">
                      <svg className="w-7 h-7 text-[var(--lavender-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Online Meeting
                    </h3>

                    {event.online_meeting_url && !editingMeetingUrl ? (
                      /* Meeting link exists - display it */
                      <div className="bg-gradient-to-br from-[var(--lavender-50)] to-[var(--cloud-50)] rounded-xl p-6">
                        {/* Meeting Type Badge */}
                        <div className="mb-4">
                          {(() => {
                            const info = getMeetingTypeInfo(event.online_meeting_type);
                            return (
                              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${info.bgColor} ${info.color}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                {info.label}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Meeting URL Display */}
                        <div className="flex items-center gap-3 mb-6 p-3 bg-white rounded-lg border border-[var(--lavender-100)]">
                          <svg className="w-5 h-5 text-[var(--lavender-500)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <p className="text-[var(--charcoal-800)] text-sm truncate flex-1 font-mono">{event.online_meeting_url}</p>
                        </div>

                        {/* Action Buttons */}
                        <div className={`${isOwner ? 'flex flex-col sm:flex-row gap-4' : ''}`}>
                          {/* Join Meeting Button */}
                          <a
                            href={event.online_meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-block ${isOwner ? 'flex-1' : 'w-full'} px-4 py-3 bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-500)] text-white rounded-lg font-medium hover:from-[var(--lavender-500)] hover:to-[var(--lavender-600)] transition text-center`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Join Meeting
                            </div>
                          </a>

                          {/* Edit Meeting Link Button - Owner only */}
                          {isOwner && (
                            <button
                              onClick={() => {
                                setMeetingUrlInput(event.online_meeting_url || "");
                                setEditingMeetingUrl(true);
                              }}
                              className="flex-1 px-4 py-3 border-2 border-[var(--lavender-200)] text-[var(--charcoal-800)] rounded-lg font-medium hover:bg-[var(--lavender-50)] transition text-center"
                            >
                              <div className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.232 5.232z" />
                                </svg>
                                Edit Link
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : editingMeetingUrl && isOwner ? (
                      /* Editing mode - show input form */
                      <div className="bg-gradient-to-br from-[var(--lavender-50)] to-[var(--cloud-50)] rounded-xl p-6">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-[var(--charcoal-900)] mb-2">
                            Meeting Link
                          </label>
                          <input
                            type="url"
                            value={meetingUrlInput}
                            onChange={(e) => setMeetingUrlInput(e.target.value)}
                            placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                            className="w-full px-4 py-3 border-2 border-[var(--lavender-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--lavender-400)] focus:border-transparent text-[var(--charcoal-900)]"
                          />
                          <p className="text-sm text-[var(--charcoal-800)] mt-2">
                            Paste a Zoom, Google Meet, or Microsoft Teams link
                          </p>
                          {meetingUrlError && (
                            <p className="text-sm text-red-600 mt-2">{meetingUrlError}</p>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setEditingMeetingUrl(false);
                              setMeetingUrlInput("");
                              setMeetingUrlError("");
                            }}
                            className="flex-1 px-4 py-3 border-2 border-[var(--lavender-200)] text-[var(--charcoal-800)] rounded-lg font-medium hover:bg-[var(--lavender-50)] transition"
                            disabled={savingMeetingUrl}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleUpdateMeetingUrl}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-500)] text-white rounded-lg font-medium hover:from-[var(--lavender-500)] hover:to-[var(--lavender-600)] transition disabled:opacity-50"
                            disabled={savingMeetingUrl}
                          >
                            {savingMeetingUrl ? "Saving..." : "Save Link"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* No meeting link set - show empty state */
                      <div className="text-center py-12">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[var(--lavender-100)] to-[var(--cloud-50)] flex items-center justify-center">
                          <svg className="w-10 h-10 text-[var(--lavender-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <h4 className="text-xl font-semibold text-[var(--charcoal-900)] mb-2">No meeting link set</h4>
                        <p className="text-[var(--charcoal-800)] mb-6 max-w-md mx-auto">
                          {isOwner
                            ? "Add a Zoom, Google Meet, or Teams link for virtual attendees."
                            : "The host hasn't added a video meeting link yet."}
                        </p>
                        {isOwner && (
                          <button
                            onClick={() => {
                              setMeetingUrlInput("");
                              setEditingMeetingUrl(true);
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-500)] text-white rounded-xl font-semibold hover:from-[var(--lavender-500)] hover:to-[var(--lavender-600)] transition shadow-lg"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Meeting Link
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Items Grid - only for gift registries (not casual meetups) */}
                {!isCasualMeetup && pageTab === "registry" && (
                  <>
                    {/* Add Item Button - shown for owners */}
                    {isOwner && !editingItemId && (
                  <div className="mb-6 bg-white rounded-lg shadow-md p-6 border-2 border-[var(--lavender-200)]">
                      <button
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-600)] text-white font-bold rounded-lg hover:from-[var(--lavender-500)] hover:to-[var(--lavender-700)] transition shadow-lg"
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
                      <div className="mb-6 bg-white rounded-lg shadow-md p-6 border-2 border-[var(--lavender-200)]">
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
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-blue-200 text-[var(--charcoal-900)]"
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
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-blue-200 text-[var(--charcoal-900)]"
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
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-blue-200 text-[var(--charcoal-900)]"
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
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-blue-200 text-[var(--charcoal-900)]"
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

                {/* Affiliate Disclosure - only show if any items have Amazon links */}
                {items.some(item =>
                  item.product_link?.includes('amazon.com') ||
                  item.product_link?.includes('amazon.co.') ||
                  item.product_link?.includes('amzn.to') ||
                  item.product_link?.includes('a.co/')
                ) && (
                  <p className="text-xs text-gray-500 mb-4 text-center">
                    As an Amazon Associate, Memora earns from qualifying purchases made through product links.
                  </p>
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
                                  href={addAffiliateTag(item.product_link)}
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
                                  {/* Payout Processing - shown when fulfillment is pending/processing */}
                                  {itemFunded && !isFulfilled && activeFulfillments[item.id] && (
                                    <div className="w-full bg-blue-50 border-2 border-blue-400 text-blue-800 px-4 py-3 rounded-lg font-semibold">
                                      <div className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Payout {activeFulfillments[item.id].status === 'pending' ? 'Pending' : 'Processing'}</span>
                                      </div>
                                      <p className="text-xs text-blue-600 text-center mt-1">
                                        Est. arrival: {activeFulfillments[item.id].estimated_arrival || '2-7 business days'}
                                      </p>
                                    </div>
                                  )}
                                  {/* Redeem button - shown only when fully funded, not redeemed, and no active fulfillment */}
                                  {itemFunded && !isFulfilled && !activeFulfillments[item.id] && (
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
                                  {/* Already redeemed message - with details */}
                                  {isFulfilled && (
                                    <div className="w-full bg-green-50 border-2 border-green-500 text-green-800 px-4 py-3 rounded-lg">
                                      <div className="flex items-center justify-center gap-2 font-semibold">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Deposited to Bank
                                      </div>
                                      {activeFulfillments[item.id] && (
                                        <div className="text-xs text-green-700 text-center mt-2 space-y-1">
                                          <p className="font-medium">
                                            ${(activeFulfillments[item.id].net_amount_cents / 100).toFixed(2)} received
                                          </p>
                                          {activeFulfillments[item.id].completed_at && (
                                            <p>
                                              Completed {new Date(activeFulfillments[item.id].completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                          )}
                                        </div>
                                      )}
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

                {/* Location Tab Content - for special events */}
                {!isCasualMeetup && pageTab === "location" && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 border border-[var(--lavender-100)]">
                    <h3 className="text-2xl font-bold font-display text-[var(--charcoal-900)] mb-6 flex items-center gap-3">
                      <svg className="w-7 h-7 text-[var(--mint-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Event Location
                    </h3>

                    {event.location ? (
                      <>
                        {/* Photos */}
                        {event.location.photos && event.location.photos.length > 0 && (
                          <div className="grid grid-cols-3 gap-3 mb-6">
                            {event.location.photos.slice(0, 3).map((photo, index) => (
                              <img
                                key={index}
                                src={`/api/places/photo?photo_reference=${encodeURIComponent(photo.photo_reference)}&maxwidth=400`}
                                alt={`${event.location.name} photo ${index + 1}`}
                                className="w-full h-32 object-cover rounded-xl"
                              />
                            ))}
                          </div>
                        )}

                        {/* Place Info */}
                        <div className="bg-gradient-to-br from-[var(--mint-100)] to-[var(--lavender-50)] rounded-xl p-6">
                          <h4 className="text-2xl font-bold text-[var(--charcoal-900)] mb-3">{event.location.name}</h4>

                          {/* Rating */}
                          {event.location.rating && (
                            <div className="flex items-center gap-2 mb-4">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-5 h-5 ${i < Math.floor(event.location.rating) ? 'text-[var(--buttercream-200)]' : 'text-[var(--cloud-100)]'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <span className="text-sm font-medium text-[var(--charcoal-800)]">{event.location.rating.toFixed(1)}</span>
                            </div>
                          )}

                          {/* Address */}
                          <div className="flex items-start gap-3 mb-6">
                            <svg className="w-5 h-5 text-[var(--charcoal-800)] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-[var(--charcoal-800)]">{event.location.formatted_address}</p>
                          </div>

                          {/* Action Buttons */}
                          <div className={`${isOwner ? 'flex flex-col sm:flex-row gap-4' : ''}`}>
                            {/* Google Maps Link */}
                            {event.location.geometry && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${event.location.geometry.lat},${event.location.geometry.lng}&query_place_id=${event.location.place_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-block ${isOwner ? 'flex-1' : 'w-full'} px-4 py-3 bg-gradient-to-r from-[var(--mint-300)] to-[var(--mint-400)] text-white rounded-lg font-medium hover:from-[var(--mint-400)] hover:to-[var(--lavender-400)] transition text-center`}
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

                            {/* Edit Location Button - Owner only */}
                            {isOwner && (
                              <button
                                onClick={handleEditLocation}
                                className={`inline-block ${!event.location.geometry ? 'w-full' : 'flex-1'} px-4 py-3 border-2 border-[var(--lavender-200)] text-[var(--charcoal-800)] rounded-lg font-medium hover:bg-[var(--lavender-50)] transition text-center`}
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
                        </div>
                      </>
                    ) : (
                      /* No location set - show empty state */
                      <div className="text-center py-12">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[var(--mint-100)] to-[var(--lavender-100)] flex items-center justify-center">
                          <svg className="w-10 h-10 text-[var(--mint-400)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <h4 className="text-xl font-semibold text-[var(--charcoal-900)] mb-2">No location set</h4>
                        <p className="text-[var(--charcoal-800)] mb-6 max-w-md mx-auto">
                          {isOwner
                            ? "Add a venue or meeting place to help guests know where to go."
                            : "The event host hasn't added a location yet."}
                        </p>
                        {isOwner && (
                          <button
                            onClick={handleEditLocation}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--mint-300)] to-[var(--mint-400)] text-white rounded-xl font-semibold hover:from-[var(--mint-400)] hover:to-[var(--lavender-400)] transition shadow-lg"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Location
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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

      {/* Email Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4">Invite by Email</h3>
            <form onSubmit={handleSendInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[var(--charcoal-900)]"
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

      {/* SMS Invite Modal */}
      {showSmsModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowSmsModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4">Invite by SMS</h3>
            <form onSubmit={handleSendSmsInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Phone Number (US only)
                </label>
                <input
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-[var(--charcoal-900)]"
                  placeholder="(555) 123-4567"
                  required
                  disabled={smsLoading}
                />
              </div>
              {smsError && (
                <div className="mb-4 text-red-600 text-sm bg-red-50 p-2 rounded">
                  {smsError}
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowSmsModal(false);
                    setInvitePhone("");
                    setSmsError("");
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300 transition"
                  disabled={smsLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                  disabled={smsLoading || !invitePhone.trim()}
                >
                  {smsLoading ? "Sending..." : "Send SMS"}
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