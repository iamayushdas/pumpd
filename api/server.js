/* opengym-api — passkey (WebAuthn) auth + per-user state storage for pumpd
   MongoDB storage, signed session cookies.                                */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient, ObjectId } from 'mongodb';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse
} from '@simplewebauthn/server';
import webpush from 'web-push';
import sgMail from '@sendgrid/mail';
import sharp from 'sharp';

const PORT = +(process.env.PORT || 3000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'pumpd';
const DATA = process.env.DATA_DIR || './data';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:8080';
const RP_NAME = process.env.RP_NAME || 'pumpd';
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
const INVITE_ONLY = /^(1|true|yes|on)$/i.test(process.env.INVITE_ONLY || '');
const SESSION_DAYS = Math.max(1, +(process.env.SESSION_DAYS || 90) || 90);
const MAX_BODY = 5 * 1024 * 1024;
const SECURE = /^https:/i.test(ORIGIN) ? ' Secure;' : '';

// Email configuration using SendGrid HTTP API (not blocked by Render)
const stripQuotes = s => s.trim().replace(/^["']|["']$/g, '');
const SENDGRID_API_KEY = stripQuotes(process.env.SENDGRID_API_KEY || process.env.SMTP_PASS || '');
const EMAIL_FROM = stripQuotes(process.env.SMTP_FROM || process.env.SENDER || 'pumpd <noreply@localhost>');

// Initialize SendGrid if API key is present
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('[Email] SendGrid API key configured');
} else {
  console.log('[Email] SendGrid API key not set - emails will not be sent');
}

// Ensure data directory exists for secrets and VAPID keys
fs.mkdirSync(DATA, { recursive: true });

/* ---------- MongoDB client & collections ---------- */
let client;
let db;
let collections = {
  users: null,
  credentials: null,
  subscriptions: null,
  invites: null,
  userStates: null,
  exercises: null,
  media: null,
  accessRequests: null,
  posts: null,
  follows: null,
  likes: null,
  userPhotos: null,
  healthMetrics: null,
  healthSyncLog: null,
  gyms: null,
  managementRequests: null,
  schedules: null,
  customExercises: null,
  diets: null,
  fees: null,
  assignmentLogs: null,
  trainingPlans: null
};

async function connectMongo() {
  const maskedUri = MONGO_URI.replace(/:([^:@]+)@/, ':****@');
  console.log(`Connecting to MongoDB: ${maskedUri}`);
  client = new MongoClient(MONGO_URI, {
    retryWrites: true,
    w: 'majority',
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  await client.connect();
  db = client.db(MONGO_DB);
  
  // Initialize collections with indexes
  collections.users = db.collection('users');
  collections.credentials = db.collection('credentials');
  collections.subscriptions = db.collection('subscriptions');
  collections.invites = db.collection('invites');
  collections.userStates = db.collection('userStates');
  collections.exercises = db.collection('exercises');
  collections.media = db.collection('exercise_media');
  collections.accessRequests = db.collection('accessRequests');
  collections.posts = db.collection('posts');
  collections.follows = db.collection('follows');
  collections.likes = db.collection('likes');
  collections.userPhotos = db.collection('userPhotos');
  collections.healthMetrics = db.collection('healthMetrics');
  collections.healthSyncLog = db.collection('healthSyncLog');
  collections.gyms = db.collection('gyms');
  collections.managementRequests = db.collection('managementRequests');
  collections.schedules = db.collection('schedules');
  collections.customExercises = db.collection('customExercises');
  collections.diets = db.collection('diets');
  collections.fees = db.collection('fees');
  collections.assignmentLogs = db.collection('assignmentLogs');
  collections.trainingPlans = db.collection('trainingPlans');
  
  // Create indexes
  await collections.users.createIndex({ id: 1 }, { unique: true });
  await collections.users.createIndex({ handle: 1 }, { unique: true, sparse: true });
  await collections.credentials.createIndex({ id: 1 }, { unique: true });
  await collections.credentials.createIndex({ userId: 1 });
  await collections.subscriptions.createIndex({ userId: 1 });
  await collections.subscriptions.createIndex({ endpoint: 1 });
  await collections.invites.createIndex({ code: 1 }, { unique: true });
  await collections.userStates.createIndex({ userId: 1 }, { unique: true });
  await collections.exercises.createIndex({ id: 1 });
  await collections.media.createIndex({ filename: 1 });
  await collections.accessRequests.createIndex({ email: 1 });
  await collections.accessRequests.createIndex({ status: 1 });
  
  // Health metrics indexes
  await collections.healthMetrics.createIndex({ userId: 1, date: -1 });
  await collections.healthMetrics.createIndex({ userId: 1, metricType: 1, date: -1 });
  await collections.healthMetrics.createIndex({ date: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
  
  // Health sync log indexes
  await collections.healthSyncLog.createIndex({ userId: 1, syncedAt: -1 });
  await collections.healthSyncLog.createIndex({ userId: 1, platform: 1 });

  // Gym operations indexes
  await collections.gyms.createIndex({ id: 1 }, { unique: true });
  await collections.gyms.createIndex({ ownerId: 1 });
  await collections.managementRequests.createIndex({ status: 1, gymId: 1, created: -1 });
  await collections.managementRequests.createIndex({ requesterId: 1, status: 1 });
  await collections.schedules.createIndex({ gymId: 1, memberId: 1, startAt: 1 });
  await collections.customExercises.createIndex({ gymId: 1, memberId: 1, created: -1 });
  await collections.diets.createIndex({ gymId: 1, memberId: 1, created: -1 });
  await collections.fees.createIndex({ gymId: 1, memberId: 1, dueDate: 1 });
  await collections.assignmentLogs.createIndex({ assignmentId: 1, memberId: 1, created: -1 });
  await collections.assignmentLogs.createIndex({ gymId: 1, created: -1 });
  await collections.trainingPlans.createIndex({ memberId: 1, gymId: 1 }, { unique: true });
  await collections.trainingPlans.createIndex({ trainerId: 1, memberId: 1, updatedAt: -1 });
  
  // Social media indexes
  await collections.posts.createIndex({ userId: 1, created: -1 });
  await collections.posts.createIndex({ created: -1 });
  await collections.follows.createIndex({ followerId: 1, followingId: 1 }, { unique: true });
  await collections.follows.createIndex({ followerId: 1 });
  await collections.follows.createIndex({ followingId: 1 });
  await collections.likes.createIndex({ postId: 1, userId: 1 }, { unique: true });
  await collections.likes.createIndex({ postId: 1 });
  await collections.likes.createIndex({ userId: 1, created: -1 });
  await collections.userPhotos.createIndex({ userId: 1, created: -1 });
  await collections.userPhotos.createIndex({ photoId: 1 }, { unique: true });
  
  console.log(`✓ MongoDB connected: ${MONGO_DB}`);
}

/* ---------- secret + session key ---------- */
const secretFile = path.join(DATA, 'secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(secretFile, 'utf8').trim();

const isAdmin = user => !!user && (user.admin === true || user.role === 'admin' || user.id === 'admin' || ADMIN_UIDS.includes(user.id));
const PERSONA_ROLES = new Set(['member', 'trainer', 'owner']);
const normalizePersona = role => {
  const value = String(role || '').trim().toLowerCase();
  return PERSONA_ROLES.has(value) ? value : 'member';
};
const personaOf = user => {
  if (user?.role === 'admin') return 'admin';
  return PERSONA_ROLES.has(user?.role) ? user.role : (isAdmin(user) ? 'admin' : 'member');
};
const ROLE_NAMES = new Set(['member', 'trainer', 'owner', 'admin']);
const normalizeAssignedRole = role => {
  const value = String(role || '').trim().toLowerCase();
  return ROLE_NAMES.has(value) ? value : 'member';
};
const cleanGymId = value => String(value || '').trim().slice(0, 80) || null;
const publicUser = user => ({
  id: user.id,
  name: user.name,
  role: personaOf(user),
  admin: isAdmin(user),
  gymId: cleanGymId(user.gymId),
  trainerId: String(user.trainerId || '').trim() || null
});
const isOwner = user => !!user && !isAdmin(user) && personaOf(user) === 'owner';
const isTrainer = user => !!user && !isAdmin(user) && personaOf(user) === 'trainer';
const sameGym = (actor, gymId) => !!actor?.gymId && !!gymId && actor.gymId === gymId;
const canManageGym = (actor, gymId) => isAdmin(actor) || (isOwner(actor) && sameGym(actor, gymId));
const canCoachGym = (actor, gymId) => canManageGym(actor, gymId) || (isTrainer(actor) && sameGym(actor, gymId));
const managedRolesFor = actor => isAdmin(actor) ? ['member', 'trainer', 'owner', 'admin'] : ['member', 'trainer'];

async function ensureGym(gymId, name = null, ownerId = null, createdBy = null) {
  const cleanId = cleanGymId(gymId);
  if (!cleanId) return null;
  const existing = await collections.gyms.findOne({ id: cleanId });
  if (!existing) {
    const gym = {
      id: cleanId,
      name: String(name || cleanId).trim().slice(0, 80) || cleanId,
      ownerId: ownerId || null,
      createdBy: createdBy || null,
      created: new Date().toISOString()
    };
    await collections.gyms.insertOne(gym);
    return gym;
  }
  if (ownerId && !existing.ownerId) {
    await collections.gyms.updateOne({ id: cleanId }, { $set: { ownerId } });
  }
  return existing;
}

async function requireOrgManager(req, res) {
  const user = await readSession(req);
  if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
  if (!isAdmin(user) && !isOwner(user)) { json(res, 403, { error: 'owner or admin access required' }); return null; }
  return user;
}

async function requireCoach(req, res) {
  const user = await readSession(req);
  if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
  if (!['admin', 'owner', 'trainer'].includes(personaOf(user))) { json(res, 403, { error: 'trainer, owner, or admin access required' }); return null; }
  return user;
}

/* ---------- push notifications (Web Push / VAPID) ---------- */
const vapidFile = path.join(DATA, 'vapid.json');
let vapid;
try { vapid = JSON.parse(fs.readFileSync(vapidFile, 'utf8')); }
catch { vapid = webpush.generateVAPIDKeys(); fs.writeFileSync(vapidFile, JSON.stringify(vapid), { mode: 0o600 }); }
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || (SECURE ? ORIGIN : 'mailto:admin@localhost');
webpush.setVapidDetails(VAPID_SUBJECT, vapid.publicKey, vapid.privateKey);

async function sendPush(userId, payload) {
  const subs = await collections.subscriptions.find({ userId }).toArray();
  if (!subs.length) return;
  const body = JSON.stringify(payload);
  let failed = [];
  
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        body
      );
    } catch (e) {
      console.error('[Push] Send failed:', e.statusCode, e.body || e.message);
      if (e.statusCode === 404 || e.statusCode === 410) {
        failed.push(sub.endpoint);
      }
    }
  }));
  
  if (failed.length) {
    await collections.subscriptions.deleteMany({ endpoint: { $in: failed } });
  }
}

/* ---------- rest timer alerts ---------- */
const restTimers = new Map();
function scheduleRestTimer(userId, sec) {
  const t = restTimers.get(userId);
  if (t) clearTimeout(t);
  restTimers.set(userId, setTimeout(() => {
    restTimers.delete(userId);
    sendPush(userId, { title: 'Rest over 💪', body: 'Time for your next set.', tag: 'rest-timer' });
  }, sec * 1000));
}

/* ---------- email sending ---------- */
async function sendEmail(to, subject, text, html) {
  console.log('[Email] sendEmail called with:', { to, subject });
  
  if (!SENDGRID_API_KEY) {
    console.log('[Email] Skipping email to', to, '- SendGrid API key not configured');
    return { skipped: true };
  }
  
  try {
    console.log('[Email] Sending email via SendGrid HTTP API to', to);
    const msg = {
      to,
      from: EMAIL_FROM,
      subject,
      text,
      html
    };
    
    const response = await sgMail.send(msg);
    console.log('[Email] Sent to', to, '- Status:', response[0].statusCode);
    return { success: true, messageId: response[0].headers['x-message-id'] };
  } catch (e) {
    console.error('[Email] Failed to send to', to, ':', e.message);
    console.error('[Email] Error code:', e.code || 'no code');
    console.error('[Email] Error response:', e.response?.body || 'no response');
    return { error: e.message, code: e.code || 'unknown', response: e.response?.body || 'no response' };
  }
}

async function sendAccessRequestNotification(requesterEmail, requesterName, message) {
  const adminEmail = process.env.ADMIN_EMAIL || EMAIL_FROM.match(/<(.+)>/)?.[1] || EMAIL_FROM;
  const subject = `New Access Request from ${requesterName}`;
  const text = `New access request received!\n\nName: ${requesterName}\nEmail: ${requesterEmail}\n${message ? `Message: ${message}\n` : ''}\nReview and approve at: ${ORIGIN}/admin`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #30d158;">New Access Request</h2>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p style="margin: 0 0 8px;"><strong>Name:</strong> ${requesterName}</p>
        <p style="margin: 0 0 8px;"><strong>Email:</strong> ${requesterEmail}</p>
        ${message ? `<p style="margin: 0;"><strong>Message:</strong> ${message}</p>` : ''}
      </div>
      <p><a href="${ORIGIN}/admin" style="display: inline-block; background: #30d158; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Review Request</a></p>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">— ${RP_NAME}</p>
    </div>
  `;
  
  return sendEmail(adminEmail, subject, text, html);
}

async function sendInviteCodeEmail(email, name, code, assignedRole = 'member', gymId = null) {
  const subject = `Your ${RP_NAME} Invite Code - Let's Get Started!`;
  
  // Create a direct login URL with encoded parameters
  const directLoginUrl = `${ORIGIN}?invite=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`;
  
  const text = `Hi ${name},\n\nGreat news! Your access request has been approved.\n\nAssigned role: ${assignedRole}${gymId ? `\nGym: ${gymId}` : ''}\nYour invite code is: ${code}\n\nQuick start:\nClick here to get started: ${directLoginUrl}\n\nOr enter manually:\n1. Visit ${ORIGIN}\n2. Click "New Profile" tab\n3. Enter your name\n4. Enter your invite code: ${code}\n5. Set up your passkey (fingerprint, face ID, or security key)\n6. Start tracking your workouts!\n\nWelcome to ${RP_NAME}!`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #30d158;">Welcome to ${RP_NAME}! 💪</h2>
      <p>Hi ${name},</p>
      <p>Great news! Your access request has been approved.</p>
      <p><strong>Assigned role:</strong> ${assignedRole}${gymId ? ` · Gym: ${gymId}` : ''}</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
        <p style="margin: 0 0 10px; color: #666; font-size: 14px;">Your Invite Code</p>
        <p style="margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 2px; color: #000; user-select: all;">${code}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <p style="margin: 0 0 12px; color: #333; font-size: 14px;">Or get started instantly with this link:</p>
        <a href="${directLoginUrl}" style="display: inline-block; background: #30d158; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Started →</a>
      </div>
      
      <h3 style="color: #333; font-size: 18px; margin: 30px 0 15px;">Manual setup:</h3>
      <ol style="line-height: 1.8; color: #333;">
        <li>Visit <a href="${ORIGIN}" style="color: #30d158; font-weight: 600;">${ORIGIN}</a></li>
        <li>Click the <strong>"New Profile"</strong> tab</li>
        <li>Enter your name</li>
        <li>Enter your invite code: <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 14px;">${code}</code></li>
        <li>Set up your <strong>passkey</strong> (fingerprint, face ID, or security key)</li>
        <li>Start tracking your workouts!</li>
      </ol>
      
      <p style="color: #666; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
        Questions? Reply to this email.<br>
        Welcome aboard!<br>
        — The ${RP_NAME} Team
      </p>
    </div>
  `;
  
  return sendEmail(email, subject, text, html);
}
function cancelRestTimer(userId) {
  const t = restTimers.get(userId);
  if (t) { clearTimeout(t); restTimers.delete(userId); }
}

/* ---------- workout reminders ---------- */
function effectiveRoutineId(S, iso) {
  const ov = S.dayPlan?.[iso];
  if (ov === 'rest') return null;
  if (ov && S.routines?.some(r => r.id === ov)) return ov;
  const wd = new Date(iso + 'T12:00:00').getDay();
  return S.week?.[wd] || null;
}

function userNow(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).formatToParts(new Date());
    const g = t => parts.find(p => p.type === t)?.value;
    return { date: `${g('year')}-${g('month')}-${g('day')}`, hhmm: `${g('hour')}:${g('minute')}` };
  } catch { return null; }
}

// Start reminder loop only after MongoDB is connected
function startReminderLoop() {
  setInterval(async () => {
    try {
      if (!collections.users) return; // Skip if not connected
      
      const users = await collections.users.find({}).toArray();
      for (const user of users) {
        const hasSubs = await collections.subscriptions.findOne({ userId: user.id });
        if (!hasSubs) continue;
        
        const state = await collections.userStates.findOne({ userId: user.id });
        if (!state) continue;

        const now = userNow(state.reminder?.tz || 'UTC');
        if (!now || state.reminder?.on !== true || state.reminder.time !== now.hhmm) continue;
        const workoutDue = user.lastReminder !== now.date && !(state.workouts || []).some(w => w.d === now.date);

        // Fees are manual by design: remind members three days before the due date,
        // once per day, and keep the existing workout reminder independent.
        const reminderUntil = Date.parse(now.date + 'T23:59:59Z') + 3 * 86400000;
        const feeRecords = await collections.fees.find({
          memberId: user.id,
          status: { $in: ['due', 'overdue'] }
        }).toArray();
        for (const fee of feeRecords) {
          const due = Date.parse(String(fee.dueDate || '') + 'T23:59:59Z');
          if (!Number.isFinite(due) || due > reminderUntil || fee.lastReminder === now.date) continue;
          const overdue = due < Date.parse(now.date + 'T00:00:00Z');
          await collections.fees.updateOne({ _id: fee._id }, { $set: { status: overdue ? 'overdue' : 'due', lastReminder: now.date } });
          sendPush(user.id, {
            title: overdue ? 'Membership fee overdue' : 'Membership fee due soon',
            body: `${fee.amount || ''} ${fee.currency || ''} · due ${fee.dueDate}`.trim(),
            tag: 'fee-reminder-' + fee._id
          });
        }

        if (!workoutDue) continue;
        const rid = effectiveRoutineId(state, now.date);
        if (!rid) continue;

        const routine = (state.routines || []).find(r => r.id === rid);
        console.log('reminder firing', user.id, rid);
        
        await collections.users.updateOne({ id: user.id }, { $set: { lastReminder: now.date } });
        sendPush(user.id, {
          title: routine ? `${routine.emoji || '🏋️'} ${routine.name} today` : 'Workout planned today',
          body: "It's on your plan — let's go 💪",
          tag: 'day-reminder'
        });
      }
    } catch (e) {
      console.error('reminder loop error:', e.message);
    }
  }, 10000).unref();
}

/* ---------- self-referencing reloader (keep-alive for Render) ---------- */
async function startKeepAliveReloader() {
  // Only start keep-alive on production (when ORIGIN is not localhost)
  if (ORIGIN.includes('localhost') || ORIGIN.includes('127.0.0.1')) {
    console.log('[Keep-Alive] Disabled on local development');
    return;
  }
  
  const httpModule = ORIGIN.startsWith('https') ? await import('https') : await import('http');
  const interval = 30000; // 30 seconds
  
  function reloadServer() {
    try {
      httpModule.get(ORIGIN, (res) => {
        if (res.statusCode === 200) {
          console.log(`[Keep-Alive] Pinged at ${new Date().toISOString()} (${res.statusCode})`);
        } else {
          console.warn(`[Keep-Alive] Unexpected status: ${res.statusCode}`);
        }
      }).on('error', (err) => {
        console.error(`[Keep-Alive] Ping failed: ${err.message}`);
      }).setTimeout(5000);
    } catch (err) {
      console.error(`[Keep-Alive] Error: ${err.message}`);
    }
  }
  
  setInterval(reloadServer, interval).unref();
  console.log(`[Keep-Alive] Started: pinging every ${interval / 1000}s to keep Render instance active`);
}

/* ---------- sessions (signed cookie) ---------- */
function sign(payload) {
  const mac = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return payload + '.' + mac;
}

function verifySig(token) {
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const payload = token.slice(0, i), mac = token.slice(i + 1);
  const expect = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  } catch { return null; }
  return payload;
}

const sessionVersion = user => user.sv || 0;

function makeSession(user) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  return sign(user.id + ':' + exp + ':' + sessionVersion(user));
}

async function readSession(req) {
  const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(c => {
    const i = c.indexOf('='); return i < 0 ? ['', ''] : [c.slice(0, i).trim(), c.slice(i + 1).trim()];
  }));
  const tok = cookies.gymsid;
  if (!tok) return null;
  const payload = verifySig(tok);
  if (!payload) return null;
  const [uid, exp, ver] = payload.split(':');
  if (!uid || +exp < Date.now()) return null;
  const user = await collections.users.findOne({ id: uid });
  if (!user) return null;
  if (user.disabled) return null;
  const claimed = ver === undefined ? 0 : Number(ver);
  if (!Number.isInteger(claimed) || claimed !== sessionVersion(user)) return null;
  return user;
}

async function requireAdmin(req, res) {
  const user = await readSession(req);
  if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
  if (!isAdmin(user)) { json(res, 403, { error: 'forbidden' }); return null; }
  return user;
}

function sessionCookie(user) {
  return `gymsid=${makeSession(user)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly;${SECURE} SameSite=Lax`;
}

const clearCookie = `gymsid=; Path=/; Max-Age=0; HttpOnly;${SECURE} SameSite=Lax`;

/* ---------- challenge store (in-memory, 5 min TTL) ---------- */
const challenges = new Map();
function putChallenge(data) {
  const cid = crypto.randomBytes(16).toString('base64url');
  challenges.set(cid, { ...data, exp: Date.now() + 5 * 60000 });
  return cid;
}
function takeChallenge(cid) {
  const c = challenges.get(cid);
  challenges.delete(cid);
  if (!c || c.exp < Date.now()) return null;
  return c;
}
setInterval(() => { for (const [k, v] of challenges) if (v.exp < Date.now()) challenges.delete(k); }, 60000).unref();

/* ---------- helpers ---------- */
function json(res, code, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(extraHeaders || {}) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', d => {
      size += d.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(d);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

const b64uToBuf = s => Buffer.from(s, 'base64url');

/* ---------- live presence (in-memory) ---------- */
const presence = new Map();
const PRESENCE_TTL = 70000;
function livePresence(uid) {
  const p = presence.get(uid);
  if (!p) return null;
  if (Date.now() - p.updatedAt > PRESENCE_TTL) { presence.delete(uid); return null; }
  return p;
}
setInterval(() => { for (const [k, v] of presence) if (Date.now() - v.updatedAt > PRESENCE_TTL) presence.delete(k); }, 30000).unref();

/* ---------- routes ---------- */
const routes = {
  'GET /api/health': async (req, res) => {
    const count = await collections.users.countDocuments();
    json(res, 200, { ok: true, users: count });
  },

  'GET /api/config': async (req, res) => {
    const userCount = await collections.users.countDocuments();
    json(res, 200, {
      invite_only: INVITE_ONLY && userCount > 0,
      user_count: userCount
    });
  },

  // Exercise JSON dataset from MongoDB
  'GET /api/exercises': async (req, res) => {
    try {
      const exercises = await collections.exercises.find({}).toArray();
      json(res, 200, { exercises });
    } catch (e) {
      console.error('exercises list error', e.message);
      json(res, 500, { error: 'failed to fetch exercises' });
    }
  },

  'GET /api/me': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    json(res, 200, { user: publicUser(user) });
  },

  'POST /api/register/options': async (req, res) => {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) return json(res, 400, { error: 'name required' });
    const code = String(body.code || '').trim().toUpperCase();
    
    const userCount = await collections.users.countDocuments();
    let invite = null;
    if (INVITE_ONLY && userCount > 0) {
      invite = await collections.invites.findOne({ code, usedBy: null, revoked: { $ne: true } });
      if (!invite) return json(res, 403, { error: 'a valid invite code is required' });
    }
    // An approved invite is authoritative. This prevents a member from changing
    // the role selected by an admin/owner during the registration form.
    const role = normalizePersona(invite?.assignedRole || body.role);
    const gymId = cleanGymId(invite?.gymId || body.gymId);
    
    const uid = crypto.randomBytes(12).toString('base64url');
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: RP_ID,
      userID: Buffer.from(uid), userName: name, userDisplayName: name,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      excludeCredentials: []
    });
    const cid = putChallenge({ challenge: options.challenge, name, uid, code, role, gymId });
    json(res, 200, { cid, options });
  },

  'POST /api/register/verify': async (req, res) => {
    const body = await readBody(req);
    const c = takeChallenge(body.cid);
    if (!c || !c.uid) return json(res, 400, { error: 'challenge expired — try again' });
    
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: c.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false
      });
    } catch (e) { return json(res, 400, { error: 'verification failed: ' + e.message }); }
    
    if (!verification.verified) return json(res, 400, { error: 'not verified' });
    const { credential } = verification.registrationInfo;
    
    const existingCred = await collections.credentials.findOne({ id: credential.id });
    if (existingCred) return json(res, 409, { error: 'credential already registered' });
    
    const userCount = await collections.users.countDocuments();
    let invite = null;
    if (INVITE_ONLY && userCount > 0) {
      invite = await collections.invites.findOne({ code: c.code, usedBy: null, revoked: { $ne: true } });
      if (!invite) return json(res, 403, { error: 'invite code is no longer valid — ask for a new one' });
    }
    
    const user = {
      id: c.uid,
      name: c.name,
      role: c.role || 'member',
      gymId: cleanGymId(c.gymId),
      created: new Date().toISOString(),
      admin: userCount === 0 || ADMIN_UIDS.includes(c.uid)
    };
    if (invite) {
      user.invitedBy = invite.code;
      user.role = normalizeAssignedRole(invite.assignedRole || user.role);
      user.gymId = cleanGymId(invite.gymId || user.gymId);
      await collections.invites.updateOne({ code: c.code }, { $set: { usedBy: user.id, usedAt: user.created } });
    }
    
    await collections.users.insertOne(user);
    if (user.gymId) {
      await ensureGym(user.gymId, user.gymId, user.role === 'owner' ? user.id : null, user.id);
    }
    await collections.credentials.insertOne({
      id: credential.id,
      userId: user.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter || 0,
      transports: body.credential?.response?.transports || []
    });
    
    json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(user) });
  },

  'POST /api/login/options': async (req, res) => {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID, userVerification: 'preferred', allowCredentials: []
    });
    const cid = putChallenge({ challenge: options.challenge });
    json(res, 200, { cid, options });
  },

  'POST /api/login/verify': async (req, res) => {
    const body = await readBody(req);
    const c = takeChallenge(body.cid);
    if (!c) return json(res, 400, { error: 'challenge expired — try again' });
    
    const cred = await collections.credentials.findOne({ id: body.credential?.id });
    if (!cred) return json(res, 404, { error: 'unknown passkey — create a profile first' });
    
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.credential,
        expectedChallenge: c.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
        credential: {
          id: cred.id,
          publicKey: b64uToBuf(cred.publicKey),
          counter: cred.counter,
          transports: cred.transports
        }
      });
    } catch (e) { return json(res, 400, { error: 'verification failed: ' + e.message }); }
    
    if (!verification.verified) return json(res, 400, { error: 'not verified' });
    
    await collections.credentials.updateOne(
      { id: cred.id },
      { $set: { counter: verification.authenticationInfo.newCounter } }
    );
    
    const user = await collections.users.findOne({ id: cred.userId });
    if (!user) return json(res, 500, { error: 'user missing' });
    if (user.disabled) return json(res, 403, { error: 'this account has been disabled' });
    
    json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(user) });
  },

  'POST /api/logout': async (req, res) => json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie }),

  'POST /api/logout/all': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const newVersion = sessionVersion(user) + 1;
    await collections.users.updateOne({ id: user.id }, { $set: { sv: newVersion } });
    json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie });
  },

  'GET /api/data': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const state = await collections.userStates.findOne({ userId: user.id });
    json(res, 200, { state: state ? state.data : null });
  },

  'PUT /api/data': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    if (!body.state || typeof body.state !== 'object') return json(res, 400, { error: 'state required' });
    
    delete body.state.active;
    
    await collections.userStates.updateOne(
      { userId: user.id },
      { $set: { data: body.state, updatedAt: new Date() } },
      { upsert: true }
    );
    
    json(res, 200, { ok: true, ts: body.state._ts || null });
  },

  'GET /api/push/public-key': async (req, res) => json(res, 200, { key: vapid.publicKey }),

  'POST /api/push/subscribe': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const sub = body.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json(res, 400, { error: 'invalid subscription' });
    
    await collections.subscriptions.deleteMany({ endpoint: sub.endpoint });
    await collections.subscriptions.insertOne({
      userId: user.id,
      endpoint: sub.endpoint,
      keys: sub.keys,
      created: new Date().toISOString()
    });
    
    json(res, 200, { ok: true });
  },

  'POST /api/push/unsubscribe': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    await collections.subscriptions.deleteOne({ userId: user.id, endpoint: body.endpoint });
    json(res, 200, { ok: true });
  },

  'POST /api/push/test': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    await sendPush(user.id, { title: 'pumpd', body: 'Test notification ✅ — this is what alerts look like.', tag: 'test' });
    json(res, 200, { ok: true });
  },

  'POST /api/push/rest-timer': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const sec = Math.max(1, Math.min(3600, Math.round(+body.seconds || 0)));
    if (!sec) return json(res, 400, { error: 'seconds required' });
    scheduleRestTimer(user.id, sec);
    json(res, 200, { ok: true });
  },

  'POST /api/push/rest-timer/cancel': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    cancelRestTimer(user.id);
    json(res, 200, { ok: true });
  },

  'POST /api/activity': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    if (body.active) {
      presence.set(user.id, {
        name: String(body.name || '').slice(0, 60),
        exIdx: +body.exIdx || 0, exTotal: +body.exTotal || 0,
        setsDone: +body.setsDone || 0, setsTotal: +body.setsTotal || 0,
        startedAt: +body.startedAt || Date.now(),
        updatedAt: Date.now()
      });
    } else presence.delete(user.id);
    json(res, 200, { ok: true });
  },

  'POST /api/admin/login': async (req, res) => {
    const body = await readBody(req);
    const code = String(body.code || body.password || '').trim();
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();

    const validUser = process.env.ADMIN_USER || process.env.ADMIN_USERNAME || 'admin';
    const validPass = process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || 'admin';

    // Matches if code/password equals validPass OR if code equals "admin:" + validPass OR username/password match
    const isCodeMatch = (code && (code === validPass || code === `admin:${validPass}`));
    const isCredsMatch = (username && password && username === validUser && password === validPass);

    if (!isCodeMatch && !isCredsMatch) {
      return json(res, 401, { error: 'Invalid admin code' });
    }

    let adminUser = await collections.users.findOne({ id: 'admin' });
    if (!adminUser) {
      adminUser = {
        id: 'admin',
        name: 'Admin',
        role: 'admin',
        created: new Date().toISOString(),
        admin: true
      };
      await collections.users.insertOne(adminUser);
    } else if (!adminUser.admin) {
      await collections.users.updateOne({ id: 'admin' }, { $set: { admin: true } });
      adminUser.admin = true;
    }

    json(res, 200, {
      user: publicUser(adminUser)
    }, { 'Set-Cookie': sessionCookie(adminUser) });
  },

  /* ---------- gyms and role operations ---------- */
  'GET /api/gyms': async (req, res) => {
    const gyms = await collections.gyms.find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ name: 1 }).toArray();
    const knownGymIds = new Set(gyms.map(g => g.id));
    const userGymIds = await collections.users.distinct('gymId', { gymId: { $ne: null, $nin: ['', '__unassigned__'] } });
    for (const gid of userGymIds) {
      if (gid && !knownGymIds.has(gid)) {
        await ensureGym(gid, gid, null, null);
        gyms.push({ id: gid, name: gid });
        knownGymIds.add(gid);
      }
    }
    gyms.sort((a, b) => a.name.localeCompare(b.name));
    json(res, 200, { gyms });
  },

  'GET /api/admin/gyms': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const gyms = await collections.gyms.find(isAdmin(manager) ? {} : { id: manager.gymId || '__unassigned__' }).sort({ name: 1 }).toArray();
    json(res, 200, { gyms });
  },

  'POST /api/admin/gyms': async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) return json(res, 400, { error: 'gym name required' });
    const id = cleanGymId(body.id) || crypto.randomBytes(8).toString('hex');
    if (await collections.gyms.findOne({ id })) return json(res, 409, { error: 'gym id already exists' });
    const gym = { id, name, ownerId: null, createdBy: admin.id, created: new Date().toISOString() };
    await collections.gyms.insertOne(gym);
    json(res, 200, { gym });
  },

  /* ---------- admin dashboard ---------- */
  'GET /api/admin/users': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const users = await collections.users.find(isAdmin(manager) ? {} : { gymId: manager.gymId || '__unassigned__' }).toArray();
    const result = [];
    
    for (const u of users) {
      const state = await collections.userStates.findOne({ userId: u.id });
      const S = state?.data || {};
      const workouts = S.workouts || [];
      const last = workouts[workouts.length - 1];
      const hasSubs = await collections.subscriptions.findOne({ userId: u.id });
      
      result.push({
        id: u.id, name: u.name, created: u.created || null,
        disabled: !!u.disabled, role: personaOf(u), admin: isAdmin(u), invitedBy: u.invitedBy || null,
        workouts: workouts.length,
        lastWorkout: last ? last.d : null,
        lastSync: S._ts || null,
        hasPush: !!hasSubs,
        live: livePresence(u.id)
      });
    }
    
    json(res, 200, { users: result, invite_only: INVITE_ONLY, now: Date.now() });
  },

  'GET /api/admin/user': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    const u = await collections.users.findOne({ id });
    if (!u) return json(res, 404, { error: 'no such user' });
    if (!isAdmin(manager) && !sameGym(manager, u.gymId)) return json(res, 403, { error: 'outside your gym' });
    
    const state = await collections.userStates.findOne({ userId: u.id });
    const S = state?.data || {};
    
    json(res, 200, {
      user: { id: u.id, name: u.name, role: personaOf(u), created: u.created || null, disabled: !!u.disabled, admin: isAdmin(u), invitedBy: u.invitedBy || null },
      unit: S.unit || 'kg',
      lastSync: S._ts || null,
      routines: (S.routines || []).map(r => ({ id: r.id, name: r.name, emoji: r.emoji, count: (r.ex || []).length })),
      bodyweight: S.bodyweight || [],
      workouts: (S.workouts || []).slice().reverse()
    });
  },

  'POST /api/admin/user/disable': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const u = await collections.users.findOne({ id: body.id });
    if (!u) return json(res, 404, { error: 'no such user' });
    if (!isAdmin(manager) && !sameGym(manager, u.gymId)) return json(res, 403, { error: 'outside your gym' });
    if (isAdmin(u) || (!isAdmin(manager) && isOwner(u))) return json(res, 400, { error: 'cannot disable this account' });
    
    await collections.users.updateOne({ id: body.id }, { $set: { disabled: !!body.disabled } });
    if (body.disabled) presence.delete(body.id);
    
    json(res, 200, { ok: true, id: body.id, disabled: !!body.disabled });
  },

  'POST /api/admin/user/role': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const u = await collections.users.findOne({ id: String(body.id || '') });
    if (!u) return json(res, 404, { error: 'no such user' });
    if (!isAdmin(manager) && !sameGym(manager, u.gymId)) return json(res, 403, { error: 'outside your gym' });

    const role = normalizeAssignedRole(body.role);
    const gymId = cleanGymId(body.gymId || u.gymId || manager.gymId);
    const trainerId = String(body.trainerId || '').trim() || null;
    if (!managedRolesFor(manager).includes(role)) return json(res, 403, { error: 'you cannot assign that role' });
    if (!isAdmin(manager) && !sameGym(manager, gymId)) return json(res, 403, { error: 'owners can only assign inside their gym' });
    if (isAdmin(u) && !isAdmin(manager)) return json(res, 403, { error: 'cannot change an admin' });

    if (trainerId) {
      const trainer = await collections.users.findOne({ id: trainerId });
      if (!trainer || personaOf(trainer) !== 'trainer' || !sameGym(manager, trainer.gymId) && !isAdmin(manager)) return json(res, 400, { error: 'trainer must belong to the same gym' });
    }
    const update = { $set: { role, admin: role === 'admin', gymId } };
    if (role === 'member' && trainerId) update.$set.trainerId = trainerId;
    else update.$unset = { trainerId: '' };
    await collections.users.updateOne({ id: u.id }, update);
    if (gymId) {
      await ensureGym(gymId, gymId, role === 'owner' ? u.id : null, manager.id);
    }
    if (role === 'owner' && gymId) {
      await collections.gyms.updateOne({ id: gymId }, { $set: { ownerId: u.id } });
    } else if (u.role === 'owner' && u.gymId && u.gymId !== gymId) {
      await collections.gyms.updateOne({ id: u.gymId, ownerId: u.id }, { $set: { ownerId: null } });
    }
    json(res, 200, { ok: true, user: publicUser({ ...u, role, admin: role === 'admin', gymId, trainerId: role === 'member' ? trainerId : null }) });
  },

  'GET /api/admin/invites': async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const invites = await collections.invites.find({}).toArray();
    const result = [];
    
    for (const i of invites) {
      let usedByName = null;
      if (i.usedBy) {
        const user = await collections.users.findOne({ id: i.usedBy });
        usedByName = user?.name || null;
      }
      result.push({ ...i, usedByName });
    }
    
    json(res, 200, { invites: result, invite_only: INVITE_ONLY });
  },

  'POST /api/admin/invites/new': async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readBody(req);
    
    let code;
    do { code = crypto.randomBytes(8).toString('hex').toUpperCase(); }
    while (await collections.invites.findOne({ code }));
    
    const invite = { code, note: String(body.note || '').slice(0, 60), createdBy: admin.id, created: new Date().toISOString() };
    await collections.invites.insertOne(invite);
    
    json(res, 200, { invite });
  },

  'POST /api/admin/invites/revoke': async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const body = await readBody(req);
    const inv = await collections.invites.findOne({ code: String(body.code || '').toUpperCase() });
    if (!inv) return json(res, 404, { error: 'no such code' });
    if (inv.usedBy) return json(res, 400, { error: 'already used — cannot revoke' });
    
    await collections.invites.deleteOne({ code: inv.code });
    json(res, 200, { ok: true });
  },

  /* ---------- access requests ---------- */
  'POST /api/access-request': async (req, res) => {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 100);
    const name = String(body.name || '').trim().slice(0, 40);
    const requestedRole = normalizePersona(body.requestedRole);
    const gymId = cleanGymId(body.gymId);
    
    if (!email || !name) return json(res, 400, { error: 'email and name are required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'invalid email' });
    
    // Check if already requested
    const existing = await collections.accessRequests.findOne({ email, status: 'pending' });
    if (existing) return json(res, 200, { message: 'your request has already been submitted' });
    
    const request = {
      email,
      name,
      status: 'pending',
      created: new Date().toISOString(),
      message: String(body.message || '').slice(0, 500),
      requestedRole,
      gymId
    };
    
    await collections.accessRequests.insertOne(request);
    if (gymId) {
      await ensureGym(gymId, gymId, null, null);
    }
    
    // Send email notification to admin
    console.log('[Access Request] New request from:', name, email);
    sendAccessRequestNotification(email, name, request.message)
      .then(result => console.log('[Access Request] Admin notification sent:', result.success ? 'success' : 'failed'))
      .catch(err => console.error('[Access Request] Failed to send admin notification:', err.message));
    
    json(res, 200, { message: 'access request submitted successfully' });
  },

  'GET /api/admin/access-requests': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const query = isAdmin(manager) ? {} : { gymId: manager.gymId || '__unassigned__', requestedRole: { $in: ['member', 'trainer'] } };
    const requests = await collections.accessRequests.find(query).sort({ created: -1 }).toArray();
    json(res, 200, { requests });
  },

  'POST /api/admin/access-request/approve': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const requestId = body.id;
    
    if (!requestId) return json(res, 400, { error: 'request id required' });
    
    const request = await collections.accessRequests.findOne({ _id: new ObjectId(requestId) });
    if (!request) return json(res, 404, { error: 'request not found' });
    if (request.status !== 'pending') return json(res, 400, { error: 'request already processed' });
    
    const requestedRole = normalizeAssignedRole(body.role || request.requestedRole || 'member');
    const gymId = cleanGymId(body.gymId || request.gymId || manager.gymId);
    if (!isAdmin(manager) && (!sameGym(manager, gymId) || !['member', 'trainer'].includes(requestedRole))) {
      return json(res, 403, { error: 'owners can only approve member or trainer requests for their gym' });
    }

    // Generate invite code
    let code;
    do { code = crypto.randomBytes(8).toString('hex').toUpperCase(); }
    while (await collections.invites.findOne({ code }));
    
    const invite = {
      code,
      note: `For ${request.name} (${request.email})`,
      createdBy: manager.id,
      created: new Date().toISOString(),
      forEmail: request.email,
      assignedRole: requestedRole,
      gymId
    };
    
    await collections.invites.insertOne(invite);
    if (gymId) {
      await ensureGym(gymId, gymId, requestedRole === 'owner' ? null : null, manager.id);
    }
    await collections.accessRequests.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'approved', approvedBy: manager.id, approvedAt: new Date().toISOString(), inviteCode: code, assignedRole: requestedRole, gymId } }
    );
    
    // Send invite code via email
    console.log('[Access Request] Approving request for:', request.email, '- Code:', code);
    const emailResult = await sendInviteCodeEmail(request.email, request.name, code, requestedRole, gymId);
    console.log('[Access Request] Email result:', JSON.stringify(emailResult));
    
    json(res, 200, { ok: true, code, emailSent: emailResult.success || false, emailError: emailResult.error || null });
  },

  'POST /api/admin/access-request/reject': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const requestId = body.id;
    
    if (!requestId) return json(res, 400, { error: 'request id required' });
    
    const request = await collections.accessRequests.findOne({ _id: new ObjectId(requestId) });
    if (!request) return json(res, 404, { error: 'request not found' });
    if (request.status !== 'pending') return json(res, 400, { error: 'request already processed' });
    
    await collections.accessRequests.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'rejected', rejectedBy: manager.id, rejectedAt: new Date().toISOString() } }
    );
    
    json(res, 200, { ok: true });
  },

  /* ---------- gym management ---------- */
  'GET /api/management/overview': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    const role = personaOf(user);
    const gymId = cleanGymId(user.gymId);
    const managed = isAdmin(user) || isOwner(user);
    let trainerUser = role === 'member' && user.trainerId ? await collections.users.findOne({ id: user.trainerId }) : null;
    const sameGymQuery = isAdmin(user) ? {} : { gymId: gymId || '__unassigned__' }

    const members = managed || isTrainer(user)
      ? await collections.users.find(isAdmin(user) ? {} : { ...sameGymQuery, role: { $in: ['member', 'trainer'] } }, { projection: { id: 1, name: 1, role: 1, gymId: 1, trainerId: 1, disabled: 1 } }).sort({ name: 1 }).toArray()
      : [{ id: user.id, name: user.name, role, gymId, trainerId: user.trainerId || null, disabled: !!user.disabled }];
    const requests = managed
      ? await collections.managementRequests.find(isAdmin(user) ? { status: 'pending' } : { status: 'pending', gymId: gymId || '__unassigned__' }).sort({ created: -1 }).limit(50).toArray()
      : await collections.managementRequests.find({ requesterId: user.id }).sort({ created: -1 }).limit(20).toArray();
    const scheduleQuery = managed || isTrainer(user) ? sameGymQuery : { memberId: user.id };
    const assignmentQuery = managed || isTrainer(user) ? sameGymQuery : { memberId: user.id };
    const feeQuery = managed ? sameGymQuery : { memberId: user.id };
    const logQuery = managed || isTrainer(user) ? sameGymQuery : { memberId: user.id };
    const trainingPlanQuery = managed || isTrainer(user) ? sameGymQuery : { memberId: user.id };

    const [schedules, exercises, diets, fees, logs, trainingPlans, gyms] = await Promise.all([
      collections.schedules.find(scheduleQuery).sort({ startAt: 1, created: -1 }).limit(100).toArray(),
      collections.customExercises.find(assignmentQuery).sort({ created: -1 }).limit(100).toArray(),
      collections.diets.find(assignmentQuery).sort({ created: -1 }).limit(100).toArray(),
      collections.fees.find(feeQuery).sort({ dueDate: 1, created: -1 }).limit(100).toArray(),
      collections.assignmentLogs.find(logQuery).sort({ created: -1 }).limit(250).toArray(),
      collections.trainingPlans.find(trainingPlanQuery).sort({ updatedAt: -1, created: -1 }).limit(100).toArray(),
      collections.gyms.find(isAdmin(user) ? {} : { id: gymId }, { projection: { _id: 0, id: 1, name: 1 } }).toArray()
    ]);
    // Older assignments may predate an explicit trainer association. Treat the
    // latest assigned plan as the member's trainer so it still surfaces in Plan.
    if (!trainerUser && role === 'member') {
      const assigned = [...trainingPlans, ...schedules, ...exercises, ...diets].find(item => item.memberId === user.id && item.trainerId);
      if (assigned) trainerUser = await collections.users.findOne({ id: assigned.trainerId });
    }

    json(res, 200, {
      viewer: publicUser(user),
      trainer: trainerUser ? publicUser(trainerUser) : null,
      permissions: {
        canApprove: managed,
        canAssign: ['admin', 'owner', 'trainer'].includes(role),
        canManageFees: isAdmin(user) || isOwner(user),
        canManageRoles: managed,
        canSubmitFees: role === 'member'
      },
      gyms,
      members: members.map(m => ({ id: m.id, name: m.name, role: personaOf(m), gymId: m.gymId || null, trainerId: m.trainerId || null, disabled: !!m.disabled })),
      requests,
      schedules,
      exercises,
      diets,
      fees,
      logs,
      trainingPlans,
      trainingPlan: role === 'member' ? (trainingPlans[0] || null) : null
    });
  },

  'POST /api/management/request': async (req, res) => {
    const requester = await readSession(req);
    if (!requester) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const requestedRole = normalizePersona(body.requestedRole || body.role);
    const gymId = cleanGymId(body.gymId || requester.gymId);
    if (!gymId) return json(res, 400, { error: 'gym id required' });
    if (requestedRole === 'owner') return json(res, 403, { error: 'owner access must be assigned by an admin' });
    const existing = await collections.managementRequests.findOne({ requesterId: requester.id, status: 'pending' });
    if (existing) return json(res, 200, { request: existing, message: 'request already pending' });
    const request = {
      type: requester.gymId ? 'role-change' : 'join-gym',
      requesterId: requester.id,
      requesterName: requester.name,
      gymId,
      requestedRole,
      message: String(body.message || '').trim().slice(0, 500),
      status: 'pending',
      created: new Date().toISOString()
    };
    const result = await collections.managementRequests.insertOne(request);
    if (gymId) {
      await ensureGym(gymId, gymId, null, requester.id);
    }
    json(res, 200, { request: { ...request, id: String(result.insertedId) } });
  },

  'POST /api/management/request/review': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    let request;
    try { request = await collections.managementRequests.findOne({ _id: new ObjectId(String(body.id || '')) }); }
    catch { request = null; }
    if (!request) return json(res, 404, { error: 'request not found' });
    if (request.status !== 'pending') return json(res, 400, { error: 'request already processed' });
    if (!isAdmin(manager) && !sameGym(manager, request.gymId)) return json(res, 403, { error: 'outside your gym' });
    const approved = body.action === 'approve';
    const requestedRole = normalizeAssignedRole(request.requestedRole);
    if (!isAdmin(manager) && !['member', 'trainer'].includes(requestedRole)) return json(res, 403, { error: 'owners can only approve member or trainer requests' });

    const target = await collections.users.findOne({ id: request.requesterId });
    if (!target) return json(res, 404, { error: 'requester no longer exists' });
    if (approved) {
      await collections.users.updateOne({ id: target.id }, { $set: { role: requestedRole, gymId: request.gymId } });
      await ensureGym(request.gymId, request.gymId, requestedRole === 'owner' ? target.id : null, manager.id);
    }
    await collections.managementRequests.updateOne(
      { _id: request._id },
      { $set: { status: approved ? 'approved' : 'rejected', reviewedBy: manager.id, reviewedAt: new Date().toISOString() } }
    );
    json(res, 200, { ok: true, status: approved ? 'approved' : 'rejected' });
  },

  'POST /api/management/training-plans': async (req, res) => {
    const coach = await requireCoach(req, res);
    if (!coach) return;
    const body = await readBody(req);
    const member = await collections.users.findOne({ id: String(body.memberId || '') });
    if (!member || personaOf(member) !== 'member') return json(res, 400, { error: 'a gym member is required' });
    if (!canCoachGym(coach, member.gymId)) return json(res, 403, { error: 'outside your gym' });
    if (isTrainer(coach) && member.trainerId && member.trainerId !== coach.id) {
      return json(res, 403, { error: 'member is assigned to another trainer' });
    }

    const sourceRoutines = Array.isArray(body.routines) ? body.routines.slice(0, 40) : [];
    const routines = sourceRoutines.map((routine, index) => {
      const id = String(routine?.id || `routine-${index + 1}`).trim().slice(0, 120);
      const name = String(routine?.name || '').trim().slice(0, 100);
      const exercises = Array.isArray(routine?.ex) ? routine.ex.slice(0, 80).map(exercise => ({
        ...exercise,
        id: String(exercise?.id || '').trim().slice(0, 120),
        sets: Math.max(1, Math.min(20, +(exercise?.sets || 3) || 3)),
        reps: Math.max(1, Math.min(100, +(exercise?.reps || 10) || 10))
      })).filter(exercise => exercise.id) : [];
      return {
        id: id || `routine-${index + 1}`,
        name: name || `Routine ${index + 1}`,
        emoji: String(routine?.emoji || 'dumbbell').slice(0, 40),
        prog: String(routine?.prog || 'linear').slice(0, 40),
        ex: exercises
      };
    });
    const routineIds = new Set(routines.map(routine => routine.id));
    const sourceWeek = body.week && typeof body.week === 'object' ? body.week : {};
    const week = {};
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      const value = String(sourceWeek[day] || '').trim();
      week[day] = value && routineIds.has(value) ? value : '';
    }
    if (!routines.length || !Object.values(week).some(Boolean)) {
      return json(res, 400, { error: 'at least one routine and one training day are required' });
    }

    // A trainer becomes the member's trainer the first time they assign a plan.
    // Owners/admins can assign for a member without replacing an existing trainer.
    if (!member.trainerId && isTrainer(coach)) {
      await collections.users.updateOne({ id: member.id }, { $set: { trainerId: coach.id } });
    }
    const trainerId = member.trainerId || (isTrainer(coach) ? coach.id : null);
    const now = new Date().toISOString();
    const existing = await collections.trainingPlans.findOne({ memberId: member.id, gymId: member.gymId });
    const plan = {
      id: existing?.id || crypto.randomBytes(12).toString('base64url'),
      gymId: member.gymId,
      memberId: member.id,
      trainerId,
      assignedBy: coach.id,
      routines,
      week,
      created: existing?.created || now,
      updatedAt: now
    };
    await collections.trainingPlans.updateOne(
      { memberId: member.id, gymId: member.gymId },
      { $set: plan },
      { upsert: true }
    );
    json(res, 200, { trainingPlan: plan });
  },

  'POST /api/management/schedules': async (req, res) => {
    const coach = await requireCoach(req, res);
    if (!coach) return;
    const body = await readBody(req);
    const member = await collections.users.findOne({ id: String(body.memberId || '') });
    if (!member || personaOf(member) !== 'member') return json(res, 400, { error: 'a gym member is required' });
    if (!canCoachGym(coach, member.gymId)) return json(res, 403, { error: 'outside your gym' });
    if (!member.trainerId && (isTrainer(coach) || isOwner(coach))) await collections.users.updateOne({ id: member.id }, { $set: { trainerId: coach.id } });
    const title = String(body.title || '').trim().slice(0, 100);
    const startAt = String(body.startAt || '').trim();
    if (!title || !startAt) return json(res, 400, { error: 'title and start time are required' });
    const schedule = {
      id: crypto.randomBytes(12).toString('base64url'), gymId: member.gymId, memberId: member.id,
      trainerId: coach.id, title, startAt, endAt: String(body.endAt || '').trim(),
      notes: String(body.notes || '').trim().slice(0, 500), createdBy: coach.id, created: new Date().toISOString()
    };
    await collections.schedules.insertOne(schedule);
    json(res, 200, { schedule });
  },

  'POST /api/management/exercises': async (req, res) => {
    const coach = await requireCoach(req, res);
    if (!coach) return;
    const body = await readBody(req);
    const member = await collections.users.findOne({ id: String(body.memberId || '') });
    if (!member || personaOf(member) !== 'member') return json(res, 400, { error: 'a gym member is required' });
    if (!canCoachGym(coach, member.gymId)) return json(res, 403, { error: 'outside your gym' });
    if (!member.trainerId && (isTrainer(coach) || isOwner(coach))) await collections.users.updateOne({ id: member.id }, { $set: { trainerId: coach.id } });
    const exerciseId = String(body.exerciseId || '').trim().slice(0, 120) || null;
    const name = String(body.name || '').trim().slice(0, 100);
    if (!name) return json(res, 400, { error: 'exercise name required' });
    const exercise = {
      id: crypto.randomBytes(12).toString('base64url'), gymId: member.gymId, memberId: member.id,
      trainerId: coach.id, exerciseId, name, scheduleId: String(body.scheduleId || '').trim() || null, instructions: String(body.instructions || '').trim().slice(0, 1000),
      equipment: String(body.equipment || '').trim().slice(0, 120),
      targetSets: Math.max(1, Math.min(20, +(body.targetSets || 3) || 3)),
      targetReps: Math.max(1, Math.min(100, +(body.targetReps || 10) || 10)),
      createdBy: coach.id, created: new Date().toISOString()
    };
    await collections.customExercises.insertOne(exercise);
    json(res, 200, { exercise });
  },

  'POST /api/management/diets': async (req, res) => {
    const coach = await requireCoach(req, res);
    if (!coach) return;
    const body = await readBody(req);
    const member = await collections.users.findOne({ id: String(body.memberId || '') });
    if (!member || personaOf(member) !== 'member') return json(res, 400, { error: 'a gym member is required' });
    if (!canCoachGym(coach, member.gymId)) return json(res, 403, { error: 'outside your gym' });
    if (!member.trainerId && (isTrainer(coach) || isOwner(coach))) await collections.users.updateOne({ id: member.id }, { $set: { trainerId: coach.id } });
    const title = String(body.title || '').trim().slice(0, 100);
    if (!title) return json(res, 400, { error: 'diet title required' });
    const foods = Array.isArray(body.foods) ? body.foods.slice(0, 30).map((food, index) => ({
      id: String(food.id || crypto.randomBytes(6).toString('hex')).slice(0, 80),
      name: String(food.name || '').trim().slice(0, 120),
      time: String(food.time || '').trim().slice(0, 20),
      serving: String(food.serving || '').trim().slice(0, 120),
      order: index
    })).filter(food => food.name) : [];
    const diet = {
      id: crypto.randomBytes(12).toString('base64url'), gymId: member.gymId, memberId: member.id,
      trainerId: coach.id, title, calories: Number.isFinite(+body.calories) ? Math.max(0, +body.calories) : null,
      meals: String(body.meals || '').trim().slice(0, 2000), foods, notes: String(body.notes || '').trim().slice(0, 500),
      createdBy: coach.id, created: new Date().toISOString()
    };
    await collections.diets.insertOne(diet);
    json(res, 200, { diet });
  },

  'POST /api/management/fees': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const member = await collections.users.findOne({ id: String(body.memberId || '') });
    if (!member || personaOf(member) !== 'member') return json(res, 400, { error: 'a gym member is required' });
    if (!canManageGym(manager, member.gymId)) return json(res, 403, { error: 'outside your gym' });
    const amount = Number(body.amount);
    const dueDate = String(body.dueDate || '').trim();
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return json(res, 400, { error: 'valid amount and due date required' });
    const fee = {
      id: crypto.randomBytes(12).toString('base64url'), gymId: member.gymId, memberId: member.id,
      amount: Math.round(amount * 100) / 100, currency: String(body.currency || 'USD').slice(0, 8).toUpperCase(),
      dueDate, status: 'due', note: String(body.note || '').trim().slice(0, 300), createdBy: manager.id, created: new Date().toISOString()
    };
    await collections.fees.insertOne(fee);
    json(res, 200, { fee });
  },

  'POST /api/management/fees/submit': async (req, res) => {
    const member = await readSession(req);
    if (!member) return json(res, 401, { error: 'not signed in' });
    if (personaOf(member) !== 'member') return json(res, 403, { error: 'members submit fees' });
    const body = await readBody(req);
    const fee = await collections.fees.findOne({ id: String(body.id || ''), memberId: member.id });
    if (!fee) return json(res, 404, { error: 'fee not found' });
    if (!['due', 'overdue', 'rejected'].includes(fee.status)) return json(res, 400, { error: 'fee is already submitted' });
    await collections.fees.updateOne({ id: fee.id }, { $set: { status: 'submitted', submittedAt: new Date().toISOString(), submissionNote: String(body.note || '').trim().slice(0, 300) } });
    json(res, 200, { ok: true, status: 'submitted' });
  },

  'POST /api/management/fees/review': async (req, res) => {
    const manager = await requireOrgManager(req, res);
    if (!manager) return;
    const body = await readBody(req);
    const fee = await collections.fees.findOne({ id: String(body.id || '') });
    if (!fee) return json(res, 404, { error: 'fee not found' });
    if (!canManageGym(manager, fee.gymId)) return json(res, 403, { error: 'outside your gym' });
    if (!['approved', 'rejected'].includes(body.status)) return json(res, 400, { error: 'status must be approved or rejected' });
    await collections.fees.updateOne({ id: fee.id }, { $set: { status: body.status, reviewedBy: manager.id, reviewedAt: new Date().toISOString() } });
    json(res, 200, { ok: true, status: body.status });
  },

  'POST /api/management/assignments/log': async (req, res) => {
    const actor = await readSession(req);
    if (!actor) return json(res, 401, { error: 'not signed in' });
    const body = await readBody(req);
    const type = String(body.assignmentType || '').trim();
    const collection = type === 'schedule' ? collections.schedules : type === 'exercise' ? collections.customExercises : type === 'diet' ? collections.diets : null;
    if (!collection) return json(res, 400, { error: 'assignmentType must be schedule, exercise, or diet' });
    const assignment = await collection.findOne({ id: String(body.assignmentId || '') });
    if (!assignment) return json(res, 404, { error: 'assignment not found' });
    const canLog = assignment.memberId === actor.id || canCoachGym(actor, assignment.gymId);
    if (!canLog) return json(res, 403, { error: 'you cannot log this assignment' });
    const status = String(body.status || '').trim();
    if (!['hit', 'missed', 'partial', 'logged'].includes(status)) return json(res, 400, { error: 'invalid assignment status' });
    const date = String(body.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const itemId = String(body.itemId || '').trim() || null;
    if (type === 'diet' && itemId && !(assignment.foods || []).some(food => food.id === itemId)) return json(res, 400, { error: 'diet item not found' });
    const log = {
      assignmentId: assignment.id,
      itemId,
      assignmentType: type,
      gymId: assignment.gymId || null,
      memberId: assignment.memberId,
      loggedBy: actor.id,
      status,
      date,
      note: String(body.note || '').trim().slice(0, 500),
      metric: body.metric == null ? null : String(body.metric).slice(0, 120),
      created: new Date().toISOString()
    };
    await collections.assignmentLogs.updateOne(
      { assignmentId: assignment.id, memberId: assignment.memberId, date, itemId },
      { $set: log },
      { upsert: true }
    );
    json(res, 200, { ok: true, log });
  },

  /* ---------- social media: user profiles ---------- */
  'GET /api/profile': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const followerCount = await collections.follows.countDocuments({ followingId: user.id });
    const followingCount = await collections.follows.countDocuments({ followerId: user.id });
    const postCount = await collections.posts.countDocuments({ userId: user.id });
    
    json(res, 200, {
      profile: {
        id: user.id,
        name: user.name,
        handle: user.handle || null,
        bio: user.bio || null,
        profilePhoto: user.profilePhoto || null,
        followerCount,
        followingCount,
        postCount
      }
    });
  },

  'GET /api/profile/:handle': async (req, res) => {
    const currentUser = await readSession(req);
    const url = new URL(req.url, 'http://x');
    const handle = url.pathname.split('/')[3];
    
    if (!handle) return json(res, 400, { error: 'handle required' });
    
    const user = await collections.users.findOne({ handle });
    if (!user) return json(res, 404, { error: 'user not found' });
    
    const followerCount = await collections.follows.countDocuments({ followingId: user.id });
    const followingCount = await collections.follows.countDocuments({ followerId: user.id });
    const postCount = await collections.posts.countDocuments({ userId: user.id });
    
    let isFollowing = false;
    if (currentUser) {
      isFollowing = !!(await collections.follows.findOne({ followerId: currentUser.id, followingId: user.id }));
    }
    
    json(res, 200, {
      profile: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        bio: user.bio || null,
        profilePhoto: user.profilePhoto || null,
        followerCount,
        followingCount,
        postCount,
        isFollowing
      }
    });
  },

  'PUT /api/profile': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const body = await readBody(req);
    const updates = {};
    
    // Handle validation (must be unique and alphanumeric with underscores, 3-20 chars)
    if (body.handle !== undefined) {
      const handle = String(body.handle || '').trim().toLowerCase();
      if (handle) {
        if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
          return json(res, 400, { error: 'handle must be 3-20 characters, letters, numbers, and underscores only' });
        }
        // Check if handle is taken
        const existing = await collections.users.findOne({ handle, id: { $ne: user.id } });
        if (existing) return json(res, 409, { error: 'handle already taken' });
        updates.handle = handle;
      } else {
        updates.handle = null;
      }
    }
    
    if (body.bio !== undefined) {
      updates.bio = String(body.bio || '').trim().slice(0, 200);
    }
    
    if (body.profilePhoto !== undefined) {
      updates.profilePhoto = String(body.profilePhoto || '').slice(0, 200) || null;
    }
    
    if (Object.keys(updates).length === 0) {
      return json(res, 400, { error: 'no updates provided' });
    }
    
    await collections.users.updateOne({ id: user.id }, { $set: updates });
    
    json(res, 200, { ok: true, updates });
  },

  'GET /api/users/search': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const url = new URL(req.url, 'http://x');
    const q = url.searchParams.get('q') || '';
    const limit = Math.min(50, Math.max(1, +(url.searchParams.get('limit') || 20)));
    
    if (!q.trim()) return json(res, 200, { users: [] });
    
    const query = {
      handle: { $exists: true, $ne: null },
      $or: [
        { handle: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') }
      ]
    };
    
    const users = await collections.users.find(query).limit(limit).toArray();
    
    const result = await Promise.all(users.map(async u => {
      const followerCount = await collections.follows.countDocuments({ followingId: u.id });
      const isFollowing = !!(await collections.follows.findOne({ followerId: user.id, followingId: u.id }));
      
      return {
        id: u.id,
        name: u.name,
        handle: u.handle,
        bio: u.bio || null,
        profilePhoto: u.profilePhoto || null,
        followerCount,
        isFollowing
      };
    }));
    
    json(res, 200, { users: result });
  },

  /* ---------- social media: follow system ---------- */
  'POST /api/follow': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const body = await readBody(req);
    const targetId = String(body.userId || '').trim();
    
    if (!targetId) return json(res, 400, { error: 'userId required' });
    if (targetId === user.id) return json(res, 400, { error: 'cannot follow yourself' });
    
    const targetUser = await collections.users.findOne({ id: targetId });
    if (!targetUser) return json(res, 404, { error: 'user not found' });
    
    // Check if already following
    const existing = await collections.follows.findOne({ followerId: user.id, followingId: targetId });
    if (existing) return json(res, 200, { ok: true, alreadyFollowing: true });
    
    await collections.follows.insertOne({
      followerId: user.id,
      followingId: targetId,
      created: new Date().toISOString()
    });
    
    json(res, 200, { ok: true });
  },

  'POST /api/unfollow': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const body = await readBody(req);
    const targetId = String(body.userId || '').trim();
    
    if (!targetId) return json(res, 400, { error: 'userId required' });
    
    await collections.follows.deleteOne({ followerId: user.id, followingId: targetId });
    
    json(res, 200, { ok: true });
  },

  'GET /api/followers': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const url = new URL(req.url, 'http://x');
    const userId = url.searchParams.get('userId') || user.id;
    const limit = Math.min(100, Math.max(1, +(url.searchParams.get('limit') || 50)));
    const offset = Math.max(0, +(url.searchParams.get('offset') || 0));
    
    const follows = await collections.follows.find({ followingId: userId })
      .sort({ created: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    
    const followerIds = follows.map(f => f.followerId);
    const followers = await collections.users.find({ id: { $in: followerIds } }).toArray();
    
    const result = await Promise.all(followers.map(async u => {
      const isFollowing = !!(await collections.follows.findOne({ followerId: user.id, followingId: u.id }));
      return {
        id: u.id,
        name: u.name,
        handle: u.handle,
        profilePhoto: u.profilePhoto || null,
        isFollowing
      };
    }));
    
    json(res, 200, { followers: result, hasMore: follows.length === limit });
  },

  'GET /api/following': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const url = new URL(req.url, 'http://x');
    const userId = url.searchParams.get('userId') || user.id;
    const limit = Math.min(100, Math.max(1, +(url.searchParams.get('limit') || 50)));
    const offset = Math.max(0, +(url.searchParams.get('offset') || 0));
    
    const follows = await collections.follows.find({ followerId: userId })
      .sort({ created: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
    
    const followingIds = follows.map(f => f.followingId);
    const following = await collections.users.find({ id: { $in: followingIds } }).toArray();
    
    const result = following.map(u => ({
      id: u.id,
      name: u.name,
      handle: u.handle,
      profilePhoto: u.profilePhoto || null,
      isFollowing: true
    }));
    
    json(res, 200, { following: result, hasMore: follows.length === limit });
  },

  /* ---------- social media: posts ---------- */
  'POST /api/posts': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    if (!user.handle) return json(res, 400, { error: 'set up your handle first' });
    
    const body = await readBody(req);
    const caption = String(body.caption || '').trim().slice(0, 500);
    const type = String(body.type || 'stats').trim();
    const metric = String(body.metric || 'strength').trim();
    const stats = body.stats || {};
    
    if (!stats || typeof stats !== 'object') {
      return json(res, 400, { error: 'stats required' });
    }
    
    const postId = crypto.randomBytes(12).toString('base64url');
    const post = {
      postId,
      userId: user.id,
      type,
      metric,
      stats: {
        date: stats.date,
        volume: stats.volume || 0,
        maxWeight: stats.maxWeight || 0,
        exercises: stats.exercises || 0,
        sets: stats.sets || 0,
        duration: stats.duration || 0
      },
      caption,
      created: new Date().toISOString(),
      likeCount: 0
    };
    
    await collections.posts.insertOne(post);
    
    json(res, 200, {
      post: {
        ...post,
        user: {
          id: user.id,
          name: user.name,
          handle: user.handle,
          profilePhoto: user.profilePhoto || null
        },
        liked: false
      }
    });
  },

  'DELETE /api/posts/:postId': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const url = new URL(req.url, 'http://x');
    const postId = url.pathname.split('/')[3];
    
    if (!postId) return json(res, 400, { error: 'postId required' });
    
    const post = await collections.posts.findOne({ postId });
    if (!post) return json(res, 404, { error: 'post not found' });
    
    if (post.userId !== user.id && !isAdmin(user)) {
      return json(res, 403, { error: 'not authorized' });
    }
    
    await collections.posts.deleteOne({ postId });
    await collections.likes.deleteMany({ postId });
    
    json(res, 200, { ok: true });
  },

  'GET /api/posts': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const url = new URL(req.url, 'http://x');
    const userId = url.searchParams.get('userId');
    const limit = Math.min(50, Math.max(1, +(url.searchParams.get('limit') || 20)));
    const before = url.searchParams.get('before'); // ISO timestamp for pagination
    
    const query = userId ? { userId } : {};
    if (before) query.created = { $lt: before };
    
    const posts = await collections.posts.find(query)
      .sort({ created: -1 })
      .limit(limit)
      .toArray();
    
    // Fetch user data and like status for each post
    const result = await Promise.all(posts.map(async p => {
      const author = await collections.users.findOne({ id: p.userId });
      const liked = !!(await collections.likes.findOne({ postId: p.postId, userId: user.id }));
      
      return {
        postId: p.postId,
        userId: p.userId,
        photoId: p.photoId,
        caption: p.caption,
        created: p.created,
        likeCount: p.likeCount || 0,
        user: author ? {
          id: author.id,
          name: author.name,
          handle: author.handle,
          profilePhoto: author.profilePhoto || null
        } : null,
        liked
      };
    }));
    
    json(res, 200, { posts: result, hasMore: posts.length === limit });
  },

  'GET /api/feed': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const url = new URL(req.url, 'http://x');
    const limit = Math.min(50, Math.max(1, +(url.searchParams.get('limit') || 20)));
    const before = url.searchParams.get('before');
    
    // Get users the current user follows
    const follows = await collections.follows.find({ followerId: user.id }).toArray();
    const followingIds = follows.map(f => f.followingId);
    
    // Include user's own posts in feed
    followingIds.push(user.id);
    
    const query = { userId: { $in: followingIds } };
    if (before) query.created = { $lt: before };
    
    const posts = await collections.posts.find(query)
      .sort({ created: -1 })
      .limit(limit)
      .toArray();
    
    const result = await Promise.all(posts.map(async p => {
      const author = await collections.users.findOne({ id: p.userId });
      const liked = !!(await collections.likes.findOne({ postId: p.postId, userId: user.id }));
      
      return {
        postId: p.postId,
        userId: p.userId,
        type: p.type || 'stats',
        metric: p.metric,
        stats: p.stats,
        photoId: p.photoId,
        caption: p.caption,
        created: p.created,
        likeCount: p.likeCount || 0,
        user: author ? {
          id: author.id,
          name: author.name,
          handle: author.handle,
          profilePhoto: author.profilePhoto || null
        } : null,
        liked
      };
    }));
    
    json(res, 200, { posts: result, hasMore: posts.length === limit });
  },

  /* ---------- social media: likes ---------- */
  'POST /api/posts/:postId/like': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const url = new URL(req.url, 'http://x');
    const postId = url.pathname.split('/')[3];
    
    if (!postId) return json(res, 400, { error: 'postId required' });
    
    const post = await collections.posts.findOne({ postId });
    if (!post) return json(res, 404, { error: 'post not found' });
    
    // Check if already liked
    const existing = await collections.likes.findOne({ postId, userId: user.id });
    if (existing) return json(res, 200, { ok: true, alreadyLiked: true });
    
    await collections.likes.insertOne({
      postId,
      userId: user.id,
      created: new Date().toISOString()
    });
    
    // Increment like count
    await collections.posts.updateOne({ postId }, { $inc: { likeCount: 1 } });
    
    json(res, 200, { ok: true });
  },

  'POST /api/posts/:postId/unlike': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    const url = new URL(req.url, 'http://x');
    const postId = url.pathname.split('/')[3];
    
    if (!postId) return json(res, 400, { error: 'postId required' });
    
    const result = await collections.likes.deleteOne({ postId, userId: user.id });
    
    if (result.deletedCount > 0) {
      await collections.posts.updateOne({ postId }, { $inc: { likeCount: -1 } });
    }
    
    json(res, 200, { ok: true });
  },

  /* ---------- social media: photo upload ---------- */
  'POST /api/upload/photo': async (req, res) => {
    const user = await readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    
    // Read multipart/form-data or raw body
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('application/json')) {
      return json(res, 400, { error: 'use JSON with base64 encoded image' });
    }
    
    const body = await readBody(req);
    const imageData = body.image; // base64 string
    
    if (!imageData) return json(res, 400, { error: 'image data required' });
    
    try {
      // Decode base64
      const buffer = Buffer.from(imageData, 'base64');
      
      // Compress image with Sharp
      const compressed = await sharp(buffer)
        .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      
      // Create thumbnail
      const thumbnail = await sharp(buffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const photoId = crypto.randomBytes(12).toString('base64url');
      
      // Store as base64 strings for reliable MongoDB storage/retrieval
      await collections.userPhotos.insertOne({
        photoId,
        userId: user.id,
        data: compressed.toString('base64'),
        thumbnail: thumbnail.toString('base64'),
        contentType: 'image/jpeg',
        size: compressed.length,
        created: new Date().toISOString()
      });
      
       json(res, 200, { photoId, size: compressed.length });
     } catch (e) {
       console.error('photo upload error:', e.message);
       json(res, 500, { error: 'failed to process image' });
     }
   },

   /* ---------- Health Metrics: Apple Health & Google Fit Integration ---------- */
   'POST /api/health/sync': async (req, res) => {
     const user = await readSession(req);
     if (!user) return json(res, 401, { error: 'not signed in' });

     const body = await readBody(req);
     const data = JSON.parse(body);
     const { metrics, platform, lastSyncTime } = data;

     if (!metrics || !Array.isArray(metrics) || !platform) {
       return json(res, 400, { error: 'metrics array and platform required' });
     }

     try {
       const userId = user.id;
       const syncedAt = new Date().toISOString();

       // Store metrics in MongoDB
       const insertOps = metrics.map(metric => ({
         insertOne: {
           document: {
             userId,
             metricType: metric.type, // 'steps', 'distance', 'calories', 'heart_rate', 'sleep'
             value: metric.value,
             unit: metric.unit,
             date: metric.date,
             source: metric.source || platform,
             platform,
             timestamp: metric.timestamp || Date.now(),
             createdAt: new Date()
           }
         }
       }));

       if (insertOps.length > 0) {
         await collections.healthMetrics.bulkWrite(insertOps);
       }

       // Log the sync
       await collections.healthSyncLog.insertOne({
         userId,
         platform,
         metricsCount: metrics.length,
         lastSyncTime,
         syncedAt,
         syncStatus: 'success'
       });

       json(res, 200, { 
         ok: true, 
         synced: metrics.length,
         syncTime: syncedAt 
       });
     } catch (e) {
       console.error('health sync error:', e.message);
       await collections.healthSyncLog.insertOne({
         userId: user.id,
         platform,
         syncStatus: 'failed',
         error: e.message,
         syncedAt: new Date().toISOString()
       });
       json(res, 500, { error: 'sync failed' });
     }
   },

   'GET /api/health/metrics': async (req, res) => {
     const user = await readSession(req);
     if (!user) return json(res, 401, { error: 'not signed in' });

     const url = new URL(req.url, 'http://x');
     const metricType = url.searchParams.get('type');
     const days = parseInt(url.searchParams.get('days') || '30', 10);
     const startDate = new Date();
     startDate.setDate(startDate.getDate() - days);

     try {
       const query = {
         userId: user.id,
         date: { $gte: startDate.toISOString().split('T')[0] }
       };
       
       if (metricType) {
         query.metricType = metricType;
       }

       const metrics = await collections.healthMetrics
         .find(query)
         .sort({ date: -1 })
         .toArray();

       json(res, 200, { metrics });
     } catch (e) {
       console.error('health metrics fetch error:', e.message);
       json(res, 500, { error: 'failed to fetch metrics' });
     }
   },

   'GET /api/health/summary': async (req, res) => {
     const user = await readSession(req);
     if (!user) return json(res, 401, { error: 'not signed in' });

     const url = new URL(req.url, 'http://x');
     const days = parseInt(url.searchParams.get('days') || '7', 10);
     const startDate = new Date();
     startDate.setDate(startDate.getDate() - days);
     const startDateStr = startDate.toISOString().split('T')[0];

     try {
       const pipeline = [
         {
           $match: {
             userId: user.id,
             date: { $gte: startDateStr }
           }
         },
         {
           $group: {
             _id: '$metricType',
             total: { $sum: '$value' },
             avg: { $avg: '$value' },
             max: { $max: '$value' },
             min: { $min: '$value' },
             count: { $sum: 1 }
           }
         }
       ];

       const summary = await collections.healthMetrics
         .aggregate(pipeline)
         .toArray();

       const result = {};
       summary.forEach(stat => {
         result[stat._id] = {
           total: Math.round(stat.total),
           average: Math.round(stat.avg),
           max: Math.round(stat.max),
           min: Math.round(stat.min),
           dataPoints: stat.count
         };
       });

       json(res, 200, { summary: result, days });
     } catch (e) {
       console.error('health summary error:', e.message);
       json(res, 500, { error: 'failed to generate summary' });
     }
   },

   'GET /api/health/sync-status': async (req, res) => {
     const user = await readSession(req);
     if (!user) return json(res, 401, { error: 'not signed in' });

     try {
       const syncLog = await collections.healthSyncLog
         .find({ userId: user.id })
         .sort({ syncedAt: -1 })
         .limit(10)
         .toArray();

       json(res, 200, { syncLog });
     } catch (e) {
       console.error('sync status error:', e.message);
       json(res, 500, { error: 'failed to fetch sync status' });
     }
   }
 };

async function main() {
  try {
    await connectMongo();
    
    // Start reminder loop after MongoDB is connected
    startReminderLoop();
    
    http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const pathname = url.pathname;
      
      // Handle dynamic image routes from MongoDB
      if (pathname.startsWith('/img/')) {
        const file = decodeURIComponent(pathname.replace('/img/', ''));
        try {
          const media = await collections.media.findOne({
            $or: [{ _id: file }, { filename: file }]
          });
          if (!media || !media.data) {
            // Fallback: check without extension or with .jpg
            const altFile = file.endsWith('.jpg') ? file.replace('.jpg', '') : file + '.jpg';
            const altMedia = await collections.media.findOne({
              $or: [{ _id: altFile }, { filename: altFile }]
            });
            if (!altMedia || !altMedia.data) return json(res, 404, { error: 'image not found' });
            const buf = altMedia.data.buffer || altMedia.data;
            res.writeHead(200, {
              'Content-Type': altMedia.contentType || 'image/jpeg',
              'Cache-Control': 'public, max-age=31536000, immutable'
            });
            return res.end(buf);
          }
          const buf = media.data.buffer || media.data;
          res.writeHead(200, {
            'Content-Type': media.contentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          return res.end(buf);
        } catch (e) {
          console.error('img error', e.message);
          return json(res, 500, { error: 'server error' });
        }
      }
      
      // Handle dynamic GIF routes from MongoDB
      if (pathname.startsWith('/gif/')) {
        const file = decodeURIComponent(pathname.replace('/gif/', ''));
        try {
          const media = await collections.media.findOne({
            $or: [{ _id: file }, { filename: file }]
          });
          if (!media || !media.data) {
            // Fallback: check without extension or with .gif
            const altFile = file.endsWith('.gif') ? file.replace('.gif', '') : file + '.gif';
            const altMedia = await collections.media.findOne({
              $or: [{ _id: altFile }, { filename: altFile }]
            });
            if (!altMedia || !altMedia.data) return json(res, 404, { error: 'gif not found' });
            const buf = altMedia.data.buffer || altMedia.data;
            res.writeHead(200, {
              'Content-Type': altMedia.contentType || 'image/gif',
              'Cache-Control': 'public, max-age=31536000, immutable'
            });
            return res.end(buf);
          }
          const buf = media.data.buffer || media.data;
          res.writeHead(200, {
            'Content-Type': media.contentType || 'image/gif',
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          return res.end(buf);
        } catch (e) {
          console.error('gif error', e.message);
          return json(res, 500, { error: 'server error' });
        }
      }

      // Handle user photo routes
      if (pathname.startsWith('/photo/')) {
        const photoId = decodeURIComponent(pathname.replace('/photo/', ''));
        const isThumbnail = photoId.endsWith('/thumb');
        const cleanPhotoId = isThumbnail ? photoId.replace('/thumb', '') : photoId;
        
        try {
          const photo = await collections.userPhotos.findOne({ photoId: cleanPhotoId });
          if (!photo || !photo.data) {
            console.error('Photo not found:', cleanPhotoId);
            return json(res, 404, { error: 'photo not found' });
          }
          
          // Decode base64 back to buffer
          const dataStr = isThumbnail && photo.thumbnail ? photo.thumbnail : photo.data;
          const buf = Buffer.from(dataStr, 'base64');
          
          res.writeHead(200, {
            'Content-Type': photo.contentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          return res.end(buf);
        } catch (e) {
          console.error('photo error', e.message, e.stack);
          return json(res, 500, { error: 'server error' });
        }
      }

      // Handle single exercise detail API route
      if (pathname.startsWith('/api/exercises/')) {
        const exId = decodeURIComponent(pathname.replace('/api/exercises/', ''));
        try {
          const exercise = await collections.exercises.findOne({
            $or: [{ id: exId }, { _id: exId }]
          });
          if (!exercise) return json(res, 404, { error: 'exercise not found' });
          return json(res, 200, { exercise });
        } catch (e) {
          console.error('exercise detail error', e.message);
          return json(res, 500, { error: 'server error' });
        }
      }
      
      // Handle dynamic profile routes
      if (pathname.startsWith('/api/profile/') && req.method === 'GET') {
        try {
          await routes['GET /api/profile/:handle'](req, res);
          return;
        } catch (e) {
          console.error('profile route error', e);
          if (!res.headersSent) json(res, 500, { error: 'server error' });
          return;
        }
      }
      
      // Handle dynamic post routes (delete and like/unlike)
      if (pathname.startsWith('/api/posts/') && pathname.split('/').length === 4) {
        const postId = pathname.split('/')[3];
        if (req.method === 'DELETE') {
          try {
            await routes['DELETE /api/posts/:postId'](req, res);
            return;
          } catch (e) {
            console.error('delete post error', e);
            if (!res.headersSent) json(res, 500, { error: 'server error' });
            return;
          }
        }
      }
      
      if (pathname.match(/^\/api\/posts\/[^\/]+\/(like|unlike)$/) && req.method === 'POST') {
        try {
          const action = pathname.endsWith('/like') ? 'like' : 'unlike';
          await routes[`POST /api/posts/:postId/${action}`](req, res);
          return;
        } catch (e) {
          console.error('like/unlike error', e);
          if (!res.headersSent) json(res, 500, { error: 'server error' });
          return;
        }
      }
      
      // Handle JSON API routes
      const key = req.method + ' ' + pathname;
      const handler = routes[key];
      if (handler) {
        try { await handler(req, res); }
        catch (e) {
          console.error(key, e);
          if (!res.headersSent) json(res, 500, { error: 'server error' });
        }
        return;
      }
      
      // Serve static frontend files (production only)
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const FRONTEND_DIR = path.join(__dirname, '..', 'frontend', 'dist');
      if (fs.existsSync(FRONTEND_DIR) && req.method === 'GET') {
        let filePath = path.join(FRONTEND_DIR, pathname === '/' ? 'index.html' : pathname);
        
        // If file doesn't exist, serve index.html for client-side routing
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(FRONTEND_DIR, 'index.html');
        }
        
        try {
          const content = fs.readFileSync(filePath);
          const ext = path.extname(filePath);
          const contentTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2'
          };
          res.writeHead(200, {
            'Content-Type': contentTypes[ext] || 'application/octet-stream',
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
          });
          return res.end(content);
        } catch (e) {
          console.error('Static file error:', e.message);
        }
      }
      
      json(res, 404, { error: 'not found' });
    }).listen(PORT, '0.0.0.0', () => {
      console.log(`gym-api on :${PORT} (rpID=${RP_ID}, origin=${ORIGIN}, db=${MONGO_DB})`);
      startKeepAliveReloader();
    });
  } catch (e) {
    console.error('Failed to start server:', e.message);
    process.exit(1);
  }
}

main();
