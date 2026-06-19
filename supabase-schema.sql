-- ============================================================
-- SCHEMA SUPABASE — Prenotazioni Sale Riunioni
-- Esegui questo script nel SQL Editor di Supabase
-- ============================================================

-- 1. Tabella profili (estende auth.users)
CREATE TABLE public.profiles (
  id        UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name      TEXT,
  role      TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabella sale
CREATE TABLE public.rooms (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  color       TEXT NOT NULL DEFAULT '#1447e6',
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabella prenotazioni
CREATE TABLE public.bookings (
  id         SERIAL PRIMARY KEY,
  room_id    INTEGER NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  date       DATE    NOT NULL,
  start_time TIME    NOT NULL,
  end_time   TIME    NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Vista per join booking + room + profilo utente
CREATE VIEW public.booking_details AS
SELECT
  b.id,
  b.room_id,
  b.user_id,
  b.title,
  b.date::TEXT         AS date,
  b.start_time::TEXT   AS start_time,
  b.end_time::TEXT     AS end_time,
  b.notes,
  b.created_at,
  r.name   AS room_name,
  r.color  AS room_color,
  p.name   AS user_name
FROM   public.bookings b
LEFT JOIN public.rooms    r ON b.room_id = r.id
LEFT JOIN public.profiles p ON b.user_id = p.id;

-- 5. Trigger: crea profilo automaticamente al signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Sale di default
INSERT INTO public.rooms (name, capacity, color, description) VALUES
  ('Sala Alpha', 10, '#1447e6', 'Sala principale con proiettore'),
  ('Sala Beta',   6, '#059669', 'Sala piccola per riunioni veloci'),
  ('Sala Gamma', 20, '#7c3aed', 'Sala conferenze grande');

-- 7. Row Level Security (le API usano service_role che bypassa RLS,
--    ma è buona pratica abilitarla come secondo livello)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profilo personale" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Sale visibili a tutti" ON public.rooms
  FOR SELECT USING (true);

CREATE POLICY "Prenotazioni visibili agli autenticati" ON public.bookings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Crea prenotazione" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Elimina propria prenotazione" ON public.bookings
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- DOPO LA REGISTRAZIONE: imposta il primo admin manualmente
-- Sostituisci con l'email reale dell'admin
-- ============================================================
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'tua@email.com');
