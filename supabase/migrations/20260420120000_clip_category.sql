-- Category tag for clips — one of: hook1, hook2, hook3, hook4, hook5, broll (or NULL).
-- Used to classify scenes for editorial organization (e.g. "which Hook variant this is").

ALTER TABLE public.video_clips
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE INDEX IF NOT EXISTS idx_video_clips_category ON public.video_clips(category);
