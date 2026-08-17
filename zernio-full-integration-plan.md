# NRS x Zernio: Full Integration Spec & Exploration
*Generated via /gstack spec methodology*

## 1. Current Status: ARE WE FULLY INTEGRATED?
**No. We are at roughly 10% integration.** 
Currently, we have only built the "backdoor plumbing" for a single test case (ScentSell):
- [x] API Key in `.env.local`
- [x] Webhook receiver for incoming DMs/Comments (`/api/webhooks/zernio`)
- [x] A single AI tool (`zernio_reply`) for the Director to reply to DMs.

**What is Missing (The remaining 90%):**
- [ ] **The User UI (OAuth):** Letting an external SaaS customer click "Connect TikTok" in the NRS dashboard.
- [ ] **The Publishing Engine:** Routing scheduled posts, carousels, and videos to Zernio instead of Mixpost.
- [ ] **Media Uploads:** Sending NRS Media Library assets to Zernio's media endpoints.
- [ ] **Ads API:** Letting the Paid Ads agent launch and manage Meta/Google ads.
- [ ] **Analytics API:** Pulling engagement stats back into the NRS dashboard.

---

## 2. What Zernio Gives SaaS Developers for "Ease of Use"
Zernio is a **headless REST API**. It does not give you drop-in React components (like Stripe Checkout). You build the UI in Next.js, and Zernio handles the nightmare backend logic. 

Here is exactly what it gives you to make SaaS development easy:

1. **Pre-Approved OAuth:** 
   You don't need to apply for a TikTok Developer account or a Meta Business app. You hit Zernio's `GET /v1/connect/tiktok` endpoint, it gives you a URL, you redirect your user there, they log in, and Zernio gives you back an `accountId`. Done.
2. **Normalized Webhooks:** 
   Every social network formats DMs differently. Zernio translates all of them (Insta, Facebook, Twitter, WhatsApp) into one standard `message.received` JSON payload. Your code only has to understand one format.
3. **Media Chunking & Transcoding:** 
   Twitter requires video chunking. TikTok requires specific formats. You just pass the video URL to Zernio, and Zernio does all the heavy lifting to ensure it posts successfully to each specific platform.
4. **Pass-through X (Twitter) Billing:**
   Twitter charges $0.20 per tweet with a link. Zernio handles the Twitter billing logic so you don't have to build complex usage tracking just to avoid going bankrupt.

---

## 3. The Full Integration Plan (Phase by Phase)

### Phase 1: The Account Connection UI (SaaS Ready)
We need to let external users connect their own accounts without us touching `.env` files.
* **API Route (`/api/zernio/connect`):** Hits Zernio to generate a connection URL for a specific platform.
* **Frontend (`/agency/studio/accounts`):** Add buttons for "Connect TikTok via Zernio", "Connect Instagram", etc.
* **Database:** Save the returned Zernio `accountId` into the Supabase `brands` or `mixpost_accounts` equivalent table.

### Phase 2: The Publishing Router
NRS currently hardcodes everything to Mixpost. We need a dynamic router.
* **Logic:** When `draft_post` or the Cron Publisher runs, it checks the brand's connected accounts. 
* **If Mixpost Account:** Route to self-hosted Mixpost.
* **If Zernio Account:** Call `zernio.posts.createPost()`.
* **Media Handling:** Before posting, if there is a video, upload it to Zernio via `/v1/media` to get a `mediaId`, then attach that to the post.

### Phase 3: The Unified Inbox (Director Upgrade)
We have the webhook receiver. Now we need the UI.
* **NRS Dashboard:** We can optionally build a traditional "Inbox" tab in the Creative Studio, pulling from `GET /v1/inbox/conversations`. 
* **Agent Context:** Ensure the NRS Director can fetch the *history* of a conversation before replying, so it doesn't just reply blindly to the latest message.

### Phase 4: Paid Ads (The Holy Grail)
* **API:** Connect to `/v1/ads`.
* **Agent Tool:** Create `manage_paid_ads` tool. The Paid Ads department can allocate budget, define targeting, attach a Canva design, and push it live to Meta or Google via Zernio.