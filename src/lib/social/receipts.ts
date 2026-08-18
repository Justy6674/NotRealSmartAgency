import type { SocialDeskAction } from './actions'

export type SocialCommandErrorCode =
  | 'INVALID_ACTION'
  | 'PERMISSION_DENIED'
  | 'BRAND_MISMATCH'
  | 'REVISION_CONFLICT'
  | 'UNSUPPORTED_OPTION'
  | 'ACCOUNT_NOT_AVAILABLE'
  | 'MEDIA_NOT_AVAILABLE'
  | 'CONFIRMATION_REQUIRED'

export interface SocialCommandReceipt {
  commandId: string
  compositionId: string
  actionType: SocialDeskAction['type']
  status: 'rejected' | 'conflict' | 'succeeded' | 'undone'
  expectedRevision: number
  appliedRevision: number | null
  touchedPaths: string[]
  inverseAction?: SocialDeskAction
  warnings: string[]
  errorCode?: SocialCommandErrorCode
  errorSafe?: string
  createdAt: string
  completedAt: string
}
