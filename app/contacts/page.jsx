"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import supabase from "../lib/supabase";
import AddContactModal from "../components/AddContactModal";

export default function ContactsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);

  // Fetch user session and redirect if not logged in
  useEffect(() => {
    let ignore = false;

    async function getUserSession() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (ignore) return;

        if (!session?.user) {
          router.replace("/login");
          return;
        }

        setUser(session.user);
        fetchContacts(session.user.id);
      } catch (error) {
        console.error('Error getting session:', error);
        if (!ignore) {
          router.replace("/login");
        }
      }
    }

    getUserSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (ignore) return;

      if (event === "SIGNED_OUT") {
        router.replace("/login");
      } else if (session?.user) {
        setUser(session.user);
        fetchContacts(session.user.id);
      }
    });

    return () => {
      ignore = true;
      listener.subscription?.unsubscribe?.();
    };
  }, [router]);

  // Fetch contacts from API
  async function fetchContacts(userId = null) {
    const userIdToUse = userId || user?.id;

    if (!userIdToUse) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/contacts?userId=${userIdToUse}`);

      if (!response.ok) {
        console.error('Failed to fetch contacts');
        setContacts([]);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setContacts(data.contacts || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  // Handle delete contact
  const handleDeleteClick = (contact) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setContactToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!contactToDelete || !user?.id) return;

    setDeletingContactId(contactToDelete.id);

    try {
      const response = await fetch(`/api/contacts/${contactToDelete.id}?userId=${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to delete contact');
        setDeletingContactId(null);
        return;
      }

      // Remove contact from local state
      setContacts(contacts.filter((c) => c.id !== contactToDelete.id));
      setDeleteDialogOpen(false);
      setContactToDelete(null);
      setDeletingContactId(null);
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact. Please try again.');
      setDeletingContactId(null);
    }
  };

  // Handle contact added
  const handleContactAdded = (newContact) => {
    setContacts([newContact, ...contacts]);
    setShowAddContactModal(false);
  };

  // Filter contacts by search query
  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase();
    return (
      contact.full_name.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query)
    );
  });

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 rounded-md hover:bg-purple-50 text-gray-800 hover:text-purple-700 transition"
                aria-label="Back to dashboard"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                  My Contacts
                </h1>
                <p className="text-sm text-gray-800">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddContactModal(true)}
              className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Contact
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        {contacts.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contacts by name or email..."
                className="w-full px-4 py-3 pl-11 bg-white/80 backdrop-blur-sm border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              <p className="text-lg font-medium text-gray-700">Loading contacts...</p>
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          /* Empty State */
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-12 text-center border border-purple-100">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              {searchQuery ? "No contacts found" : "No contacts yet"}
            </h2>
            <p className="text-gray-800 mb-6 max-w-md mx-auto">
              {searchQuery
                ? "Try adjusting your search query."
                : "Add contacts to quickly invite them to your events."}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddContactModal(true)}
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Your First Contact
              </button>
            )}
          </div>
        ) : (
          /* Contacts Grid */
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredContacts.map((contact, index) => {
              const gradients = [
                'from-pink-50 to-rose-50 border-pink-200',
                'from-purple-50 to-indigo-50 border-purple-200',
                'from-blue-50 to-cyan-50 border-blue-200',
                'from-yellow-50 to-amber-50 border-yellow-200',
                'from-emerald-50 to-teal-50 border-emerald-200',
                'from-orange-50 to-red-50 border-orange-200',
              ];
              const gradientClass = gradients[index % gradients.length];

              return (
                <div
                  key={contact.id}
                  className={`bg-gradient-to-br ${gradientClass} rounded-xl p-6 border-2 shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 relative group`}
                >
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteClick(contact)}
                    className="absolute top-3 right-3 bg-white/90 hover:bg-red-500 text-gray-700 hover:text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg transition-all shadow-md z-10 opacity-0 group-hover:opacity-100"
                    title="Remove contact"
                    disabled={deletingContactId === contact.id}
                  >
                    ×
                  </button>

                  {/* Avatar */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-md">
                      <span className="text-white font-semibold text-lg">
                        {contact.first_name?.charAt(0).toUpperCase() || contact.email?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-800 truncate">
                        {contact.full_name || contact.email}
                      </h3>
                      <p className="text-sm text-gray-800 truncate">{contact.email}</p>
                    </div>
                  </div>

                  {/* Date Added */}
                  <div className="pt-3 border-t border-white/50">
                    <p className="text-xs text-gray-800">
                      Added {new Date(contact.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Contact Modal */}
      {showAddContactModal && user && (
        <AddContactModal
          onClose={() => setShowAddContactModal(false)}
          onContactAdded={handleContactAdded}
          userId={user.id}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && contactToDelete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCloseDeleteDialog}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-2">Remove Contact</h3>
            <p className="text-gray-800 mb-4">
              Are you sure you want to remove <span className="font-semibold">{contactToDelete.full_name || contactToDelete.email}</span> from your contacts?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseDeleteDialog}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-semibold hover:bg-gray-300 transition"
                disabled={deletingContactId === contactToDelete.id}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition disabled:opacity-50"
                disabled={deletingContactId === contactToDelete.id}
              >
                {deletingContactId === contactToDelete.id ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}