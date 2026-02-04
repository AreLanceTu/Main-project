import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.2.4";

const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

export type FirebaseTokenClaims = {
  sub: string;
  user_id?: string;
  email?: string;
  aud?: string;
  iss?: string;
};

export async function verifyFirebaseIdToken(
  authorizationHeader: string | null,
  firebaseProjectId: string,
): Promise<{ uid: string; email?: string }>
{
  if (!authorizationHeader) throw new Error("Missing token");

  // Accept either:
  // - "Bearer <token>" (typical Authorization header)
  // - "<token>" (custom header like x-firebase-token)
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  const token = (match?.[1] || authorizationHeader).trim();
  if (!token) throw new Error("Missing token");

  const issuer = `https://securetoken.google.com/${firebaseProjectId}`;

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    audience: firebaseProjectId,
  });

  const claims = payload as unknown as FirebaseTokenClaims;
  const uid = claims.sub || claims.user_id;
  if (!uid) throw new Error("Token missing uid");

  return { uid, email: claims.email };
}
