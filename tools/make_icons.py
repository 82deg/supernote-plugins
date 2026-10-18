"""Draw 48x48 black toolbar icons (antialiased via 4x supersampling) as RGBA PNGs.

usage: python3 -I tools/make_icons.py <out_dir>
writes rotate_left.png, rotate_right.png, crop.png
"""
import math
import os
import struct
import sys
import zlib

N = 48
SS = 4  # supersampling factor
M = N * SS


def blank():
    return [[0] * M for _ in range(M)]


def disc(px, cx, cy, r):
    """Filled circle, coordinates in icon px (0..48)."""
    cx, cy, r = cx * SS, cy * SS, r * SS
    for y in range(max(0, int(cy - r)), min(M, int(cy + r) + 1)):
        for x in range(max(0, int(cx - r)), min(M, int(cx + r) + 1)):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                px[y][x] = 1


def line(px, x0, y0, x1, y1, w):
    """Thick line with round caps."""
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 4) + 1
    for i in range(steps + 1):
        t = i / steps
        disc(px, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2)


def arc(px, cx, cy, r, a0, a1, w):
    """Thick arc from angle a0 to a1 (degrees, 0 = east, clockwise on screen)."""
    steps = int(abs(a1 - a0) * 2) + 1
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        disc(px, cx + r * math.cos(a), cy + r * math.sin(a), w / 2)


def triangle(px, pts):
    (ax, ay), (bx, by), (cx, cy) = [(x * SS, y * SS) for x, y in pts]
    def side(px_, py_, x1, y1, x2, y2):
        return (px_ - x2) * (y1 - y2) - (x1 - x2) * (py_ - y2)
    for y in range(M):
        for x in range(M):
            p = (x + 0.5, y + 0.5)
            d1 = side(*p, ax, ay, bx, by)
            d2 = side(*p, bx, by, cx, cy)
            d3 = side(*p, cx, cy, ax, ay)
            if not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0)):
                px[y][x] = 1


def rotate_icon(clockwise):
    """Open circular arrow; arrowhead at the arc's leading end."""
    px = blank()
    cx, cy, r, w = 24, 26, 13, 4.5
    # Arc covers 280°, gap at the top where the arrowhead sits.
    if clockwise:
        arc(px, cx, cy, r, -60, 200, w)  # ends at upper-left... leading end at -60 (upper right)
        end = math.radians(-60)
        tangent = end - math.pi / 2  # direction of travel is decreasing angle → counter… flip below
    else:
        arc(px, cx, cy, r, -20 + 0, 240, w)
        end = math.radians(240)
        tangent = end + math.pi / 2
    ex, ey = cx + r * math.cos(end), cy + r * math.sin(end)
    # Arrowhead: triangle pointing along the tangent at the arc end.
    if clockwise:
        tangent = end + math.pi / 2 + math.pi  # travel direction at -60° going clockwise = toward smaller angle
    size = 8
    tx, ty = math.cos(tangent), math.sin(tangent)
    nx, ny = -ty, tx
    tip = (ex + tx * size, ey + ty * size)
    b1 = (ex + nx * size * 0.75, ey + ny * size * 0.75)
    b2 = (ex - nx * size * 0.75, ey - ny * size * 0.75)
    triangle(px, [tip, b1, b2])
    return px


def crop_icon():
    """Two interlocking right angles, the classic crop glyph."""
    px = blank()
    w = 4.5
    line(px, 14, 5, 14, 34, w)   # first L: vertical
    line(px, 14, 34, 43, 34, w)  # first L: horizontal
    line(px, 5, 14, 34, 14, w)   # second L: horizontal
    line(px, 34, 14, 34, 43, w)  # second L: vertical
    return px


def downsample(px):
    out = []
    for y in range(N):
        row = []
        for x in range(N):
            s = sum(px[y * SS + j][x * SS + i] for j in range(SS) for i in range(SS))
            row.append(round(255 * s / (SS * SS)))
        out.append(row)
    return out


def write_png(path, alpha):
    raw = b"".join(b"\x00" + b"".join(bytes((0, 0, 0, a)) for a in row) for row in alpha)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def mirror(px):
    return [list(reversed(row)) for row in px]


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    # rotate_icon(clockwise=False) draws its head at the top pointing clockwise
    # (checked visually), so it is the *right* icon; its mirror is the left one.
    right = rotate_icon(clockwise=False)
    write_png(os.path.join(out, "rotate_right.png"), downsample(right))
    write_png(os.path.join(out, "rotate_left.png"), downsample(mirror(right)))
    write_png(os.path.join(out, "crop.png"), downsample(crop_icon()))
