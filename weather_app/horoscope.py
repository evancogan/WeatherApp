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
    "Don't forget to look before you stop wiping",
    "A bird in the hand is worth two in the bush but",
    "If you ever see a painted lady",
    "Hey, my wife is missing, have you seen",
    "Help, I'm tripping and all I can see is",
    "You forgot to turn the lights off, you forgot",
    "You should help yourself to the nearest",
    "I have a million better things to be doing so",
    "Is this mole normal",
    "What, you want advice? From me? Well",
    "I have waited for this day for a long time Comrade",
    "I mean, if you really need to know",
    "Good god, would you please shut up",
    "My wife left me",
    "Have you seen my pet turtle? Anyway",
    "You were caught kissing boys",
    "I think it'd be best if you knew this",
    "A priest, a rabbi, and a gay man walk into a bar",
    "This is where you read about your horoscope, you dumb",
    "I like kissing men",
    "Cut my life into pieses",
    "Survey says",
    "We polled all gay men, and",
    "What a fruit",
    "It's enough man ass to make you sick, but",
    "Instead of turning the frogs gay",
    "It's a stupid idea but",
    "Wouldn't it be funny if",
    "I am robotically designed to",
    "Freeze, motherfucker",
    "I say what goes around here, and what I say",
    "I'm not sure without my chinese peptides, but",
    "I'm looking for a 4 foot three inch motherfucker",
    "Are you absolutely sure it's you, and not",
    "WOOOOOOOOOOOOOOOOOAAAAAAAAAAGGHGHHHHHHH NELLY",
    "It's not weird, it's",
    "My favorite kind of bullshit",
    "Good luck, I'm heading to",
]

CLOSINGS = [
    "turn you into a duck",
    "cuddle me I'm scared",
    "a few beers too many",
    "I am way too high to deal with this right now",
    "RRRRRGGGHHHRAAGHGHHHHH. Whatever",
    "I forgot what I was saying",
    "anyways, good luck with that",
    "okay, see you later then",
    "in a world of gay men, you are my favorite",
    "wouldn't that be concerning, what I just said?",
    "and that's when I had my first period",
    "morally bankrupt, is what I am",
    "whatever that means",
    "and that's why I do crossfit",
    "anyways, what were you saying? I was thinking about man ass",
    "we should just shut up about this and go watch shrek the musical",
    "I hate talking about it",
    "a little green man",
    "a big angry motherfucker",
    "weird fairy little thing",
    "another one of my sordid lovers",
    "and, scene",
    "so, kiss me you piece of shit",
    "and because of that, I love you",
    "there's nothing you could say to make me stop loving you",
    "oh shit there is a man mowing my lawn for me",
    "ta-da!",
    "I forget what happens next",
    "wouldn't that be just grand?",
    "beat a motherfucker up",
    "so, I always chop my own wood after that",
    "*cough cough* sorry I said that",
    "what, were you expecting a real horoscope?",
    "sorry I don't have a real horoscope",
    "all of astrology is a lie",
    "let's play with a ouija board",
    "so that's why we should hire a naked fireman for the house",
    "isn't that a little concerning? I should get checked out",
    "forgive me",
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
