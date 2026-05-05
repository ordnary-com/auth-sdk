# `@ordnary/auth-sdk`

Server-side SDK for integrating **Ordnary Accounts** as an OIDC provider.

## Features

- **OAuth/OIDC**: PKCE, state, and nonce management.
- **Session**: Signed `httpOnly` cookie-based session management.
- **Handlers**: Pre-built Next.js route handlers for login, callback, and logout.
- **API Spec**: Includes [OpenAPI 3.0](./openapi.yaml) definition.

## Install

```bash
npm install @ordnary/auth-sdk
```

## Usage

```ts
import { createOrdnaryAuth } from "@ordnary/auth-sdk";

export const auth = createOrdnaryAuth({
  issuer: "https://accounts.ordnary.com",
  clientId: "your-client-id",
  redirectUri: "https://your-app.com/api/auth/callback",
  cookieSecret: "your-secret",
});

// Use in Next.js Route Handlers
export const GET = (req) => auth.handleLogin(req);
