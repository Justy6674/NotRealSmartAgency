import { ChatInterface } from '@/components/agency/ChatInterface'

interface Props {
  params: Promise<{ conversationId: string }>
}

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params
  return <ChatInterface conversationId={conversationId} />
}
