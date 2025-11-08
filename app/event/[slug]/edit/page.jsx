"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import supabase from "../../../lib/supabase";

export default function EditEventPage() {
  const { slug } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [event, setEvent] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);

  // Item form fields
  const [itemTitle, setItemTitle] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemProductLink, setItemProductLink] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState("");

  // Fetch event & items, auth
  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      setLoading(true);
      setError("");

      // Check session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (ignore) return;

      if (!session?.user) {
        router.replace("/login");
        return;
      }
      setUser(session.user);

      // Fetch event by slug
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, title, slug, description, user_id")
        .eq("slug", slug)
        .single();

      if (eventError || !eventData) {
        setError(
          eventError?.message ||
            "Event not found or you do not have access."
        );
        setLoading(false);
        return;
      }

      // Check ownership
      if (eventData.user_id !== session.user.id) {
        setError("You do not have permission to edit this event.");
        setLoading(false);
        return;
      }

      setEvent(eventData);

      // Fetch items for this event
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select(
          "id, title, price_cents, product_link, image_url, current_amount_cents"
        )
        .eq("event_id", eventData.id)
        .order("id", { ascending: true });

      if (itemError) {
        setError(itemError.message);
        setItems([]);
      } else {
        setItems(itemData || []);
      }
      setLoading(false);
    }

    fetchData();

    // Listen for sign-out in other tabs
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          router.replace("/login");
        }
      }
    );

    return () => {
      ignore = true;
      listener.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleShowAddItem = () => {
    setShowAddItem((val) => !val);
    setItemError("");
    // Reset form when toggling
    setItemTitle("");
    setItemPrice("");
    setItemProductLink("");
    setItemImageUrl("");
  };

  // Add item
  const handleAddItem = async (e) => {
    e.preventDefault();
    setItemError("");
    setItemLoading(true);

    // Validation
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

    // Insert into db
    const { data, error: insertError } = await supabase
      .from("items")
      .insert({
        event_id: event.id,
        title: itemTitle.trim(),
        price_cents: Math.round(Number(itemPrice) * 100), // USD to cents
        product_link: itemProductLink.trim() || null,
        image_url: itemImageUrl.trim() || null,
        current_amount_cents: 0,
      })
      .select()
      .single();

    setItemLoading(false);

    if (insertError) {
      setItemError(insertError.message || "Failed to add item.");
      return;
    }

    // Refresh items list
    setItems((prev) => (data ? [...prev, data] : prev));
    handleShowAddItem();
  };

  // Delete item
  const handleDeleteItem = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this item? This cannot be undone.");
    if (!confirmed) return;
    setLoading(true);
    const { error: deleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError("Failed to delete item.");
      setLoading(false);
      return;
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
    setLoading(false);
  };

  // Render
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-3xl mx-auto bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Edit Event</h1>
          <div className="flex gap-2">
            <Link
              href={`/event/${slug}`}
              className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-sm font-semibold transition"
            >
              View Public Page
            </Link>
            <Link
              href="/dashboard"
              className="bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 text-sm font-semibold transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
        {/* Loading state */}
        {loading ? (
          <div className="w-full flex justify-center items-center py-16">
            <div className="text-lg text-gray-600 animate-pulse">
              Loading...
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-100 text-red-700 font-medium rounded p-4 my-4 text-center">
            {error}
          </div>
        ) : (
          <>
            {/* Event summary */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-1">{event?.title}</h2>
              <p className="text-gray-600">{event?.description || <span className="italic text-gray-400">No description.</span>}</p>
            </div>

            {/* Add item form toggle */}
            <div className="mb-6">
              {!showAddItem ? (
                <button
                  className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition"
                  onClick={handleShowAddItem}
                >
                  + Add Item
                </button>
              ) : (
                <div className="bg-gray-50 rounded-md p-4 border border-gray-200 mt-2">
                  <form onSubmit={handleAddItem} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="item-title">
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
                      <label className="block text-sm font-medium mb-1" htmlFor="item-price">
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
                      <label className="block text-sm font-medium mb-1" htmlFor="item-link">
                        Product Link
                      </label>
                      <input
                        id="item-link"
                        type="url"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring focus:ring-blue-200"
                        value={itemProductLink}
                        onChange={(e) => setItemProductLink(e.target.value)}
                        disabled={itemLoading}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="item-img">
                        Image URL
                      </label>
                      <input
                        id="item-img"
                        type="url"
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
                        {itemLoading ? "Adding..." : "Add Item"}
                      </button>
                      <button
                        type="button"
                        className="bg-gray-300 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-400 transition"
                        onClick={handleShowAddItem}
                        disabled={itemLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Items list */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Items</h3>
              {items.length === 0 ? (
                <div className="text-gray-500 italic mb-8">
                  No items yet. Use "+ Add Item" to add one.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-5">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-lg shadow border bg-white flex flex-col md:flex-row gap-3 p-4">
                      {item.image_url && (
                        <div className="flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-20 h-20 object-cover rounded-md border bg-gray-100"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-2">
                            <h4 className="font-bold text-gray-800">{item.title}</h4>
                            <span className="ml-2 text-blue-700 font-semibold">
                              ${ (item.price_cents/100).toFixed(2) }
                            </span>
                          </div>
                          {item.product_link && (
                            <a
                              href={item.product_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm"
                            >
                              Product Link
                            </a>
                          )}
                          {/* Progress */}
                          <div className="mt-2">
                            <div className="text-xs text-gray-500 mb-1">
                              Progress: ${(item.current_amount_cents/100).toFixed(2)} / ${(item.price_cents/100).toFixed(2)}
                            </div>
                            <div className="w-full h-3 bg-gray-200 rounded">
                              <div
                                className={`h-3 rounded transition-all`}
                                style={{
                                  width: `${
                                    Math.min(
                                      (item.current_amount_cents / item.price_cents) * 100,
                                      100
                                    )
                                  }%`,
                                  backgroundColor:
                                    item.current_amount_cents >= item.price_cents
                                      ? "#22C55E"
                                      : "#3B82F6",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Delete button */}
                      <div className="flex flex-col items-end justify-between ml-2">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded font-semibold text-sm mt-1"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

