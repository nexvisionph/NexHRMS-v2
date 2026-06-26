# Migration Execution Order

**IMPORTANT:** Do not rename existing migration files. Supabase tracks applied
migrations by filename. Renaming breaks the migration history on all environments
where the migration has already been applied.

Duplicate-numbered files (001–031, 055, 065, 066) are a known legacy issue.
Supabase sorts by filename alphabetically, so within a number the order is
determined by the suffix (e.g. `001_auth_profiles` before `001_profiles`).

**Rule going forward:** All new migrations use the next sequential number with
no collisions. Current highest: `067`. Next new migration: `068`.

---

## Canonical Execution Order (alphabetical, as applied by Supabase)

```
001_auth_profiles.sql
001_profiles.sql
002_employees.sql
002_foundation_tables.sql
003_employees.sql
003_roles_permissions.sql
004_attendance.sql
005_leave.sql
006_payroll.sql
007_loans.sql
008_tasks_messaging.sql
009_audit_notifications.sql
009_remaining_tables.sql
010_indexes.sql
010_projects_timesheets_settings.sql
011_rls_policies.sql
012_realtime.sql
012_seed_data.sql
013_fix_holidays_type_check.sql
013_seed_data.sql
014_add_missing_fk_constraints.sql
014_seed_users.sql
015_add_indexes_and_checks.sql
015_attendance_logs_unique.sql
016_fix_loans_timestamp.sql
016_v1_parity.sql
017_add_companies_and_company_id.sql
017_align_employee_roles.sql
018_make_appearance_tenant_scoped.sql
018_seed_profile_flags.sql
019_company_rls_policy_templates.sql
019_extend_event_types.sql
020_add_company_id_to_remaining_tables.sql
020_enable_realtime.sql
021_add_company_id_to_config_tables.sql
021_expand_event_types.sql
022_add_company_id_to_foundation_tables.sql
022_kiosk_face_recognition_enhancement.sql
023_add_company_scoped_rls_policies.sql
023_face_embedding_support.sql
024_add_employee_biometric_id.sql
024_finance_rls_fixes.sql
025_employee_attendance_log_write.sql
025_performance_management.sql
026_face_reference_images.sql
026_tasks_schema_updates.sql
027_biometric_integration.sql
027_project_constraints.sql
028_biometric_palm_and_exception_flags.sql
028_payroll_run_payslips_junction.sql
029_fix_task_completion_reports_cascade.sql
029_project_assignments_junction.sql
030_employee_biometric_self_service.sql
030_employees_add_contact_fields.sql
031_employee_security_rls_hardening.sql
031_tasks_project_id.sql
032_task_tags.sql
033_fix_location_pings_rls.sql
034_job_titles.sql
035_departments.sql
036_deduction_overrides.sql
037_fix_deduction_rls.sql
038_payroll_signature_config.sql
039_fix_payroll_fk_cascade.sql
040_realtime_missing_tables_disable_rls.sql
041_face_recognition_test_account.sql
042_employees_add_job_title.sql
043_leave_requests_add_duration.sql
044_notification_logs_add_read.sql
045_payroll_simplification.sql
046_text_channels_realtime.sql
047_push_subscriptions.sql
048_payroll_payment_proof.sql
049_employees_notification_preferences.sql
050_avatars_storage_bucket.sql
051_kiosk_config.sql
052_notification_provider_config.sql
053_employees_biometric_id.sql
054_payslip_payment_hold.sql
055_client_feature_pack.sql
055_fix_stale_payslip_statuses.sql
056_bir_compliance_foundation.sql
057_employee_201_files_disciplinary.sql
058_jobs.sql
059_fix_account_role_sync.sql
060_tasks_schema_updates.sql
061_201docs_employee_insert_policy.sql
062_fix_departments_jobtitles_rls.sql
063_imported_payroll_support.sql
064_disciplinary_explanation_realtime_sync.sql
065_disciplinary_enhancements.sql
065_ot_review_layer.sql
065_update_loans_status_check.sql
066_disciplinary_case_status_sync_triggers.sql
066_payroll_rules_engine.sql
067_mobile_attendance.sql
20260608_payroll_computation_engine.sql  ← non-standard name, applied last
add_government_loans.sql                 ← non-standard name, applied after 20260608
```

---

## Next Available Numbers

| Purpose | Migration Number |
|---|---|
| Next new migration | `068` |
| attendance_summaries table (ATT-001) | `068` |
| attendance location columns (ATT-006) | `069` |
| Any future migration | `070+` |

---

## Rules for New Migrations

1. Use format: `NNN_short_description.sql` where NNN is zero-padded 3 digits
2. NNN must be unique — check this file before creating a new migration
3. Never use a number already in the list above
4. Update this file's "Next Available Numbers" table when you add a migration
5. CI will fail if duplicate numbers are detected (see `.github/workflows/ci-main.yml`)
