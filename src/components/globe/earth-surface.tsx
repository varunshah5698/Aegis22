"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { makeCloudTexture, makeGlowTexture, makeStarField, type EarthTextures } from "./assets";

const EARTH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPositionW = worldPosition.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const EARTH_FRAGMENT = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uWater;
  uniform vec3 uSunDirection;
  uniform float uNightGain;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec3 normal = normalize(vNormalW);
    vec3 sunDirection = normalize(uSunDirection);
    vec3 viewDirection = normalize(cameraPosition - vPositionW);

    float sun = dot(normal, sunDirection);
    float daylight = smoothstep(-0.16, 0.34, sun);

    vec3 dayColor = texture2D(uDay, vUv).rgb;
    vec3 nightColor = texture2D(uNight, vUv).rgb;

    vec3 color = mix(nightColor * uNightGain, dayColor, daylight);

    // A narrow warm band at the terminator keeps the transition from reading
    // as a hard cut between two textures. Kept low so the limb does not turn
    // into a bright orange ring.
    float terminator = smoothstep(0.03, 0.12, daylight) * (1.0 - smoothstep(0.12, 0.26, daylight));
    color += vec3(0.34, 0.15, 0.04) * terminator * 0.12;

    // Gentle limb darkening: compresses the grazing-angle texture that would
    // otherwise read as a solid band around the silhouette.
    float limbShade = 0.34 + 0.66 * smoothstep(0.0, 0.68, max(dot(normal, viewDirection), 0.0));
    color *= limbShade;

    // Ocean specular. The water mask is white over water and black over land.
    float water = texture2D(uWater, vUv).r;
    vec3 halfVector = normalize(sunDirection + viewDirection);
    float specular = pow(max(dot(normal, halfVector), 0.0), 44.0);
    color += vec3(0.62, 0.8, 1.0) * specular * water * daylight * 0.85;

    // Blue limb: a restrained scattering hint rather than a bloom halo.
    float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
    color += vec3(0.18, 0.4, 0.76) * fresnel * 0.4;

    gl_FragColor = vec4(color, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const CLOUD_VERTEX = EARTH_VERTEX;

// Cloud cover comes from an animated texture baked once on the CPU (four
// octaves of 3D value noise on the GPU cost more than the rest of the planet
// combined on an integrated GPU). Two texture taps replace eight noise
// evaluations per pixel while the deck keeps drifting as a whole.
const CLOUD_FRAGMENT = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSunDirection;
  uniform float uOpacity;
  uniform float uDrift;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec3 normal = normalize(vNormalW);
    vec3 viewDirection = normalize(cameraPosition - vPositionW);
    vec3 sunDirection = normalize(uSunDirection);

    vec2 uv = vec2(vUv.x + uDrift, vUv.y);
    float bands = texture2D(uClouds, uv).r * 0.72 + texture2D(uClouds, uv * 2.3 + vec2(0.37, 0.11)).g * 0.28;
    float cover = smoothstep(0.56, 0.74, bands);

    float daylight = smoothstep(-0.2, 0.36, dot(normal, sunDirection));
    float limb = smoothstep(0.08, 0.5, dot(normal, viewDirection));

    float alpha = cover * limb * mix(0.09, 0.62, daylight) * uOpacity;
    if (alpha < 0.008) discard;

    vec3 tint = mix(vec3(0.34, 0.44, 0.6), vec3(1.0), daylight);
    gl_FragColor = vec4(tint, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPositionW = worldPosition.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uSunDirection;
  uniform vec3 uColor;

  varying vec3 vNormalW;
  varying vec3 vPositionW;

  void main() {
    vec3 normal = normalize(vNormalW);
    vec3 viewDirection = normalize(cameraPosition - vPositionW);
    float rim = pow(1.0 - abs(dot(normal, viewDirection)), 2.6);
    float sun = smoothstep(-0.45, 0.6, dot(-normal, normalize(uSunDirection)));
    gl_FragColor = vec4(uColor, rim * (0.12 + sun * 0.32));

    #include <colorspace_fragment>
  }
`;

export function EarthSurface({
  textures,
  sunDirection,
  reducedMotion,
  spin = 0,
}: {
  textures: EarthTextures;
  sunDirection: THREE.Vector3;
  reducedMotion: boolean;
  /**
   * Yaw of the whole planet, owned by the parent's spin group. The clouds and
   * atmosphere are counter-rotated by it, so weather drifts over the surface
   * instead of being welded to it.
   */
  spin?: number;
}) {
  const clouds = React.useMemo(() => makeCloudTexture(1024, 512), []);
  const cloudsRef = React.useRef<THREE.Mesh>(null);
  const atmosphereRef = React.useRef<THREE.Mesh>(null);
  const earthMaterial = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EARTH_VERTEX,
        fragmentShader: EARTH_FRAGMENT,
        uniforms: {
          uDay: { value: textures.day },
          uNight: { value: textures.night },
          uWater: { value: textures.water },
          uSunDirection: { value: sunDirection },
          uNightGain: { value: 1.3 },
        },
      }),
    // The sun vector is a stable instance; texture swaps are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const cloudMaterial = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CLOUD_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        uniforms: {
          uClouds: { value: clouds },
          uSunDirection: { value: sunDirection },
          uOpacity: { value: 0.9 },
          uDrift: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      }),
    // The sun vector is a stable instance; the cloud texture never changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  React.useEffect(() => {
    earthMaterial.uniforms.uDay!.value = textures.day;
    earthMaterial.uniforms.uNight!.value = textures.night;
    earthMaterial.uniforms.uWater!.value = textures.water;
  }, [earthMaterial, textures]);

  React.useEffect(
    () => () => {
      earthMaterial.dispose();
      cloudMaterial.dispose();
      clouds.dispose();
    },
    [earthMaterial, cloudMaterial, clouds],
  );

  // Drifting the texture (instead of rotating the sphere) keeps the cloud
  // shell static, so the deck can be baked into one seamless tile.
  useFrame((_, delta) => {
    if (reducedMotion) return;
    const drift = cloudMaterial.uniforms.uDrift!;
    drift.value = (drift.value as number) + delta * 0.0024;
    // Counter-yaw the shells every frame: `spin` is advanced inside the spin
    // group's own callback, so reading it as a prop here would lag a frame
    // behind and make the clouds shimmer against the coastline.
    if (cloudsRef.current) cloudsRef.current.rotation.y = -spin;
    if (atmosphereRef.current) atmosphereRef.current.rotation.y = -spin;
  });

  return (
    <group>
      {/* Raycast stays enabled so markers behind the planet cannot be hit. */}
      <mesh material={earthMaterial}>
        <sphereGeometry args={[1, 160, 96]} />
      </mesh>

      <mesh ref={cloudsRef} material={cloudMaterial} raycast={() => null}>
        <sphereGeometry args={[1.008, 96, 64]} />
      </mesh>

      <Atmosphere meshRef={atmosphereRef} sunDirection={sunDirection} />
    </group>
  );
}

export function Atmosphere({
  sunDirection,
  meshRef,
}: {
  sunDirection: THREE.Vector3;
  /** Optional; the caller counter-yaws it so the limb does not turn with the planet. */
  meshRef?: React.RefObject<THREE.Mesh | null> | undefined;
}) {
  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        uniforms: {
          uSunDirection: { value: sunDirection },
          uColor: { value: new THREE.Color("#4c86d8") },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  React.useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh ref={meshRef ?? null} material={material} raycast={() => null}>
      <sphereGeometry args={[1.042, 96, 64]} />
    </mesh>
  );
}

export function StarryBackdrop({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const group = React.useRef<THREE.Group>(null);
  const glow = React.useMemo(() => makeGlowTexture(), []);
  const field = React.useMemo(() => makeStarField(820), []);

  const geometry = React.useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(field.positions, 3));
    buffer.setAttribute("color", new THREE.BufferAttribute(field.colors, 3));
    return buffer;
  }, [field]);

  const material = React.useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.075,
        map: glow,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
      }),
    [glow],
  );

  React.useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      glow.dispose();
    },
    [geometry, material, glow],
  );

  // A very slow roll of the whole field. It is far enough away that a few
  // degrees per minute reads as parallax rather than as rotation, which is
  // what keeps the hero from freezing once the globe stops moving.
  useFrame((_, delta) => {
    if (reducedMotion || !group.current) return;
    group.current.rotation.y += delta * 0.004;
  });

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} raycast={() => null} frustumCulled={false} />
    </group>
  );
}
