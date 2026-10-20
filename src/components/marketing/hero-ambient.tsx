"use client";

import * as React from "react";

/**
 * The landing hero's motion layer.
 *
 * The original hero used a 20-second ambient clip of drifting coins. It looked
 * right but played badly: the first and last frames did not line up, so every
 * loop snapped, and decoding competed with the WebGL globe for the compositor,
 * so it visibly dropped frames. None of that motion needs a codec.
 *
 * This draws it instead. A dark field in the product palette is painted once
 * into an offscreen plate, then a handful of coins drift over it. Every coin's X and
 * Y are periodic over the loop (`speed` and `bob` are whole excursions per
 * loop), so frame N flows into frame 0 with no cut, and the sprite bank is
 * pre-rendered offscreen for three focus levels, so a frame costs a plate blit
 * plus a dozen `drawImage` calls — no decode, no per-frame gradients, no CSS
 * filters on a moving layer.
 *
 * Coins are sorted into depth lanes. A lane only ever shares its band with
 * coins travelling in the same direction at the same rate, so two coins can
 * never slide through each other, and no twin copy is needed to fill the wrap
 * gap: the disc simply leaves one side of the hero while another, further
 * along its lane, comes back.
 *
 * Each coin also turns: its horizontal squash is `cos(phase)`, and the face
 * swaps to its reverse exactly when the coin is edge-on. Because the sprite is
 * also squashed, the flip is invisible and the arc must stay free of it (one
 * full turn per bob avoids a second, incommensurate period).
 *
 * The float is deliberately larger than a drifting-clock ticker: near coins
 * travel faster, bob further and ride a slightly blurred sprite, far coins creep
 * and stay crisp. That parallax is what reads as depth; a uniform drift reads
 * as wallpaper. Each pass also adds a faint contact shadow under the near
 * coins so they sit in air rather than on the plate.
 */

interface Coin {
  /** Playing-card key. `back` sprites share it and swap in when edge-on. */
  face: string;
  /** Native aspect (width / height), used so tall coins are not squashed. */
  aspect: number;
  /** Fraction of the hero height. */
  size: number;
  /** Horizontal speed, hero widths per loop; negative flies right-to-left. */
  speed: number;
  /** Fractions of a loop the coin waits off-screen before entering. */
  offset: number;
  /** Starting height, 0..1. */
  y: number;
  /** Whole vertical oscillations per loop — must stay an integer. */
  bob: number;
  /** Bob amplitude, fraction of hero height. */
  bobAmp: number;
  /** Starting phase of the bob, 0..1. */
  phase: number;
  /** Turns about the vertical axis per loop — a whole number, signed. */
  spin: number;
  /** Phase of the turn, 0..1 (0 = facing us). */
  flip: number;
  /** Spin of the disc in plan, degrees per loop. */
  roll: number;
  tilt: number;
  /** Base opacity. */
  alpha: number;
  /** Depth 0 = crisp (far), 1 = soft (middle), 2 = heavily blurred (near). */
  depth: 0 | 1 | 2;
}

/**
 * Three depths, each a coherent population rather than a single token coin, so
 * the hero keeps moving (and keeps parallaxing) at every point in the loop.
 */
const COINS: Coin[] = [
  // Near — large, soft, fast, and the most of their travel.
  {
    face: "gold-front",
    aspect: 1,
    size: 0.3,
    speed: 0.58,
    offset: 0.04,
    y: 0.22,
    bob: 1,
    bobAmp: 0.075,
    phase: 0.0,
    spin: 1,
    flip: 0.1,
    roll: 8,
    tilt: -14,
    alpha: 0.95,
    depth: 2,
  },
  {
    face: "silver-front",
    aspect: 1,
    size: 0.2,
    speed: 0.62,
    offset: 0.46,
    y: 0.58,
    bob: 2,
    bobAmp: 0.062,
    phase: 0.4,
    spin: -1,
    flip: 0.55,
    roll: -12,
    tilt: 24,
    alpha: 0.86,
    depth: 2,
  },
  {
    face: "gold-left",
    aspect: 1,
    size: 0.15,
    speed: -0.54,
    offset: 0.7,
    y: 0.34,
    bob: 1,
    bobAmp: 0.07,
    phase: 0.7,
    spin: 2,
    flip: 0.3,
    roll: 14,
    tilt: 8,
    alpha: 0.8,
    depth: 2,
  },
  {
    face: "bimetal-right",
    aspect: 1,
    size: 0.12,
    speed: -0.6,
    offset: 0.22,
    y: 0.76,
    bob: 2,
    bobAmp: 0.058,
    phase: 0.15,
    spin: -2,
    flip: 0.75,
    roll: -10,
    tilt: -20,
    alpha: 0.72,
    depth: 2,
  },
  // Middle — the readable detail of the field.
  {
    face: "gold-right",
    aspect: 1,
    size: 0.19,
    speed: 0.3,
    offset: 0.1,
    y: 0.44,
    bob: 1,
    bobAmp: 0.05,
    phase: 0.3,
    spin: 1,
    flip: 0.42,
    roll: 6,
    tilt: 12,
    alpha: 0.9,
    depth: 1,
  },
  {
    face: "silver-front",
    aspect: 1,
    size: 0.15,
    speed: 0.28,
    offset: 0.58,
    y: 0.14,
    bob: 2,
    bobAmp: 0.045,
    phase: 0.62,
    spin: -1,
    flip: 0.2,
    roll: -8,
    tilt: -10,
    alpha: 0.78,
    depth: 1,
  },
  {
    face: "gold-front",
    aspect: 1,
    size: 0.13,
    speed: -0.32,
    offset: 0.36,
    y: 0.68,
    bob: 1,
    bobAmp: 0.048,
    phase: 0.85,
    spin: 2,
    flip: 0.6,
    roll: 10,
    tilt: 18,
    alpha: 0.74,
    depth: 1,
  },
  {
    face: "bimetal-right",
    aspect: 1,
    size: 0.11,
    speed: -0.26,
    offset: 0.8,
    y: 0.5,
    bob: 2,
    bobAmp: 0.042,
    phase: 0.08,
    spin: -2,
    flip: 0.9,
    roll: -12,
    tilt: -6,
    alpha: 0.7,
    depth: 1,
  },
  // Far — small, crisp, slow drift, so the depth order never inverts.
  {
    face: "gold-front",
    aspect: 1,
    size: 0.07,
    speed: 0.13,
    offset: 0.26,
    y: 0.86,
    bob: 1,
    bobAmp: 0.026,
    phase: 0.52,
    spin: 1,
    flip: 0.35,
    roll: 10,
    tilt: 6,
    alpha: 0.5,
    depth: 0,
  },
  {
    face: "gold-right",
    aspect: 1,
    size: 0.055,
    speed: 0.14,
    offset: 0.66,
    y: 0.08,
    bob: 2,
    bobAmp: 0.022,
    phase: 0.18,
    spin: -1,
    flip: 0.7,
    roll: -14,
    tilt: -16,
    alpha: 0.44,
    depth: 0,
  },
  {
    face: "silver-front",
    aspect: 1,
    size: 0.06,
    speed: -0.12,
    offset: 0.5,
    y: 0.3,
    bob: 1,
    bobAmp: 0.024,
    phase: 0.74,
    spin: 2,
    flip: 0.5,
    roll: 8,
    tilt: 20,
    alpha: 0.42,
    depth: 0,
  },
  {
    face: "bimetal-right",
    aspect: 1,
    size: 0.05,
    speed: -0.13,
    offset: 0.9,
    y: 0.62,
    bob: 3,
    bobAmp: 0.02,
    phase: 0.92,
    spin: -1,
    flip: 0.12,
    roll: -6,
    tilt: -22,
    alpha: 0.38,
    depth: 0,
  },
];

/** Coin sprites live here, named `<metal>-<view>.png`; `front` faces gain a `back`. */
const COIN_DIR = "/backdrop/coins";

/**
 * A coin face's sprite URL.
 *
 * The loaded sprite map is keyed by URL, never by face name. Keying lookups by
 * the bare face (`gold-front`) silently missed every entry, so the bank stayed
 * empty and the canvas painted nothing but the plate.
 */
const spriteUrl = (face: string) => `${COIN_DIR}/${face}.png`;

/** A face and, for `front` faces, the matching `back` seen edge-on. */
const spriteUrls = (face: string) =>
  face.includes("front")
    ? [spriteUrl(face), spriteUrl(face.replace("front", "back"))]
    : [spriteUrl(face)];

/** Bank key: a sprite URL plus the blur depth it was rendered at. */
const bankKey = (url: string, depth: number) => `${url}#${depth}`;

const LOOP_SECONDS = 34;
const TAU = Math.PI * 2;

/**
 * Shared by every coin layer so the string is parsed once.
 *
 * The brighter pass (`brightness(1.5)`) belonged to the pale photo plate: it
 * lifted dull coins to something readable on lavender. On the dark field the
 * same filter clips the highlights to flat white, so the coins are dimmed and
 * tinted toward the product's gold instead, and the sprites read as metal
 * rather than as lit paper.
 */
const COIN_FILTER = "brightness(0.72) saturate(1.35) sepia(0.35) hue-rotate(-8deg)";

/** Blur radii (in units of the crisp sprite's pixels) per depth level. */
const BLUR: Record<Coin["depth"], number> = { 0: 0, 1: 1.1, 2: 2.6 };

/**
 * How far each depth travels per loop, as a multiple of the agreed speed. Near
 * coins cover roughly twice the ground of far ones, which is the whole depth
 * cue; scaled here rather than re-authored per coin so a lane can never end up
 * with two coins of different rates.
 */
const PARALLAX: Record<Coin["depth"], number> = { 0: 0.55, 1: 0.9, 2: 1.35 };

/**
 * Draws `image` into a fresh canvas that fills the square exactly.
 *
 * The sprite size is fixed here, not stretched at paint time: the preg `px`
 * was only ever a hint to the blur radius, so the nearest lane previously
 * upscaled a thumbnail-sized artefact over a fifth of the hero — the grey
 * blobs that read as smudges rather than coins.
 *
 * `blur` is in sprite pixels and is sampled from the source's own resolution,
 * so a near lane stays soft without turning into a smear at larger sizes. The
 * nine taps cost nothing per frame because this runs once, on load and resize.
 */
function spriteBank(image: HTMLImageElement, depth: Coin["depth"], targetPx: number) {
  const px = Math.max(8, Math.round(targetPx));
  const drawn = Math.min(px, image.naturalWidth || px);
  const scale = px / drawn;
  const radius = BLUR[depth] * scale;

  const size = px + Math.ceil(radius * 4);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;

  const inset = (size - px) / 2;
  if (radius < 0.75) {
    ctx.drawImage(image, inset, inset, px, px);
    return canvas;
  }

  // Nine taps in a spiral read as a gaussian at these radii.
  const passes: Array<[number, number, number]> = [
    [0, 0, 0.2],
    [-radius, 0, 0.14],
    [radius, 0, 0.14],
    [0, -radius, 0.14],
    [0, radius, 0.14],
    [-radius * 0.7, -radius * 0.7, 0.06],
    [radius * 0.7, -radius * 0.7, 0.06],
    [-radius * 0.7, radius * 0.7, 0.06],
    [radius * 0.7, radius * 0.7, 0.06],
  ];
  for (const [dx, dy, alpha] of passes) {
    ctx.globalAlpha = Math.min(1, alpha * 5);
    ctx.drawImage(image, inset + dx, inset + dy, px, px);
  }
  return canvas;
}

export interface HeroAmbientProps {
  className?: string;
  /** Fires once the plate and sprites are painted and the layer may fade in. */
  onReady?: () => void;
}

export function HeroAmbient({ className, onReady }: HeroAmbientProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const readyRef = React.useRef(onReady);
  readyRef.current = onReady;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;

    let disposed = false;
    let frame = 0;
    let width = 0;
    let height = 0;
    let plate: HTMLCanvasElement | null = null;
    /** Crisp source sprites, one per unique URL. */
    const sprites = new Map<string, HTMLImageElement>();
    /** Pre-rendered, per-depth copies keyed by URL + depth. */
    const bank = new Map<string, CanvasImageSource>();
    /** Base sprite size in CSS px for the current hero height. */
    let unit = 0;
    const started = performance.now();

    const load = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = (event) => {
          console.warn(`[hero-ambient] could not load ${src}`, event);
          resolve(null);
        };
        image.src = src;
      });

    /**
     * Paints the dark field the coins drift over, into an offscreen plate at
     * the current DPR.
     *
     * This used to blit a stock still of coins on lavender blooms. The photo's
     * own pixels were the problem: a bright pastel plate cannot be darkened by
     * the translucent tint and vignette layered above it, so the hero rendered
     * as a pale wash and the copy lost its contrast. It also shipped a second
     * set of coins (facing the wrong way) underneath the ones drawn here.
     *
     * The field is built from the product palette instead: near-black navy with
     * the same cool lobe on the right and the warm floor the marketing sections
     * use. Every value stays under ~40/255, so the coin sprites are the only
     * bright thing in the layer. It is painted once per resize, never per frame.
     */
    const buildPlate = () => {
      plate = document.createElement("canvas");
      plate.width = width;
      plate.height = height;
      const ctx = plate.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#05080f";
      ctx.fillRect(0, 0, width, height);

      // Cool light behind the globe, a lift at the top for the nav, and a warm
      // trace in the upper left where the amber wash sits.
      const lobes: Array<[number, number, number, number, string, string]> = [
        [0.78, 0.4, 0.62, 0.72, "rgba(34, 62, 108, 0.55)", "rgba(14, 26, 48, 0)"],
        [0.5, 0.02, 1.0, 0.5, "rgba(18, 30, 52, 0.6)", "rgba(10, 16, 30, 0)"],
        [0.08, 0.08, 0.5, 0.5, "rgba(120, 86, 36, 0.22)", "rgba(60, 44, 20, 0)"],
        [0.9, 0.95, 0.5, 0.5, "rgba(24, 60, 62, 0.18)", "rgba(10, 24, 26, 0)"],
      ];
      for (const [fx, fy, rx, ry, inner, outer] of lobes) {
        const gradient = ctx.createRadialGradient(
          width * fx,
          height * fy,
          0,
          width * fx,
          height * fy,
          Math.hypot(width * rx, height * ry),
        );
        gradient.addColorStop(0, inner);
        gradient.addColorStop(1, outer);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      // Floor falloff: the field should sink, not lighten, at the bottom edge.
      const floor = ctx.createLinearGradient(0, height * 0.55, 0, height);
      floor.addColorStop(0, "rgba(2, 4, 8, 0)");
      floor.addColorStop(1, "rgba(2, 4, 8, 0.85)");
      ctx.fillStyle = floor;
      ctx.fillRect(0, height * 0.55, width, height * 0.45);
    };

    /** Re-renders the blurred copies at the new hero size. */
    const buildBank = () => {
      bank.clear();
      unit = height;
      if (!unit || sprites.size === 0) return;
      for (const coin of COINS) {
        // Every sprite is rendered at the size of its largest coin at this
        // depth, so a shelf of pre-blurred copies covers all of the coins.
        const px = Math.max(
          ...COINS.filter((c) => c.depth === coin.depth).map((c) => c.size * unit),
        );
        for (const url of spriteUrls(coin.face)) {
          const image = sprites.get(url);
          if (!image) continue;
          const key = bankKey(url, coin.depth);
          if (!bank.has(key)) bank.set(key, spriteBank(image, coin.depth, px));
        }
      }
    };

    /**
     * Position of a coin at loop time `t`, in canvas pixels: one-directional
     * lanes (the coin slides in from one edge and out the other, the `offset`
     * staggering co-lane coins so they never share a slot), a vertical bob, and
     * a slow turn in plan. Each term is a whole number of excursions per loop,
     * so frame N flows into frame 0 with no cut.
     */
    const place = (coin: Coin, t: number): [number, number, number, number] => {
      const size = coin.size * unit;
      const sizeFrac = coin.size / Math.min(1, width / height);
      const span = 1 + sizeFrac + 0.1;
      const speed = coin.speed * PARALLAX[coin.depth];
      const p = (((t * speed + coin.offset) % 1) + 1) % 1;
      const direction = Math.sign(coin.speed) || 1;
      const a = (p * span - sizeFrac * 0.5) * width;
      const x = direction > 0 ? a : width - a;
      const y = (coin.y + Math.sin((t * coin.bob + coin.phase) * TAU) * coin.bobAmp) * height;
      const angle = ((coin.tilt + t * coin.roll) * Math.PI) / 180;
      return [x, y, size, angle];
    };

    const paint = (t: number) => {
      if (plate) context.drawImage(plate, 0, 0);
      else {
        context.fillStyle = "#0a0f1c";
        context.fillRect(0, 0, width, height);
      }
      if (!unit) return;

      // One `filter` assignment for the whole pass rather than per coin: it is
      // constant text, so the compositor resolves it once. The tint keeps the
      // grey sprites reading as minted metal against the navy field instead of
      // as pale discs.
      context.filter = COIN_FILTER;

      // Pass one: a soft contact shadow that travels with each near coin. It is
      // what stops the sprites reading as decals pasted on the still — the coin
      // casts light down onto the field and sits in front of it.
      for (const coin of COINS) {
        if (coin.depth !== 2) continue;
        const [x, y, size, angle] = place(coin, t);
        context.save();
        context.translate(x + size * 0.16, y + size * 0.22);
        context.rotate(angle);
        context.globalAlpha = coin.alpha * 0.3;
        context.fillStyle = "#01030a";
        context.filter = "blur(10px)";
        context.beginPath();
        context.ellipse(0, 0, size * 0.36, size * 0.3, 0, 0, TAU);
        context.fill();
        context.restore();
        context.filter = COIN_FILTER;
      }

      // Pass two: the coins themselves, painting back-to-front so near coins
      // always sit over far ones.
      for (const coin of [...COINS].sort((a, b) => a.depth - b.depth)) {
        // A coin is only ever shown on one of its faces, so its `back` sprite
        // is the same design seen from behind.
        const back = coin.face.includes("front");
        const turn = (t * coin.spin + coin.flip) % 1;
        const facing = Math.abs(Math.cos(turn * TAU));
        const url =
          back && Math.cos(turn * TAU) < 0
            ? spriteUrl(coin.face.replace("front", "back"))
            : spriteUrl(coin.face);
        const sprite = bank.get(bankKey(url, coin.depth));
        if (!sprite) continue;

        const [x, y, size, angle] = place(coin, t);

        // Floor the squash so an edge-on coin is a readable sliver rather than
        // a vanished line, and let that sliver dim slightly as it turns.
        const squash = Math.max(0.06, facing);
        context.globalAlpha = coin.alpha * (0.72 + 0.28 * facing);
        // The pre-blurred sprites carry a transparent margin; draw the whole
        // artefact rather than re-centring its nominal size over the outline.
        const box = sprite instanceof HTMLCanvasElement ? sprite.width : size;
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.drawImage(sprite, (-box * squash) / 2, -box / 2, box * squash, box);
        context.restore();
      }
      context.globalAlpha = 1;
      context.filter = "none";
    };

    const render = (now: number) => {
      frame = 0;
      const t = ((((now - started) / 1000 / LOOP_SECONDS) % 1) + 1) % 1;
      paint(t);
      frame = requestAnimationFrame(render);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // The plate is a soft-focus still and every coin is pre-blurred by its
      // depth, so drawing at device resolution is what makes the motion read
      // as smooth rather than as a low-res canvas being upscaled.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextWidth = Math.max(1, Math.round(rect.width * dpr));
      const nextHeight = Math.max(1, Math.round(rect.height * dpr));
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      return true;
    };

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = media.matches;

    const start = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (reduced || document.visibilityState === "hidden") {
        paint((performance.now() - started) / 1000 / LOOP_SECONDS);
        return;
      }
      frame = requestAnimationFrame(render);
    };

    const onMotionChange = () => {
      reduced = media.matches;
      start();
    };
    const onVisibility = () => start();

    resize();
    buildPlate();
    paint(0);

    const urls = Array.from(new Set(COINS.flatMap((coin) => spriteUrls(coin.face))));
    void Promise.all(urls.map(load)).then((coinImages) => {
      if (disposed) return;
      urls.forEach((url, index) => {
        const image = coinImages[index];
        if (image) sprites.set(url, image);
      });
      buildBank();
      paint(0);
      readyRef.current?.();
      start();
    });

    const observer = new ResizeObserver(() => {
      if (!resize()) return;
      buildPlate();
      buildBank();
      if (!reduced) return;
      paint((performance.now() - started) / 1000 / LOOP_SECONDS);
    });
    observer.observe(canvas);
    media.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
