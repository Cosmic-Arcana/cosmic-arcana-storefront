"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import { MathUtils, type Group, type Mesh } from "three";

import type { GraphicsCapability, GraphicsMode } from "../lib/graphics-capability";

export type SceneCard = {
  positionKey: string;
  cardId: string;
  reversed: boolean;
};

type Palette = {
  gold: string;
  face: string;
  back: string;
  live: string;
  sky: string;
};

const PALETTES: Record<GraphicsMode, Palette> = {
  light: {
    gold: "#b45309",
    face: "#fde68a",
    back: "#e0f2fe",
    live: "#38bdf8",
    sky: "#f8fafc",
  },
  medium: {
    gold: "#f5d36c",
    face: "#c4b5fd",
    back: "#4c1d95",
    live: "#67e8f9",
    sky: "#16082a",
  },
  heavy: {
    gold: "#fb7185",
    face: "#c026d3",
    back: "#1e1b4b",
    live: "#22d3ee",
    sky: "#020617",
  },
};

const MOTION: Record<GraphicsMode, { lerp: number; tilt: number; spin: number; dpr: number }> = {
  light: { lerp: 0.06, tilt: 0.16, spin: 0, dpr: 1 },
  medium: { lerp: 0.12, tilt: 0.42, spin: 0.12, dpr: 1.25 },
  heavy: { lerp: 0.2, tilt: 0.72, spin: 0.55, dpr: 1.75 },
};

type ArcanaSceneProps = {
  cards: SceneCard[];
  liveCards?: SceneCard[];
  compact?: boolean;
  mode: GraphicsMode;
  capability: GraphicsCapability | null;
};

function PointerRig({ children, mode }: { children: ReactNode; mode: GraphicsMode }) {
  const group = useRef<Group>(null);
  const target = useRef({ x: 0, y: 0 });
  const motion = MOTION[mode];

  useFrame((state) => {
    target.current.x = MathUtils.lerp(target.current.x, state.pointer.x, motion.lerp);
    target.current.y = MathUtils.lerp(target.current.y, state.pointer.y, motion.lerp);
    if (!group.current) {
      return;
    }
    const { x, y } = target.current;
    group.current.rotation.x = y * motion.tilt;
    group.current.rotation.y = x * motion.tilt * 1.2;
    group.current.rotation.z = x * y * motion.tilt * 0.5;
  });

  return <group ref={group}>{children}</group>;
}

function CardMesh({
  color,
  gold,
  reversed,
  spin,
}: {
  color: string;
  gold: string;
  reversed: boolean;
  spin: number;
}) {
  const mesh = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (mesh.current && spin > 0) {
      mesh.current.rotation.y += delta * spin;
    }
  });
  return (
    <mesh ref={mesh} rotation={[reversed ? Math.PI : 0, 0.15, 0]}>
      <boxGeometry args={[1.35, 2.15, 0.1]} />
      <meshBasicMaterial color={color} />
      <mesh position={[0, 0.72, 0.055]}>
        <boxGeometry args={[0.85, 0.1, 0.02]} />
        <meshBasicMaterial color={gold} />
      </mesh>
      <mesh position={[0, -0.72, 0.055]}>
        <boxGeometry args={[0.85, 0.1, 0.02]} />
        <meshBasicMaterial color={gold} />
      </mesh>
    </mesh>
  );
}

function TarotSlab({
  card,
  index,
  count,
  live,
  palette,
  mode,
}: {
  card: SceneCard;
  index: number;
  count: number;
  live?: boolean;
  palette: Palette;
  mode: GraphicsMode;
}) {
  const spread = count === 1 ? 0 : (index - (count - 1) / 2) * 1.7;
  const lift = live ? 1.15 : 0;
  return (
    <group
      position={[spread, lift, live ? -0.6 : 0]}
      rotation={[0, 0, count === 1 ? 0 : (index - (count - 1) / 2) * 0.12]}
    >
      <CardMesh
        color={live ? palette.live : palette.face}
        gold={palette.gold}
        reversed={card.reversed}
        spin={live ? 0 : MOTION[mode].spin}
      />
    </group>
  );
}

function EmptyDeck({ palette, mode }: { palette: Palette; mode: GraphicsMode }) {
  return (
    <group>
      <CardMesh color={palette.face} gold={palette.gold} reversed={false} spin={MOTION[mode].spin} />
      <mesh position={[0, 0, -0.18]} rotation={[0, 0.2, 0.05]}>
        <boxGeometry args={[1.35, 2.15, 0.1]} />
        <meshBasicMaterial color={palette.back} />
      </mesh>
    </group>
  );
}

function CssDeck({
  cards,
  liveCards,
  palette,
}: {
  cards: SceneCard[];
  liveCards: SceneCard[];
  palette: Palette;
}) {
  const shown =
    cards.length === 0
      ? [{ positionKey: "empty", cardId: "deck", reversed: false }]
      : cards.slice(0, 3);
  return (
    <div
      data-scene="css"
      className="flex h-full items-center justify-center gap-3"
      style={{ background: palette.sky }}
    >
      {shown.map((card) => (
        <div
          key={`${card.positionKey}-${card.cardId}`}
          data-card-id={card.cardId}
          className="flex h-40 w-24 items-center justify-center rounded-lg border text-center text-xs"
          style={{
            borderColor: palette.gold,
            background: palette.face,
            color: "#0b0714",
          }}
        >
          {card.cardId}
        </div>
      ))}
      {liveCards.slice(-3).map((card, index) => (
        <div
          key={`live-${card.cardId}-${index}`}
          data-live-card={card.cardId}
          className="flex h-28 w-16 items-center justify-center rounded-lg border text-center text-[10px]"
          style={{ borderColor: palette.live, background: palette.back, color: palette.live }}
        >
          {card.cardId}
        </div>
      ))}
    </div>
  );
}

export function ArcanaScene({
  cards,
  liveCards = [],
  compact = false,
  mode,
  capability,
}: ArcanaSceneProps) {
  const shown = useMemo(() => cards.slice(0, 3), [cards]);
  const live = useMemo(() => liveCards.slice(-8), [liveCards]);
  const palette = PALETTES[mode];
  const allow3d = capability?.allow3d === true;

  if (!capability) {
    return <div className="h-full w-full" data-scene="pending" style={{ background: palette.sky }} />;
  }

  if (!allow3d) {
    return <CssDeck cards={shown} liveCards={live} palette={palette} />;
  }

  return (
    <Canvas
      dpr={[1, MOTION[mode].dpr]}
      camera={{ position: [0, 0.2, compact ? 4.4 : 5], fov: compact ? 48 : 40 }}
      gl={{ antialias: mode !== "light", alpha: false, preserveDrawingBuffer: true }}
      style={{ width: "100%", height: "100%", background: palette.sky }}
      onCreated={({ gl: renderer }) => {
        renderer.getContext().canvas.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
        });
      }}
    >
      <color attach="background" args={[palette.sky]} />
      <ambientLight intensity={1} />
      <PointerRig mode={mode}>
        {shown.length === 0 ? <EmptyDeck palette={palette} mode={mode} /> : null}
        {shown.map((card, index) => (
          <TarotSlab
            key={`own-${card.positionKey}-${card.cardId}`}
            card={card}
            index={index}
            count={shown.length}
            palette={palette}
            mode={mode}
          />
        ))}
        {live.map((card, index) => (
          <TarotSlab
            key={`live-${card.positionKey}-${card.cardId}-${index}`}
            card={card}
            index={index}
            count={live.length}
            live
            palette={palette}
            mode={mode}
          />
        ))}
      </PointerRig>
    </Canvas>
  );
}
