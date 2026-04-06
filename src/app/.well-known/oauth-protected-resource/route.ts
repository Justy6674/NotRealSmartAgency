import { NextResponse } from 'next/server'

const BASE = 'https://www.notrealsmart.com.au'

export async function GET() {
  return NextResponse.json({
    resource: `${BASE}/api/mcp`,
    authorization_servers: [BASE],
    scopes_supported: ['mcp'],
    bearer_methods_supported: ['header'],
  })
}
