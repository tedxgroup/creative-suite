-- =============================================
-- Nano Flow — Image generation canvas
-- =============================================

-- =============================================
-- image_flows
-- =============================================
CREATE TABLE IF NOT EXISTS public.image_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Flow sem título',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  viewport JSONB NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}'::jsonb,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_flows_updated_at
  ON public.image_flows(updated_at DESC)
  WHERE deleted_at IS NULL;

-- =============================================
-- generated_images
-- =============================================
CREATE TABLE IF NOT EXISTS public.generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.image_flows(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  refs_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  aspect TEXT NOT NULL,
  resolution TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gemini-3-pro-image-preview',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_images_flow
  ON public.generated_images(flow_id)
  WHERE deleted_at IS NULL;

-- =============================================
-- reference_assets
-- =============================================
CREATE TABLE IF NOT EXISTS public.reference_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reference_assets_created_at
  ON public.reference_assets(created_at DESC);

-- =============================================
-- RLS (open — matches existing project convention)
-- =============================================
ALTER TABLE public.image_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "image_flows_all" ON public.image_flows;
CREATE POLICY "image_flows_all" ON public.image_flows FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "generated_images_all" ON public.generated_images;
CREATE POLICY "generated_images_all" ON public.generated_images FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "reference_assets_all" ON public.reference_assets;
CREATE POLICY "reference_assets_all" ON public.reference_assets FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Triggers
-- =============================================
DROP TRIGGER IF EXISTS set_image_flows_updated_at ON public.image_flows;
CREATE TRIGGER set_image_flows_updated_at
  BEFORE UPDATE ON public.image_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
