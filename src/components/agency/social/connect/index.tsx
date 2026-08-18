/**
 * Our own connect flow, in one folder.
 *
 * The whole point of it is that a business owner never lands on another
 * company's screen to connect his own Facebook. The platform's sign-in page is
 * theirs, because it must be; everything around it — the chooser, the second
 * choice, the two platforms with no sign-in page at all, and every sentence
 * about what did and did not happen — is ours.
 *
 * `ConnectAccountDialog` is the only piece a screen needs. The rest are exported
 * because the accounts page draws the same honest states outside the dialog, and
 * two vocabularies for "connected" is exactly how the desk came to show two
 * warning accounts as healthy.
 */

export { ConnectAccountDialog, CONNECT_API, readConnectReturn } from './ConnectAccountDialog'
export {
  PlatformGrid,
  CONNECTABLE_PLATFORMS,
  platformBySlug,
  platformLabel,
  type ConnectablePlatform,
  type ConnectedAccountSummary,
  type ConnectFlow,
} from './PlatformGrid'
export {
  ConnectStatus,
  HealthBadge,
  healthWording,
  phaseWording,
  showsTick,
  type ConnectionHealth,
  type ConnectPhase,
} from './ConnectStatus'
export { SecondarySelectionStep, type ConnectChoice } from './SecondarySelectionStep'
export { BlueskyCredentialsForm } from './BlueskyCredentialsForm'
export { TelegramConnectStep } from './TelegramConnectStep'
