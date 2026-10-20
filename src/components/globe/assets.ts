"use client";

import * as React from "react";
import * as THREE from "three";

export type EarthTextureStatus = "loading" | "ready" | "partial" | "failed";

export interface EarthTextures {
  day: THREE.Texture;
  night: THREE.Texture;
  water: THREE.Texture;
  status: EarthTextureStatus;
}

function fallbackTexture(red: number, green: number, blue: number): THREE.DataTexture {
  const data = new Uint8Array([red, green, blue, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const EARTH_ASSETS = {
  day: "/textures/earth/earth-day-2k.jpg",
  night: "/textures/earth/earth-night-2k.jpg",
  water: "/textures/earth/earth-water-2k.png",
} as const;

/**
 * Loads Earth imagery by hand instead of with `useLoader` so a single missing
 * asset degrades to a plain ocean sphere instead of throwing away the whole
 * scene. Textures are disposed on unmount.
 */
export function useEarthTextures(): EarthTextures {
  const [textures, setTextures] = React.useState<EarthTextures>(() => ({
    day: fallbackTexture(11, 42, 67),
    night: fallbackTexture(0, 0, 0),
    water: fallbackTexture(0, 0, 0),
    status: "loading",
  }));

  React.useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const loaded: THREE.Texture[] = [];
    const fallbacks = [textures.day, textures.night, textures.water];

    const load = (url: string, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) =>
      new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          url,
          (texture) => {
            texture.colorSpace = colorSpace;
            texture.anisotropy = 8;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            loaded.push(texture);
            resolve(texture);
          },
          undefined,
          reject,
        );
      });

    Promise.allSettled([
      load(EARTH_ASSETS.day),
      load(EARTH_ASSETS.night),
      load(EARTH_ASSETS.water, THREE.NoColorSpace),
    ]).then(
      ([day, night, water]) => {
        if (cancelled) {
          loaded.forEach((texture) => texture.dispose());
          return;
        }
        const next: EarthTextures = {
          day: day.status === "fulfilled" ? day.value : textures.day,
          night: night.status === "fulfilled" ? night.value : textures.night,
          water: water.status === "fulfilled" ? water.value : textures.water,
          status:
            day.status === "fulfilled" && night.status === "fulfilled" && water.status === "fulfilled"
              ? "ready"
              : day.status === "fulfilled"
                ? "partial"
                : "failed",
        };
        setTextures(next);
      },
    );

    return () => {
      cancelled = true;
      loaded.forEach((texture) => texture.dispose());
      // The original 1×1 fallbacks are only disposed if they were replaced.
      fallbacks.forEach((texture) => {
        if (!loaded.includes(texture)) texture.dispose();
      });
    };
    // The effect owns its own loader; the initial fallback textures never change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return textures;
}

/** A soft radial sprite, used for particles, city markers and stars. */
export function makeGlowTexture(): THREE.Texture {
  return makeRadialTexture([
    [0, "rgba(255,255,255,1)"],
    [0.22, "rgba(255,255,255,0.85)"],
    [0.5, "rgba(255,255,255,0.24)"],
    [1, "rgba(255,255,255,0)"],
  ]);
}

/** A hollow ring, used for arrival pulses. */
export function makeRingTexture(): THREE.Texture {
  return makeRadialTexture([
    [0, "rgba(255,255,255,0)"],
    [0.55, "rgba(255,255,255,0)"],
    [0.72, "rgba(255,255,255,0.9)"],
    [0.86, "rgba(255,255,255,0.25)"],
    [1, "rgba(255,255,255,0)"],
  ]);
}

/**
 * A tileable cloud deck: four octaves of 3D value noise on a sphere, sampled
 * into the red channel (with a finer octave sum in green for the shader's
 * second tap) and wrapped horizontally so the deck drifts seamlessly.
 *
 * Baked once per mount (a few ms at 1024×512) so the shader can spend its
 * budget on the planet instead of per-pixel noise.
 */
export function makeCloudTexture(width = 1024, height = 512): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return fallbackTexture(128, 128, 128);

  const data = context.createImageData(width, height);
  const pixels = data.data;
  const TWO_PI = Math.PI * 2;

  for (let y = 0; y < height; y += 1) {
    const phi = (y / (height - 1)) * Math.PI;
    const sinPhi = Math.sin(phi);
    const ny = Math.cos(phi) * 3.1;
    for (let x = 0; x < width; x += 1) {
      const theta = (x / width) * TWO_PI;
      const nx = sinPhi * Math.cos(theta) * 3.1;
      const nz = sinPhi * Math.sin(theta) * 3.1;

      let coarse = 0;
      let fine = 0;
      let amplitude = 0.62;
      let frequency = 1;
      for (let octave = 0; octave < 4; octave += 1) {
        coarse += amplitude * valueNoise3(nx * frequency, ny * frequency, nz * frequency);
        amplitude *= 0.5;
        frequency *= 2.07;
      }
      fine = valueNoise3(nx * 5.4 + 4.2, ny * 5.4 - 1.7, nz * 5.4 + 2.9);

      const offset = (y * width + x) * 4;
      pixels[offset] = Math.round(Math.min(1, Math.max(0, coarse)) * 255);
      pixels[offset + 1] = Math.round(Math.min(1, Math.max(0, fine)) * 255);
      pixels[offset + 2] = 0;
      pixels[offset + 3] = 255;
    }
  }

  context.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function hash3(x: number, y: number, z: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise3(x: number, y: number, z: number): number {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const cz = Math.floor(z);
  const fx = smooth(x - cx);
  const fy = smooth(y - cy);
  const fz = smooth(z - cz);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const x00 = lerp(hash3(cx, cy, cz), hash3(cx + 1, cy, cz), fx);
  const x10 = lerp(hash3(cx, cy + 1, cz), hash3(cx + 1, cy + 1, cz), fx);
  const x01 = lerp(hash3(cx, cy, cz + 1), hash3(cx + 1, cy, cz + 1), fx);
  const x11 = lerp(hash3(cx, cy + 1, cz + 1), hash3(cx + 1, cy + 1, cz + 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

function makeRadialTexture(stops: Array<[number, string]>): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return fallbackTexture(255, 255, 255);

  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function disposeObject3D(root: THREE.Object3D | null): void {
  root?.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Sprite)) {
      return;
    }
    child.geometry?.dispose();
    const material = child.material;
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => entry?.dispose());
  });
}

export type StarField = {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
};

/** Deterministic star field so the backdrop is stable between renders. */
export function makeStarField(count = 760): StarField {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  let seed = 0x9e3779b9;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let index = 0; index < count; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const radius = 11 + random() * 26;
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const warmth = random();
    const brightness = 0.35 + random() * 0.65;
    colors[index * 3] = brightness * (0.86 + warmth * 0.14);
    colors[index * 3 + 1] = brightness * 0.9;
    colors[index * 3 + 2] = brightness * (1 - warmth * 0.1);
    sizes[index] = 0.035 + Math.pow(random(), 3) * 0.12;
  }

  return { positions, colors, sizes };
}
