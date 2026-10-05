
-- M3TM WORLD public-source history is strictly isolated from APP private/auth data.
-- No military tracks or restricted ACLED rows are stored.
CREATE TABLE IF NOT EXISTS public.world_gdelt_export_windows (
  window_name TEXT PRIMARY KEY CHECK (window_name ~ '^20[0-9]{12}\.export\.CSV\.zip$'),
  published_at TIMESTAMPTZ NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_rows INTEGER NOT NULL DEFAULT 0 CHECK (scanned_rows >= 0),
  mena_rows INTEGER NOT NULL DEFAULT 0 CHECK (mena_rows >= 0)
);
CREATE INDEX IF NOT EXISTS world_gdelt_window_published_idx
  ON public.world_gdelt_export_windows(published_at DESC);

CREATE TABLE IF NOT EXISTS public.world_gdelt_published_reports (
  window_name TEXT NOT NULL REFERENCES public.world_gdelt_export_windows(window_name) ON DELETE CASCADE,
  event_id BIGINT NOT NULL CHECK (event_id > 0),
  event_date DATE,
  report_time TIMESTAMPTZ,
  latitude NUMERIC(6,2) NOT NULL CHECK (latitude BETWEEN 8 AND 43),
  longitude NUMERIC(6,2) NOT NULL CHECK (longitude BETWEEN 20 AND 65),
  event_category TEXT NOT NULL,
  event_code TEXT NOT NULL,
  quad INTEGER NOT NULL CHECK (quad IN (3,4)),
  country TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_count INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
  article_count INTEGER NOT NULL DEFAULT 0 CHECK (article_count >= 0),
  PRIMARY KEY(window_name,event_id)
);
CREATE INDEX IF NOT EXISTS world_gdelt_report_window_idx
  ON public.world_gdelt_published_reports(window_name);
CREATE INDEX IF NOT EXISTS world_gdelt_report_country_idx
  ON public.world_gdelt_published_reports(country,window_name);

CREATE TABLE IF NOT EXISTS public.world_gdelt_ingest_tickets (
  ticket UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS world_gdelt_ticket_expiry_idx
  ON public.world_gdelt_ingest_tickets(expires_at);

ALTER TABLE public.world_gdelt_export_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_gdelt_published_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_gdelt_ingest_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.world_gdelt_export_windows, public.world_gdelt_published_reports, public.world_gdelt_ingest_tickets
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_gdelt_export_windows, public.world_gdelt_published_reports,
  public.world_gdelt_ingest_tickets TO service_role;

CREATE OR REPLACE FUNCTION public.world_gdelt_redeem_ingest_ticket(p_ticket UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ticket UUID;
BEGIN
  UPDATE public.world_gdelt_ingest_tickets
    SET consumed_at=now()
    WHERE ticket=p_ticket AND consumed_at IS NULL AND expires_at>now()
    RETURNING ticket INTO v_ticket;
  RETURN v_ticket IS NOT NULL;
END;$$;
REVOKE ALL ON FUNCTION public.world_gdelt_redeem_ingest_ticket(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.world_gdelt_redeem_ingest_ticket(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.world_gdelt_commit_export(
  p_window TEXT,p_scanned INTEGER,p_rows JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_pub TIMESTAMPTZ;
  v_inserted INTEGER;
  v_count INTEGER;
BEGIN
  IF p_window IS NULL OR p_window !~ '^20[0-9]{12}\.export\.CSV\.zip$' THEN
    RAISE EXCEPTION 'Invalid GDELT archive filename';
  END IF;
  v_pub := make_timestamptz(
    substring(p_window,1,4)::integer,substring(p_window,5,2)::integer,
    substring(p_window,7,2)::integer,substring(p_window,9,2)::integer,
    substring(p_window,11,2)::integer,substring(p_window,13,2)::double precision,'UTC'
  );
  IF v_pub > now() + interval '10 minutes' OR v_pub < now() - interval '8 days' THEN
    RAISE EXCEPTION 'Archive outside bounded collection window';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array'
     OR jsonb_array_length(p_rows)>2500 OR p_scanned NOT BETWEEN 0 AND 250000 THEN
    RAISE EXCEPTION 'Invalid or oversized archive sample';
  END IF;
  INSERT INTO public.world_gdelt_export_windows(window_name,published_at,scanned_rows,mena_rows)
    VALUES (p_window,v_pub,p_scanned,jsonb_array_length(p_rows))
    ON CONFLICT(window_name) DO UPDATE SET last_checked_at=now(),
       scanned_rows=GREATEST(public.world_gdelt_export_windows.scanned_rows,excluded.scanned_rows),
       mena_rows=GREATEST(public.world_gdelt_export_windows.mena_rows,excluded.mena_rows);
  INSERT INTO public.world_gdelt_published_reports
    (window_name,event_id,event_date,report_time,latitude,longitude,event_category,event_code,
     quad,country,place,source_url,source_count,article_count)
  SELECT
    p_window,r.event_id,r.event_date,r.report_time,
    round(r.latitude*4)/4,round(r.longitude*4)/4,
    left(r.event_category,36),left(r.event_code,12),
    r.quad,left(coalesce(r.country,''),6),left(coalesce(r.place,''),180),
    left(coalesce(r.source_url,''),700),
    least(greatest(coalesce(r.source_count,0),0),100000),
    least(greatest(coalesce(r.article_count,0),0),100000)
  FROM jsonb_to_recordset(p_rows) AS r(
    event_id BIGINT,event_date DATE,report_time TIMESTAMPTZ,
    latitude NUMERIC,longitude NUMERIC,
    event_category TEXT,event_code TEXT,quad INTEGER,
    country TEXT,place TEXT,source_url TEXT,
    source_count INTEGER,article_count INTEGER
  )
  WHERE r.event_id>0 AND r.latitude BETWEEN 8 AND 43
    AND r.longitude BETWEEN 20 AND 65
    AND r.quad IN(3,4) AND length(coalesce(r.event_category,''))>0
  ON CONFLICT(window_name,event_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted=ROW_COUNT;
  SELECT count(*) INTO v_count FROM public.world_gdelt_published_reports WHERE window_name=p_window;
  RETURN jsonb_build_object('window',p_window,'newReports',v_inserted,'totalReports',v_count);
END;$$;
REVOKE ALL ON FUNCTION public.world_gdelt_commit_export(TEXT,INTEGER,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.world_gdelt_commit_export(TEXT,INTEGER,JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.world_gdelt_schedule_ingest()
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ticket UUID; v_request BIGINT;
BEGIN
  -- A secret-free, one-shot ticket is generated by the DATABASE, not the HTTP caller.
  IF NOT pg_try_advisory_xact_lock(712603005) THEN RETURN NULL; END IF;
  DELETE FROM public.world_gdelt_ingest_tickets WHERE issued_at < now() - interval '2 hours';
  IF EXISTS(SELECT 1 FROM public.world_gdelt_ingest_tickets WHERE issued_at>now()-interval '90 seconds')
    THEN RETURN NULL; END IF;
  INSERT INTO public.world_gdelt_ingest_tickets(expires_at)
  VALUES (now()+interval '2 minutes') RETURNING ticket INTO v_ticket;
  SELECT net.http_post(
    url := 'https://heibzaolhwlzqaweludm.supabase.co/functions/v1/world-gdelt-archive',
    body := jsonb_build_object('ticket',v_ticket::text),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 15000
  ) INTO v_request;
  RETURN v_request;
END;$$;
REVOKE ALL ON FUNCTION public.world_gdelt_schedule_ingest() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.world_gdelt_prune()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  DELETE FROM public.world_gdelt_export_windows WHERE published_at < now()-interval '8 days';
  DELETE FROM public.world_gdelt_ingest_tickets WHERE issued_at < now()-interval '2 hours';
END;$$;
REVOKE ALL ON FUNCTION public.world_gdelt_prune() FROM PUBLIC, anon, authenticated;

-- The independent public-source job never writes to APP's private tables.
SELECT cron.schedule('world-gdelt-public-15min','5,20,35,50 * * * *',
  $schedule$SELECT public.world_gdelt_schedule_ingest();$schedule$);
SELECT cron.schedule('world-gdelt-public-prune','20 1 * * *',
  $schedule$SELECT public.world_gdelt_prune();$schedule$);
