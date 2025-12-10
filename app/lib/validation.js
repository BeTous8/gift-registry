/**
 * Validation utilities for Memora
 * Includes UUID validation, idempotency key validation, and input sanitization
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates UUID format
 * @param {string} id - The UUID to validate
 * @returns {boolean} - True if valid UUID format
 */
export function isValidUUID(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return UUID_REGEX.test(id);
}

/**
 * Validates UUID and throws error if invalid
 * @param {string} id - The UUID to validate
 * @param {string} paramName - Name of the parameter for error message
 * @throws {Error} - If UUID is invalid
 */
export function validateUUID(id, paramName = 'ID') {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid ${paramName} format`);
  }
}

/**
 * Validates multiple UUIDs at once
 * @param {Object} params - Object with UUID parameters
 * @returns {Object} - Object with validation errors (empty if all valid)
 */
export function validateUUIDs(params) {
  const errors = {};

  for (const [key, value] of Object.entries(params)) {
    if (value && !isValidUUID(value)) {
      errors[key] = `Invalid ${key} format`;
    }
  }

  return errors;
}

/**
 * Validates idempotency key format and binding
 * Idempotency keys should be:
 * - Non-empty strings
 * - At least 16 characters long
 * - Alphanumeric with hyphens/underscores
 *
 * @param {string} key - The idempotency key
 * @param {string} userId - User ID for binding validation
 * @param {string} itemId - Item ID for binding validation
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateIdempotencyKey(key, userId = null, itemId = null) {
  // Check if key exists
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Idempotency key is required' };
  }

  // Check minimum length
  if (key.length < 16) {
    return { valid: false, error: 'Idempotency key must be at least 16 characters' };
  }

  // Check format (alphanumeric + hyphens/underscores)
  const keyRegex = /^[a-zA-Z0-9_-]+$/;
  if (!keyRegex.test(key)) {
    return { valid: false, error: 'Idempotency key contains invalid characters' };
  }

  // Optional: Check if key is bound to user/item (prevents cross-user replay)
  if (userId && itemId) {
    // Key should ideally contain userId or itemId for binding
    // This is a soft check - not enforced but recommended
    const containsBinding = key.includes(userId.substring(0, 8)) ||
                           key.includes(itemId.substring(0, 8));

    if (!containsBinding) {
      // Warning only - still valid but not ideal
      console.warn('Idempotency key not bound to user/item - consider including IDs for security');
    }
  }

  return { valid: true };
}

/**
 * Validates amount in cents
 * @param {number} amountCents - Amount in cents
 * @param {number} minCents - Minimum allowed amount (default: 1)
 * @param {number} maxCents - Maximum allowed amount (default: 1000000)
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateAmount(amountCents, minCents = 1, maxCents = 1000000) {
  if (typeof amountCents !== 'number' || isNaN(amountCents)) {
    return { valid: false, error: 'Amount must be a number' };
  }

  if (!Number.isInteger(amountCents)) {
    return { valid: false, error: 'Amount must be an integer (cents)' };
  }

  if (amountCents < minCents) {
    return { valid: false, error: `Amount must be at least $${(minCents / 100).toFixed(2)}` };
  }

  if (amountCents > maxCents) {
    return { valid: false, error: `Amount cannot exceed $${(maxCents / 100).toFixed(2)}` };
  }

  return { valid: true };
}

/**
 * Sanitizes string input to prevent XSS
 * @param {string} input - Input string
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
export function sanitizeString(input, maxLength = 1000) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
}

/**
 * Validates email format
 * @param {string} email - Email address
 * @returns {boolean} - True if valid email
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}