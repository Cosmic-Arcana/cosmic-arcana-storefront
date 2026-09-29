"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import { MathUtils, type Group } from "three";

export type SceneCard = {
  positionKey: string;
  cardId: string;
  reversed: boolean;
};

type ArcanaSceneProps = {
  cards: SceneCard[];
  liveCards?: SceneCard[];
  compact?: boolean;
};

const GOLD = "#f5d36c";
const FACE = "#c4b5fd";
const BACK = "#4c1d95";
const LIVE = "#67e8f9";

function PointerRig({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  const target = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    target.current.x = MathUtils.lerp(target.current.x, state.pointer.x, 0.12);
    target.current.y = MathUtils.lerp(target.current.y, state.pointer.y, 0.12);
    if (!group.current) {
      return;
    }
    const { x, y } = target.current;
    group.current.rotation.x = y * 0.42;
    group.current.rotation.y = x * 0.55;
    group.current.rotation.z = x * y * 0.22;
  });

  return <group ref={group}>{children}</group>;
}

function CardMesh({
  color,
  reversed,
}: {
  color: string;
  reversed: boolean;
}) {
  return (
    <mesh rotation={[reversed ? Math.PI : 0, 0.15, 0]}>
      <boxGeometry args={[1.35, 2.15, 0.1]} />
      <meshBasicMaterial color={color} />
      <mesh position={[0, 0.72, 0.055]}>
        <boxGeometry args={[0.85, 0.1, 0.02]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
      <mesh position={[0, -0.72, 0.055]}>
        <boxGeometry args={[0.85, 0.1, 0.02]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
    </mesh>
  );
}

function TarotSlab({
  card,
  index,
  count,
  live,
}: {
  card: SceneCard;
  index: number;
  count: number;
  live?: boolean;
}) {
  const spread = count === 1 ? 0 : (index - (count - 1) / 2) * 1.7;
  const lift = live ? 1.15 : 0;
  return (
    <group position={[spread, lift, live ? -0.6 : 0]} rotation={[0, 0, count === 1 ? 0 : (index - (count - 1) / 2) * 0.12]}>
      <CardMesh color={live ? LIVE : FACE} reversed={card.reversed} />
    </group>
  );
}

function EmptyDeck() {
  return (
    <group>
      <CardMesh color={FACE} reversed={false} />
      <mesh position={[0, 0, -0.18]} rotation={[0, 0.2, 0.05]}>
        <boxGeometry args={[1.35, 2.15, 0.1]} />
        <meshBasicMaterial color={BACK} />
      </mesh>
    </group>
  );
}

export function ArcanaScene({ cards, liveCards = [], compact = false }: ArcanaSceneProps) {
  const shown = useMemo(() => cards.slice(0, 3), [cards]);
  const live = useMemo(() => liveCards.slice(-8), [liveCards]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.2, compact ? 4.4 : 5], fov: compact ? 48 : 40 }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      style={{ width: "100%", height: "100%", background: "#16082a" }}
    >
      <color attach="background" args={["#16082a"]} />
      <ambientLight intensity={1} />
      <PointerRig>
        {shown.length === 0 ? <EmptyDeck /> : null}
        {shown.map((card, index) => (
          <TarotSlab key={`own-${card.positionKey}-${card.cardId}`} card={card} index={index} count={shown.length} />
        ))}
        {live.map((card, index) => (
          <TarotSlab
            key={`live-${card.positionKey}-${card.cardId}-${index}`}
            card={card}
            index={index}
            count={live.length}
            live
          />
        ))}
      </PointerRig>
    </Canvas>
  );
}
