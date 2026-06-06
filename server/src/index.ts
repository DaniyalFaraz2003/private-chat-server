import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { WebSocketServer } from "ws";
import authRoutes from "./routes/auth";
import { handleConnection } from "./ws/handler";
import { initDb } from "./db";

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });
await fastify.register(rateLimit, { max: 10, timeWindow: "1 minute" });
await fastify.register(authRoutes, { prefix: "/auth" });

initDb();

const wss = new WebSocketServer({ server: fastify.server, path: "/ws" });
wss.on("connection", (socket, req) => handleConnection(socket, req, wss));

await fastify.listen({
    port: Number(process.env.PORT) || 3001,
    host: '0.0.0.0'
});

console.log(`Server is running on port ${process.env.PORT || 3001}`);