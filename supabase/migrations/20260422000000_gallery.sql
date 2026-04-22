-- =============================================
-- Gallery — cross-flow catalog of saved assets
-- =============================================

CREATE TABLE IF NOT EXISTS public.gallery_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#9ca3af',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_categories_name
  ON public.gallery_categories(name);

CREATE TABLE IF NOT EXISTS public.gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('image', 'reference')),
  url TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  aspect TEXT,
  ref_tag TEXT,
  source_flow_id UUID,
  source_node_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate saves of the same URL
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_items_url_active
  ON public.gallery_items(url)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gallery_items_created_at
  ON public.gallery_items(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gallery_items_kind
  ON public.gallery_items(kind)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gallery_item_categories (
  item_id UUID NOT NULL REFERENCES public.gallery_items(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.gallery_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (item_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_gallery_item_categories_item
  ON public.gallery_item_categories(item_id);
CREATE INDEX IF NOT EXISTS idx_gallery_item_categories_category
  ON public.gallery_item_categories(category_id);

-- =============================================
-- RLS (open — matches existing project convention)
-- =============================================
ALTER TABLE public.gallery_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_item_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gallery_categories_all" ON public.gallery_categories;
CREATE POLICY "gallery_categories_all" ON public.gallery_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gallery_items_all" ON public.gallery_items;
CREATE POLICY "gallery_items_all" ON public.gallery_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gallery_item_categories_all" ON public.gallery_item_categories;
CREATE POLICY "gallery_item_categories_all" ON public.gallery_item_categories FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- Triggers
-- =============================================
DROP TRIGGER IF EXISTS set_gallery_categories_updated_at ON public.gallery_categories;
CREATE TRIGGER set_gallery_categories_updated_at
  BEFORE UPDATE ON public.gallery_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS set_gallery_items_updated_at ON public.gallery_items;
CREATE TRIGGER set_gallery_items_updated_at
  BEFORE UPDATE ON public.gallery_items
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
