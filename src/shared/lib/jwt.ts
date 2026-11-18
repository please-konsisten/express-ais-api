import jwt from "jsonwebtoken";

const secret = process.env.JWT_ACCESS_SECRET;
if (!secret) {
  throw new Error("JWT_ACCESS_SECRET belum diset di environment");
}

export type AccessTokenPayload = {
  sub: string; // user id
  roleId: string;
  roleName: string;
};

const ALGORITHM = "HS256";

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, secret, { algorithm: ALGORITHM, expiresIn: "15m" });

// Dipakai middleware authenticate. Melempar error jika token tidak valid atau kedaluwarsa.
// Algoritma dikunci agar token dengan algoritma lain (mis. "none") ditolak.
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, secret, { algorithms: [ALGORITHM] });

  if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded["roleId"] !== "string") {
    throw new jwt.JsonWebTokenError("Payload token tidak valid");
  }

  return { sub: decoded.sub, roleId: decoded["roleId"], roleName: decoded["roleName"] };
};