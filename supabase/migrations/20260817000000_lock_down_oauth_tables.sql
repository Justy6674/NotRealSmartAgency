-- Close public access to the OAuth tables.
--
-- oauth_clients holds client_secret in plaintext, and oauth_auth_codes holds
-- short-lived codes that exchange for a session. Both had Row Level Security
-- OFF and `GRANT ALL ... TO anon`. The anon key is not a secret — it ships in
-- the browser bundle of every page load — so anyone who opened the site could
-- read the client secrets, and could also INSERT, UPDATE and DELETE rows in
-- both tables. Registering a client pointing anywhere, or deleting the real
-- ones, needed nothing but the page source.
--
-- Every server path that touches these tables uses the service role
-- (/api/mcp/{authorize,token,code,register} all use createAdminClient), and the
-- service role bypasses RLS. So enabling RLS with no policies closes the tables
-- to browser clients completely while leaving MCP sign-in working unchanged.
--
-- The grants are revoked as well. With RLS on and no policy, anon and
-- authenticated already get nothing, so this changes no behaviour today — it
-- means a permissive policy added later cannot silently hand write access back.
--
-- Deliberately NOT rotating the exposed client_secret values here: that is
-- Justin's call and he asked to lock down first. Until they are rotated, anyone
-- who already copied a secret still holds a valid one.

ALTER TABLE "public"."oauth_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."oauth_auth_codes" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."oauth_clients" FROM "anon";
REVOKE ALL ON TABLE "public"."oauth_clients" FROM "authenticated";
REVOKE ALL ON TABLE "public"."oauth_auth_codes" FROM "anon";
REVOKE ALL ON TABLE "public"."oauth_auth_codes" FROM "authenticated";

-- service_role keeps its grant; it is the only thing that legitimately reads
-- these tables, and it is never exposed to a browser.
