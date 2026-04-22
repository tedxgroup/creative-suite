-- =============================================
-- Link a project to a shared Nano Flow used as a
-- visual workspace for per-scene image overrides.
-- =============================================

ALTER TABLE public.video_projects
  ADD COLUMN IF NOT EXISTS scene_flow_id UUID
    REFERENCES public.image_flows(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_video_projects_scene_flow_id
  ON public.video_projects(scene_flow_id);
