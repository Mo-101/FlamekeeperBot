// bot/commands/syncstructure.js
// Idempotent guild structure + permissions sync
export const data = { name: 'syncstructure', description: 'Sync server structure, roles, and permissions' };

// ---- Editable spec ----------------------------------------------------------
const ROLES = [
  // Order matters for role position (later = higher). Add as you need.
  { name: 'Core Team', color: 0xfee75c, hoist: true, mentionable: true },
  { name: 'Guardian',  color: 0x57f287, hoist: true, mentionable: true },
];

const EVERYONE = '@everyone';

const STRUCTURE = [
  {
    category: '📚 Information Hub',
    children: [
      {
        name: '📌-welcome-and-rules',
        type: 0,
        topic: 'Start here. Community rules & onboarding.',
        overwrites: {
          [EVERYONE]: { ViewChannel: true, SendMessages: false },
          'Core Team': { ViewChannel: true, SendMessages: true },
        },
      },
      {
        name: '📣-announcements',
        type: 0,
        topic: 'Official announcements. Read-only for members.',
        overwrites: {
          [EVERYONE]: { ViewChannel: true, SendMessages: false },
          'Core Team': { ViewChannel: true, SendMessages: true },
        },
      },
      { name: '📚-resources',         type: 0, topic: 'Docs, links, knowledge base.' },
    ],
  },
  {
    category: '🛡️ Guardianship (First 54)',
    children: [
      { name: '📝-how-to-verify',       type: 0, overwrites: { [EVERYONE]: { ViewChannel: true, SendMessages: false }, 'Core Team': { SendMessages: true } } },
      { name: '🎯-first-54-apply',      type: 0 },
      { name: '♡-approved-guardians',  type: 0, overwrites: { [EVERONE]: { ViewChannel: true, SendMessages: false }, 'Core Team': { SendMessages: true } } },
      { name: '❓-validator-faq',       type: 0, overwrites: { [EVERYONE]: { ViewChannel: true, SendMessages: false }, 'Core Team': { SendMessages: true } } },
    ],
  },
  {
    category: '⚡ DAO Ops',
    children: [
      { name: '💡-proposals',      type: 0, topic: 'Draft & discuss proposals.' },
      { name: '🗳️-snapshot-feed',  type: 0, topic: 'Snapshot vote links & results.', overwrites: { [EVERYONE]: { ViewChannel: true, SendMessages: false }, 'Core Team': { SendMessages: true } } },
      { name: '🧮-voting-room',     type: 0 },
      { name: '📊-results-log',     type: 0, overwrites: { [EVERYONE]: { ViewChannel: true, SendMessages: false }, 'Core Team': { SendMessages: true } } },
    ],
  },
  {
    category: '🌐 Community',
    children: [
      { name: '🌐-general',        type: 0 },
      { name: '🗓️-meeting-plans',  type: 0 },
      { name: '🎲-off-topic',      type: 0 },
    ],
  },
  {
    category: '🔊 Voice Channels',
    children: [
      { name: 'Lounge',       type: 2 },
      { name: 'Meeting Room', type: 2 },
    ],
  },
];
// -----------------------------------------------------------------------------

import { PermissionFlagsBits } from 'discord.js';
const TYPE_CATEGORY = 4, TYPE_TEXT = 0, TYPE_VOICE = 2;

function norm(s) {
  return s.toLowerCase()
    .replace(/[\p{Extended_Pictographic}\p{Symbol}\p{Mark}]/gu, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function flagsFromMap(map = {}) {
  // map: { ViewChannel: true/false, SendMessages: true/false, ... }
  const allow = [], deny = [];
  for (const [k, v] of Object.entries(map)) {
    if (PermissionFlagsBits[k] === undefined) continue;
    (v ? allow : deny).push(PermissionFlagsBits[k]);
  }
  return { allow, deny };
}

async function ensureRoles(guild) {
  const existing = await guild.roles.fetch();
  const roleMap = new Map();
  // Ensure @everyone is available by name
  roleMap.set(EVERYONE, guild.roles.everyone);

  for (const spec of ROLES) {
    let role = existing.find(r => r.name === spec.name);
    if (!role) {
      role = await guild.roles.create({ name: spec.name, color: spec.color, hoist: spec.hoist, mentionable: spec.mentionable, reason: 'Sync roles' });
    } else {
      // minimal drift correction
      const updates = {};
      if (role.color !== spec.color) updates.color = spec.color;
      if (role.hoist !== spec.hoist) updates.hoist = spec.hoist;
      if (role.mentionable !== spec.mentionable) updates.mentionable = spec.mentionable;
      if (Object.keys(updates).length) await role.edit({ ...updates, reason: 'Sync roles' });
    }
    roleMap.set(spec.name, role);
  }

  // try to keep order (higher later)
  const positions = [];
  for (const spec of ROLES) {
    const r = roleMap.get(spec.name);
    if (r) positions.push({ role: r.id, position: 1 }); // will be normalized; we only need stable relative order
  }
  if (positions.length > 1) {
    // move roles to top-ish preserving order (Discord normalizes absolute positions)
    await guild.roles.setPositions(positions.map((r, i) => ({ role: r.role, position: guild.roles.cache.size - (ROLES.length - i) })));
  }

  return roleMap;
}

export async function execute(message, args) {
  const guild = message.guild;
  if (!guild) return message.reply('⚠️ Must be used in a server.');
  const me = await guild.members.fetchMe();
  if (!me.permissions.has('ManageChannels')) return message.reply('❌ I need **Manage Channels**.');
  if (!me.permissions.has('ManageRoles')) return message.reply('❌ I need **Manage Roles** (to sync roles & overwrites).');

  const dry = (args[0] || '').toLowerCase() === 'dry';
  const roleMap = await ensureRoles(guild);

  const channels = await guild.channels.fetch();
  const byType = (t) => channels.filter(ch => ch && ch.type === t);
  const findCat = (n) => byType(TYPE_CATEGORY).find(ch => norm(ch.name) === norm(n));
  const findBy = (n, t) => channels.find(ch => ch && ch.type === t && norm(ch.name) === norm(n));

  const lines = [];
  for (const block of STRUCTURE) {
    // Category
    let cat = findCat(block.category);
    if (!cat) {
      lines.push(`📁 Create category → **${block.category}**`);
      if (!dry) cat = await guild.channels.create({ name: block.category, type: TYPE_CATEGORY, reason: 'Sync structure' });
      else continue; // in dry-run we can't attach children; we still list intended actions
    } else if (cat.name !== block.category && !dry) {
      await cat.setName(block.category, 'Sync structure');
      lines.push(`✏️ Rename category **${cat.name}** → **${block.category}**`);
    } else {
      lines.push(`✅ Category OK: **${block.category}**`);
    }

    // Children
    for (const c of block.children) {
      let ch = findBy(c.name, c.type);
      if (!ch) {
        lines.push(`➕ Create ${c.type === TYPE_VOICE ? 'voice' : 'text'} → **${c.name}** under **${block.category}**`);
        if (!dry) {
          ch = await guild.channels.create({
            name: c.name,
            type: c.type,
            parent: cat.id,
            reason: 'Sync structure',
            topic: c.type === TYPE_TEXT ? (c.topic || null) : undefined,
          });
        }
      } else {
        // rename if drift
        if (ch.name !== c.name && !dry) {
          await ch.setName(c.name, 'Sync structure');
          lines.push(`✏️ Rename **${ch.name}** → **${c.name}**`);
        }
        // ensure parent
        if (ch.parentId !== cat.id && !dry) {
          await ch.setParent(cat.id, { lockPermissions: false, reason: 'Sync structure' });
          lines.push(`📦 Move **${c.name}** → **${block.category}**`);
        }
        // ensure topic for text
        if (c.type === TYPE_TEXT && c.topic && ch.topic !== c.topic && !dry) {
          await ch.setTopic(c.topic);
          lines.push(`🧾 Set topic for **${c.name}**`);
        }
      }

      // permission overwrites
      if (c.overwrites && ch && !dry) {
        const overwrites = [];
        for (const [roleName, map] of Object.entries(c.overwrites)) {
          const role = roleName === EVERYONE ? roleMap.get(EVERYONE) : roleMap.get(roleName) || guild.roles.cache.find(r => r.name === roleName);
          if (!role) continue;
          const { allow, deny } = flagsFromMap(map);
          overwrites.push({ id: role.id, allow, deny });
        }
        if (overwrites.length) {
          await ch.permissionOverwrites.set(overwrites, 'Sync structure perms');
          lines.push(`🔐 Set perms for **${c.name}**`);
        }
      }
    }
  }

  // Send summary in chunks
  const header = dry ? '🧪 **Dry-run** (no changes):' : '✅ **Sync complete.**';
  const MAX = 1800; let buf = header;
  for (const l of lines) {
    if ((buf + '\n' + l).length > MAX) { // flush
      // eslint-disable-next-line no-await-in-loop
      await message.channel.send(buf); buf = '';
    }
    buf += (buf ? '\n' : '') + l;
  }
  if (buf) await message.channel.send(buf);
}
*** End Patch
