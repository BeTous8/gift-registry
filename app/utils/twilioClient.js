import twilio from 'twilio';

// Helper function to get Twilio client (initialized at runtime)
export function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error('Twilio credentials not configured');
    return null;
  }

  return twilio(accountSid, authToken);
}

// Format phone number to E.164 format for US numbers
export function formatPhoneNumber(phone) {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // US number: 10 digits -> add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // US number with country code: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Already has country code or other format
  return `+${digits}`;
}

// Validate US phone number (basic validation)
export function isValidUSPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  // Must be 10 digits, or 11 digits starting with 1
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}
