"use client";

import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useEarthTextures, type EarthTextures, type EarthTextureStatus } from "./assets";
import { EarthSurface, StarryBackdrop } from "./earth-surface";
import { TransactionLayer } from "./transaction-layer";
import type { GlobeTransfer } from "@/lib/globe/transactions";
import { cn } from "@/lib/utils";

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const BASE_DISTANCE = 4.05;
const FOCUS_DISTANCE = 3.5;
const MIN_DISTANCE = 2.9;
const MAX_DISTANCE = 5;
const FOV = 36;
/**
 * Fraction of the visible half-height the planet is allowed to fill.
 *
 * The canvas is a rectangle, so a planet that fills the narrow dimension first
 * leaves hard edges where its disc meets the canvas border. At 0.9 the sphere
 * keeps a visible margin on every side at the closest zoom, which is also the
 * ceiling that keeps it from becoming a wall of texture that covers the page.
 */
const FIT_MARGIN = 0.9;
/** Unit sphere radius in world units (the surface mesh is r = 1). */
const GLOBE_RADIUS = 1;
const AXIAL_TILT = -23.44 * DEG;
const INITIAL_SPIN = -(62 + 90) * DEG;

/** Camera distance at which the sphere just fits the smaller canvas axis. */
function fitDistance(width: number, height: number): number {
  if (width <= 0 || height <= 0) return BASE_DISTANCE;
  const halfFov = (FOV * DEG) / 2;
  const vertical = GLOBE_RADIUS / Math.tan(halfFov);
  const horizontal = vertical / (width / height);
  return Math.max(vertical, horizontal) / FIT_MARGIN;
}

/**
 * Closest the camera may come. Never inside the fitted distance, so no zoom —
 * wheel, pinch or focus — can push the sphere past its own canvas and expose
 * the rectangular viewport edge.
 */
function minDistanceFor(width: number, height: number): number {
  return Math.max(MIN_DISTANCE, fitDistance(width, height));
}

const SUN_DIRECTION = new THREE.Vector3(-0.82, 0.36, 0.44).normalize();

export interface GlobeFocus {
  lat: number;
  lon: number;
}

export interface EarthGlobeProps {
  transfers: GlobeTransfer[];
  activeIds: string[];
  focus: GlobeFocus | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  className?: string;
}

/**
 * Interactive Earth.
 *
 * Rotation happens on the globe itself (a tilted spin group), so every arc,
 * marker and pulse is a child of the same coordinate space and stays pinned to
 * its geography. The camera only ever dollies, which keeps the planet centred
 * while drag and zoom feel like handling an object.
 */
export function EarthGlobe({ transfers, activeIds, focus, onSelect, onClear, className }: EarthGlobeProps) {
  const [visible, setVisible] = React.useState(true);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const textures = useEarthTextures();

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // Only a hidden tab stops the render loop: reduced motion freezes the
  // autonomous animation, but the globe must still respond to drag and zoom.
  const paused = !visible;

  return (
    <div className={cn("relative isolate h-full w-full overflow-hidden", className)} aria-hidden="true">
      <GlobeErrorBoundary>
        <Canvas
          camera={{ position: [0, 0.02, BASE_DISTANCE], fov: FOV, near: 0.1, far: 120 }}
          dpr={[1, 1.85]}
          frameloop={paused ? "demand" : "always"}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ touchAction: "none" }}
          onPointerMissed={onClear}
        >
          <GlobeScene
            transfers={transfers}
            activeIds={activeIds}
            focus={focus}
            onSelect={onSelect}
            textures={textures}
            reducedMotion={reducedMotion}
            paused={paused}
          />
        </Canvas>
      </GlobeErrorBoundary>

      <TextureNotice status={textures.status} />
    </div>
  );
}

class GlobeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full items-center justify-center px-6 text-center text-[11px] leading-5 text-white/45">
          This visualization needs WebGL, which is unavailable in this browser.
          <br />
          The transaction intelligence below remains available.
        </div>
      );
    }
    return this.props.children;
  }
}

function TextureNotice({ status }: { status: EarthTextureStatus }) {
  if (status === "loading" || status === "ready") return null;
  return (
    <p className="pointer-events-none absolute bottom-1 left-0 text-[9.5px] leading-4 text-white/32">
      {status === "failed"
        ? "Surface imagery unavailable — simplified planet shown."
        : "Some surface imagery could not load."}
    </p>
  );
}

function GlobeScene({
  transfers,
  activeIds,
  focus,
  onSelect,
  textures,
  reducedMotion,
  paused,
}: {
  transfers: GlobeTransfer[];
  activeIds: string[];
  focus: GlobeFocus | null;
  onSelect: (id: string) => void;
  textures: EarthTextures;
  reducedMotion: boolean;
  paused: boolean;
}) {
  const { gl, camera, size } = useThree();
  const spinRef = React.useRef(INITIAL_SPIN);
  const targetSpin = React.useRef(INITIAL_SPIN);
  const pitchRef = React.useRef(0.1);
  const targetPitch = React.useRef(0.1);
  const distanceRef = React.useRef(BASE_DISTANCE);
  const targetDistance = React.useRef(BASE_DISTANCE);
  const interacting = React.useRef(false);

  const spinGroup = React.useRef<THREE.Group>(null);
  const pitchGroup = React.useRef<THREE.Group>(null);

  // The canvas is a rectangle that resizes with the layout, so the zoom floor
  // is derived from it rather than hardcoded. Kept in a ref so the native
  // pointer listeners below read the current value without re-binding.
  const bounds = React.useRef({ min: MIN_DISTANCE, max: MAX_DISTANCE });
  React.useLayoutEffect(() => {
    bounds.current.min = minDistanceFor(size.width, size.height);
    targetDistance.current = Math.min(bounds.current.max, Math.max(bounds.current.min, targetDistance.current));
    distanceRef.current = Math.min(bounds.current.max, Math.max(bounds.current.min, distanceRef.current));
  }, [size.width, size.height]);

  React.useEffect(() => {
    if (!focus) {
      targetDistance.current = BASE_DISTANCE;
      return;
    }

    const desiredSpin = -(focus.lon + 90) * DEG;
    const nearest = desiredSpin + Math.round((spinRef.current - desiredSpin) / TWO_PI) * TWO_PI;
    targetSpin.current = nearest;
    targetPitch.current = Math.max(-0.5, Math.min(0.5, focus.lat * DEG));
    targetDistance.current = Math.max(bounds.current.min, FOCUS_DISTANCE);
  }, [focus]);

  // Pointer drag, pinch and wheel. Native listeners keep the gesture handling
  // identical over the globe, the arcs and empty space, and work on touch.
  React.useEffect(() => {
    const canvas = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart: { distance: number; gap: number } | null = null;

    const gapBetweenPointers = () => {
      const values = Array.from(pointers.values());
      if (values.length < 2) return 0;
      return Math.hypot(values[0]!.x - values[1]!.x, values[0]!.y - values[1]!.y);
    };

    const onPointerDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      interacting.current = true;
      if (pointers.size === 2) {
        pinchStart = { distance: targetDistance.current, gap: gapBetweenPointers() };
      }
      canvas.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size >= 2 && pinchStart) {
        const gap = gapBetweenPointers();
        if (gap > 0) {
          targetDistance.current = Math.min(
            bounds.current.max,
            Math.max(bounds.current.min, (pinchStart.distance * pinchStart.gap) / gap),
          );
        }
        return;
      }

      targetSpin.current += dx * 0.0072;
      targetPitch.current = Math.max(-0.5, Math.min(0.5, targetPitch.current + dy * 0.005));
    };

    const endPointer = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (pointers.size === 0) interacting.current = false;
      canvas.releasePointerCapture?.(event.pointerId);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetDistance.current = Math.min(
        bounds.current.max,
        Math.max(bounds.current.min, targetDistance.current + Math.sign(event.deltaY) * 0.16),
      );
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const smoothing = 1 - Math.exp(-5.2 * dt);

    // A resize can land between frames; clamp again here so neither the spring
    // nor a focus target can ever resolve to a distance inside the sphere.
    targetDistance.current = Math.min(bounds.current.max, Math.max(bounds.current.min, targetDistance.current));

    if (!paused && !interacting.current && !focus) {
      targetSpin.current += dt * 0.05;
    }

    spinRef.current += (targetSpin.current - spinRef.current) * smoothing;
    pitchRef.current += (targetPitch.current - pitchRef.current) * smoothing;
    distanceRef.current += (targetDistance.current - distanceRef.current) * smoothing;

    if (spinGroup.current) spinGroup.current.rotation.y = spinRef.current;
    if (pitchGroup.current) pitchGroup.current.rotation.x = pitchRef.current;
    camera.position.z = distanceRef.current;
  });

  return (
    <>
      <StarryBackdrop reducedMotion={reducedMotion} />

      <group ref={pitchGroup}>
        <group rotation={[0, 0, AXIAL_TILT]}>
          <group ref={spinGroup}>
            <EarthSurface
              textures={textures}
              sunDirection={SUN_DIRECTION}
              reducedMotion={reducedMotion}
              spin={paused ? 0 : spinRef.current}
            />
            <TransactionLayer transfers={transfers} activeIds={activeIds} onSelect={onSelect} />
          </group>
        </group>
      </group>
    </>
  );
}
