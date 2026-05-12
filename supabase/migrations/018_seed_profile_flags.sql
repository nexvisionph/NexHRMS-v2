-- Ensure all seed/demo accounts are fully onboarded.
-- profile_complete=true prevents the onboarding modal from triggering.
-- must_change_password=false prevents the forced password change step.
UPDATE profiles
SET profile_complete = true,
    must_change_password = false
WHERE profile_complete = false
   OR must_change_password = true;
