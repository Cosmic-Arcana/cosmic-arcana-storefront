import { ReadingStudio } from "../../components/ReadingStudio";

export const metadata = {
  title: "Watch preview · Cosmic Arcana",
  description: "A round 198px frame for how a reading scene sits on a watch face. Not a native watch app.",
};

export default function WatchPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#05010d] p-8">
      <p className="max-w-md text-center text-sm text-zinc-400">
        Preview only. Watch platforms are not chosen yet. This is the same 3D scene clipped to a
        round 198px face.
      </p>
      <div className="relative h-[242px] w-[198px] overflow-hidden rounded-[42px] border border-amber-200/40 bg-black shadow-[0_0_40px_#7c3aed55]">
        <div className="absolute inset-[6px] h-[186px] w-[186px] overflow-hidden rounded-full bg-[#05010d]">
          <ReadingStudio compact />
        </div>
      </div>
      <a href="/" className="text-sm text-amber-200 hover:text-amber-100">
        Back to reading
      </a>
    </main>
  );
}
