/**
 * 周期任务计算器
 *
 * 纯函数模块，负责解析重复规则字符串并计算下一次/范围内出现日期。
 * 无 Obsidian 或插件状态依赖。
 */

/**
 * 解析后的周期规则结构
 */
export interface ParsedRecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    /** 0=Sun..6=Sat，用于 weekly 指定星期几 */
    days?: number[];
    /** 用于 monthly: 数字表示日期，'last' 表示月末 */
    monthDay?: number | string;
    whenDone: boolean;
    isWeekday?: boolean;
    isWeekend?: boolean;
}

/** 星期名称到索引的映射 */
const DAY_NAME_TO_INDEX: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
};

/**
 * 解析 repeat 规则字符串为结构化对象
 *
 * 支持的规则格式:
 * - every day, every N days
 * - every week, every N weeks, every week on Monday, every N weeks on Monday,Wednesday
 * - every month, every N months, every month on the 15th, every month on the last
 * - every year, every N years
 * - every weekday, every weekend
 * - 以上均可追加 "when done"
 */
export function parseRepeatRule(rule: string): ParsedRecurrenceRule | null {
    if (!rule || typeof rule !== 'string') return null;

    const lower = rule.toLowerCase().trim();

    // 解析 when done
    const whenDone = lower.includes('when done');
    const baseRule = lower.replace(/\s*when\s+done\s*$/, '').trim();

    // every weekday
    if (baseRule === 'every weekday') {
        return { frequency: 'daily', interval: 1, whenDone, isWeekday: true };
    }

    // every weekend
    if (baseRule === 'every weekend') {
        return { frequency: 'daily', interval: 1, whenDone, isWeekend: true };
    }

    // every N days
    const dailyMatch = baseRule.match(/^every\s+(\d+)\s*days?$/);
    if (dailyMatch) {
        return { frequency: 'daily', interval: parseInt(dailyMatch[1]), whenDone };
    }

    // every day
    if (baseRule === 'every day') {
        return { frequency: 'daily', interval: 1, whenDone };
    }

    // every N weeks on <days>
    const weeklyWithDaysMatch = baseRule.match(/^every\s+(\d+)\s*weeks?\s+on\s+(.+)$/);
    if (weeklyWithDaysMatch) {
        const interval = parseInt(weeklyWithDaysMatch[1]);
        const dayNames = weeklyWithDaysMatch[2].split(',').map(d => d.trim().toLowerCase());
        const days = dayNames.map(name => DAY_NAME_TO_INDEX[name]).filter(d => d !== undefined);
        if (days.length > 0) {
            return { frequency: 'weekly', interval, days, whenDone };
        }
    }

    // every week on <days>
    const weeklyWithDaysSimple = baseRule.match(/^every\s+week\s+on\s+(.+)$/);
    if (weeklyWithDaysSimple) {
        const dayNames = weeklyWithDaysSimple[1].split(',').map(d => d.trim().toLowerCase());
        const days = dayNames.map(name => DAY_NAME_TO_INDEX[name]).filter(d => d !== undefined);
        if (days.length > 0) {
            return { frequency: 'weekly', interval: 1, days, whenDone };
        }
    }

    // every N weeks
    const weeklyMatch = baseRule.match(/^every\s+(\d+)\s*weeks?$/);
    if (weeklyMatch) {
        return { frequency: 'weekly', interval: parseInt(weeklyMatch[1]), whenDone };
    }

    // every week
    if (baseRule === 'every week') {
        return { frequency: 'weekly', interval: 1, whenDone };
    }

    // every N months on the last
    const monthlyWithLastMatch = baseRule.match(/^every\s+(\d+)\s*months?\s+on\s+the\s+last$/);
    if (monthlyWithLastMatch) {
        return { frequency: 'monthly', interval: parseInt(monthlyWithLastMatch[1]), monthDay: 'last', whenDone };
    }

    // every month on the last
    if (baseRule === 'every month on the last') {
        return { frequency: 'monthly', interval: 1, monthDay: 'last', whenDone };
    }

    // every N months on the <Nth>
    const monthlyWithDayMatch = baseRule.match(/^every\s+(\d+)\s*months?\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?$/);
    if (monthlyWithDayMatch) {
        return { frequency: 'monthly', interval: parseInt(monthlyWithDayMatch[1]), monthDay: parseInt(monthlyWithDayMatch[2]), whenDone };
    }

    // every month on the <Nth>
    const monthlyWithDaySimple = baseRule.match(/^every\s+month\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?$/);
    if (monthlyWithDaySimple) {
        return { frequency: 'monthly', interval: 1, monthDay: parseInt(monthlyWithDaySimple[1]), whenDone };
    }

    // every N months
    const monthlyMatch = baseRule.match(/^every\s+(\d+)\s*months?$/);
    if (monthlyMatch) {
        return { frequency: 'monthly', interval: parseInt(monthlyMatch[1]), whenDone };
    }

    // every month
    if (baseRule === 'every month') {
        return { frequency: 'monthly', interval: 1, whenDone };
    }

    // every N years
    const yearlyMatch = baseRule.match(/^every\s+(\d+)\s*years?$/);
    if (yearlyMatch) {
        return { frequency: 'yearly', interval: parseInt(yearlyMatch[1]), whenDone };
    }

    // every year
    if (baseRule === 'every year') {
        return { frequency: 'yearly', interval: 1, whenDone };
    }

    return null;
}

/**
 * 计算下一个出现日期
 *
 * @param rule 解析后的周期规则
 * @param fromDate 基准日期（通常是当前任务的日期字段值）
 * @returns 下一个出现日期
 */
export function getNextOccurrence(rule: ParsedRecurrenceRule, fromDate: Date): Date {
    const result = new Date(fromDate);

    switch (rule.frequency) {
        case 'daily': {
            if (rule.isWeekday) {
                // 工作日：前进1天，跳过周末
                result.setDate(result.getDate() + 1);
                while (result.getDay() === 0 || result.getDay() === 6) {
                    result.setDate(result.getDate() + 1);
                }
            } else if (rule.isWeekend) {
                // 周末：前进到下一个周六或周日
                result.setDate(result.getDate() + 1);
                while (result.getDay() !== 0 && result.getDay() !== 6) {
                    result.setDate(result.getDate() + 1);
                }
            } else {
                result.setDate(result.getDate() + rule.interval);
            }
            break;
        }

        case 'weekly': {
            if (rule.days && rule.days.length > 0) {
                // 指定了星期几：找到下一个符合的日期
                const sortedDays = [...rule.days].sort((a, b) => a - b);
                const currentDay = result.getDay();

                // 在当前周内找下一个匹配日
                let nextDayInWeek = sortedDays.find(d => d > currentDay);

                if (nextDayInWeek !== undefined) {
                    result.setDate(result.getDate() + (nextDayInWeek - currentDay));
                } else {
                    // 当前周没有匹配，跳到下一周的第一个匹配日
                    const daysUntilNextWeekFirst = (7 - currentDay) + sortedDays[0];
                    result.setDate(result.getDate() + daysUntilNextWeekFirst);
                }

                // 对于 interval > 1，需要额外跳过 (interval-1) 周
                if (rule.interval > 1) {
                    // 从第一次出现后再加 (interval-1)*7 天
                    // 但更准确的做法是：从原始 fromDate 开始计算 interval 周
                    // 重新实现：先前进 interval 周，再找下一个匹配日
                    const fromPlusWeeks = new Date(fromDate);
                    fromPlusWeeks.setDate(fromPlusWeeks.getDate() + rule.interval * 7);
                    const targetDay = fromPlusWeeks.getDay();
                    const sorted = [...rule.days].sort((a, b) => a - b);

                    // 在 fromPlusWeeks 所在的周找最近的匹配日
                    let found = sorted.find(d => d >= targetDay);
                    if (found !== undefined) {
                        fromPlusWeeks.setDate(fromPlusWeeks.getDate() + (found - targetDay));
                    } else {
                        // 取下一周的第一个
                        fromPlusWeeks.setDate(fromPlusWeeks.getDate() + (7 - targetDay + sorted[0]));
                    }
                    return fromPlusWeeks;
                }
            } else {
                result.setDate(result.getDate() + rule.interval * 7);
            }
            break;
        }

        case 'monthly': {
            const originalDay = result.getDate();

            if (rule.monthDay === 'last') {
                // 月末：前进 interval 个月，取最后一天
                result.setMonth(result.getMonth() + rule.interval);
                result.setDate(getLastDayOfMonth(result.getFullYear(), result.getMonth()));
            } else if (rule.monthDay !== undefined) {
                // 指定日期：前进 interval 个月，clamp 到有效日期
                const targetDay = rule.monthDay as number;
                result.setMonth(result.getMonth() + rule.interval);
                result.setDate(clampDay(result.getFullYear(), result.getMonth(), targetDay));
            } else {
                // 不指定日期：前进 interval 个月，保持日期不变（clamp）
                result.setMonth(result.getMonth() + rule.interval);
                result.setDate(clampDay(result.getFullYear(), result.getMonth(), originalDay));
            }
            break;
        }

        case 'yearly': {
            result.setFullYear(result.getFullYear() + rule.interval);
            break;
        }
    }

    return result;
}

/**
 * 计算日期范围内所有出现日期
 *
 * @param rule 解析后的周期规则
 * @param baseDate 基准日期（当前任务的日期字段值）
 * @param rangeStart 范围起始日期
 * @param rangeEnd 范围结束日期
 * @param maxCount 最大返回数量，防止无限循环
 * @returns 在范围内的出现日期数组
 */
export function getOccurrencesInRange(
    rule: ParsedRecurrenceRule,
    baseDate: Date,
    rangeStart: Date,
    rangeEnd: Date,
    maxCount: number = 50
): Date[] {
    const results: Date[] = [];
    const rangeStartNorm = normalizeDate(rangeStart);
    const rangeEndNorm = normalizeDate(rangeEnd);

    let current = normalizeDate(baseDate);
    // 从 baseDate 的下一次开始（不包含 baseDate 本身）
    current = getNextOccurrence(rule, current);

    let count = 0;
    while (count < maxCount) {
        if (current.getTime() > rangeEndNorm.getTime()) break;

        if (current.getTime() >= rangeStartNorm.getTime()) {
            results.push(new Date(current));
        }

        current = getNextOccurrence(rule, current);
        count++;
    }

    return results;
}

/**
 * 获取月份的最后一天
 */
function getLastDayOfMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Clamp 日期到月份有效范围
 * 例如：31日在2月 → 28/29日
 */
function clampDay(year: number, month: number, day: number): number {
    const lastDay = getLastDayOfMonth(year, month);
    return Math.min(day, lastDay);
}

/**
 * 标准化日期（去除时分秒）
 */
function normalizeDate(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}
