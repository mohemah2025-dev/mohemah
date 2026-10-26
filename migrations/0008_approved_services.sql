-- Services an administrator approved for a provider (JSON array of service ids). The provider can switch
-- them on/off but cannot add others. Back-filled from the services they already have or requested.
ALTER TABLE users ADD COLUMN approved_services TEXT;
UPDATE users SET approved_services = (
  SELECT json_group_array(sid) FROM (
    SELECT service_id AS sid FROM provider_services WHERE provider_id = users.id
    UNION SELECT value FROM json_each(COALESCE(users.requested_services, '[]'))
  )
) WHERE EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = users.id AND r.role = 'provider');
