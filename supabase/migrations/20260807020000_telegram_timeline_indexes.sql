-- The Mini App now rebuilds its whole conversation from these tables on every
-- open, instead of keeping it in browser memory where closing the app erased
-- it. Index-only: no table, column or row is created, altered or deleted.

-- The timeline's job window.
--
-- Deliberately NOT keyed on project_access_grant_id: a grant that is revoked
-- and reissued must not make the owner's history disappear.
CREATE INDEX IF NOT EXISTS idx_mcp_jobs_telegram_timeline
  ON public.mcp_jobs (user_id, brand_id, channel, created_at DESC);

-- The timeline's media and proposal windows.
CREATE INDEX IF NOT EXISTS idx_media_items_brand_created
  ON public.media_items (user_id, brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outputs_brand_type_created
  ON public.outputs (user_id, brand_id, output_type, created_at DESC);

-- One tap, one Director run.
--
-- The client mints an id per send and repeats it on retry. Without a unique
-- index the route can only check-then-insert, and two taps on slow phone data
-- fit through the gap between the two — producing two jobs, two paid model
-- calls, two answers and two file deliveries. With it, the second insert
-- fails cleanly and the route hands back the first job.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_jobs_client_event_id
  ON public.mcp_jobs ((input->>'client_event_id'))
  WHERE input->>'client_event_id' IS NOT NULL;
