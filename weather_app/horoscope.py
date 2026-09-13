"""Daily horoscope readings for the Horoscope screen.

There is no horoscope in the wttr.in response, so the readings are composed here
the same way moon.py derives its phase dates: locally, with no extra service to
depend on. A reading is one opening clause plus one closing clause.

Two properties the screen depends on:

* No two signs share a reading on the same day. The clauses are not drawn one
  sign at a time, which would collide sooner than intuition suggests -- twelve
  independent draws from forty clauses repeat one about five days in six, by the
  birthday problem. Instead each pool is permuted for the day and dealt out, one
  clause per sign, so a collision is impossible rather than merely unlikely.
* The same day gives the same readings. The permutation is seeded from the date,
  and the result is written to disk (see STORE_PATH), so a reading survives both
  a server restart and any later edit to the clause pools -- once a day's
  readings have been shown, they are what that day said.

hashlib does the seeding rather than the built-in hash(), which is randomised
per interpreter run and would have re-rolled every reading on restart.
"""

import hashlib
import json
from pathlib import Path

# Where the current day's readings are kept between runs. Sits beside this
# module and is regenerated whenever it is missing, unreadable, or stale, so
# deleting it is always safe.
STORE_PATH = Path(__file__).with_name("horoscope_today.json")

# Name and the date range printed under it. The ranges are the common newspaper
# ones; the boundaries shift by a day some years, which no one reading a CRT
# weather channel is going to hold against us.
SIGNS = [
    {"name": "Aries", "dates": "Mar 21 - Apr 19"},
    {"name": "Taurus", "dates": "Apr 20 - May 20"},
    {"name": "Gemini", "dates": "May 21 - Jun 20"},
    {"name": "Cancer", "dates": "Jun 21 - Jul 22"},
    {"name": "Leo", "dates": "Jul 23 - Aug 22"},
    {"name": "Virgo", "dates": "Aug 23 - Sep 22"},
    {"name": "Libra", "dates": "Sep 23 - Oct 22"},
    {"name": "Scorpio", "dates": "Oct 23 - Nov 21"},
    {"name": "Sagittarius", "dates": "Nov 22 - Dec 21"},
    {"name": "Capricorn", "dates": "Dec 22 - Jan 19"},
    {"name": "Aquarius", "dates": "Jan 20 - Feb 18"},
    {"name": "Pisces", "dates": "Feb 19 - Mar 20"},
]

# Both pools are kept to one short clause each: the screen prints twelve
# readings at once, in blurred CRT type, so anything longer stops being readable
# at a glance. Adding to either pool is the way to make repeats rarer -- forty
# by forty is 1,600 possible readings, and a given sign draws the same opening
# about once every forty days.
OPENINGS = [
    "A stalled plan starts moving",
    "An old message finally lands",
    "Someone repeats themselves for a reason",
    "The weather matches your mood",
    "A small expense pays for itself",
    "Your patience is noticed",
    "An early start works in your favour",
    "A familiar face turns up",
    "Plans change twice before noon",
    "The quiet hour is the useful one",
    "A loose end ties itself",
    "Good news arrives sideways",
    "An errand takes you somewhere better",
    "The second try goes smoothly",
    "A rumour proves half true",
    "Something you lent comes back",
    "A short delay saves you trouble",
    "The obvious answer is the right one",
    "An old habit earns its keep",
    "Someone finally returns the favour",
    "A closed door was never locked",
    "The morning runs ahead of schedule",
    "A neighbour knows more than you think",
    "Your name comes up in a good room",
    "A forgotten deadline resurfaces",
    "The cheaper option is the better one",
    "An interruption turns out useful",
    "A long drive clears something up",
    "The paperwork goes through",
    "Someone younger has the answer",
    "A quiet week suits you",
    "An apology arrives late but real",
    "The line moves faster than expected",
    "A half-finished project calls you back",
    "Someone overestimates their case",
    "The evening turns out livelier",
    "A borrowed idea works better here",
    "Your instincts run ahead of the facts",
    "An old photograph settles an argument",
    "The last item on the list matters most",
]

CLOSINGS = [
    "say yes before you overthink it",
    "keep the evening free",
    "let the details wait until tomorrow",
    "take the long way home",
    "trust the first answer you gave",
    "spend the afternoon outdoors",
    "answer the call you have been dodging",
    "write it down before you forget",
    "share the credit generously",
    "leave a little earlier than planned",
    "do not lend anything you want returned",
    "ask the obvious question",
    "finish what is already open",
    "check the forecast before committing",
    "make room for one more thing",
    "keep your own counsel for a day",
    "let someone else go first",
    "pay the small bill today",
    "say less than you know",
    "take the meeting anyway",
    "call the person you keep meaning to",
    "put the phone down after dark",
    "read the second page too",
    "start before you feel ready",
    "give the slow option a chance",
    "sleep on anything expensive",
    "keep the receipt",
    "let the argument go cold",
    "do the boring part first",
    "accept the help offered",
    "revisit a decision from last month",
    "travel light",
    "keep tomorrow morning clear",
    "double-check the address",
    "eat something before you decide",
    "thank whoever covered for you",
    "hold the good news a little longer",
    "leave the last word alone",
    "take the compliment at face value",
    "tidy one thing you keep stepping over",
]

# Dealing one clause per sign is what makes the readings unique, and it only
# works while there are at least as many clauses as signs. Checked here so a
# pool trimmed too far fails loudly at import instead of quietly handing two
# signs the same reading.
if len(OPENINGS) < len(SIGNS) or len(CLOSINGS) < len(SIGNS):
    raise ValueError("Each clause pool needs at least one entry per sign.")

# Today's readings, so the common case costs neither a file read nor a rebuild.
_cache = {"date": None, "signs": []}


def _permuted(options, *seed_parts):
    """A deterministic shuffle of `options` for the given seed.

    Ordering by a hash of each entry is a permutation the same way a random
    shuffle is, but it is fully defined by this function -- it cannot drift with
    a future change to the standard library's PRNG, which a stored reading being
    reproducible depends on.
    """
    def rank(option):
        seed = "|".join([*(str(part) for part in seed_parts), option])
        return hashlib.sha256(seed.encode("utf-8")).digest()

    return sorted(options, key=rank)


def _compose(iso_date):
    """Build all twelve readings for an ISO date, without touching the store."""
    openings = _permuted(OPENINGS, iso_date, "open")
    closings = _permuted(CLOSINGS, iso_date, "close")

    return [
        {
            "name": sign["name"],
            "dates": sign["dates"],
            "reading": f"{openings[index]} -- {closings[index]}.",
        }
        for index, sign in enumerate(SIGNS)
    ]


def _load_stored(iso_date):
    """The stored readings if they are for `iso_date`, otherwise None.

    Any unreadable or malformed store is treated as simply absent: these are
    decorative readings, and a corrupt file is not worth failing a weather
    request over when the day can just be composed again.
    """
    try:
        stored = json.loads(STORE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None

    if not isinstance(stored, dict) or stored.get("date") != iso_date:
        return None
    signs = stored.get("signs")
    if not isinstance(signs, list) or len(signs) != len(SIGNS):
        return None
    return signs


def _store(iso_date, signs):
    """Write the day's readings, ignoring a read-only or full disk."""
    try:
        STORE_PATH.write_text(
            json.dumps({"date": iso_date, "signs": signs}, indent=2),
            encoding="utf-8",
        )
    except OSError as err:
        print(f"Horoscope store unavailable, readings will rebuild each run: {err}")


def daily_horoscopes(today):
    """All twelve signs with today's reading, in the usual Aries-first order.

    Returns a list of {"name", "dates", "reading"} dicts. `today` is the date
    where the weather is, not where the server runs, so the readings roll over
    at the viewer's midnight rather than the host's.
    """
    iso = today.isoformat()
    if _cache["date"] == iso:
        return _cache["signs"]

    # A new day, or the first request since the process started. Either way the
    # store is the authority if it already holds this date.
    signs = _load_stored(iso)
    if signs is None:
        signs = _compose(iso)
        _store(iso, signs)

    _cache["date"] = iso
    _cache["signs"] = signs
    return signs
