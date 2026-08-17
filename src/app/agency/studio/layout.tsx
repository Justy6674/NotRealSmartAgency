/**
 * Studio layout — wraps every /agency/studio/* route.
 *
 * This layout deliberately renders NO navigation of its own.
 *
 * It used to mount two things that are now gone:
 *
 * 1. <StudioSidebar /> — a third navigation layer. With the brand sidebar on
 *    the left, the room tabs and sub-tabs in the header, and the Director rail
 *    on the right, a Studio route was showing four separate ways to move around
 *    at once. Its fourteen destinations now live as inner tabs inside the Social
 *    media department, which is where they always belonged: they are views of
 *    one department's work, not top-level places. Deleting the component was
 *    tempting but wrong — it is unmounted here, not removed, so the department
 *    tabs can borrow from it.
 *
 * 2. <StudioChatCloser /> — it force-closed the Director panel on mount for
 *    every Studio route, on the reasoning that the panel overlapped the content.
 *    That directly contradicts the rule that the rail is present on every
 *    screen: the owner would open the Director, navigate to Studio, and watch it
 *    vanish with no explanation. The overlap is a layout problem and is solved
 *    in the layout, never by closing the rail behind the owner's back.
 *
 * Every /agency/studio/* route still resolves — this removed chrome, not pages.
 *
 * The wrapper below is load-bearing even though it draws nothing. The
 * surrounding layout hands its children a non-scrolling flex column, so Studio
 * has to own its own scrolling or a long page is clipped instead of scrolled.
 * `min-h-0` is the part that is easy to drop and hard to debug: without it a
 * flex child refuses to shrink below its content, `overflow-y-auto` never has a
 * bounded height to scroll within, and the overflow escapes upward into a
 * container that hides it. It stays a block container, not a flex one, because
 * the pages inside were written against the old block wrapper.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {children}
    </div>
  )
}
