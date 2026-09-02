import { describe, it, expect } from 'bun:test'
import { matchesHolidayDate } from '../destinations/holidaygroup.repository'

describe('matchesHolidayDate', () => {
    it('matches a recurring date (year null) regardless of the year', () => {
        const dates = [{ month: 12, day: 25, year: null }]
        expect(matchesHolidayDate(dates, { year: 2026, month: 12, day: 25 })).toBe(true)
        expect(matchesHolidayDate(dates, { year: 2030, month: 12, day: 25 })).toBe(true)
    })

    it('only matches a year-pinned date (mobile holiday) on that exact year', () => {
        const dates = [{ month: 2, day: 17, year: 2026 }]
        expect(matchesHolidayDate(dates, { year: 2026, month: 2, day: 17 })).toBe(true)
        expect(matchesHolidayDate(dates, { year: 2027, month: 2, day: 17 })).toBe(false)
    })

    it('requires month and day to match regardless of year pin', () => {
        const dates = [{ month: 1, day: 1, year: null }]
        expect(matchesHolidayDate(dates, { year: 2026, month: 1, day: 2 })).toBe(false)
        expect(matchesHolidayDate(dates, { year: 2026, month: 2, day: 1 })).toBe(false)
    })

    it('matches if any date in the group hits, mixing recurring and year-pinned', () => {
        const dates = [
            { month: 12, day: 25, year: null },
            { month: 2, day: 17, year: 2026 },
        ]
        expect(matchesHolidayDate(dates, { year: 2027, month: 12, day: 25 })).toBe(true)
        expect(matchesHolidayDate(dates, { year: 2027, month: 2, day: 17 })).toBe(false)
    })

    it('returns false for an empty group', () => {
        expect(matchesHolidayDate([], { year: 2026, month: 1, day: 1 })).toBe(false)
    })
})
