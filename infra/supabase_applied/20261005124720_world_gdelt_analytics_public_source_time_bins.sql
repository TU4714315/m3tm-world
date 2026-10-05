
CREATE OR REPLACE FUNCTION public.world_gdelt_public_analytics(p_hours INTEGER DEFAULT 24)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_hours INTEGER;
  v_step INTEGER;
  v_start TEXT;
  v_out JSONB;
BEGIN
  v_hours := CASE WHEN p_hours IN (1,6,24,168) THEN p_hours ELSE 24 END;
  v_step := CASE v_hours WHEN 1 THEN 15 WHEN 6 THEN 30 WHEN 24 THEN 60 ELSE 180 END;
  v_start := to_char((now()-make_interval(hours=>v_hours)) AT TIME ZONE 'UTC','YYYYMMDDHH24MISS') || '.export.CSV.zip';

  WITH filtered AS (
    SELECT r.event_id,r.event_category,r.country,r.source_count,r.article_count,
           w.published_at
      FROM public.world_gdelt_published_reports AS r
      JOIN public.world_gdelt_export_windows AS w USING (window_name)
      WHERE r.window_name >= v_start AND w.published_at <= now()
  ), categories AS (
    SELECT event_category,COUNT(*)::INTEGER AS reports FROM filtered
    GROUP BY event_category
  ), country_counts AS (
    SELECT country,COUNT(*)::INTEGER AS reports
      FROM filtered
      WHERE country <> ''
      GROUP BY country ORDER BY reports DESC LIMIT 12
  ), timeseries AS (
    SELECT date_bin(make_interval(mins=>v_step),published_at,
      '1970-01-01T00:00:00Z'::timestamptz) AS bucket,
      COUNT(*)::INTEGER AS reports
    FROM filtered
    GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'scope','GDELT source-coded reports, Middle East and Red Sea, generalized 0.25-degree',
    'confidence','reported-by-source-not-independently-verified',
    'lookbackHours',v_hours,
    'bucketMinutes',v_step,
    'totalReportRows',(SELECT COUNT(*) FROM filtered),
    'distinctEventIds',(SELECT COUNT(DISTINCT event_id) FROM filtered),
    'multiplePublishers',(SELECT COUNT(*) FROM filtered WHERE source_count>=2),
    'singlePublisher',(SELECT COUNT(*) FROM filtered WHERE source_count<2),
    'categories',COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('category',event_category,'reports',reports))
       FROM categories),'[]'::jsonb),
    'countries',COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('country',country,'reports',reports))
       FROM country_counts),'[]'::jsonb),
    'timeline',COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('publishedAt',bucket,'reports',reports)
        ORDER BY bucket) FROM timeseries),'[]'::jsonb),
    'asOf',now()
  ) INTO v_out;
  RETURN v_out;
END;$$;

REVOKE ALL ON FUNCTION public.world_gdelt_public_analytics(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.world_gdelt_public_analytics(INTEGER) TO service_role;
