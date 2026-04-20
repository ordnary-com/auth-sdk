import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

function base64Url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString("base64url");
}

function normalizeBaseUrl(url) {
  return url.replace(/\/$/, "");
}

function createRandomString(size = 32) {
  return randomBytes(size).toString("base64url");
}

async function createPkcePair() {
  const verifier = createRandomString(32);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64Url(Buffer.from(digest));
  return { verifier, challenge };
}

function createCookieCodec(secret) {
  function sign(value) {
    return createHmac("sha256", secret).update(value).digest("base64url");
  }

  function encodeSigned(payload) {
    const raw = base64Url(JSON.stringify(payload));
    return `${raw}.${sign(raw)}`;
  }

  function decodeSigned(value) {
    if (!value) return null;

    const [raw, signature] = value.split(".");
    if (!raw || !signature) return null;
    if (sign(raw) !== signature) return null;

    try {
      return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    } catch {
      return null;
    }
  }

  return { encodeSigned, decodeSigned };
}

function createScopedCookies(cookiePrefix) {
  return {
    session: `${cookiePrefix}_session`,
    login: `${cookiePrefix}_oauth`,
  };
}

function normalizeScopes(scopes) {
  return Array.isArray(scopes) ? scopes.join(" ") : scopes;
}

export function createOrdnaryAuth(config) {
  const issuer = normalizeBaseUrl(config.issuer);
  const redirectUri = normalizeBaseUrl(config.redirectUri);
  const cookieSecret = config.cookieSecret;
  const cookiePrefix = config.cookiePrefix || "ordnary_auth";
  const secureCookies = config.secureCookies ?? redirectUri.startsWith("https://");
  const scopes = normalizeScopes(config.scopes || ["openid", "profile", "email"]);
  const cookieNames = createScopedCookies(cookiePrefix);
  const codec = createCookieCodec(cookieSecret);

  function buildAuthorizeUrl(params) {
    const url = new URL("/oauth/authorize", issuer);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  async function readCookie(name) {
    const cookieStore = await cookies();
    return cookieStore.get(name)?.value;
  }

  async function writeCookie(name, value, options) {
    const cookieStore = await cookies();
    cookieStore.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: "/",
      ...options,
    });
  }

  async function deleteCookie(name) {
    const cookieStore = await cookies();
    cookieStore.delete(name);
  }

  async function readSession() {
    return codec.decodeSigned(await readCookie(cookieNames.session));
  }

  async function writeSession(session) {
    await writeCookie(cookieNames.session, codec.encodeSigned(session), {
      expires: new Date(session.expiresAt),
    });
    return session;
  }

  async function clearSession() {
    await deleteCookie(cookieNames.session);
  }

  async function readLoginState() {
    return codec.decodeSigned(await readCookie(cookieNames.login));
  }

  async function writeLoginState(state) {
    await writeCookie(cookieNames.login, codec.encodeSigned(state), {
      maxAge: 60 * 10,
    });
    return state;
  }

  async function clearLoginState() {
    await deleteCookie(cookieNames.login);
  }

  async function exchangeCode({ code, codeVerifier }) {
    const tokenResponse = await fetch(`${issuer}/api/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      const message = await tokenResponse.text();
      throw new Error(message || "token_exchange_failed");
    }

    return tokenResponse.json();
  }

  async function fetchUserInfo(accessToken) {
    const userInfoResponse = await fetch(`${issuer}/api/oauth/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!userInfoResponse.ok) {
      const message = await userInfoResponse.text();
      throw new Error(message || "userinfo_failed");
    }

    return userInfoResponse.json();
  }

  async function handleLogin(request, options = {}) {
    const currentUrl = new URL(request.url);
    const state = createRandomString();
    const nonce = createRandomString();
    const { verifier, challenge } = await createPkcePair();
    const returnTo =
      options.returnTo ||
      currentUrl.searchParams.get(options.returnToParam || "returnTo") ||
      config.defaultReturnTo ||
      "/profile";

    await writeLoginState({
      state,
      nonce,
      codeVerifier: verifier,
      returnTo,
    });

    const authorizeUrl = buildAuthorizeUrl({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: options.scope ? normalizeScopes(options.scope) : scopes,
      state,
      nonce,
      prompt: options.prompt,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    return NextResponse.redirect(authorizeUrl);
  }

  async function handleCallback(request, options = {}) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");
    const failurePath = options.failureRedirectTo || config.failureRedirectTo || "/";

    if (error) {
      return NextResponse.redirect(
        new URL(
          `${failurePath}?error=${encodeURIComponent(errorDescription || error)}`,
          url.origin
        )
      );
    }

    const loginState = await readLoginState();
    await clearLoginState();

    if (!code || !state || !loginState || loginState.state !== state) {
      await clearSession();
      return NextResponse.redirect(
        new URL(`${failurePath}?error=oauth_state_mismatch`, url.origin)
      );
    }

    try {
      const tokens = await exchangeCode({
        code,
        codeVerifier: loginState.codeVerifier,
      });
      const user = await fetchUserInfo(tokens.access_token);
      const expiresIn = Number(tokens.expires_in || 3600);

      await writeSession({
        accessToken: tokens.access_token,
        idToken: tokens.id_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type || "Bearer",
        expiresAt: Date.now() + expiresIn * 1000,
        user,
      });

      return NextResponse.redirect(
        new URL(loginState.returnTo || config.defaultReturnTo || "/profile", url.origin)
      );
    } catch (errorObject) {
      await clearSession();
      const message =
        errorObject instanceof Error ? errorObject.message : "oauth_callback_failed";
      return NextResponse.redirect(
        new URL(`${failurePath}?error=${encodeURIComponent(message)}`, url.origin)
      );
    }
  }

  async function handleLogout(request, options = {}) {
    await clearLoginState();
    await clearSession();

    return NextResponse.redirect(
      new URL(options.redirectTo || config.logoutRedirectTo || "/", request.url)
    );
  }

  async function requireSession(path = config.failureRedirectTo || "/") {
    const session = await readSession();
    if (!session) {
      redirect(path);
    }
    return session;
  }

  return {
    issuer,
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scopes,
    createRandomString,
    createPkcePair,
    buildAuthorizeUrl,
    readSession,
    writeSession,
    clearSession,
    readLoginState,
    writeLoginState,
    clearLoginState,
    exchangeCode,
    fetchUserInfo,
    handleLogin,
    handleCallback,
    handleLogout,
    requireSession,
  };
}
