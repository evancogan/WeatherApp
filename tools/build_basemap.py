"""Build weather_app/static/basemap.svg from Natural Earth geometry.

Run once; the output is committed and the app never calls this. Rerun it only
to change the frame, and when you do, copy the same WEST/EAST/SOUTH/NORTH into
regional.py and the new aspect ratio into .map-frame in style.css -- the
markers are positioned as percentages of this exact projection.

Expects three public-domain Natural Earth files in the working directory,
which are not committed because this runs once:

    coast.geojson   ne_50m_land.geojson
    lakes.geojson   ne_50m_lakes.geojson
    states.geojson  ne_50m_admin_1_states_provinces_lakes.geojson

all from https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
"""
import json
import math

# The frame, chosen so Detroit sits on the left edge and Augusta near the
# right, matching the reference screenshot.
WEST, EAST = -84.6, -67.4
SOUTH, NORTH = 39.9, 46.45

VIEW_W = 1000.0
SIMPLIFY_TOL = 0.35          # in viewBox units
PAD = 80.0                   # clip rect padding outside the viewBox


def merc_y(lat):
    """Mercator northing, in the same degree units the longitudes use."""
    lat = max(min(lat, 85.0), -85.0)
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


Y_TOP, Y_BOT = merc_y(NORTH), merc_y(SOUTH)
SCALE = VIEW_W / (EAST - WEST)
VIEW_H = (Y_TOP - Y_BOT) * SCALE


def project(lon, lat):
    return ((lon - WEST) * SCALE, (Y_TOP - merc_y(lat)) * SCALE)


def bbox_hits(coords):
    """True if any point of this ring is anywhere near the frame."""
    for lon, lat in coords:
        if WEST - 12 <= lon <= EAST + 12 and SOUTH - 8 <= lat <= NORTH + 8:
            return True
    return False


def clip(points, inside, intersect):
    """One Sutherland-Hodgman pass against a single edge."""
    out = []
    for i, cur in enumerate(points):
        prev = points[i - 1]
        cur_in, prev_in = inside(cur), inside(prev)
        if cur_in:
            if not prev_in:
                out.append(intersect(prev, cur))
            out.append(cur)
        elif prev_in:
            out.append(intersect(prev, cur))
    return out


def clip_rect(points, x0, y0, x1, y1):
    """Clip a closed ring to the padded frame so coordinates stay small."""
    def cut(a, b, axis, value):
        ax, ay = a
        bx, by = b
        d = (b[axis] - a[axis])
        t = 0.0 if d == 0 else (value - a[axis]) / d
        return (ax + (bx - ax) * t, ay + (by - ay) * t)

    for axis, value, keep_greater in (
        (0, x0, True), (0, x1, False), (1, y0, True), (1, y1, False)
    ):
        if not points:
            return []
        if keep_greater:
            points = clip(points, lambda p: p[axis] >= value,
                          lambda a, b: cut(a, b, axis, value))
        else:
            points = clip(points, lambda p: p[axis] <= value,
                          lambda a, b: cut(a, b, axis, value))
    return points


def simplify(points, tol):
    """Douglas-Peucker, iterative so deep rings do not blow the stack."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        lo, hi = stack.pop()
        if hi <= lo + 1:
            continue
        ax, ay = points[lo]
        bx, by = points[hi]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy)
        worst, worst_i = 0.0, -1
        for i in range(lo + 1, hi):
            px, py = points[i]
            if norm == 0:
                dist = math.hypot(px - ax, py - ay)
            else:
                dist = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if dist > worst:
                worst, worst_i = dist, i
        if worst > tol:
            keep[worst_i] = True
            stack.append((lo, worst_i))
            stack.append((worst_i, hi))
    return [p for p, k in zip(points, keep) if k]


def rings_of(geom):
    kind = geom["type"]
    if kind == "Polygon":
        return list(geom["coordinates"])
    if kind == "MultiPolygon":
        return [ring for poly in geom["coordinates"] for ring in poly]
    if kind == "LineString":
        return [geom["coordinates"]]
    if kind == "MultiLineString":
        return list(geom["coordinates"])
    return []


def path_for(features, closed=True):
    """One SVG path 'd' string covering every ring of every feature."""
    parts = []
    for feature in features:
        for ring in rings_of(feature["geometry"]):
            ring = [(c[0], c[1]) for c in ring]
            if not bbox_hits(ring):
                continue
            pts = [project(lon, lat) for lon, lat in ring]
            pts = clip_rect(pts, -PAD, -PAD, VIEW_W + PAD, VIEW_H + PAD)
            if len(pts) < 3:
                continue
            pts = simplify(pts, SIMPLIFY_TOL)
            if len(pts) < 3:
                continue
            head = "M{:.1f} {:.1f}".format(*pts[0])
            tail = "".join("L{:.1f} {:.1f}".format(x, y) for x, y in pts[1:])
            parts.append(head + tail + ("Z" if closed else ""))
    return "".join(parts)


def load(name):
    with open(name, encoding="utf-8") as handle:
        return json.load(handle)["features"]


land = path_for(load("coast.geojson"))
lakes = path_for(load("lakes.geojson"))
borders = path_for(load("states.geojson"))

svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.1f}" preserveAspectRatio="none" class="map-base" aria-hidden="true">
<path class="map-land" fill-rule="evenodd" d="{land}"/>
<path class="map-lake" fill-rule="evenodd" d="{lakes}"/>
<path class="map-border" d="{borders}"/>
</svg>
""".format(w=VIEW_W, h=VIEW_H, land=land, lakes=lakes, borders=borders)

with open("basemap.svg", "w", encoding="utf-8") as handle:
    handle.write(svg)

print("viewBox 0 0 {:.0f} {:.1f}  aspect {:.4f}".format(VIEW_W, VIEW_H, VIEW_W / VIEW_H))
print("bytes", len(svg))
