-- ============================================================
-- 012: Enable realtime for key tables
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payslips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_tokens;
