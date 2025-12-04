"use client";

import { useState, useEffect } from "react";

export default function LocationSearchModal({ onClose, onLocationSelected }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);

  // Debounced search for autocomplete
  useEffect(() => {
    if (searchQuery.length < 3) {
      setPredictions([]);
      return;
    }

    const timer = setTimeout(() => {
      searchPlaces(searchQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search for places using autocomplete
  async function searchPlaces(query) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to search places');
        setPredictions([]);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setPredictions(data.predictions || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search places');
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }

  // Fetch place details when user selects a prediction
  async function handleSelectPlace(prediction) {
    setLoadingDetails(true);
    setError(null);

    try {
      const response = await fetch(`/api/places/details?place_id=${encodeURIComponent(prediction.place_id)}`);

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch place details');
        setLoadingDetails(false);
        return;
      }

      const data = await response.json();
      setSelectedPlace(data.place);
    } catch (err) {
      console.error('Place details error:', err);
      setError('Failed to fetch place details');
    } finally {
      setLoadingDetails(false);
    }
  }

  // Confirm location selection
  function handleConfirmLocation() {
    if (!selectedPlace) return;

    // Format location data for parent component
    const locationData = {
      place_id: selectedPlace.place_id,
      name: selectedPlace.name,
      formatted_address: selectedPlace.formatted_address,
      geometry: selectedPlace.geometry,
      photos: selectedPlace.photos,
      rating: selectedPlace.rating,
      types: selectedPlace.types,
    };

    onLocationSelected(locationData);
    onClose();
  }

  // Get photo URL from photo reference
  function getPhotoUrl(photoReference, maxWidth = 400) {
    return `/api/places/photo?photo_reference=${encodeURIComponent(photoReference)}&maxwidth=${maxWidth}`;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {selectedPlace ? 'Location Details' : 'Search Location'}
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

          {/* Search Input - Only show if no place selected */}
          {!selectedPlace && (
            <>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a place, address, or venue..."
                  className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>

              <p className="text-sm text-gray-900 mt-2">
                Enter at least 3 characters to search
              </p>
            </>
          )}

          {/* Back button when place is selected */}
          {selectedPlace && (
            <button
              onClick={() => setSelectedPlace(null)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Search again
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {loadingDetails ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : selectedPlace ? (
            /* Selected Place Details */
            <div className="space-y-4">
              {/* Photos */}
              {selectedPlace.photos && selectedPlace.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {selectedPlace.photos.slice(0, 3).map((photo, index) => (
                    <img
                      key={index}
                      src={getPhotoUrl(photo.photo_reference, 400)}
                      alt={`${selectedPlace.name} photo ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}

              {/* Place Info */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{selectedPlace.name}</h3>

                {/* Rating */}
                {selectedPlace.rating && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-5 h-5 ${i < Math.floor(selectedPlace.rating) ? 'text-yellow-400' : 'text-gray-900'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{selectedPlace.rating.toFixed(1)}</span>
                  </div>
                )}

                {/* Address */}
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-gray-800 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-900">{selectedPlace.formatted_address}</p>
                </div>

                {/* Location coordinates (optional) */}
                {selectedPlace.geometry && (
                  <div className="mt-3 text-xs text-gray-900">
                    Coordinates: {selectedPlace.geometry.lat?.toFixed(6)}, {selectedPlace.geometry.lng?.toFixed(6)}
                  </div>
                )}
              </div>

              {/* Google Maps Link */}
              {selectedPlace.geometry && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedPlace.geometry.lat},${selectedPlace.geometry.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition text-center"
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
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : searchQuery.length < 3 ? (
            <div className="text-center py-8 text-gray-900">
              <svg className="w-16 h-16 mx-auto mb-3 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p>Start typing to search for locations</p>
            </div>
          ) : predictions.length === 0 ? (
            <div className="text-center py-8 text-gray-900">
              <svg className="w-16 h-16 mx-auto mb-3 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No locations found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            /* Search Results */
            <div className="space-y-2">
              {predictions.map((prediction) => (
                <button
                  key={prediction.place_id}
                  onClick={() => handleSelectPlace(prediction)}
                  className="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-transparent transition"
                >
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {prediction.structured_formatting?.main_text || prediction.description}
                      </p>
                      <p className="text-sm text-gray-800 truncate">
                        {prediction.structured_formatting?.secondary_text || prediction.description}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-800 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          {selectedPlace ? (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLocation}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition"
              >
                Select Location
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
