import { NextResponse } from 'next/server'

const BASE = 'https://www.notrealsmart.com.au'

export async function GET() {
  return NextResponse.json({
    issuer: BASE,
    authorization_endpoint: `${BASE}/api/mcp/authorize`,
    token_endpoint: `${BASE}/api/mcp/token`,
    registration_endpoint: `${BASE}/api/mcp/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    scopes_supported: ['mcp'],
  })
}
