/**
 * Get today's date at midnight (00:00:00.000)
 *
 * Uses timezone-aware calculation based on user settings.
 */
import { getTodayInTimezone } from './timezone';

export function getTodayDate(): Date {
	return getTodayInTimezone();
}
