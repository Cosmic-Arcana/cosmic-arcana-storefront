import Link from "next/link";

import { auth0 } from "../lib/auth0";

export async function SiteHeader() {
  const session = await auth0.getSession().catch(() => null);
  const signedIn = Boolean(session?.user?.sub);

  const links = [
    { href: "/", label: "Reading" },
    { href: "/readings", label: "Saved" },
    { href: "/#under-the-hood", label: "Under the hood" },
    { href: "/watch", label: "Watch preview" },
    { href: "/agent", label: "Agent activity" },
    { href: "/privacy", label: "Privacy" },
    signedIn
      ? { href: "/auth/logout", label: "Sign out" }
      : { href: "/login", label: "Sign in" },
  ] as const;

  return (
    <header
      data-testid="site-header"
      className="border-b border-violet-500/20 bg-[#0b0714] px-6 py-3"
    >
      <nav aria-label="Primary" className="mx-auto flex max-w-6xl flex-wrap gap-4 text-sm">
        {links.map((link) =>
          // /auth/* are route handlers, not pages. A next/link to one is prefetched when it scrolls
          // into view, so in production the sign-out address would be requested on every page load
          // and end the session without a click. A plain anchor is only followed when clicked.
          link.href.startsWith("/auth/") ? (
            <a
              key={link.href}
              href={link.href}
              className="text-amber-100 underline-offset-4 hover:underline"
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.href}
              href={link.href}
              className="text-amber-100 underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ),
        )}
      </nav>
    </header>
  );
}
