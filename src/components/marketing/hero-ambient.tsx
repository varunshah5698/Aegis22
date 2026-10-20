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
 * This draws it instead. A still of the scene is painted once into an
 * offscreen plate, then a handful of coins drift over it. Every coin's X and
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
  { face: "gold-front", aspect: 1, size: 0.3, speed: 0.58, offset: 0.04, y: 0.22, bob: 1, bobAmp: 0.075, phase: 0.0, spin: 1, flip: 0.1, roll: 8, tilt: -14, alpha: 0.95, depth: 2 },
  { face: "silver-front", aspect: 1, size: 0.2, speed: 0.62, offset: 0.46, y: 0.58, bob: 2, bobAmp: 0.062, phase: 0.4, spin: -1, flip: 0.55, roll: -12, tilt: 24, alpha: 0.86, depth: 2 },
  { face: "gold-left", aspect: 1, size: 0.15, speed: -0.54, offset: 0.7, y: 0.34, bob: 1, bobAmp: 0.07, phase: 0.7, spin: 2, flip: 0.3, roll: 14, tilt: 8, alpha: 0.8, depth: 2 },
  { face: "bimetal-right", aspect: 1, size: 0.12, speed: -0.6, offset: 0.22, y: 0.76, bob: 2, bobAmp: 0.058, phase: 0.15, spin: -2, flip: 0.75, roll: -10, tilt: -20, alpha: 0.72, depth: 2 },
  // Middle — the readable detail of the field.
  { face: "gold-right", aspect: 1, size: 0.19, speed: 0.3, offset: 0.1, y: 0.44, bob: 1, bobAmp: 0.05, phase: 0.3, spin: 1, flip: 0.42, roll: 6, tilt: 12, alpha: 0.9, depth: 1 },
  { face: "silver-front", aspect: 1, size: 0.15, speed: 0.28, offset: 0.58, y: 0.14, bob: 2, bobAmp: 0.045, phase: 0.62, spin: -1, flip: 0.2, roll: -8, tilt: -10, alpha: 0.78, depth: 1 },
  { face: "gold-front", aspect: 1, size: 0.13, speed: -0.32, offset: 0.36, y: 0.68, bob: 1, bobAmp: 0.048, phase: 0.85, spin: 2, flip: 0.6, roll: 10, tilt: 18, alpha: 0.74, depth: 1 },
  { face: "bimetal-right", aspect: 1, size: 0.11, speed: -0.26, offset: 0.8, y: 0.5, bob: 2, bobAmp: 0.042, phase: 0.08, spin: -2, flip: 0.9, roll: -12, tilt: -6, alpha: 0.7, depth: 1 },
  // Far — small, crisp, slow drift, so the depth order never inverts.
  { face: "gold-front", aspect: 1, size: 0.07, speed: 0.13, offset: 0.26, y: 0.86, bob: 1, bobAmp: 0.026, phase: 0.52, spin: 1, flip: 0.35, roll: 10, tilt: 6, alpha: 0.5, depth: 0 },
  { face: "gold-right", aspect: 1, size: 0.055, speed: 0.14, offset: 0.66, y: 0.08, bob: 2, bobAmp: 0.022, phase: 0.18, spin: -1, flip: 0.7, roll: -14, tilt: -16, alpha: 0.44, depth: 0 },
  { face: "silver-front", aspect: 1, size: 0.06, speed: -0.12, offset: 0.5, y: 0.3, bob: 1, bobAmp: 0.024, phase: 0.74, spin: 2, flip: 0.5, roll: 8, tilt: 20, alpha: 0.42, depth: 0 },
  { face: "bimetal-right", aspect: 1, size: 0.05, speed: -0.13, offset: 0.9, y: 0.62, bob: 3, bobAmp: 0.02, phase: 0.92, spin: -1, flip: 0.12, roll: -6, tilt: -22, alpha: 0.38, depth: 0 },
];

const BACKDROP_STILL = "/backdrop/hero-ambient-poster.jpg";
/** Coin sprites live here, named `<metal>-<view>.png`; `front` faces gain a `back`. */
const COIN_DIR = "/backdrop/coins";
const LOOP_SECONDS = 34;
const TAU = Math.PI * 2;

/** Shared by every coin layer so the string is parsed once. */
const COIN_FILTER = "brightness(1.5) saturate(1.14)";

/** Blur radii (in units of the crisp sprite's pixels) per depth level. */
const BLUR: Record<Coin["depth"], number> = { 0: 0, 1: 0.75, 2: 1.9 };

/**
 * How far each depth travels per loop, as a multiple of the agreed speed. Near
 * coins cover roughly twice the ground of far ones, which is the whole depth
 * cue; scaled here rather than re-authored per coin so a lane can never end up
 * with two coins of different rates.
 */
const PARALLAX: Record<Coin["depth"], number> = { 0: 0.55, 1: 0.9, 2: 1.35 };

/**
 * Draws `image` into a fresh canvas at `px` size. `blur` is expressed in
 * sprite pixels: the sprite is drawn three times, each pass halved in alpha,
 * offset by the radius — a cheap Gaussian that costs nothing per frame
 * because it happens once, here. Without tracking the scale, a retina screen
 * would silently turn "blur 0.6px" into a sharp coin, so the radius is scaled
 * with the sprite.
 */
function spriteBank(image: HTMLImageElement, depth: Coin["depth"], maxPx: number) {
  const px = Math.max(4, Math.round(maxPx));
  const radius = BLUR[depth] * 2; // source sprites are authored at 2x
  if (radius < 0.75) return image;

  const size = Math.ceil(px + radius * 4);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;

  // Nine taps in a spiral read as a gaussian at these radii and keep the
  // cost of loading imperceptible.
  const passes: Array<[number, number, number]> = [
    [0, 0, 0.2],
    [-radius, 0, 0.14], [radius, 0, 0.14], [0, -radius, 0.14], [0, radius, 0.14],
    [-radius * 0.7, -radius * 0.7, 0.06], [radius * 0.7, -radius * 0.7, 0.06],
    [-radius * 0.7, radius * 0.7, 0.06], [radius * 0.7, radius * 0.7, 0.06],
  ];
  const inset = radius * 2;
  for (const [dx, dy, alpha] of passes) {
    ctx.globalAlpha = alpha * 5;
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

    /** Paints the still into an offscreen plate at the current DPR. */
    const buildPlate = (still: HTMLImageElement | null) => {
      plate = document.createElement("canvas");
      plate.width = width;
      plate.height = height;
      const ctx = plate.getContext("2d");
      if (!ctx) return;
      if (!still) {
        ctx.fillStyle = "#0a0f1c";
        ctx.fillRect(0, 0, width, height);
        return;
      }
      // Cover-fit so the plate always fills the hero without stretching.
      const scale = Math.max(width / still.naturalWidth, height / still.naturalHeight);
      const w = still.naturalWidth * scale;
      const h = still.naturalHeight * scale;
      ctx.drawImage(still, (width - w) / 2, (height - h) / 2, w, h);
    };

    /** Re-renders the blurred copies at the new hero size. */
    const buildBank = () => {
      bank.clear();
      unit = height;
      for (const coin of COINS) {
        const image = sprites.get(coin.face);
        if (!image) continue;
        const px = coin.size * unit;
        // Biggest the coin ever gets on screen is edge-on, at its full height,
        // so the crisp sprite only needs room for that.
        const key = `${coin.face}#${coin.depth}`;
        if (!bank.has(key)) bank.set(key, spriteBank(image, coin.depth, px * 2));
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
      const p = ((((t * speed + coin.offset) % 1) + 1) % 1);
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
      // constant text, so the compositor resolves it once, and the coins keep
      // the metal read that the tint layered above them would otherwise take
      // away. (The sphere sprites they replaced lost about half their
      // luminance under that tint and read as dust rather than money.)
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
        const src = back && Math.cos(turn * TAU) < 0 ? `${coin.face.replace("front", "back")}#${coin.depth}` : `${coin.face}#${coin.depth}`;
        const sprite = bank.get(src);
        if (!sprite) continue;

        const [x, y, size, angle] = place(coin, t);

        // Floor the squash so an edge-on coin is a readable sliver rather than
        // a vanished line, and let that sliver dim slightly as it turns.
        const squash = Math.max(0.06, facing);
        context.globalAlpha = coin.alpha * (0.72 + 0.28 * facing);
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.drawImage(sprite, -size * squash * 0.5, -size * 0.5, size * squash, size);
        context.restore();
      }
      context.globalAlpha = 1;
      context.filter = "none";
    };

    const render = (now: number) => {
      frame = 0;
      const t = (((now - started) / 1000 / LOOP_SECONDS) % 1 + 1) % 1;
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
    paint(0);

    const urls = Array.from(
      new Set(
        COINS.flatMap((coin) =>
          coin.face.includes("front")
            ? [coin.face, coin.face.replace("front", "back")]
            : [coin.face],
        ).map((face) => `${COIN_DIR}/${face}.png`),
      ),
    );
    void Promise.all([load(BACKDROP_STILL), ...urls.map(load)]).then((loaded) => {
      if (disposed) return;
      const [still, ...coinImages] = loaded;
      urls.forEach((url, index) => {
        const image = coinImages[index];
        if (image) sprites.set(url, image);
      });
      buildPlate(still);
      buildBank();
      paint(0);
      readyRef.current?.();
      start();
    });

    const observer = new ResizeObserver(() => {
      if (!resize()) return;
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
