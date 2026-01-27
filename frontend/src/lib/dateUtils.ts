/**
 * Date utility functions for converting between Date objects and YYYYMMDD format
 */

/**
 * Converts a Date object to YYYYMMDD format string
 * @param date - Date object to convert
 * @returns String in YYYYMMDD format (e.g., "20250804")
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Parses a YYYYMMDD format string to a Date object
 * @param dateString - String in YYYYMMDD format (e.g., "20250804")
 * @returns Date object or null if invalid
 */
export function parseYYYYMMDD(dateString: string): Date | null {
  if (!isValidYYYYMMDD(dateString)) {
    return null;
  }
  
  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10) - 1; // Month is 0-indexed
  const day = parseInt(dateString.substring(6, 8), 10);
  
  const date = new Date(year, month, day);
  
  // Validate the date is valid (handles invalid dates like Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  
  return date;
}

/**
 * Validates if a string is in YYYYMMDD format
 * @param dateString - String to validate
 * @returns true if valid YYYYMMDD format, false otherwise
 */
export function isValidYYYYMMDD(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  // Check format: exactly 8 digits
  if (!/^\d{8}$/.test(dateString)) {
    return false;
  }
  
  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10);
  const day = parseInt(dateString.substring(6, 8), 10);
  
  // Basic range validation
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  return true;
}

/**
 * Formats a Date object to a readable string (e.g., "Aug 4, 2025")
 * @param date - Date object to format
 * @returns Formatted date string
 */
export function formatDateReadable(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}


