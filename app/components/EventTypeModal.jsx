'use client';

import { motion, AnimatePresence } from 'framer-motion';

const eventTypes = [
  {
    id: 'birthday',
    name: 'Celebrate a Birthday',
    image: '/birthday.png',
    disabled: false,
    category: 'birthday'
  },
  {
    id: 'wedding',
    name: 'Wedding Celebration',
    image: '/wedding.png',
    disabled: true,
    category: 'wedding'
  },
  {
    id: 'baby-shower',
    name: 'Welcome a Little One',
    image: '/baby-shower.png',
    disabled: true,
    category: 'baby-shower'
  },
  {
    id: 'get-together',
    name: 'Get Together',
    image: '/get-together.png',
    disabled: false,
    category: 'casual'
  }
];

export default function EventTypeModal({ onClose, onSelectType }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-lg w-full border border-[var(--lavender-100)]"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--charcoal-900)]">
              What are we celebrating?
            </h2>
            <p className="text-[var(--charcoal-800)] mt-2">
              Choose your event type to get started
            </p>
          </div>

          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {eventTypes.map((type, index) => (
              <motion.button
                key={type.id}
                disabled={type.disabled}
                onClick={() => !type.disabled && onSelectType(type.category)}
                className={`
                  relative p-4 rounded-2xl min-h-[160px]
                  flex flex-col items-center justify-center text-center
                  transition-all duration-200
                  ${type.disabled
                    ? 'bg-[var(--cloud-100)] cursor-not-allowed opacity-70'
                    : 'bg-gradient-to-br from-[var(--lavender-50)] to-[var(--peach-100)] hover:shadow-lg active:scale-[0.98]'
                  }
                  border-2 ${type.disabled ? 'border-[var(--cloud-100)]' : 'border-transparent hover:border-[var(--lavender-200)]'}
                `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                whileHover={!type.disabled ? { y: -4 } : {}}
              >
                {/* Coming Soon Badge */}
                {type.disabled && (
                  <span className="absolute -top-2 -right-2 bg-[var(--peach-400)] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shadow-md">
                    Coming Soon
                  </span>
                )}

                {/* Illustration */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 mb-3">
                  <img
                    src={type.image}
                    alt={type.name}
                    className={`w-full h-full object-contain ${type.disabled ? 'grayscale' : ''}`}
                  />
                </div>

                {/* Label */}
                <h3 className={`font-semibold text-sm sm:text-base ${type.disabled ? 'text-[var(--charcoal-800)]' : 'text-[var(--charcoal-900)]'}`}>
                  {type.name}
                </h3>
              </motion.button>
            ))}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-6 w-full py-2 text-[var(--charcoal-800)] hover:text-[var(--charcoal-900)] transition-colors text-sm"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
