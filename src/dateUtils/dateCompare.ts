/**
 * Date comparison utilities
 */
import { isTodayInTimezone, isThisMonthInTimezone } from './timezone';

/**
 * Check if date is today (timezone-aware)
 */
export function isToday(date: Date): boolean {
	return isTodayInTimezone(date);
}

/**
 * Check if date is in current month (timezone-aware)
 */
export function isThisMonth(date: Date): boolean {
	return isThisMonthInTimezone(date);
}
