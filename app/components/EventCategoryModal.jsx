"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * EventCategoryModal - Modal for selecting event type before creation
 * Used on calendar page to let users choose between Special Events and Casual Meet-ups
 *
 * @param {string} selectedDate - The pre-selected date (YYYY-MM-DD format)
 * @param {function} onClose - Callback when modal is closed
 * @param {function} onSelectSpecial - Callback when user selects "Special Events"
 * @param {function} onSelectCasual - Callback when user selects "Casual Meet-up"
 */
export default function EventCategoryModal({ selectedDate, onClose, onSelectSpecial, onSelectCasual }) {
  // Format the date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-3xl max-w-2xl w-full p-8 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--lavender-50)] transition"
          >
            <svg className="w-5 h-5 text-[var(--charcoal-800)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <motion.h2
              className="text-2xl sm:text-3xl font-bold font-display text-[var(--charcoal-900)] mb-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              What would you like to plan?
            </motion.h2>
            {selectedDate && (
              <motion.p
                className="text-[var(--charcoal-800)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {formatDate(selectedDate)}
              </motion.p>
            )}
          </div>

          {/* Category Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Special Events Card */}
            <motion.button
              onClick={onSelectSpecial}
              className="group relative p-6 rounded-2xl bg-[var(--lavender-100)]/40 border border-[var(--lavender-200)]/50 overflow-hidden text-left"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
              whileHover={{
                scale: 1.02,
                boxShadow: "0 15px 30px -10px rgba(184, 169, 232, 0.3)",
              }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Animated gradient background on hover */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-[var(--lavender-200)]/0 via-[var(--lavender-100)]/0 to-[var(--peach-100)]/0 rounded-2xl"
                whileHover={{
                  background: "linear-gradient(135deg, rgba(184, 169, 232, 0.3) 0%, rgba(237, 233, 254, 0.5) 50%, rgba(255, 205, 178, 0.3) 100%)"
                }}
                transition={{ duration: 0.3 }}
              />

              <div className="relative z-10">
                <motion.div
                  className="mb-4 flex justify-center"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <img
                    src="/special-ceremony.png"
                    alt="Special Events"
                    className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                  />
                </motion.div>
                <h3 className="text-xl font-bold font-display text-[var(--charcoal-900)] mb-2 group-hover:text-[var(--lavender-600)] transition-colors duration-300">
                  Special Events
                </h3>
                <p className="text-sm text-[var(--charcoal-800)]">
                  Birthdays, Weddings, Anniversaries with gift registry
                </p>
              </div>

              {/* Sparkle effect */}
              <motion.div
                className="absolute top-3 right-3 w-1.5 h-1.5 bg-[var(--lavender-400)] rounded-full opacity-0 group-hover:opacity-100"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.button>

            {/* Casual Meet-up Card */}
            <motion.button
              onClick={onSelectCasual}
              className="group relative p-6 rounded-2xl bg-[var(--mint-100)]/40 border border-[var(--mint-200)]/50 overflow-hidden text-left"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
              whileHover={{
                scale: 1.02,
                boxShadow: "0 15px 30px -10px rgba(181, 234, 215, 0.3)",
              }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Animated gradient background on hover */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-[var(--mint-200)]/0 via-[var(--mint-100)]/0 to-[var(--buttercream-100)]/0 rounded-2xl"
                whileHover={{
                  background: "linear-gradient(135deg, rgba(181, 234, 215, 0.3) 0%, rgba(208, 245, 229, 0.5) 50%, rgba(255, 243, 205, 0.3) 100%)"
                }}
                transition={{ duration: 0.3 }}
              />

              <div className="relative z-10">
                <motion.div
                  className="mb-4 flex justify-center"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                >
                  <img
                    src="/casual-meetup.png"
                    alt="Casual Meet-up"
                    className="w-28 h-28 sm:w-32 sm:h-32 object-contain"
                  />
                </motion.div>
                <h3 className="text-xl font-bold font-display text-[var(--charcoal-900)] mb-2 group-hover:text-[var(--mint-400)] transition-colors duration-300">
                  Casual Meet-up
                </h3>
                <p className="text-sm text-[var(--charcoal-800)]">
                  Coffee, Dinner, Book Club - quick to set up
                </p>
              </div>

              {/* Sparkle effect */}
              <motion.div
                className="absolute top-3 left-3 w-1.5 h-1.5 bg-[var(--mint-400)] rounded-full opacity-0 group-hover:opacity-100"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
