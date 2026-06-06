import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const algorithm = "HS256";
const expiry = "7d";

export async function signToken(payload: { userId: number, username: string }) {
    return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(secret);
}

export async function verifyToken(token: string) {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: number, username: string };
}