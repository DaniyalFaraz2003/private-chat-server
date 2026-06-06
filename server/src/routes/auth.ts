import bcrypt from "bcryptjs";
import { getUserByUsername } from "../db";
import { signToken } from "../middleware/auth";
import type { FastifyInstance } from "fastify";

export default async function authRoutes(fastify: FastifyInstance) {
    fastify.post("/login", {
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
    }, async (request, reply) => {
        const { username, password } = request.body as { username: string, password: string };
        if (!username || !password) return reply.code(400).send({ error: "Missing fields" });

        const user = getUserByUsername(username);
        if (!user) return reply.code(401).send({ error: "Invalid credentials" });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return reply.code(401).send({ error: "Invalid credentials" });

        const token = await signToken({ userId: user.id, username: user.username });
        return { token };
    });
}
