-- Rename subscription tier values to match final product naming
-- (old: starter/professional/enterprise → new: starter/standard/premium)
alter table organizations
  alter column subscription_tier type text;

alter table organizations
  drop constraint if exists organizations_subscription_tier_check;

update organizations
  set subscription_tier = 'standard'
  where subscription_tier = 'professional';

update organizations
  set subscription_tier = 'premium'
  where subscription_tier = 'enterprise';

alter table organizations
  add constraint organizations_subscription_tier_check
  check (subscription_tier in ('starter', 'standard', 'premium'));

-- Add marketing_consent to parents table
alter table parents
  add column if not exists marketing_consent boolean default null;
