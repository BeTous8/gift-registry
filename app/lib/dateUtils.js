/**
 * Date utility functions to handle date-only strings without timezone issues
 */

/**
 * Parse a date string (YYYY-MM-DD) as a local date, not UTC
 * This prevents the "off by one day" bug when displaying dates
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Date} - Date object in local timezone
 */
export function parseLocalDate(dateString) {
  if (!dateString) return null;

  // Split the date string
  const [year, month, day] = dateString.split('-').map(Number);

  // Create a Date object using local timezone (month is 0-indexed)
  return new Date(year, month - 1, day);
}

/**
 * Format a date string for display
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export function formatDateString(dateString, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const date = parseLocalDate(dateString);
  if (!date) return '';

  return date.toLocaleDateString('en-US', options);
}

/**
 * Get the difference in days between a date string and today
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {number} - Number of days (negative if in the past)
 */
export function getDaysUntil(dateString) {
  const eventDate = parseLocalDate(dateString);
  if (!eventDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);

  const diffTime = eventDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date string is today
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean}
 */
export function isToday(dateString) {
  return getDaysUntil(dateString) === 0;
}

/**
 * Check if a date string is in the past
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean}
 */
export function isPast(dateString) {
  return getDaysUntil(dateString) < 0;
}

/**
 * Check if a date string is within the next N days
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {number} days - Number of days to check
 * @returns {boolean}
 */
export function isWithinDays(dateString, days) {
  const daysUntil = getDaysUntil(dateString);
  return daysUntil >= 0 && daysUntil <= days;
}
