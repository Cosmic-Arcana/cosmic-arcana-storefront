export const metadata = {
  title: "Sign in",
  description: "Sign in to Cosmic Arcana with GitHub or Google through Auth0.",
};

export default function LoginPage() {
  return (
    <main id="main" className="mx-auto max-w-md p-10">
      <h1 className="text-2xl font-semibold tracking-tight text-[#f5f3ff]">Sign in</h1>
      <p className="mt-3 text-sm leading-6 text-[#e4e4e7]">
        GitHub and Google go through Auth0. Enable those social connections on the tenant, then
        create the GitHub OAuth app and Google Cloud OAuth client Auth0 asks for (redirect URI is
        the Auth0 callback, not this site).
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <a
          href="/auth/login?connection=github"
          className="rounded-md bg-zinc-100 px-4 py-2 text-center text-sm font-medium text-zinc-950 hover:bg-white"
        >
          Continue with GitHub
        </a>
        <a
          href="/auth/login?connection=google-oauth2"
          className="rounded-md bg-violet-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-violet-500"
        >
          Continue with Google
        </a>
      </div>
    </main>
  );
}
