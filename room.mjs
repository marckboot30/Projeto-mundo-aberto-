// Servidor do Últimos Dias (Colyseus 0.17 hospedado no PlayDrop).
// Modelo: o servidor guarda o mundo compartilhado e repassa mensagens; um dos jogadores ("anfitrião") simula os zumbis.
import { Room, defineRoom } from "colyseus";
import { MongoClient } from "mongodb";

const SAVE_MS = 30000;
const MEM = { mundos: new Map(), jogadores: new Map() }; // guarda o mundo enquanto o servidor estiver ligado (sem banco)
class Mundo extends Room {
  maxClients = 8;
  async onCreate(options) {
    this.key = String(options?.key || "publico").slice(0, 80);
    if (this.key !== "publico") this.setPrivate(true);
    this.world = { deltas: {}, veh: {}, drops: {}, totalH: 0 };
    this.players = new Map(); // sessionId -> { userId, name, st }
    this.hostId = null;
    try {
      if (process.env.PLAYDROP_MONGO_URL) {
        this.mongo = new MongoClient(process.env.PLAYDROP_MONGO_URL); await this.mongo.connect();
        this.db = this.mongo.db();
        const w = await this.db.collection("mundos").findOne({ _id: this.key });
        if (w) this.world = { deltas: w.deltas || {}, veh: w.veh || {}, drops: w.drops || {}, totalH: w.totalH || 0 };
      }
    } catch (e) { console.log("mongo indisponível", e?.message); this.db = null; }
    if (!this.db && MEM.mundos.has(this.key)) this.world = MEM.mundos.get(this.key);
    this.dirty = false;
    this.clock.setInterval(() => this.persist(), SAVE_MS);
    const relay = (type) => this.onMessage(type, (client, m) => this.broadcast(type, Object.assign({ from: client.sessionId }, m), { except: client }));
    // estado do jogador (posição, animação, carro)
    this.onMessage("p", (client, m) => { const pl = this.players.get(client.sessionId); if (pl) pl.st = m; this.broadcast("p", Object.assign({ from: client.sessionId }, m), { except: client }); });
    // zumbis: só o anfitrião manda; pedidos de dano e barulho vão para o anfitrião
    this.onMessage("zs", (client, m) => { if (client.sessionId === this.hostId) this.broadcast("zs", m, { except: client }); });
    this.onMessage("hurt", (client, m) => { if (client.sessionId !== this.hostId) return; const to = this.clients.find(c => c.sessionId === m.to); if (to) to.send("hurt", m); });
    for (const t of ["hit", "noise", "ahit"]) this.onMessage(t, (client, m) => { const h = this.clients.find(c => c.sessionId === this.hostId); if (h && h !== client) h.send(t, Object.assign({ from: client.sessionId }, m)); });
    // mundo compartilhado
    this.onMessage("chunk", (client, m) => { if (!m || typeof m.key !== "string") return; this.world.deltas[m.key] = m.d; this.dirty = true; this.broadcast("chunk", m, { except: client }); });
    this.onMessage("veh", (client, m) => { if (!m || !m.id) return; this.world.veh[m.id] = m.sv; this.dirty = true; this.broadcast("veh", m, { except: client }); });
    this.onMessage("drop", (client, m) => { if (!m || !m.id) return; if (m.d) this.world.drops[m.id] = m.d; else delete this.world.drops[m.id]; this.dirty = true; this.broadcast("drop", m, { except: client }); });
    this.onMessage("time", (client, m) => { if (client.sessionId !== this.hostId) return; this.world.totalH = m.totalH; this.broadcast("time", m, { except: client }); });
    this.onMessage("save", async (client, m) => { const pl = this.players.get(client.sessionId); if (!pl) return; if (!this.db) { MEM.jogadores.set(this.key + ":" + pl.userId, m.P); return; } try { await this.db.collection("jogadores").updateOne({ _id: this.key + ":" + pl.userId }, { $set: { P: m.P, at: Date.now() } }, { upsert: true }); } catch (e) {} });
    relay("chat");
  }
  async onJoin(client, options, auth) {
    const a = client.auth || auth || {};
    const userId = String(a.userId ?? a.id ?? ("nome:" + String(options?.name || client.sessionId).toLowerCase())), name = String(a.username || options?.name || "Sobrevivente").slice(0, 24);
    this.players.set(client.sessionId, { userId, name, st: null });
    if (!this.hostId) this.hostId = client.sessionId;
    let saved = null;
    if (this.db) try { const doc = await this.db.collection("jogadores").findOne({ _id: this.key + ":" + userId }); saved = doc?.P || null; } catch (e) {}
    else saved = MEM.jogadores.get(this.key + ":" + userId) || null;
    client.send("bem-vindo", { you: client.sessionId, host: this.hostId, world: this.world, me: saved,
      players: [...this.players].filter(([id]) => id !== client.sessionId).map(([id, p]) => ({ id, name: p.name, st: p.st })) });
    this.broadcast("entrou", { id: client.sessionId, name }, { except: client });
  }
  onLeave(client) {
    const pl = this.players.get(client.sessionId); this.players.delete(client.sessionId);
    this.broadcast("saiu", { id: client.sessionId, name: pl?.name });
    if (this.hostId === client.sessionId) { this.hostId = this.clients.find(c => c.sessionId !== client.sessionId)?.sessionId || null; if (this.hostId) this.broadcast("host", { id: this.hostId }); }
  }
  async persist() {
    if (!this.db) { MEM.mundos.set(this.key, this.world); return; }
    if (!this.dirty) return; this.dirty = false;
    try { await this.db.collection("mundos").updateOne({ _id: this.key }, { $set: { deltas: this.world.deltas, veh: this.world.veh, drops: this.world.drops, totalH: this.world.totalH, at: Date.now() } }, { upsert: true }); } catch (e) { this.dirty = true; }
  }
  async onDispose() { this.dirty = true; await this.persist(); await this.mongo?.close(); }
}
export const rooms = { mundo: defineRoom(Mundo).filterBy(["key"]) };
