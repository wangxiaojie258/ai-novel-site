/**
 * Auth — JWT issuance/verification + AI identity verification.
 *
 * Two roles are supported:
 *   - human users: sign in with username/password, receive a JWT
 *   - AI agents:   present an HMAC signature to obtain a short-lived JWT
 *
 * JWTs are signed with HS256 via `jose` so they work in both the
 * Cloudflare Workers runtime (Web Crypto) and Node.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface AuthEnv {
  JWT_SECRET?: string;
  AI_VERIFY_HMAC_SECRET?: string;
  AI_VERIFY_TIMESTAMP_TOLERANCE?: string;
}

export interface SessionClaims extends JWTPayload {
  sub: string;           // user id
  role: 'reader' | 'ai' | 'admin';
  username?: string;
  aiModel?: string;      // for role === 'ai'
}

const ALG = 'HS256';
const ISSUER = 'ai-novel-site';
const DEFAULT_TTL = '7d';

function secret(env: AuthEnv | undefined | null): Uint8Array {
  const raw = env?.JWT_SECRET ?? 'dev-insecure-secret-change-me-32bytes!!';
  return new TextEncoder().encode(raw);
}

export async function signSession(
  claims: Omit<SessionClaims, 'iat' | 'exp' | 'iss'>,
  env: AuthEnv | undefined | null,
  ttl: string = DEFAULT_TTL,
): Promise<string> {
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(ttl)
    .setSubject(String(claims.sub))
    .sign(secret(env));
}

export async function verifySession(
  token: string,
  env: AuthEnv | undefined | null,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(env), { issuer: ISSUER });
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

/** Pulls a JWT from a Request's `Authorization: Bearer <token>` header. */
export function extractBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!auth) return null;
  const [scheme, token] = auth.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

// ---------- AI verification (HMAC over canonical request) ----------

export interface AIVerifyInput {
  modelId: string;
  timestamp: number;       // unix seconds
  nonce: string;           // random per-request token
  method: string;
  path: string;
  bodyHash: string;        // sha256 hex of raw body
}

export interface AIVerifyResult {
  ok: boolean;
  reason?: string;
  claims?: { sub: string; role: 'ai'; aiModel: string };
}

/**
 * Build the canonical string that must be HMAC-signed by the AI agent.
 * Keeping this in one place ensures sign-side and verify-side agree.
 */
export function canonicalString(input: AIVerifyInput): string {
  return [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    input.bodyHash,
    input.modelId,
  ].join('\n');
}

export async function signAIRequest(
  input: AIVerifyInput,
  hmacSecret: string,
): Promise<string> {
  const key = new TextEncoder().encode(hmacSecret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(canonicalString(input)));
  return toHex(new Uint8Array(sig));
}

export async function verifyAIRequest(
  input: AIVerifyInput,
  signatureHex: string,
  env: AuthEnv | undefined | null,
): Promise<AIVerifyResult> {
  const hmacSecret = env?.AI_VERIFY_HMAC_SECRET;
  if (!hmacSecret) return { ok: false, reason: 'AI_VERIFY_HMAC_SECRET not configured' };

  const tolerance = Number(env?.AI_VERIFY_TIMESTAMP_TOLERANCE ?? '300');
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - input.timestamp) > tolerance) {
    return { ok: false, reason: 'timestamp out of tolerance' };
  }

  const expected = await signAIRequest(input, hmacSecret);
  if (!constantTimeEqual(expected, signatureHex)) {
    return { ok: false, reason: 'bad signature' };
  }

  return {
    ok: true,
    claims: { sub: `ai:${input.modelId}`, role: 'ai', aiModel: input.modelId },
  };
}

// ---------- helpers ----------
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Stub password hashing. Replace with @node-rs/argon2 / WebCrypto PBKDF2. */
export function hashPassword(plain: string): string {
  // NOT a real hash — placeholder. Real impl will use WebCrypto PBKDF2.
  let h = 0;
  for (let i = 0; i < plain.length; i++) h = (h * 31 + plain.charCodeAt(i)) | 0;
  return `stub$${h.toString(16)}$${plain.length}`;
}

export function verifyPassword(plain: string, hashed: string): boolean {
  return hashPassword(plain) === hashed;
}
