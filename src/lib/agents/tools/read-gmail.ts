import { tool } from 'ai'
import { z } from 'zod/v3'

/**
 * Gmail reading tool — searches and reads emails.
 * Uses Google OAuth. Requires GMAIL_ACCESS_TOKEN in env
 * (refreshed via OAuth flow, or use a service account).
 *
 * For MVP: fetches via Gmail API directly.
 */
export function createReadGmailTool() {
  return tool({
    description:
      'Search and read Gmail emails. Use to find client briefs, extract information from email threads, or check correspondence about a brand. Requires Gmail OAuth to be configured.',
    inputSchema: z.object({
      query: z.string().describe('Gmail search query. Examples: "from:client@example.com", "subject:marketing brief", "after:2026/03/01 label:inbox"'),
      maxResults: z.number().min(1).max(10).default(5).describe('Maximum emails to return'),
      readFull: z.boolean().default(false).describe('Read full email body (true) or just subject/from/date (false)'),
    }),
    execute: async ({ query, maxResults, readFull }) => {
      const accessToken = process.env.GMAIL_ACCESS_TOKEN
      if (!accessToken) {
        return {
          success: false,
          error: 'Gmail not connected. Add GMAIL_ACCESS_TOKEN to environment variables. Set up OAuth at console.cloud.google.com.',
          hint: 'For now, you can ask the user to paste email content directly into the chat.',
        }
      }

      try {
        // Search for messages
        const searchRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!searchRes.ok) {
          const err = await searchRes.text()
          return { success: false, error: `Gmail API error: ${searchRes.status}`, detail: err }
        }

        const searchData = await searchRes.json()
        const messageIds = searchData.messages?.map((m: { id: string }) => m.id) ?? []

        if (messageIds.length === 0) {
          return { success: true, emails: [], message: `No emails found for query: "${query}"` }
        }

        // Fetch each message
        const emails = []
        for (const msgId of messageIds.slice(0, maxResults)) {
          const format = readFull ? 'full' : 'metadata'
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=${format}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )

          if (!msgRes.ok) continue
          const msg = await msgRes.json()

          const headers = msg.payload?.headers ?? []
          const getHeader = (name: string) => headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

          const email: Record<string, unknown> = {
            id: msg.id,
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject'),
            date: getHeader('Date'),
            snippet: msg.snippet,
          }

          if (readFull && msg.payload?.body?.data) {
            email.body = Buffer.from(msg.payload.body.data, 'base64url').toString('utf-8')
          } else if (readFull && msg.payload?.parts) {
            const textPart = msg.payload.parts.find((p: { mimeType: string }) => p.mimeType === 'text/plain')
            if (textPart?.body?.data) {
              email.body = Buffer.from(textPart.body.data, 'base64url').toString('utf-8').slice(0, 3000)
            }
          }

          emails.push(email)
        }

        return {
          success: true,
          emails,
          count: emails.length,
          query,
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Gmail search failed',
        }
      }
    },
  })
}
