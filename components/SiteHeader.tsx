import Link from "next/link";

const links = [
  { href: "/", label: "Reading" },
  { href: "/#under-the-hood", label: "Under the hood" },
  { href: "/watch", label: "Watch preview" },
  { href: "/agent", label: "Agent activity" },
  { href: "/login", label: "Sign in" },
] as const;

export function SiteHeader() {
  return (
    <header
      data-testid="site-header"
      className="border-b border-violet-500/20 bg-[#0b0714] px-6 py-3"
    >
      <nav aria-label="Primary" className="mx-auto flex max-w-6xl flex-wrap gap-4 text-sm">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-amber-100 underline-offset-4 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
