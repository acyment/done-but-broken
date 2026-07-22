#!/usr/bin/env python3
"""Write tiny valid JPEG fixtures with distinct bytes (distinct SHA1s, so
Immich's checksum dedup treats them as different assets). Nothing decodes
them at upload time (API worker only, no metadata job runs)."""
import base64
import sys
from pathlib import Path

# Minimal baseline 1x1 JPEG (JFIF). Trailing bytes after EOI differentiate copies.
JPEG_1PX = base64.b64decode(
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA"
    "AAAAAAAAAAAAC//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=="
)

def main() -> int:
    outdir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
    for name, tail in [("fixture-a.jpg", b"A"), ("fixture-b.jpg", b"B"), ("fixture-c.jpg", b"C")]:
        (outdir / name).write_bytes(JPEG_1PX + tail)
        print(name, len(JPEG_1PX) + 1, "bytes")
    return 0

if __name__ == "__main__":
    sys.exit(main())
