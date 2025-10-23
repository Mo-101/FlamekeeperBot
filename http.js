// bot/http.js
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory store for Guardians (swap to DB later without changing API)
const guardians = new Map(); // key: discordId -> { wallet, note, status, createdAt, decidedBy, decidedAt, reason }

export function createHttp({ discordClient, postDonation, runSyncStructure }) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  
  // Serve static files from the root directory
  app.use(express.static(__dirname));

  // ---- Required env (index.js should already enforce when PORT is set) ----
  const ADMIN_API_KEY       = process.env.ADMIN_API_KEY;
  const WEBHOOK_SECRET      = process.env.WEBHOOK_SECRET;
  const GUILD_ID            = process.env.GUILD_ID;
  const GUARDIAN_ROLE_NAME  = process.env.GUARDIAN_ROLE_NAME || 'Guardian';
  const CORE_TEAM_ROLE_NAME = process.env.CORE_TEAM_ROLE_NAME || 'Core Team';
  const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID || '';

  // ---- Utils ----
  app.get('/health', (_req, res) => res.status(200).send('OK'));

  function requireAdmin(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key || key !== ADMIN_API_KEY) return res.status(401).json({ error: 'unauthorized' });
    next();
  }

  function verifyHmac(req, headerName = 'x-signature-sha256') {
    if (!WEBHOOK_SECRET) return true; // Skip verification if no secret set
    const sig = (req.headers[headerName] || '').toString();
    const body = JSON.stringify(req.body ?? {});
    const mac = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    try { 
      return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig)); 
    } catch { 
      return false; 
    } 
  }

  async function fetchGuild() {
    if (!GUILD_ID) throw new Error('GUILD_ID not configured');
    return discordClient.guilds.fetch(GUILD_ID);
  }

  async function announce(text) {
    if (!ANNOUNCE_CHANNEL_ID) return;
    try {
      const ch = await discordClient.channels.fetch(ANNOUNCE_CHANNEL_ID);
      if (ch?.isTextBased()) await ch.send(text);
    } catch (err) {
      console.error('Announcement failed:', err.message);
    }
  }

  // ===================== Roles =====================

  // List roles
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

  // Create role
  // body: { name, color?, hoist?, mentionable? }
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

  // Assign role
  // body: { userId, roleName }
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

  // Remove role
  // body: { userId, roleName }
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

  // ================= Guardians ("First 54") ================ 

  // Public apply
  // body: { discordId, wallet, note? }
  app.post('/api/guardians/apply', async (req, res) => {
    const { discordId, wallet, note } = req.body || {};
    if (!discordId || !wallet) return res.status(400).json({ error: 'discordId and wallet required' });
    const now = Date.now();
    guardians.set(discordId, { wallet, note: note || '', status: 'pending', createdAt: now });
    res.json({ ok: true });
  });

  // List (admin)
  // query: ?status=pending|approved|rejected
  app.get('/api/guardians/list', requireAdmin, async (req, res) => {
    const status = (req.query.status || '').toString();
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    const out = [];
    for (const [discordId, rec] of guardians.entries()) {
      if (!status || rec.status === status) out.push({ discordId, ...rec });
    }
    out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    res.json({ guardians: out });
  });

  // Approve (admin) → assigns Guardian role
  // body: { discordId }
  app.post('/api/guardians/approve', requireAdmin, async (req, res) => {
    const { discordId } = req.body || {};
    if (!discordId) return res.status(400).json({ error: 'discordId required' });
    const rec = guardians.get(discordId);
    if (!rec || rec.status !== 'pending') return res.status(404).json({ error: 'not pending' });

    try {
      const guild = await fetchGuild();
      const member = await guild.members.fetch(discordId);
      const role = guild.roles.cache.find(r => r.name === GUARDIAN_ROLE_NAME);
      if (!role) return res.status(500).json({ error: `missing role: ${GUARDIAN_ROLE_NAME}` });
      await member.roles.add(role, 'Guardianship approved');

      guardians.set(discordId, { ...rec, status: 'approved', decidedBy: CORE_TEAM_ROLE_NAME, decidedAt: Date.now() });
      await announce(`✅ **Guardian Approved**: <@${discordId}> — wallet \`${rec.wallet}\``);
      res.json({ ok: true });
    } catch (e) {
      console.error('approve guardian failed', e);
      res.status(500).json({ error: 'approve failed' });
    }
  });

  // Reject (admin)
  // body: { discordId, reason? }
  app.post('/api/guardians/reject', requireAdmin, async (req, res) => {
    const { discordId, reason } = req.body || {};
    if (!discordId) return res.status(400).json({ error: 'discordId required' });
    const rec = guardians.get(discordId);
    if (!rec || rec.status !== 'pending') return res.status(404).json({ error: 'not pending' });

    guardians.set(discordId, { ...rec, status: 'rejected', decidedBy: CORE_TEAM_ROLE_NAME, decidedAt: Date.now(), reason: reason || '' });
    await announce(`❌ **Guardian Rejected**: <@${discordId}>${reason ? ` — ${reason}` : ''}`);
    res.json({ ok: true });
  });

  // ================= Structure Sync trigger ================ 

  // body: { dry?: boolean }
  app.post('/api/sync-structure', requireAdmin, async (req, res) => {
    try {
      const dry = !!(req.body && req.body.dry);
      const result = await runSyncStructure({ dry });
      res.json({ ok: true, result });
    } catch (e) {
      console.error('sync-structure failed', e);
      res.status(500).json({ error: 'sync-structure failed' });
    }
  });

  // ================= Donation Webhook (HMAC) ================ 

  // body: { donor, beneficiary, amountWei, txHash? }
  app.post('/webhooks/donation', async (req, res) => {
    if (!verifyHmac(req)) return res.status(401).json({ error: 'bad signature' });
    const { donor, beneficiary, amountWei, txHash } = req.body || {};
    if (!donor || !beneficiary || !amountWei) return res.status(400).json({ error: 'missing fields' });
    try {
      await postDonation({ donor, beneficiary, amountWei, txHash });
      res.json({ ok: true });
    } catch (e) {
      console.error('donation webhook failed', e);
      res.status(500).json({ error: 'failed' });
    }
  });

  // CRITICAL: Return the Express app
  return app;
}
