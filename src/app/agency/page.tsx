import { redirect } from 'next/navigation'

// Opening NRS shows every project at once. It used to open one project's
// conversation, which meant the state of the other ten was only reachable by
// selecting each in turn.
export default function AgencyPage() {
  redirect('/agency/board')
}
