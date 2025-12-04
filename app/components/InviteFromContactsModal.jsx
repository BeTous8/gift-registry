"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "../lib/supabase";

export default function InviteFromContactsModal({ isOpen, onClose, eventId, eventTitle, onInviteSuccess }) {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [invitedEmails, setInvitedEmails] = useState(new Set());

  // Fetch user and contacts on mount
  useEffect(() => {
    async function initialize() {
      try {
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setError("You must be logged in to invite contacts");
          setLoading(false);
          return;
        }

        setUser(session.user);

        // Fetch user's contacts
        const contactsResponse = await fetch(`/api/contacts?userId=${session.user.id}`);

        if (!contactsResponse.ok) {
          setError("Failed to load contacts");
          setLoading(false);
          return;
        }

        const contactsData = await contactsResponse.json();
        setContacts(contactsData.contacts || []);

        // Fetch existing invitations for this event
        const invitationsResponse = await fetch(`/api/events/${eventId}/invite?userId=${session.user.id}`);

        if (invitationsResponse.ok) {
          const invitationsData = await invitationsResponse.json();
          const invitations = invitationsData.invitations || [];

          // Create a set of invited emails (only pending invitations)
          const invitedEmailsSet = new Set(
            invitations
              .filter(inv => inv.status === 'pending')
              .map(inv => inv.email?.toLowerCase())
          );

          setInvitedEmails(invitedEmailsSet);
        }
      } catch (err) {
        console.error("Error loading contacts:", err);
        setError("Failed to load contacts");
      } finally {
        setLoading(false);
      }
    }

    if (isOpen) {
      initialize();
    }
  }, [isOpen]);

  // Toggle contact selection
  const toggleContact = (contactId, contactEmail) => {
    // Prevent selecting already-invited contacts
    if (invitedEmails.has(contactEmail?.toLowerCase())) {
      return;
    }

    const newSelected = new Set(selectedContactIds);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContactIds(newSelected);
  };

  // Select/Deselect all
  const toggleSelectAll = () => {
    // Filter out already-invited contacts
    const selectableContacts = contacts.filter(c => !invitedEmails.has(c.email?.toLowerCase()));

    if (selectedContactIds.size === selectableContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(selectableContacts.map(c => c.id)));
    }
  };

  // Handle bulk invite
  async function handleInvite() {
    if (selectedContactIds.size === 0) {
      setError("Please select at least one contact to invite");
      return;
    }

    setInviting(true);
    setError(null);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Authentication required");
        setInviting(false);
        return;
      }

      const response = await fetch(`/api/events/${eventId}/invite-from-contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          contact_ids: Array.from(selectedContactIds)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to send invitations");
        setInviting(false);
        return;
      }

      const data = await response.json();

      // Count successful invitations
      const invitedCount = data.results?.invited?.length || 0;
      const alreadyInvitedCount = data.results?.already_invited?.length || 0;
      const alreadyMemberCount = data.results?.already_member?.length || 0;

      // Build success message
      let message = "";
      if (invitedCount > 0) {
        message = `Invited ${invitedCount} contact${invitedCount > 1 ? 's' : ''} successfully`;
      }
      if (alreadyInvitedCount > 0) {
        message += message ? ` (${alreadyInvitedCount} already invited)` : `${alreadyInvitedCount} already invited`;
      }
      if (alreadyMemberCount > 0) {
        message += message ? ` (${alreadyMemberCount} already member${alreadyMemberCount > 1 ? 's' : ''})` : `${alreadyMemberCount} already member${alreadyMemberCount > 1 ? 's' : ''}`;
      }

      // Call success callback with message and counts
      if (onInviteSuccess) {
        onInviteSuccess(message, { invitedCount, alreadyInvitedCount, alreadyMemberCount });
      }

      // Clear selection, reset inviting state, and close modal
      setSelectedContactIds(new Set());
      setInviting(false);
      onClose();
    } catch (err) {
      console.error("Error sending invitations:", err);
      setError("Failed to send invitations");
      setInviting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Invite from Contacts
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-gray-100 text-gray-800 transition"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-800 mb-4">
            Select contacts to invite to <span className="font-semibold">{eventTitle}</span>
          </p>

          {/* Select All / Counter */}
          {contacts.length > 0 && (
            <div className="flex items-center justify-between">
              <button
                onClick={toggleSelectAll}
                className="text-sm font-medium text-purple-600 hover:text-purple-700 transition"
              >
                {(() => {
                  const selectableCount = contacts.filter(c => !invitedEmails.has(c.email?.toLowerCase())).length;
                  return selectedContactIds.size === selectableCount ? "Deselect All" : "Select All";
                })()}
              </button>
              <span className="text-sm text-gray-800">
                {selectedContactIds.size} of {contacts.filter(c => !invitedEmails.has(c.email?.toLowerCase())).length} selected
              </span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-gray-900">
              <svg className="w-16 h-16 mx-auto mb-3 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="font-medium mb-2">No contacts yet</p>
              <p className="text-sm mb-4">Add contacts first to invite them to events</p>
              <button
                onClick={() => router.push('/contacts')}
                className="text-purple-600 hover:text-purple-700 font-medium text-sm"
              >
                Go to Contacts →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => {
                const isSelected = selectedContactIds.has(contact.id);
                const isAlreadyInvited = invitedEmails.has(contact.email?.toLowerCase());

                return (
                  <div
                    key={contact.id}
                    onClick={() => toggleContact(contact.id, contact.email)}
                    className={`flex items-center gap-3 p-3 rounded-lg transition ${
                      isAlreadyInvited
                        ? "bg-gray-100 border-2 border-gray-200 opacity-60 cursor-not-allowed"
                        : isSelected
                        ? "bg-purple-50 border-2 border-purple-500 cursor-pointer"
                        : "bg-gray-50 border-2 border-transparent hover:bg-gray-100 cursor-pointer"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                          isAlreadyInvited
                            ? "bg-gray-300 border-gray-400"
                            : isSelected
                            ? "bg-purple-600 border-purple-600"
                            : "bg-white border-gray-300"
                        }`}
                      >
                        {isSelected && !isAlreadyInvited && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>

                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 ${
                      isAlreadyInvited
                        ? "bg-gray-400"
                        : "bg-gradient-to-br from-pink-400 to-purple-500"
                    }`}>
                      <span className="text-white font-semibold text-sm">
                        {contact.full_name?.charAt(0).toUpperCase() || contact.email?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        isAlreadyInvited ? "text-gray-900" : "text-gray-800"
                      }`}>
                        {contact.full_name || contact.email}
                      </p>
                      <p className={`text-sm truncate ${
                        isAlreadyInvited ? "text-gray-800" : "text-gray-800"
                      }`}>
                        {contact.email}
                      </p>
                    </div>

                    {/* Already Invited Badge */}
                    {isAlreadyInvited && (
                      <span className="text-xs text-gray-900 bg-gray-200 px-3 py-1 rounded-full whitespace-nowrap">
                        Already invited
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={inviting || selectedContactIds.size === 0}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inviting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Inviting...
              </span>
            ) : (
              `Invite Selected (${selectedContactIds.size})`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
