-- Retire the legacy avatar-video provider without deleting a customer's
-- historical output or encrypted integration record.
begin;

update user_integrations
set is_active = false,
    updated_at = now()
where provider = 'heygen'
  and is_active = true;

update agent_configs
set system_prompt = regexp_replace(
  regexp_replace(
    regexp_replace(
      system_prompt,
      'HeyGen',
      'the NRS video toolkit',
      'gi'
    ),
    'create_video',
    'a production brief',
    'g'
  ),
  'AI avatar delivery',
  'programmatic or recorded production',
  'gi'
)
where system_prompt ~* 'HeyGen|create_video';

commit;
