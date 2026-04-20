# `@ordnary/auth-sdk`

Small Next.js server-side package for integrating `ordnary.accounts` as an OAuth/OIDC provider.

## Install

```bash
npm install @ordnary/auth-sdk
```

For local development inside this workspace, you can also install it from the folder directly:

```bash
npm install ../ordnary.auth-sdk
```

## Configuration

```ts
import { createOrdnaryAuth } from "@ordnary/auth-sdk";

export const ordnaryAuth = createOrdnaryAuth({
  issuer: process.env.ORDNARY_ISSUER || "http://localhost:3000",
  clientId: process.env.ORDNARY_CLIENT_ID || "ordnary-testproject",
  redirectUri:
    process.env.ORDNARY_REDIRECT_URI || "http://localhost:3001/api/auth/callback",
  cookieSecret: process.env.AUTH_COOKIE_SECRET || "dev-secret-change-me",
  cookiePrefix: "ordnary_testproject",
  defaultReturnTo: "/profile",
  failureRedirectTo: "/",
  logoutRedirectTo: "/",
});
```

## Next.js Route Handlers

```ts
// app/api/auth/login/route.ts
import { ordnaryAuth } from "@/lib/ordnary";

export async function GET(request: Request) {
  return ordnaryAuth.handleLogin(request);
}
```

```ts
// app/api/auth/callback/route.ts
import { ordnaryAuth } from "@/lib/ordnary";

export async function GET(request: Request) {
  return ordnaryAuth.handleCallback(request);
}
```

```ts
// app/api/auth/logout/route.ts
import { ordnaryAuth } from "@/lib/ordnary";

export async function GET(request: Request) {
  return ordnaryAuth.handleLogout(request);
}
```

## Session Usage

```ts
const session = await ordnaryAuth.readSession();
```

Or force a redirect when authentication is required:

```ts
const session = await ordnaryAuth.requireSession("/");
```

## What This Package Handles

- PKCE, state, and nonce generation
- signed `httpOnly` cookies for login state and session storage
- redirecting to `/oauth/authorize`
- authorization code exchange through `/api/oauth/token`
- user profile retrieval through `/api/oauth/userinfo`
- logout cleanup
