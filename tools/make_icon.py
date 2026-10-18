"""Draw a 48x48 black 'image +' toolbar icon (frame, sun, mountain, plus badge) as RGBA PNG."""
import struct, sys, zlib

N = 48
px = [[0] * N for _ in range(N)]  # alpha: 255 = black ink


def ink(x, y):
    if 0 <= x < N and 0 <= y < N:
        px[y][x] = 255


def clear(x, y):
    if 0 <= x < N and 0 <= y < N:
        px[y][x] = 0


# Picture frame, 3px stroke, with room bottom-right for the plus badge.
L, T, R, B = 3, 7, 38, 38
for y in range(T, B + 1):
    for x in range(L, R + 1):
        if x < L + 3 or x > R - 3 or y < T + 3 or y > B - 3:
            ink(x, y)

# Sun.
for y in range(N):
    for x in range(N):
        if (x - 27) ** 2 + (y - 16) ** 2 <= 9:
            ink(x, y)

# Mountains (two triangles) resting on the inner bottom edge.
base = B - 3
for y in range(18, base + 1):
    for x in range(N):
        if abs(x - 14) <= (y - 18) * 0.9 and x >= L + 3:
            ink(x, y)
        if y >= 24 and abs(x - 27) <= (y - 24) * 0.9 and x <= R - 3:
            ink(x, y)

# Plus badge: white disc knocked out, then a black plus.
cx, cy = 38, 38
for y in range(N):
    for x in range(N):
        d = (x - cx) ** 2 + (y - cy) ** 2
        if d <= 10 ** 2:
            clear(x, y)
        if d <= 8 ** 2:
            ink(x, y)
for i in range(-5, 6):
    for w in (-1, 0, 1):
        clear(cx + i, cy + w)
        clear(cx + w, cy + i)

raw = b"".join(b"\x00" + b"".join(bytes((0, 0, 0, a)) for a in row) for row in px)


def chunk(t, d):
    return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)


png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 6, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
open(sys.argv[1], "wb").write(png)
