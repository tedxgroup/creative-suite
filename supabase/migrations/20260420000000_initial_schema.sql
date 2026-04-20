-- =============================================
-- Creative Suite — Initial Schema
-- =============================================

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- video_projects
-- =============================================
CREATE TABLE IF NOT EXISTS public.video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- video_clips
-- =============================================
CREATE TABLE IF NOT EXISTS public.video_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 1,
  model TEXT NOT NULL DEFAULT 'veo3',
  image_url TEXT,
  audio_url TEXT,
  prompt TEXT NOT NULL DEFAULT '',
  dialogue TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  task_id TEXT,
  provider TEXT,
  video_url TEXT,
  error TEXT,
  trim_start NUMERIC,
  trim_end NUMERIC,
  tagged BOOLEAN DEFAULT false,
  regenerated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_clips_project ON public.video_clips(project_id);
CREATE INDEX IF NOT EXISTS idx_video_clips_status ON public.video_clips(status);

-- =============================================
-- voice_history
-- =============================================
CREATE TABLE IF NOT EXISTS public.voice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('tts', 'voice-changer')),
  voice_id TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  text TEXT,
  input_audio_url TEXT,
  output_url TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_history_created_at
  ON public.voice_history(created_at DESC);

-- =============================================
-- RLS policies (open — auth handled at app layer via allowlist)
-- =============================================
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_projects_all" ON public.video_projects;
CREATE POLICY "video_projects_all" ON public.video_projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "video_clips_all" ON public.video_clips;
CREATE POLICY "video_clips_all" ON public.video_clips FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "voice_history_all" ON public.voice_history;
CREATE POLICY "voice_history_all" ON public.voice_history FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Triggers
-- =============================================
DROP TRIGGER IF EXISTS set_video_projects_updated_at ON public.video_projects;
CREATE TRIGGER set_video_projects_updated_at
  BEFORE UPDATE ON public.video_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS set_video_clips_updated_at ON public.video_clips;
CREATE TRIGGER set_video_clips_updated_at
  BEFORE UPDATE ON public.video_clips
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
