CREATE TABLE public.podcast_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  visual_style TEXT NOT NULL DEFAULT 'cinematic_documentary',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_episodes TO authenticated;
GRANT ALL ON public.podcast_episodes TO service_role;
ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own podcast episodes" ON public.podcast_episodes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own podcast episodes" ON public.podcast_episodes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own podcast episodes" ON public.podcast_episodes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own podcast episodes" ON public.podcast_episodes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.podcast_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.podcast_episodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  segment_order INTEGER NOT NULL,
  concept_title TEXT NOT NULL,
  host_dialogue TEXT NOT NULL,
  veo_cinematic_prompt TEXT NOT NULL,
  key_takeaway TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 8,
  video_job_id TEXT,
  video_path TEXT,
  status TEXT NOT NULL DEFAULT 'script_ready',
  error_message TEXT,
  seed BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (episode_id, segment_order)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.podcast_segments TO authenticated;
GRANT ALL ON public.podcast_segments TO service_role;
ALTER TABLE public.podcast_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own podcast segments" ON public.podcast_segments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own podcast segments" ON public.podcast_segments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own podcast segments" ON public.podcast_segments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own podcast segments" ON public.podcast_segments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX podcast_episodes_user_created_idx ON public.podcast_episodes(user_id, created_at DESC);
CREATE INDEX podcast_segments_episode_order_idx ON public.podcast_segments(episode_id, segment_order);

CREATE TRIGGER update_podcast_episodes_updated_at BEFORE UPDATE ON public.podcast_episodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_podcast_segments_updated_at BEFORE UPDATE ON public.podcast_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Users can view their own podcast videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'podcast-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can upload their own podcast videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'podcast-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update their own podcast videos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'podcast-videos' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'podcast-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete their own podcast videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'podcast-videos' AND (storage.foldername(name))[1] = auth.uid()::text);