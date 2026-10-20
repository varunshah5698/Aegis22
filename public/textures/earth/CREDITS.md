# Earth imagery credits

These textures are stored locally so the globe never depends on a third-party
image CDN at runtime.

| File | Source | Notes |
| --- | --- | --- |
| `earth-day-2k.jpg` | NASA Visible Earth — Blue Marble, via the turban/webgl-earth asset set | 2048 × 1024 equirectangular. NASA imagery is not subject to copyright in the United States. |
| `earth-night-2k.jpg` | NASA Earth Observatory — Black Marble night lights, via the three-globe example assets | 2048 × 1024 equirectangular city lights. |
| `earth-water-2k.png` | Water mask derived from NASA Blue Marble, via the turban/webgl-earth asset set | Grayscale mask used for the ocean specular highlight. |

The procedural cloud deck, atmosphere, stars, marker and pulse sprites are
generated at runtime in `src/components/globe/` and are not separate assets.
