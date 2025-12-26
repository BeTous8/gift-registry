'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LocationSearchModal from './LocationSearchModal';
import supabase from '../lib/supabase';

/**
 * Step-by-step Event Creation Wizard
 * 4 slides: Title → Date/Time → Location → Description
 *
 * @param {string} eventType - "birthday" or "casual"
 * @param {function} onClose - Close the wizard
 * @param {function} onSuccess - Called with created event data
 */
export default function EventWizardModal({ eventType, onClose, onSuccess }) {
  // Wizard state
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  // Form state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState(null);
  const [description, setDescription] = useState('');

  // UI state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = 4;
  const isBirthday = eventType === 'birthday';

  // Generate URL slug from title
  function generateSlug(title) {
    if (!title) return '';
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const timestamp = Date.now();
    return `${baseSlug}-${timestamp}`;
  }

  // Generate random invite code
  function generateInviteCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Navigation
  const goNext = () => {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  // Can proceed to next step?
  const canProceed = () => {
    if (step === 0) return title.trim().length > 0;
    if (step === 1) return date.length > 0 && time.length > 0; // Date and time required
    return true; // Location and description are optional
  };

  // Submit the event
  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setError('You must be logged in to create an event');
        setLoading(false);
        return;
      }

      // Determine event settings based on type
      const registryEnabled = isBirthday; // Birthday = registry, casual = no registry
      const eventCategory = isBirthday ? 'birthday' : 'casual';

      // Generate slug and invite code only if registry enabled
      const slug = registryEnabled ? generateSlug(title) : null;
      const inviteCode = registryEnabled ? generateInviteCode() : null;

      // Capture user's timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const { data, error: insertError } = await supabase
        .from('events')
        .insert({
          user_id: session.user.id,
          title: title.trim(),
          slug: slug,
          description: description.trim() || null,
          event_date: date || null,
          event_time: time || null,
          event_category: eventCategory,
          invite_code: inviteCode,
          location: location || null,
          is_recurring: false,
          registry_enabled: registryEnabled,
          is_private: false,
          timezone: userTimezone
        })
        .select()
        .single();

      setLoading(false);

      if (insertError) {
        setError(insertError.message || 'Failed to create event. Please try again.');
        return;
      }

      // Success
      onSuccess(data);
      onClose();
    } catch (err) {
      console.error('Error creating event:', err);
      setError('Failed to create event. Please try again.');
      setLoading(false);
    }
  };

  // Slide animation variants
  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -200 : 200, opacity: 0 })
  };

  // Progress dots component
  const ProgressDots = () => (
    <div className="flex justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <motion.div
          key={i}
          className={`
            rounded-full transition-all duration-300
            ${i === step
              ? 'w-8 h-2 bg-gradient-to-r from-[var(--lavender-400)] to-[var(--peach-400)]'
              : i < step
              ? 'w-2 h-2 bg-[var(--lavender-400)]'
              : 'w-2 h-2 bg-[var(--cloud-100)]'
            }
          `}
          initial={false}
          animate={{ scale: i === step ? 1 : 0.9 }}
        />
      ))}
    </div>
  );

  // Render current slide content
  const renderSlide = () => {
    switch (step) {
      case 0: // Title
        return (
          <div className="space-y-4">
            <div className="text-center">
              <motion.span
                className="text-4xl mb-4 block"
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
              >
                {isBirthday ? '🎂' : '☕'}
              </motion.span>
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--charcoal-900)]">
                What should we call it?
              </h3>
              <p className="text-[var(--charcoal-800)] text-sm mt-1">
                Give your {isBirthday ? 'celebration' : 'get-together'} a name
              </p>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isBirthday ? "Sarah's 30th Birthday" : "Coffee with the team"}
              className="w-full px-4 py-3 text-lg text-center border-2 border-[var(--lavender-200)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--lavender-400)] focus:border-transparent text-[var(--charcoal-900)] placeholder:text-[var(--charcoal-800)]/50"
              autoFocus
            />
          </div>
        );

      case 1: // Date/Time
        return (
          <div className="space-y-4">
            <div className="text-center">
              <span className="text-4xl mb-4 block">📅</span>
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--charcoal-900)]">
                When is the big day?
              </h3>
              <p className="text-[var(--charcoal-800)] text-sm mt-1">
                Pick the date and time
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 text-lg text-center border-2 border-[var(--lavender-200)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--lavender-400)] text-[var(--charcoal-900)]"
                autoFocus
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 text-lg text-center border-2 border-[var(--lavender-200)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--lavender-400)] text-[var(--charcoal-900)]"
              />
            </div>
          </div>
        );

      case 2: // Location
        return (
          <div className="space-y-4">
            <div className="text-center">
              <span className="text-4xl mb-4 block">📍</span>
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--charcoal-900)]">
                Where is it happening?
              </h3>
              <p className="text-[var(--charcoal-800)] text-sm mt-1">
                Add a venue or skip for now
              </p>
            </div>
            {location ? (
              <div className="border-2 border-[var(--lavender-200)] rounded-xl p-4 bg-[var(--lavender-50)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--charcoal-900)] truncate">{location.name}</p>
                    <p className="text-sm text-[var(--charcoal-800)] truncate">{location.formatted_address}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    className="text-[var(--peach-500)] hover:text-[var(--peach-400)] text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="w-full px-4 py-4 border-2 border-dashed border-[var(--lavender-200)] rounded-xl hover:border-[var(--lavender-400)] hover:bg-[var(--lavender-50)] transition text-[var(--charcoal-800)] hover:text-[var(--lavender-600)] font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Search for a place
              </button>
            )}
          </div>
        );

      case 3: // Description
        return (
          <div className="space-y-4">
            <div className="text-center">
              <span className="text-4xl mb-4 block">✨</span>
              <h3 className="text-xl sm:text-2xl font-bold text-[var(--charcoal-900)]">
                Add any details?
              </h3>
              <p className="text-[var(--charcoal-800)] text-sm mt-1">
                Share more info with your guests
              </p>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dress code, parking info, gift preferences..."
              rows={4}
              className="w-full px-4 py-3 text-[var(--charcoal-900)] border-2 border-[var(--lavender-200)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--lavender-400)] focus:border-transparent resize-none placeholder:text-[var(--charcoal-800)]/50"
              autoFocus
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full border border-[var(--lavender-100)] overflow-hidden"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[var(--lavender-50)] text-[var(--charcoal-800)] transition"
            aria-label="Close wizard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Progress Dots */}
          <ProgressDots />

          {/* Slide Content */}
          <div className="min-h-[200px] relative">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
              >
                {renderSlide()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 text-[var(--charcoal-900)] text-sm text-center bg-[var(--peach-100)] border-2 border-[var(--peach-300)] p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {/* Back Button */}
            <motion.button
              onClick={goBack}
              className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 ${
                step === 0
                  ? 'invisible'
                  : 'text-[var(--charcoal-800)] hover:bg-[var(--lavender-50)] transition'
              }`}
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </motion.button>

            {/* Next / Create Button */}
            <motion.button
              onClick={step === totalSteps - 1 ? handleSubmit : goNext}
              disabled={!canProceed() || loading}
              className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 ${
                step === totalSteps - 1
                  ? 'bg-gradient-to-r from-[var(--lavender-400)] to-[var(--mint-400)] text-white shadow-lg'
                  : 'bg-gradient-to-r from-[var(--lavender-400)] to-[var(--lavender-600)] text-white'
              } hover:shadow-xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed`}
              whileHover={canProceed() && !loading ? { x: step === totalSteps - 1 ? 0 : 2, scale: 1.02 } : {}}
              whileTap={canProceed() && !loading ? { scale: 0.95 } : {}}
            >
              {loading ? (
                'Creating...'
              ) : step === totalSteps - 1 ? (
                <>
                  Create Event
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </>
              ) : (
                <>
                  Next
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Location Search Modal */}
      {showLocationModal && (
        <LocationSearchModal
          onClose={() => setShowLocationModal(false)}
          onLocationSelected={(locationData) => {
            setLocation(locationData);
            setShowLocationModal(false);
          }}
        />
      )}
    </>
  );
}
