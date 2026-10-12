"""Generate browser derivatives; never rewrite the supplied portrait originals."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
target = root / "assets" / "portraits"
target.mkdir(parents=True, exist_ok=True)
for number in range(1, 41):
    original = root / "portraits" / f"person-{number:02}.png"
    with Image.open(original) as image:
        for size in (320, 960):
            derivative = target / f"person-{number:02}-{size}.webp"
            if derivative.exists() and derivative.stat().st_mtime >= original.stat().st_mtime:
                continue
            image.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS).save(
                derivative, "WEBP", quality=85, method=6
            )
print("Generated 80 transparent WebP portraits.")
