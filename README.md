# `@ordnary/auth-sdk`

Kleine Next.js server-side package om `ordnary.accounts` als OAuth/OIDC provider te koppelen.

## Install

```bash
npm install @ordnary/auth
```

Voor lokale ontwikkeling in deze workspace kun je ook gebruiken:

```bash
npm install ../ordnary.auth
```

## Config

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

## Next.js route handlers

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

## Session usage

```ts
const session = await ordnaryAuth.readSession();
```

Of hard redirecten als login vereist is:

```ts
const session = await ordnaryAuth.requireSession("/");
```

## Wat de package afhandelt

- PKCE + state + nonce generatie
- signed httpOnly cookies voor loginstate en sessie
- redirect naar `/oauth/authorize`
- code exchange via `/api/oauth/token`
- userinfo-ophaal via `/api/oauth/userinfo`
- logout cleanup
