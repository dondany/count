#!/usr/bin/env python3
"""Build games/europeData.js from Natural Earth 1:50m countries (world-atlas TopoJSON).

    curl -s -o /tmp/c50.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json
    python3 dev/build-europe.py /tmp/c50.json

Countries are clipped to a Europe window, simplified, and written as flat [lon, lat, ...] rings.
European countries get their ISO alpha-2 id (they are quizzed); neighbouring land is kept as scenery.
"""
import json, math, sys

LON0, LON1, LAT0, LAT1 = -25.0, 45.0, 34.0, 71.5
EUROPE = {  # Natural Earth name -> id
    'Albania': 'AL', 'Andorra': 'AD', 'Austria': 'AT', 'Belarus': 'BY', 'Belgium': 'BE', 'Bosnia and Herz.': 'BA', 'Bulgaria': 'BG',
    'Croatia': 'HR', 'Cyprus': 'CY', 'N. Cyprus': 'CY', 'Czechia': 'CZ', 'Denmark': 'DK', 'Estonia': 'EE', 'Finland': 'FI', 'France': 'FR',
    'Germany': 'DE', 'Greece': 'GR', 'Hungary': 'HU', 'Iceland': 'IS', 'Ireland': 'IE', 'Italy': 'IT', 'Kosovo': 'XK', 'Latvia': 'LV',
    'Liechtenstein': 'LI', 'Lithuania': 'LT', 'Luxembourg': 'LU', 'Malta': 'MT', 'Moldova': 'MD', 'Monaco': 'MC', 'Montenegro': 'ME',
    'Netherlands': 'NL', 'Macedonia': 'MK', 'Norway': 'NO', 'Poland': 'PL', 'Portugal': 'PT', 'Romania': 'RO', 'Russia': 'RU',
    'San Marino': 'SM', 'Serbia': 'RS', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Spain': 'ES', 'Sweden': 'SE', 'Switzerland': 'CH',
    'Ukraine': 'UA', 'United Kingdom': 'GB', 'Vatican': 'VA',
}

def decode(topo):
    sx, sy = topo['transform']['scale']; tx, ty = topo['transform']['translate']
    arcs = []
    for arc in topo['arcs']:
        x = y = 0; pts = []
        for dx, dy in arc:
            x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    def ring(idx):
        out = []
        for i in idx:
            a = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(a if not out else a[1:])
        return out
    feats = []
    for g in topo['objects']['countries']['geometries']:
        polys = [g['arcs']] if g['type'] == 'Polygon' else g['arcs'] if g['type'] == 'MultiPolygon' else []
        feats.append((g['properties']['name'], [ring(p[0]) for p in polys]))  # outer rings only
    return feats

def clip(poly):  # Sutherland-Hodgman against the window
    def edge(pts, inside, cross):
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev): out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev): out.append(cross(prev, cur))
        return out
    def xc(v):
        return lambda a, b: (v, a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]))
    def yc(v):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1]), v)
    for inside, cross in [(lambda p: p[0] >= LON0, xc(LON0)), (lambda p: p[0] <= LON1, xc(LON1)),
                          (lambda p: p[1] >= LAT0, yc(LAT0)), (lambda p: p[1] <= LAT1, yc(LAT1))]:
        if not poly: break
        poly = edge(poly, inside, cross)
    return poly

def simplify(pts, tol):  # Douglas-Peucker on a closed ring
    if len(pts) < 5: return pts
    def rec(a, b):
        (x1, y1), (x2, y2) = pts[a], pts[b]; dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy) or 1e-12
        best, bi = 0, -1
        for i in range(a + 1, b):
            d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L
            if d > best: best, bi = d, i
        return rec(a, bi)[:-1] + rec(bi, b) if best > tol else [pts[a], pts[b]]
    mid = len(pts) // 2
    return rec(0, mid)[:-1] + rec(mid, len(pts) - 1)

def area(p):
    return abs(sum(p[i][0] * p[i - 1][1] - p[i - 1][0] * p[i][1] for i in range(len(p)))) / 2

def inside(x, y, poly):
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        (xi, yi), (xj, yj) = poly[i], poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c

def label_point(poly):  # roughly the point deepest inside the polygon (never outside, unlike a centroid)
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]; k = math.cos(math.radians(52))
    best, bp = -1, (sum(xs) / len(xs), sum(ys) / len(ys))
    n = 28
    for i in range(n + 1):
        for j in range(n + 1):
            x = min(xs) + (max(xs) - min(xs)) * i / n; y = min(ys) + (max(ys) - min(ys)) * j / n
            if not inside(x, y, poly): continue
            d = min(math.hypot((x - poly[m][0]) * k, y - poly[m][1]) for m in range(0, len(poly), max(1, len(poly) // 200)))
            if d > best: best, bp = d, (x, y)
    return bp

def main(src, out):
    feats = decode(json.load(open(src)))
    countries, scenery = {}, []
    for name, rings in feats:
        cid = EUROPE.get(name)
        for r in rings:
            if max(x for x, _ in r) - min(x for x, _ in r) > 180:  # ring wraps round the date line (Russia): unwrap first
                r = [(x + 360 if x < 0 else x, y) for x, y in r]
            rid = cid
            if cid == 'RU' and all(32 < x < 37 and 44 < y < 46.3 for x, y in r):
                rid = 'UA'  # Crimea: shown within Ukraine's internationally recognised borders
            r = clip(r)
            if len(r) < 3: continue
            a = area(r)
            if cid is None and a < 0.3: continue
            if cid and a < 0.02 and name not in ('Malta', 'Andorra', 'Monaco', 'San Marino', 'Vatican', 'Liechtenstein', 'Luxembourg'): continue
            r = simplify(r, 0.035 if a > 0.5 else 0.008)
            if len(r) < 3: continue
            (countries.setdefault(rid, []) if rid else scenery).append(r)
    rows = []
    for cid, rings in sorted(countries.items()):
        big = max(rings, key=area)
        lx, ly = label_point(big)
        tot = sum(area(r) for r in rings)
        rows.append('  { id: %s, area: %.2f, label: [%.2f, %.2f], polys: [%s] }' % (
            json.dumps(cid), tot, lx, ly, ', '.join('[' + ','.join('%.2f,%.2f' % p for p in r) + ']' for r in rings)))
    sc = ', '.join('[' + ','.join('%.2f,%.2f' % p for p in r) + ']' for r in scenery)
    with open(out, 'w') as f:
        f.write('// Generated by dev/build-europe.py from Natural Earth 1:50m (public domain). Rings are flat [lon, lat, ...].\n')
        f.write('export const EU_BOX = { lon0: %s, lon1: %s, lat0: %s, lat1: %s };\n' % (LON0, LON1, LAT0, LAT1))
        f.write('export const EU_COUNTRIES = [\n' + ',\n'.join(rows) + ',\n];\n')
        f.write('export const EU_SCENERY = [' + sc + '];\n')
    print(len(rows), 'countries,', len(scenery), 'scenery rings')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'games/europeData.js')
