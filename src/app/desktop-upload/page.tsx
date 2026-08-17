import { redirect } from 'next/navigation'
import { DesktopMediaInbox } from '@/components/agency/DesktopMediaInbox'
import { canWriteDesktopInboxBrand, DESKTOP_INBOX_BRAND_SLUGS, type TeamMembershipForUpload } from '@/lib/media/desktop-inbox'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DesktopUploadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=%2Fdesktop-upload')

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, slug, user_id, brand_colours')
    .in('slug', DESKTOP_INBOX_BRAND_SLUGS)
    .order('name')

  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('team_members')
    .select('owner_id, role, status, brand_ids')
    .eq('member_id', user.id)
    .eq('status', 'accepted')

  const writableBrands = (brands ?? [])
    .filter((brand) => {
      if (brand.user_id === user.id) return true
      return (memberships ?? []).some((membership) => (
        membership.owner_id === brand.user_id
        && canWriteDesktopInboxBrand(membership as TeamMembershipForUpload, brand.id)
      ))
    })
    .map(({ id, name, slug, brand_colours }) => ({
      id,
      name,
      slug,
      brand_colours: brand_colours ?? {},
    }))

  return <DesktopMediaInbox brands={writableBrands} />
}
