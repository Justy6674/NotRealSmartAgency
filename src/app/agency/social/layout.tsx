import { SocialDepartmentChrome } from '@/components/agency/social/SocialDepartmentChrome'

/**
 * The Social department shell. Every /agency/social/* URL is wrapped in it, so
 * the header, the tab strip and the pinned action bar are the department's
 * rather than any one screen's.
 *
 * What a child screen gets, and what it must therefore stop doing:
 *
 *   · A PADDED, SCROLLING PANE (18px 26px 26px). It is the only scroller in the
 *     department. A screen that wraps itself in `overflow-y-auto` again ends up
 *     with two scrollbars and 52px of padding down one side.
 *   · A PINNED ACTION BAR at the foot, filled with `<SocialActionBar>` from the
 *     chrome module. That is where a decision goes — save, schedule, post now,
 *     approve — so the owner finds it in the same place on every screen instead
 *     of hunting for whatever the current one drew.
 */
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <SocialDepartmentChrome>{children}</SocialDepartmentChrome>
}
