import { isWebsiteScanRequest } from '@/lib/agents/website-scan-directive'

/** Give the owner a truthful, action-specific status while a Director job runs. */
export function getTelegramJobAcknowledgement(projectName: string, message: string): string {
  if (isWebsiteScanRequest(message)) {
    return `Scanning ${projectName}’s live website now. I’ll return the evidence and the one next marketing action here.`
  }

  return `Working on ${projectName}. I’ll return the completed result here.`
}
