"use client";

import * as React from "react";

import { HeroAmbient } from "@/components/marketing/hero-ambient";

/**
 * The landing hero's cinematic backdrop.
 *
 * Layered, bottom to top: a charcoal/blue-grey ambient plate with drifting
 * coins (canvas), then a palette tint and a left-weighted vignette. Nothing
 * here is interactive — the whole stack is pointer-transparent and sits under
 * the hero's z-10 content.
 *
 * The motion is drawn on a canvas rather than decoded from a clip. The old
 * video version paid for a per-frame compositor filter chain (`saturate`,
 * `brightness`, `contrast` on a morphing layer, a `mix-blend-mode: multiply`
 * tint over it, a 6 KB grain tile animated with `steps`) on top of a video
 * decode, which is why it stuttered against the WebGL globe. The canvas has no
 * filters and no blend modes; the tint and vignette are static gradients that
 * the compositor uploads once.
 *
 * Until the canvas fades in, the CSS plate underneath is the static field, so
 * the hero never flashes black. Reduced-motion visitors keep that plate with
 * no motion at all.
 */
export function HeroBackdrop() {
  const [ready, setReady] = React.useState(false);

  return (
    <div className="hero-backdrop" data-ready={ready ? "on" : "off"}>
      <div className="hero-backdrop__wash" />
      <div className="hero-backdrop__bloom" />
      <HeroAmbient className="hero-backdrop__canvas" onReady={() => setReady(true)} />
      <div className="hero-backdrop__tint" />
      <div className="hero-backdrop__vignette" />
    </div>
  );
}
