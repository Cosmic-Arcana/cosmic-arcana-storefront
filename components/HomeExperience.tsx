"use client";

import { useState } from "react";
import type { SpreadDetailsV1 } from "@cosmic-arcana/sdk";

import { ReadingStudio } from "./ReadingStudio";
import { UnderTheHood } from "./UnderTheHood";

export function HomeExperience() {
  const [spread, setSpread] = useState<SpreadDetailsV1 | null>(null);

  return (
    <>
      <main id="main">
        <ReadingStudio onSpreadChange={setSpread} />
      </main>
      <UnderTheHood spreadJson={spread} />
    </>
  );
}
