import { SOCIAL_PLATFORM_CAPABILITIES } from './capabilities'
import type { SocialDeskCommand } from './actions'
import { reduceSocialCommand, SocialCommandError } from './reducer'
import type { SocialMediaRef, SocialPostDocumentV1 } from './model'
import type { SocialCommandReceipt } from './receipts'
import { SocialDeskCommandSchema } from './schemas'

export interface SocialCommandRepository {
  getComposition(): Promise<SocialPostDocumentV1>
  getReceipt(commandId: string): Promise<SocialCommandReceipt | null>
  commit(input: {
    command: SocialDeskCommand
    document: SocialPostDocumentV1
    receipt: SocialCommandReceipt
  }): Promise<
    | { document: SocialPostDocumentV1; receipt: SocialCommandReceipt }
    | { conflictRevision: number }
  >
}

export interface SocialCommandContext {
  repository: SocialCommandRepository
  authenticatedUserId: string
  canWriteBrand: (actorUserId: string, brandId: string) => Promise<boolean>
  validateAccounts: (brandId: string, accountIds: string[]) => Promise<boolean>
  loadMedia: (brandId: string) => Promise<Map<string, SocialMediaRef>>
  now: () => string
}

function receiptOf(
  command: SocialDeskCommand,
  partial: Partial<SocialCommandReceipt> & Pick<SocialCommandReceipt, 'status'>,
): SocialCommandReceipt {
  const now = command.createdAt
  return {
    commandId: command.commandId,
    compositionId: command.compositionId,
    actionType: command.action.type,
    expectedRevision: command.expectedRevision,
    appliedRevision: null,
    touchedPaths: [],
    warnings: [],
    createdAt: now,
    completedAt: now,
    ...partial,
  }
}

export async function executeSocialCommand(
  context: SocialCommandContext,
  rawCommand: unknown,
): Promise<{ document: SocialPostDocumentV1; receipt: SocialCommandReceipt }> {
  const parsed = SocialDeskCommandSchema.safeParse(rawCommand)
  if (!parsed.success) {
    const current = await context.repository.getComposition()
    return {
      document: current,
      receipt: receiptOf(
        {
          commandId: '00000000-0000-4000-8000-000000000000',
          compositionId: current.compositionId,
          brandId: current.brandId,
          expectedRevision: 0,
          source: 'manual',
          actorUserId: context.authenticatedUserId,
          action: { type: 'save_draft' },
          createdAt: context.now(),
        },
        { status: 'rejected', errorCode: 'INVALID_ACTION', errorSafe: 'That change is not allowed.' },
      ),
    }
  }

  const command = parsed.data
  const existing = await context.repository.getReceipt(command.commandId)
  const current = await context.repository.getComposition()
  if (existing) return { document: current, receipt: existing }

  if (command.actorUserId !== context.authenticatedUserId) {
    return {
      document: current,
      receipt: receiptOf(command, {
        status: 'rejected',
        errorCode: 'PERMISSION_DENIED',
        errorSafe: 'You cannot change this post.',
      }),
    }
  }

  if (command.brandId !== current.brandId || command.compositionId !== current.compositionId) {
    return {
      document: current,
      receipt: receiptOf(command, {
        status: 'rejected',
        errorCode: 'BRAND_MISMATCH',
        errorSafe: 'This post belongs to a different business.',
      }),
    }
  }

  if (!(await context.canWriteBrand(command.actorUserId, command.brandId))) {
    return {
      document: current,
      receipt: receiptOf(command, {
        status: 'rejected',
        errorCode: 'PERMISSION_DENIED',
        errorSafe: 'You cannot change this post.',
      }),
    }
  }

  if (command.expectedRevision !== current.revision) {
    return {
      document: current,
      receipt: receiptOf(command, {
        status: 'conflict',
        errorCode: 'REVISION_CONFLICT',
        errorSafe: 'This post changed while you were editing. Try again.',
      }),
    }
  }

  const mediaById = await context.loadMedia(command.brandId)
  const action = command.action.type === 'undo'
    ? (await context.repository.getReceipt(command.action.commandId))?.inverseAction
    : command.action

  if (command.action.type === 'undo' && !action) {
    return {
      document: current,
      receipt: receiptOf(command, {
        status: 'rejected',
        errorCode: 'INVALID_ACTION',
        errorSafe: 'There is nothing to undo.',
      }),
    }
  }

  try {
    const result = reduceSocialCommand(current, action!, {
      capabilities: SOCIAL_PLATFORM_CAPABILITIES,
      now: context.now(),
      mediaById,
    })
    const receipt = receiptOf(command, {
      status: command.action.type === 'undo' ? 'undone' : 'succeeded',
      appliedRevision: result.document.revision,
      touchedPaths: result.touchedPaths,
      inverseAction: result.inverseAction,
      warnings: result.warnings,
      completedAt: context.now(),
    })
    const committed = await context.repository.commit({
      command,
      document: result.document,
      receipt,
    })
    if ('conflictRevision' in committed) {
      return {
        document: current,
        receipt: receiptOf(command, {
          status: 'conflict',
          errorCode: 'REVISION_CONFLICT',
          errorSafe: 'This post changed while you were editing. Try again.',
        }),
      }
    }
    return committed
  } catch (error) {
    const code = error instanceof SocialCommandError ? error.code : 'INVALID_ACTION'
    const mapped =
      code === 'MEDIA_NOT_AVAILABLE'
        ? 'MEDIA_NOT_AVAILABLE' as const
        : code === 'UNSUPPORTED_OPTION'
          ? 'UNSUPPORTED_OPTION' as const
          : 'INVALID_ACTION' as const
    return {
      document: current,
      receipt: receiptOf(command, {
        status: 'rejected',
        errorCode: mapped,
        errorSafe: error instanceof Error ? error.message : 'That change could not be applied.',
      }),
    }
  }
}
