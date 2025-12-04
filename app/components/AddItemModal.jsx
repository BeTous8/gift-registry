"use client";

import { useState } from 'react';

export default function AddItemModal({ isOpen, onClose, eventId, userId, onItemAdded }) {
  const [activeTab, setActiveTab] = useState('automatic'); // 'automatic' or 'manual'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Automatic tab states
  const [amazonLink, setAmazonLink] = useState('');

  // Manual tab states
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [productLink, setProductLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    // Reset all states
    setActiveTab('automatic');
    setAmazonLink('');
    setTitle('');
    setPrice('');
    setProductLink('');
    setImageUrl('');
    setError('');
    setLoading(false);
    onClose();
  };

  // Handle automatic Amazon scraping
  const handleAutomaticAdd = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate Amazon URL (supports amazon.com, amzn.to, a.co)
    const isAmazonUrl = amazonLink && (
      amazonLink.includes('amazon.com') ||
      amazonLink.includes('amzn.to') ||
      amazonLink.includes('amzn.') ||
      amazonLink.includes('a.co/')
    );

    if (!isAmazonUrl) {
      setError('Please enter a valid Amazon product link');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/items/add-from-amazon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productLink: amazonLink.trim(),
          eventId: eventId,
          userId: userId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to scrape Amazon product. Please try using Manual tab.');
        setLoading(false);
        return;
      }

      // Success! Notify parent and close modal
      onItemAdded(result.item);
      handleClose();
    } catch (error) {
      console.error('Error calling Amazon scraper:', error);
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  // Handle manual entry
  const handleManualAdd = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!title.trim()) {
      setError('Title is required');
      setLoading(false);
      return;
    }

    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0.01) {
      setError('Valid price is required');
      setLoading(false);
      return;
    }

    if (productLink && productLink.length > 0) {
      try {
        new URL(productLink);
      } catch {
        setError('Product link must be a valid URL');
        setLoading(false);
        return;
      }
    }

    if (imageUrl && imageUrl.length > 0) {
      try {
        new URL(imageUrl);
      } catch {
        setError('Image URL must be a valid URL');
        setLoading(false);
        return;
      }
    }

    try {
      // Call the manual insert (we'll create this endpoint or use direct Supabase)
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventId,
          title: title.trim(),
          priceCents: Math.round(Number(price) * 100),
          productLink: productLink.trim() || null,
          imageUrl: imageUrl.trim() || null,
          userId: userId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to add item');
        setLoading(false);
        return;
      }

      // Success! Notify parent and close modal
      onItemAdded(result.item);
      handleClose();
    } catch (error) {
      console.error('Error adding item manually:', error);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="text-2xl font-bold">Find the Item on Amazon</h3>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-200 text-3xl leading-none transition"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('automatic')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                activeTab === 'automatic'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              disabled={loading}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Automatic (Amazon)
              </div>
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                activeTab === 'manual'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              disabled={loading}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Manual Entry
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Automatic Tab */}
          {activeTab === 'automatic' && (
            <form onSubmit={handleAutomaticAdd} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">How to use:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to Amazon and find your desired product</li>
                      <li>Copy the product URL from your browser</li>
                      <li>Paste the link below</li>
                      <li>Click "Add Item" - we'll automatically extract the title, price, and image!</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amazon Product Link <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900 transition"
                  placeholder="https://www.amazon.com/product/..."
                  value={amazonLink}
                  onChange={(e) => setAmazonLink(e.target.value)}
                  disabled={loading}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: https://www.amazon.com/Apple-AirPods-Pro/dp/B0CHWRXH8B
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading || !amazonLink.trim()}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Adding Item...</span>
                    </div>
                  ) : (
                    'Add Item'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Manual Tab */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualAdd} className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Manual Entry:</span> Use this option for non-Amazon items or if automatic scraping fails.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
                  placeholder="e.g., Apple AirPods Pro (2nd Generation)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (USD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
                  placeholder="e.g., 249.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Link (optional)
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
                  placeholder="https://example.com/product"
                  value={productLink}
                  onChange={(e) => setProductLink(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image URL (optional)
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Adding Item...</span>
                    </div>
                  ) : (
                    'Add Item'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
