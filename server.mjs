// Servidor próprio do Últimos Dias: entrega o jogo e roda as salas online (Colyseus) no mesmo endereço.
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { rooms } from "./room.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    app.get("/saude", (req, res) => res.send("ok"));
    app.use(express.static(dir, { setHeaders: (res) => res.setHeader("Cache-Control", "no-cache") }));
  },
});
gameServer.define("mundo", rooms.mundo.klass).filterBy(["key"]);
const port = Number(process.env.PORT || 2567);
await gameServer.listen(port);
console.log("Últimos Dias rodando na porta " + port);
