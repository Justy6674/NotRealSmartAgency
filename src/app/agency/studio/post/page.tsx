import { redirect } from 'next/navigation'

/**
 * This route used to host a second, separate post composer (PostComposerRoom).
 *
 * Two composers was the fault. /agency/studio/create has the content validator
 * and the per-platform options; this one had neither, and nothing kept them in
 * step. Every fix — a compliance rule, a platform character limit, a media
 * constraint — had to be written twice or it only landed on one of them. They
 * drifted, and the owner had no way to tell which composer he was standing in.
 * Deleting the page outright was the obvious move and the wrong one: an old
 * bookmark or a habit would have put him on a 404 with no onward path.
 *
 * So the route survives as a redirect and nothing else.
 *
 * 307 (redirect) rather than 308 (permanentRedirect) is deliberate. A permanent
 * redirect is cached by the browser indefinitely, so reversing it later would
 * mean asking the owner to clear his cache — and he is not a developer we can
 * send into browser settings. A temporary redirect is re-asked every time and
 * costs one round trip, which is the cheaper side of that trade.
 */
export default function RetiredPostComposerPage() {
  redirect('/agency/social/compose')
}
