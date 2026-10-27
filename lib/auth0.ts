import { Auth0Client } from '@auth0/nextjs-auth0/server';

// Single instance shared by the proxy and any route that needs the session. Configuration comes
// from AUTH0_* and APP_BASE_URL in the environment.
export const auth0 = new Auth0Client();
