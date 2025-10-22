// bot/http.js
import express from 'express';
import crypto from 'node:crypto';
import { PermissionFlagsBits } from 'discord.js';

/**
 * Minimal state to start (in-memory). Swap to DB later.
 * guardians: Map<discordId, { wallet, note, status: 'pending'|'approved'|'rejected', decidedBy?, decidedAt?, createdAt }>
 */
const guardians = new Map();

export function createHttp({ discordClient, postDonation, runSyncStructure }) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.status(200).send('OK'));

  // ------- Auth / Security -------
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
  const GUILD_ID = process.env.GUILD_ID || '';
  const GUARDIAN_ROLE_NAME = process.env.GUARDIAN_ROLE_NAME || 'Guardian';
  const CORE_TEAM_ROLE_NAME = process.env.CORE_TEAM_ROLE_NAME || 'Core Team';
  const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID || '';

  function requireAdmin(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    return next();
  }

  function verifyHmac(req, headerName = 'x-signature-sha256') {
    if (!WEBHOOK_SECRET) return true;
    const sig = (req.headers[headerName] || '').toString();
    const body = JSON.stringify(req.body ?? {});
    const mac = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig));
    } catch {
      return false;
    }
  }

  // ------- Helpers -------
  async function fetchGuild() {
    if (!GUILD_ID) throw new Error('GUILD_ID not set');
    return discordClient.guilds.fetch(GUILD_ID);
  }

  function toDTO(statusFilter) {
    const arr = [];
    for (const [discordId, rec] of guardians.entries()) {
      if (!statusFilter || rec.status === statusFilter) {
        arr.push({ discordId, ...rec });
      }
    }
    // newest first
    arr.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return arr;
  }

  async function announce(text) {
    if (!ANNOUNCE_CHANNEL_ID) return;
    try {
      const ch = await discordClient.channels.fetch(ANNOUNCE_CHANNEL_ID);
      if (ch?.isTextBased()) await ch.send(text);
    } catch (e) {
      console.error('announce failed', e);
    }
  }

  // ------- Role APIs -------
  // GET /api/roles
  app.get('/api/roles', requireAdmin, async (_req, res) => {
    try {
      const guild = await fetchGuild();
      const roles = [...guild.roles.cache.values()]
        .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
        .sort((a, b) => b.position - a.position);
      res.json({ roles });
    } catch (e) {
      console.error('roles list failed', e);
      res.status(500).json({ error: 'roles list failed' });
    }
  });

  // POST /api/roles/create { name, color?, hoist?, mentionable? }
  app.post('/api/roles/create', requireAdmin, async (req, res) => {
    const { name, color, hoist, mentionable } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
      const guild = await fetchGuild();
      const role = await guild.roles.create({
        name,
        color: color ?? null,
        hoist: !!hoist,
        mentionable: !!mentionable,
        reason: 'API create role',
      });
      res.json({ ok: true, role: { id: role.id, name: role.name } });
    } catch (e) {
      console.error('create role failed', e);
      res.status(500).json({ error: 'create role failed' });
    }
  });

  // POST /api/roles/assign { userId, roleName }
  app.post('/api/roles/assign', requireAdmin, async (req, res) => {
    const { userId, roleName } = req.body || {};
    if (!userId || !roleName) return res.status(400).json({ error: 'userId, roleName required' });
    try {
      const guild = await fetchGuild();
      const member = await guild.members.fetch(userId);
      const role = guild.roles.cache.find(r => r.name === roleName);
      if (!role) return res.status(404).json({ error: 'role not found' });
      await member.roles.add(role, 'API roles/assign');
      res.json({ ok: true });
    } catch (e) {
      console.error('assign role failed', e);
      res.status(500).json({ error: 'assign role failed' });
    }
  });

  // POST /api/roles/remove { userId, roleName }
  app.post('/api/roles/remove', requireAdmin, async (req, res) => {
    const { userId, roleName } = req.body || {};
    if (!userId || !roleName) return res.status(400).json({ error: 'userId, roleName required' });
    try {
      const guild = await fetchGuild();
      const member = await guild.members.fetch(userId);
      const role = guild.roles.cache.find(r => r.name === roleName);
      if (!role) return res.status(404).json({ error: 'role not found' });
      await member.roles.remove(role, 'API roles/remove');
      res.json({ ok: true });
    } catch (e) {
      console.error('remove role failed', e);
      res.status(500).json({ error: 'remove role failed' });
    }
  });

  // ------- Guardianship ("First 54") -------
  // POST /api/guardians/apply { discordId, wallet, note? }
  app.post('/api/guardians/apply', async (req, res) => {
    const { discordId, wallet, note } = req.body || {};
    if (!discordId || !wallet) return res.status(400).json({ error: 'discordId and wallet required' });
    const rec = guardians.get(discordId);
    const now = Date.now();
    if (rec && rec.status === 'pending') {
      guardians.set(discordId, { ...rec, wallet, note, createdAt: rec.createdAt ?? now });
    } else {
      guardians.set(discordId, { wallet, note, status: 'pending', createdAt: now });
    }
    return res.json({ ok: true });
  });

  // GET /api/guardians/list?status=pending|approved|rejected
  app.get('/api/guardians/list', requireAdmin, async (req, res) => {
    const status = (req.query.status || '').toString();
    if (status && !['pending', 'approve