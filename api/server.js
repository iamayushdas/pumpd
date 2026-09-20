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
  userPhotos: null
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

const isAdmin = user => !!user && (user.admin === true || user.id === 'admin' || ADMIN_UIDS.includes(user.id));

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

async function sendInviteCodeEmail(email, name, code) {
  const subject = `Your ${RP_NAME} Invite Code - Let's Get Started!`;
  const text = `Hi ${name},\n\nGreat news! Your access request has been approved.\n\nYour invite code is: ${code}\n\nHow to get started:\n1. Visit ${ORIGIN}\n2. Click "New Profile" tab\n3. Enter your name\n4. Enter your invite code: ${code}\n5. Set up your passkey (fingerprint, face ID, or security key)\n6. Start tracking your workouts!\n\nWelcome to ${RP_NAME}!`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #30d158;">Welcome to ${RP_NAME}! 💪</h2>
      <p>Hi ${name},</p>
      <p>Great news! Your access request has been approved.</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
        <p style="margin: 0 0 10px; color: #666; font-size: 14px;">Your Invite Code</p>
        <p style="margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 2px; color: #000; user-select: all;">${code}</p>
      </div>
      
      <h3 style="color: #333; font-size: 18px; margin: 30px 0 15px;">How to get started:</h3>
      <ol style="line-height: 1.8; color: #333;">
        <li>Visit <a href="${ORIGIN}" style="color: #30d158; font-weight: 600;">${ORIGIN}</a></li>
        <li>Click the <strong>"New Profile"</strong> tab</li>
        <li>Enter your name</li>
        <li>Enter your invite code: <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 14px;">${code}</code></li>
        <li>Set up your <strong>passkey</strong> (fingerprint, face ID, or security key)</li>
        <li>Start tracking your workouts!</li>
      </ol>
      
      <p style="margin-top: 30px;"><a href="${ORIGIN}" style="display: inline-block; background: #30d158; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">Get Started →</a></p>
      
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
        if (!state?.reminder?.on) continue;
        
        const now = userNow(state.reminder.tz || 'UTC');
        if (!now || state.reminder.time !== now.hhmm) continue;
        if (user.lastReminder === now.date) continue;
        if ((state.workouts || []).some(w => w.d === now.date)) continue;
        
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
    json(res, 200, { user: { id: user.id, name: user.name, admin: isAdmin(user) } });
  },

  'POST /api/register/options': async (req, res) => {
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) return json(res, 400, { error: 'name required' });
    const code = String(body.code || '').trim().toUpperCase();
    
    const userCount = await collections.users.countDocuments();
    if (INVITE_ONLY && userCount > 0) {
      const validInvite = await collections.invites.findOne({ code, usedBy: null, revoked: { $ne: true } });
      if (!validInvite) return json(res, 403, { error: 'a valid invite code is required' });
    }
    
    const uid = crypto.randomBytes(12).toString('base64url');
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: RP_ID,
      userID: Buffer.from(uid), userName: name, userDisplayName: name,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      excludeCredentials: []
    });
    const cid = putChallenge({ challenge: options.challenge, name, uid, code });
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
      created: new Date().toISOString(),
      admin: userCount === 0 || ADMIN_UIDS.includes(c.uid)
    };
    if (invite) {
      user.invitedBy = invite.code;
      await collections.invites.updateOne({ code: c.code }, { $set: { usedBy: user.id, usedAt: user.created } });
    }
    
    await collections.users.insertOne(user);
    await collections.credentials.insertOne({
      id: credential.id,
      userId: user.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter || 0,
      transports: body.credential?.response?.transports || []
    });
    
    json(res, 200, { user: { id: user.id, name: user.name, admin: isAdmin(user) } }, { 'Set-Cookie': sessionCookie(user) });
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
    
    json(res, 200, { user: { id: user.id, name: user.name, admin: isAdmin(user) } }, { 'Set-Cookie': sessionCookie(user) });
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
        created: new Date().toISOString(),
        admin: true
      };
      await collections.users.insertOne(adminUser);
    } else if (!adminUser.admin) {
      await collections.users.updateOne({ id: 'admin' }, { $set: { admin: true } });
      adminUser.admin = true;
    }

    json(res, 200, {
      user: { id: adminUser.id, name: adminUser.name, admin: true }
    }, { 'Set-Cookie': sessionCookie(adminUser) });
  },

  /* ---------- admin dashboard ---------- */
  'GET /api/admin/users': async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const users = await collections.users.find({}).toArray();
    const result = [];
    
    for (const u of users) {
      const state = await collections.userStates.findOne({ userId: u.id });
      const S = state?.data || {};
      const workouts = S.workouts || [];
      const last = workouts[workouts.length - 1];
      const hasSubs = await collections.subscriptions.findOne({ userId: u.id });
      
      result.push({
        id: u.id, name: u.name, created: u.created || null,
        disabled: !!u.disabled, admin: isAdmin(u), invitedBy: u.invitedBy || null,
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
    if (!await requireAdmin(req, res)) return;
    const id = new URL(req.url, 'http://x').searchParams.get('id');
    const u = await collections.users.findOne({ id });
    if (!u) return json(res, 404, { error: 'no such user' });
    
    const state = await collections.userStates.findOne({ userId: u.id });
    const S = state?.data || {};
    
    json(res, 200, {
      user: { id: u.id, name: u.name, created: u.created || null, disabled: !!u.disabled, admin: isAdmin(u), invitedBy: u.invitedBy || null },
      unit: S.unit || 'kg',
      lastSync: S._ts || null,
      routines: (S.routines || []).map(r => ({ id: r.id, name: r.name, emoji: r.emoji, count: (r.ex || []).length })),
      bodyweight: S.bodyweight || [],
      workouts: (S.workouts || []).slice().reverse()
    });
  },

  'POST /api/admin/user/disable': async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const body = await readBody(req);
    const u = await collections.users.findOne({ id: body.id });
    if (!u) return json(res, 404, { error: 'no such user' });
    if (isAdmin(u)) return json(res, 400, { error: 'cannot disable an admin' });
    
    await collections.users.updateOne({ id: body.id }, { $set: { disabled: !!body.disabled } });
    if (body.disabled) presence.delete(body.id);
    
    json(res, 200, { ok: true, id: body.id, disabled: !!body.disabled });
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
      message: String(body.message || '').slice(0, 500)
    };
    
    await collections.accessRequests.insertOne(request);
    
    // Send email notification to admin
    console.log('[Access Request] New request from:', name, email);
    sendAccessRequestNotification(email, name, request.message)
      .then(result => console.log('[Access Request] Admin notification sent:', result.success ? 'success' : 'failed'))
      .catch(err => console.error('[Access Request] Failed to send admin notification:', err.message));
    
    json(res, 200, { message: 'access request submitted successfully' });
  },

  'GET /api/admin/access-requests': async (req, res) => {
    if (!await requireAdmin(req, res)) return;
    const requests = await collections.accessRequests.find({}).sort({ created: -1 }).toArray();
    json(res, 200, { requests });
  },

  'POST /api/admin/access-request/approve': async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readBody(req);
    const requestId = body.id;
    
    if (!requestId) return json(res, 400, { error: 'request id required' });
    
    const request = await collections.accessRequests.findOne({ _id: new ObjectId(requestId) });
    if (!request) return json(res, 404, { error: 'request not found' });
    if (request.status !== 'pending') return json(res, 400, { error: 'request already processed' });
    
    // Generate invite code
    let code;
    do { code = crypto.randomBytes(8).toString('hex').toUpperCase(); }
    while (await collections.invites.findOne({ code }));
    
    const invite = {
      code,
      note: `For ${request.name} (${request.email})`,
      createdBy: admin.id,
      created: new Date().toISOString(),
      forEmail: request.email
    };
    
    await collections.invites.insertOne(invite);
    await collections.accessRequests.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'approved', approvedBy: admin.id, approvedAt: new Date().toISOString(), inviteCode: code } }
    );
    
    // Send invite code via email
    console.log('[Access Request] Approving request for:', request.email, '- Code:', code);
    const emailResult = await sendInviteCodeEmail(request.email, request.name, code);
    console.log('[Access Request] Email result:', JSON.stringify(emailResult));
    
    json(res, 200, { ok: true, code, emailSent: emailResult.success || false, emailError: emailResult.error || null });
  },

  'POST /api/admin/access-request/reject': async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readBody(req);
    const requestId = body.id;
    
    if (!requestId) return json(res, 400, { error: 'request id required' });
    
    const request = await collections.accessRequests.findOne({ _id: new ObjectId(requestId) });
    if (!request) return json(res, 404, { error: 'request not found' });
    if (request.status !== 'pending') return json(res, 400, { error: 'request already processed' });
    
    await collections.accessRequests.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'rejected', rejectedBy: admin.id, rejectedAt: new Date().toISOString() } }
    );
    
    json(res, 200, { ok: true });
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
    }).listen(PORT, '0.0.0.0', () => console.log(`gym-api on :${PORT} (rpID=${RP_ID}, origin=${ORIGIN}, db=${MONGO_DB})`));
  } catch (e) {
    console.error('Failed to start server:', e.message);
    process.exit(1);
  }
}

main();
