-- =============================================
-- Scene draft — lets the bulk-scenes dialog
-- restore in-progress work after accidental close.
-- =============================================

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS scene_draft JSONB;
