"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { greatCirclePoints, latLonToVector3 } from "@/lib/globe/geo";
import {
  GLOBE_KIND_COLOR,
  GLOBE_KIND_DASHED,
  type GlobeTransfer,
} from "@/lib/globe/transactions";

import { makeGlowTexture, makeRingTexture } from "./assets";

const SURFACE_RADIUS = 1.003;

interface Route {
  transfer: GlobeTransfer;
  points: THREE.Vector3[];
  geometry: THREE.BufferGeometry;
  color: THREE.Color;
  /** Seconds to traverse the route. */
  duration: number;
  /** Seconds before the next traversal starts. */
  cycle: number;
  offset: number;
  length: number;
}

function seeded(index: number, salt = 1): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * A flat ribbon that follows the arc. Building it ourselves (rather than a
 * tube) keeps the route one continuous stroke above the surface and lets the
 * dash pattern break the geometry where the flow is a structuring or loop
 * signal.
 */
function buildRibbonGeometry(points: THREE.Vector3[], width: number, dashed: boolean): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const previous = new THREE.Vector3();
  const next = new THREE.Vector3();

  points.forEach((point, index) => {
    previous.copy(points[Math.max(0, index - 1)]!);
    next.copy(points[Math.min(points.length - 1, index + 1)]!);
    tangent.copy(next).sub(previous);
    side.copy(point).normalize().cross(tangent).normalize();

    const taper = 0.35 + 0.65 * Math.sin(Math.PI * (index / (points.length - 1)));
    const halfWidth = width * taper;
    positions.push(
      point.x - side.x * halfWidth,
      point.y - side.y * halfWidth,
      point.z - side.z * halfWidth,
      point.x + side.x * halfWidth,
      point.y + side.y * halfWidth,
      point.z + side.z * halfWidth,
    );
  });

  for (let index = 0; index < points.length - 1; index += 1) {
    const visible = !dashed || index % 9 < 6;
    if (!visible) continue;
    const base = index * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function buildRoutes(transfers: GlobeTransfer[]): Route[] {
  return transfers.map((transfer, index) => {
    const points = greatCirclePoints(transfer.from, transfer.to, {
      radius: 1.006,
      segments: 96,
      minLift: 0.022,
      maxLift: 0.24,
    });

    let length = 0;
    for (let i = 1; i < points.length; i += 1) {
      length += points[i]!.distanceTo(points[i - 1]!);
    }

    return {
      transfer,
      points,
      geometry: buildRibbonGeometry(points, 0.0032, GLOBE_KIND_DASHED[transfer.kind]),
      color: new THREE.Color(GLOBE_KIND_COLOR[transfer.kind]),
      duration: 3.4 + Math.min(2.8, length * 1.2),
      cycle: 6.2 + Math.min(4.4, length * 1.6) + seeded(index, 2) * 2.4,
      offset: seeded(index, 5) * 7.5,
      length,
    };
  });
}

function sampleRoute(points: THREE.Vector3[], progress: number, target: THREE.Vector3): THREE.Vector3 {
  const scaled = progress * (points.length - 1);
  const index = Math.min(points.length - 2, Math.max(0, Math.floor(scaled)));
  const t = scaled - index;
  return target.copy(points[index]!).lerp(points[index + 1]!, t);
}

interface TransactionLayerProps {
  transfers: GlobeTransfer[];
  /** Route and flow ids that should stay bright while the rest recede. */
  activeIds: string[];
  onSelect: (id: string) => void;
}

export function TransactionLayer({ transfers, activeIds, onSelect }: TransactionLayerProps) {
  const routes = React.useMemo(() => buildRoutes(transfers), [transfers]);
  const glow = React.useMemo(() => makeGlowTexture(), []);
  const ring = React.useMemo(() => makeRingTexture(), []);

  React.useEffect(
    () => () => {
      routes.forEach((route) => route.geometry.dispose());
      glow.dispose();
      ring.dispose();
    },
    [routes, glow, ring],
  );

  const hasActive = activeIds.length > 0;

  const markers = React.useMemo(() => {
    const map = new Map<
      string,
      { point: THREE.Vector3; kind: GlobeTransfer["kind"]; transferId: string; count: number }
    >();

    for (const route of routes) {
      const { transfer } = route;
      const locations: Array<{ coords: GlobeTransfer["from"]; transferId: string }> = [
        { coords: transfer.from, transferId: transfer.id },
        { coords: transfer.to, transferId: transfer.id },
      ];
      for (const location of locations) {
        const key = `${location.coords.lat.toFixed(2)}:${location.coords.lon.toFixed(2)}`;
        const existing = map.get(key);
        const severity = (kind: GlobeTransfer["kind"]) =>
          kind === "corridor" || kind === "circular" ? 3 : kind === "structuring" || kind === "elevated" ? 2 : 1;
        if (existing) {
          existing.count += 1;
          if (severity(transfer.kind) > severity(existing.kind)) existing.kind = transfer.kind;
        } else {
          map.set(key, {
            point: latLonToVector3(location.coords.lat, location.coords.lon, 1.012),
            kind: transfer.kind,
            transferId: transfer.id,
            count: 1,
          });
        }
      }
    }

    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [routes]);

  return (
    <group>
      {routes.map((route) => {
        const active = activeIds.includes(route.transfer.id);
        const dimmed = hasActive && !active;
        return (
          <ViewPath
            key={route.transfer.id}
            route={route}
            glow={glow}
            ring={ring}
            active={active}
            dimmed={dimmed}
            visible={!dimmed}
            onSelect={onSelect}
          />
        );
      })}

      {markers.map((marker) => {
        const belongs = routes.some(
          (route) =>
            activeIds.includes(route.transfer.id) &&
            (latLonToVector3(route.transfer.from.lat, route.transfer.from.lon).distanceTo(marker.point) < 0.02 ||
              latLonToVector3(route.transfer.to.lat, route.transfer.to.lon).distanceTo(marker.point) < 0.02),
        );
        return (
          <sprite
            key={marker.key}
            position={marker.point}
            scale={belongs ? 0.05 : marker.kind === "cleared" ? 0.018 : 0.026}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(marker.transferId);
            }}
            onPointerOver={() => {
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "";
            }}
          >
            <spriteMaterial
              map={glow}
              color={GLOBE_KIND_COLOR[marker.kind]}
              transparent
              opacity={belongs ? 0.95 : 0.78}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        );
      })}
    </group>
  );
}

function ViewPath({
  route,
  glow,
  ring,
  active,
  dimmed,
  visible,
  onSelect,
}: {
  route: Route;
  glow: THREE.Texture;
  ring: THREE.Texture;
  active: boolean;
  dimmed: boolean;
  visible: boolean;
  onSelect: (id: string) => void;
}) {
  const particle = React.useRef<THREE.Sprite>(null);
  const pulse = React.useRef<THREE.Sprite>(null);
  const destination = React.useMemo(
    () => latLonToVector3(route.transfer.to.lat, route.transfer.to.lon, SURFACE_RADIUS + 0.006),
    [route],
  );
  const position = React.useMemo(() => new THREE.Vector3(), []);
  const previousProgress = React.useRef(0);
  const pulseStart = React.useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (!particle.current || !pulse.current) return;

    if (!visible) {
      particle.current.visible = false;
      pulse.current.visible = false;
      return;
    }

    const elapsed = clock.getElapsedTime();
    const local = (elapsed + route.offset) % route.cycle;

    if (local <= route.duration) {
      const progress = local / route.duration;
      sampleRoute(route.points, progress, position);
      particle.current.position.copy(position);
      particle.current.visible = true;
      const fade = Math.min(1, progress / 0.06) * Math.min(1, (1 - progress) / 0.06);
      const material = particle.current.material as THREE.SpriteMaterial;
      material.opacity = (active ? 1 : 0.9) * Math.max(0.15, fade);
      const scale = active ? 0.062 : 0.04;
      particle.current.scale.setScalar(scale);
    } else {
      particle.current.visible = false;
    }

    if (previousProgress.current < 1 && local / Math.max(route.duration, 0.001) >= 1) {
      pulseStart.current = elapsed;
    }
    previousProgress.current = Math.min(1, local / route.duration);

    if (pulseStart.current === null) {
      pulse.current.visible = false;
      return;
    }

    const age = elapsed - pulseStart.current;
    if (age > 1.25) {
      pulseStart.current = null;
      pulse.current.visible = false;
      return;
    }

    const t = age / 1.25;
    pulse.current.visible = true;
    pulse.current.position.copy(destination);
    pulse.current.scale.setScalar(0.03 + t * 0.13);
    const material = pulse.current.material as THREE.SpriteMaterial;
    material.opacity = (1 - t) * 0.75;
  });

  return (
    <group>
      <mesh
        geometry={route.geometry}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(route.transfer.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <meshBasicMaterial
          color={route.color}
          transparent
          opacity={dimmed ? 0.08 : active ? 0.95 : 0.72}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      <sprite ref={particle} visible={false} raycast={() => null}>
        <spriteMaterial
          map={glow}
          color={route.color}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      <sprite ref={pulse} visible={false} raycast={() => null}>
        <spriteMaterial
          map={ring}
          color={route.color}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}
