"""Upcoming moon phase dates.

wttr.in reports the moon's phase today but not when the next phases fall, and the
Almanac screen needs the next four. This module derives them from the mean
synodic month, which is the average time from one new moon to the next.

Accuracy: the real interval varies by several hours either side of the mean
because the Moon's orbit is elliptical and the Sun perturbs it, so a date here can
be off by up to about a day. That is acceptable for a decorative almanac. If these
dates ever need to be authoritative, this approach is not enough and a proper
ephemeris library is required.
"""

from datetime import date, datetime, timedelta, timezone

# A known new moon, used as the origin to count synodic months from.
# 2000-01-06 18:14 UTC.
NEW_MOON_EPOCH = datetime(2000, 1, 6, 18, 14, tzinfo=timezone.utc)

# Mean length of one new-moon-to-new-moon cycle, in days.
SYNODIC_MONTH_DAYS = 29.530588853

# One cycle divided into quarters. The index into this list is the quarter number
# counted from a new moon, so it also names whatever quarter a given step lands on.
QUARTER_NAMES = ["New", "First", "Full", "Last"]


def upcoming_phases(from_date=None, count=4):
    """The next `count` quarter phases after `from_date`, in chronological order.

    Returns a list of {"name", "date"} dicts, where name is one of QUARTER_NAMES
    and date is an ISO date string. Starting from whichever quarter falls next
    means the sequence rolls around naturally (First, Full, Last, New, First...)
    rather than always leading with the same phase.
    """
    if from_date is None:
        from_date = date.today()

    start = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
    quarter_days = SYNODIC_MONTH_DAYS / 4

    # How many quarters have elapsed since the epoch. Rounding up lands on the
    # next quarter boundary still in the future.
    elapsed_quarters = (start - NEW_MOON_EPOCH).total_seconds() / 86400 / quarter_days
    next_quarter = int(elapsed_quarters) + 1

    phases = []
    for step in range(count):
        quarter = next_quarter + step
        moment = NEW_MOON_EPOCH + timedelta(days=quarter * quarter_days)
        phases.append({
            "name": QUARTER_NAMES[quarter % 4],
            "date": moment.date().isoformat(),
        })
    return phases
