// Backend + WebAuthn helpers (ported from the vanilla app).
export const IS_APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
export const IS_ANDROID = /Android/.test(navigator.userAgent)
export const BIO = IS_APPLE ? 'Face ID / Touch ID' : IS_ANDROID ? 'fingerprint or face unlock' : 'your fingerprint, face or PIN'
export const VAULT = IS_APPLE ? 'iCloud Keychain' : IS_ANDROID ? 'Google Password Manager' : 'your password manager'
export const webauthnOK = () => !!(window.PublicKeyCredential && navigator.credentials)

export async function api(path: string, opts?: RequestInit): Promise<any> {
  const r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts))
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(data.error || ('HTTP ' + r.status)) as Error & { status?: number }
    e.status = r.status
    throw e
  }
  return data
}

const bufToB64u = (buf: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64uToBuf = (s: string): ArrayBuffer => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)).buffer

function toCreationOptions(o: any) {
  o.challenge = b64uToBuf(o.challenge)
  o.user.id = b64uToBuf(o.user.id)
  ;(o.excludeCredentials || []).forEach((c: any) => { c.id = b64uToBuf(c.id) })
  return o
}
function toRequestOptions(o: any) {
  o.challenge = b64uToBuf(o.challenge)
  ;(o.allowCredentials || []).forEach((c: any) => { c.id = b64uToBuf(c.id) })
  return o
}
function credToJSON(cred: any) {
  const r = cred.response
  const out: any = {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
    authenticatorAttachment: cred.authenticatorAttachment || null,
    response: { clientDataJSON: bufToB64u(r.clientDataJSON) }
  }
  if (r.attestationObject) {
    out.response.attestationObject = bufToB64u(r.attestationObject)
    out.response.transports = r.getTransports ? r.getTransports() : ['internal']
  }
  if (r.authenticatorData) {
    out.response.authenticatorData = bufToB64u(r.authenticatorData)
    out.response.signature = bufToB64u(r.signature)
    out.response.userHandle = r.userHandle ? bufToB64u(r.userHandle) : null
  }
  return out
}

export async function passkeyRegister(name: string, code: string, role = 'member', gymId?: string | null): Promise<any> {
  const { cid, options } = await api('/api/register/options', {
    method: 'POST',
    body: JSON.stringify({ name, code: code || '', role, gymId: gymId || undefined })
  })
  const cred = await navigator.credentials.create({ publicKey: toCreationOptions(options) })
  const res = await api('/api/register/verify', { method: 'POST', body: JSON.stringify({ cid, credential: credToJSON(cred) }) })
  return res.user
}

export async function passkeyLogin(): Promise<any> {
  const { cid, options } = await api('/api/login/options', { method: 'POST', body: '{}' })
  const cred = await navigator.credentials.get({ publicKey: toRequestOptions(options) })
  const res = await api('/api/login/verify', { method: 'POST', body: JSON.stringify({ cid, credential: credToJSON(cred) }) })
  return res.user
}

export async function adminLogin(secretOrUser: string, password?: string): Promise<any> {
  const body = password !== undefined ? { username: secretOrUser, password } : { code: secretOrUser }
  const res = await api('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify(body)
  })
  return res.user
}

export async function requestAccess(email: string, name: string, message: string, requestedRole = 'member', gymId?: string | null): Promise<any> {
  return api('/api/access-request', {
    method: 'POST',
    body: JSON.stringify({ email, name, message, requestedRole, gymId: gymId || null })
  })
}

export async function getAccessRequests(): Promise<any> {
  return api('/api/admin/access-requests')
}

export async function approveAccessRequest(id: string, role?: string, gymId?: string | null): Promise<any> {
  return api('/api/admin/access-request/approve', {
    method: 'POST',
    body: JSON.stringify({ id, role, gymId: gymId || null })
  })
}

export async function rejectAccessRequest(id: string): Promise<any> {
  return api('/api/admin/access-request/reject', {
    method: 'POST',
    body: JSON.stringify({ id })
  })
}

export const getManagementOverview = (): Promise<any> => api('/api/management/overview')
export const createManagementRequest = (payload: { requestedRole: string; gymId: string; message?: string }): Promise<any> => api('/api/management/request', { method: 'POST', body: JSON.stringify(payload) })
export const reviewManagementRequest = (id: string, action: 'approve' | 'reject'): Promise<any> => api('/api/management/request/review', { method: 'POST', body: JSON.stringify({ id, action }) })
export const createTrainingPlan = (payload: Record<string, unknown>): Promise<any> => api('/api/management/training-plans', { method: 'POST', body: JSON.stringify(payload) })
export const createSchedule = (payload: Record<string, unknown>): Promise<any> => api('/api/management/schedules', { method: 'POST', body: JSON.stringify(payload) })
export const createCustomExercise = (payload: Record<string, unknown>): Promise<any> => api('/api/management/exercises', { method: 'POST', body: JSON.stringify(payload) })
export const createDiet = (payload: Record<string, unknown>): Promise<any> => api('/api/management/diets', { method: 'POST', body: JSON.stringify(payload) })
export const createFee = (payload: Record<string, unknown>): Promise<any> => api('/api/management/fees', { method: 'POST', body: JSON.stringify(payload) })
export const submitFee = (id: string, note?: string): Promise<any> => api('/api/management/fees/submit', { method: 'POST', body: JSON.stringify({ id, note }) })
export const reviewFee = (id: string, status: 'approved' | 'rejected'): Promise<any> => api('/api/management/fees/review', { method: 'POST', body: JSON.stringify({ id, status }) })
export const logAssignment = (assignmentType: 'schedule' | 'exercise' | 'diet', assignmentId: string, status: 'hit' | 'missed' | 'partial' | 'logged', note?: string, metric?: string, itemId?: string): Promise<any> => api('/api/management/assignments/log', { method: 'POST', body: JSON.stringify({ assignmentType, assignmentId, status, note, metric, itemId }) })
export const listGyms = (): Promise<any> => api('/api/gyms')
