import { SocialDepartmentChrome } from '@/components/agency/social/SocialDepartmentChrome'

/**
 * Social department shell. The chrome (header + inner tabs) lives here so
 * every sub-page gets the same navigation strip without repeating it.
 *
 * Compose is full-height: the panel div in SocialDepartmentChrome uses
 * `overflow-hidden flex-col` rather than `overflow-y-auto` when the compose
 * tab is active, so PostCreator's pinned action bar is never clipped.
 */
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <SocialDepartmentChrome>{children}</SocialDepartmentChrome>
}
