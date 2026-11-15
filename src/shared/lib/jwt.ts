import jwt from "jsonwebtoken";

const secret = process.env.JWT_ACCESS_SECRET;
if (!secret) {
  throw new Error("JWT_ACCESS_SECRET belum diset di environment");
}

export type AccessTokenPayload = {
  sub: string; // user id
  roleId: string;
};

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, secret, { expiresIn: "15m" });

// Dipakai middleware authenticate. Melempar error jika token tidak valid atau kedaluwarsa.
export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, secret) as unknown as AccessTokenPayload;