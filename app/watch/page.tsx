import { ReadingStudio } from "../../components/ReadingStudio";

export const metadata = {
  title: "Watch preview",
  description:
    "Round 198px preview of the Cosmic Arcana 3D reading scene. Not a native watch app. Platforms are not chosen yet.",
};

export default function WatchPage() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#05010d] p-8">
      <h1 className="text-2xl font-semibold text-[#f5f3ff]">Watch preview</h1>
      <p className="max-w-md text-center text-sm text-[#e4e4e7]">
        Preview only. Watch platforms are not chosen yet. This is the same 3D scene clipped to a
        round 198px face.
      </p>
      <div
        className="relative h-[242px] w-[198px] overflow-hidden rounded-[42px] border border-amber-200/40 bg-black shadow-[0_0_40px_#7c3aed55]"
        data-testid="watch-bezel"
      >
        <div className="absolute inset-[6px] h-[186px] w-[186px] overflow-hidden rounded-full bg-[#05010d]">
          <ReadingStudio compact />
        </div>
      </div>
      <a href="/" className="text-sm font-medium text-amber-100 underline underline-offset-4">
        Back to reading
      </a>
    </main>
  );
}
