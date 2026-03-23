import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SubscriptionTier } from '@/types/database'

const PRICE_TO_TIER: Record<string, SubscriptionTier> = {
  [process.env.STRIPE_STARTER_PRICE_ID!]: 'starter',
  [process.env.STRIPE_PROFESSIONAL_PRICE_ID!]: 'professional',
  [process.env.STRIPE_PRACTICE_PRICE_ID!]: 'practice',
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id
        const tier = priceId ? PRICE_TO_TIER[priceId] : undefined

        if (tier) {
          await supabase
            .from('users')
            .update({
              subscription_tier: tier,
              subscription_status: 'active',
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
            })
            .eq('stripe_customer_id', customerId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer as string
        const priceId = subscription.items.data[0]?.price.id
        const tier = priceId ? PRICE_TO_TIER[priceId] : undefined

        const updates: Record<string, unknown> = {}

        if (tier) {
          updates.subscription_tier = tier
        }

        if (subscription.cancel_at_period_end) {
          updates.subscription_status = 'cancelled'
        } else {
          updates.subscription_status = subscription.status === 'active' ? 'active' : subscription.status
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('users')
            .update(updates)
            .eq('stripe_customer_id', customerId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer as string

        await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'active',
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer as string

        await supabase
          .from('users')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', customerId)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
