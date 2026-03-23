const BASE_URL = 'http://localhost:4000/api'

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let json
  try {
    json = await res.json()
  } catch {
    json = null
  }

  return { ok: res.ok, status: res.status, json }
}

async function login(email, password) {
  const result = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  })

  if (!result.ok || !result.json?.accessToken) {
    throw new Error(`Login failed for ${email}: ${result.status} ${JSON.stringify(result.json)}`)
  }

  return result.json.accessToken
}

function denyAllPermissions() {
  const modules = ['leads', 'clients', 'projects', 'followups', 'proposals', 'invoicing', 'team', 'communication', 'reports', 'settings']
  return Object.fromEntries(modules.map((m) => [m, { view: false, create: false, edit: false, delete: false }]))
}

async function main() {
  const adminToken = await login('ceo@promoora.in', 'Aryan@9719')

  const rolesRes = await api('/roles', { token: adminToken })
  if (!rolesRes.ok) {
    throw new Error(`Failed to load roles: ${rolesRes.status} ${JSON.stringify(rolesRes.json)}`)
  }

  const bdRole = (rolesRes.json.roles || []).find((r) => String(r.name).toLowerCase().includes('bd'))
  if (!bdRole) {
    throw new Error('Could not find BD role in /roles response')
  }

  const original = {
    name: bdRole.name,
    color: bdRole.color,
    permissions: bdRole.permissions,
  }

  const patched = await api(`/roles/${bdRole._id}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      name: bdRole.name,
      color: bdRole.color,
      permissions: denyAllPermissions(),
    },
  })

  if (!patched.ok) {
    throw new Error(`Failed to patch BD role: ${patched.status} ${JSON.stringify(patched.json)}`)
  }

  const bdToken = await login('priya@promoora.in', 'Promoora@123')

  const checks = []

  const leadsRes = await api('/leads', { token: bdToken })
  checks.push({ endpoint: 'GET /api/leads', status: leadsRes.status, expectedDenied: true })

  const followupsRes = await api('/followups/today', { token: bdToken })
  checks.push({ endpoint: 'GET /api/followups/today', status: followupsRes.status, expectedDenied: true })

  const teamMembersRes = await api('/team/members', { token: bdToken })
  checks.push({ endpoint: 'GET /api/team/members', status: teamMembersRes.status, expectedDenied: true })

  const reportsRes = await api('/reports/lead-conversion', { token: bdToken })
  checks.push({ endpoint: 'GET /api/reports/lead-conversion', status: reportsRes.status, expectedDenied: true })

  const restore = await api(`/roles/${bdRole._id}`, {
    method: 'PATCH',
    token: adminToken,
    body: original,
  })

  if (!restore.ok) {
    console.error('WARNING: failed to restore original BD role permissions:', restore.status, restore.json)
  }

  console.log('Permission E2E Results')
  for (const check of checks) {
    const denied = check.status === 401 || check.status === 403
    const result = denied === check.expectedDenied ? 'PASS' : 'FAIL'
    console.log(`${result} | ${check.endpoint} | status=${check.status} | expected denied=${check.expectedDenied}`)
  }

  const failed = checks.filter((c) => {
    const denied = c.status === 401 || c.status === 403
    return denied !== c.expectedDenied
  })

  if (failed.length > 0) {
    process.exitCode = 2
  }
}

main().catch((err) => {
  console.error('Permission E2E check failed:', err.message)
  process.exit(1)
})
