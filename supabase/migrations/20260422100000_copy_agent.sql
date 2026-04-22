-- =============================================
-- Copy Agent — extends video clips with scene classification
-- and per-scene contextual image generation (Nano Banana b-roll).
-- =============================================

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS base_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS copy_text TEXT;

ALTER TABLE public.video_clips
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'talking_head'
    CHECK (kind IN ('talking_head', 'broll')),
  ADD COLUMN IF NOT EXISTS visual_direction TEXT,
  ADD COLUMN IF NOT EXISTS suggested_props JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_video_clips_kind
  ON public.video_clips(kind);
