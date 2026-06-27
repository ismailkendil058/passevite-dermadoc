-- ----------------------------------------------------
-- PasseVite Dermadoc - Consolidated Schema SQL
-- Recreates the entire Supabase database schema
-- ----------------------------------------------------

-- Enable UUID extension (standard for Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------
-- 1. ENUMS & CUSTOM TYPES
-- ----------------------------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('receptionist', 'manager');
    END IF;
END $$;

-- ----------------------------------------------------
-- 2. TABLES
-- ----------------------------------------------------

-- User Roles Table (used by standard RLS rules)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Profiles Table (used to show receptionist/manager profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Doctors Table
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  initial CHAR(1) NOT NULL UNIQUE,
  password TEXT, -- Password for medecin login flow
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Sessions Table (Daily sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by UUID REFERENCES auth.users(id) NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_phone TEXT NOT NULL,
    client_name TEXT NOT NULL,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
    appointment_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'coming', 'denied', 'no_answer', 'attended')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Queue Entries Table
CREATE TABLE IF NOT EXISTS public.queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('U', 'N', 'R')),
  doctor_id UUID REFERENCES public.doctors(id) NOT NULL,
  state_number INTEGER NOT NULL,
  client_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_cabinet', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  patient_name TEXT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL
);

-- Completed Clients Table
CREATE TABLE IF NOT EXISTS public.completed_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_entry_id UUID REFERENCES public.queue_entries(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.sessions(id) NOT NULL,
  client_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) NOT NULL,
  client_id TEXT NOT NULL,
  state TEXT NOT NULL,
  treatment TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  tranche_paid NUMERIC NOT NULL DEFAULT 0,
  receptionist_id UUID REFERENCES auth.users(id) NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  notes TEXT,
  numero_dent VARCHAR(255)
);

-- Custom Roles Table (for manual authentication bypass)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Plain text password as used in the custom auth flow
    role TEXT NOT NULL CHECK (role IN ('manager', 'receptionist')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedbacks Table
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  client_id TEXT,
  session_id TEXT
);

-- Satisfied Stats Table
CREATE TABLE IF NOT EXISTS public.satisfied_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  UNIQUE(date)
);

-- Medications Table
CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Prescriptions Table
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
  patient_name TEXT NOT NULL,
  age INTEGER,
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  medications JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('check', 'caisse', 'ccp', 'manager payment')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  expiration_date DATE,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Website Bookings Table (used by the customer-facing booking page)
CREATE TABLE IF NOT EXISTS public.website (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  appointment_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------
-- 3. VIEWS
-- ----------------------------------------------------
CREATE OR REPLACE VIEW public.feedback_stats AS
SELECT 
  (SELECT COALESCE(SUM(count), 0) FROM public.satisfied_stats) AS satisfied_count,
  (SELECT COUNT(*) FROM public.feedbacks) AS feedback_count;

-- ----------------------------------------------------
-- 4. FUNCTIONS & TRIGGERS
-- ----------------------------------------------------

-- Security Definer Has Role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to increment satisfied count
CREATE OR REPLACE FUNCTION public.increment_satisfied_count()
RETURNS void AS $$
BEGIN
  INSERT INTO public.satisfied_stats (date, count)
  VALUES (current_date, 1)
  ON CONFLICT (date) 
  DO UPDATE SET count = satisfied_stats.count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------
-- 5. INDEXES
-- ----------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_phone_active_idx ON public.queue_entries (phone) 
  WHERE (status IN ('waiting', 'in_cabinet'));

CREATE INDEX IF NOT EXISTS idx_appointments_phone ON public.appointments(client_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_at);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON public.prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON public.prescriptions(prescription_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON public.invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON public.invoice_items(product_id);

-- ----------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completed_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satisfied_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website ENABLE ROW LEVEL SECURITY;

-- Define Policies

-- User Roles: users can read own roles
CREATE POLICY "Authenticated can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Profiles: users can read and update own profile
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Doctors: Anyone can read
CREATE POLICY "Anyone can read doctors" ON public.doctors FOR SELECT USING (true);

-- Sessions: Anyone authenticated can read/write, or receptionist/manager can edit
CREATE POLICY "Authenticated can read sessions" ON public.sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Receptionist can insert sessions" ON public.sessions FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Receptionist can update sessions" ON public.sessions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));

-- Appointments: Authenticated manage appointments
CREATE POLICY "Allows authenticated users to manage appointments" ON public.appointments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Queue Entries: Public read, authenticated manage
CREATE POLICY "Anyone can read queue" ON public.queue_entries FOR SELECT USING (true);
CREATE POLICY "Receptionist can insert queue" ON public.queue_entries FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Receptionist can update queue" ON public.queue_entries FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Receptionist can delete queue" ON public.queue_entries FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));

-- Completed Clients: Authenticated read, receptionist insert
CREATE POLICY "Authenticated can read completed" ON public.completed_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Receptionist can insert completed" ON public.completed_clients FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'manager'));

-- Custom Roles Table: Public read for login bypass
CREATE POLICY "Public read for login" ON public.roles FOR SELECT USING (true);

-- Feedbacks: Public insert, public read
CREATE POLICY "Public read feedbacks" ON public.feedbacks FOR SELECT USING (true);
CREATE POLICY "Public insert feedbacks" ON public.feedbacks FOR INSERT WITH CHECK (true);

-- Satisfied Stats: Public read, insert, update
CREATE POLICY "Public read stats" ON public.satisfied_stats FOR SELECT USING (true);
CREATE POLICY "Public insert satisfied_stats" ON public.satisfied_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update satisfied_stats" ON public.satisfied_stats FOR UPDATE USING (true) WITH CHECK (true);

-- Medications: Public read
CREATE POLICY "Public read medications" ON public.medications FOR ALL USING (true);

-- Prescriptions: Authenticated manage
CREATE POLICY "Authenticated insert prescriptions" ON public.prescriptions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read prescriptions" ON public.prescriptions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update prescriptions" ON public.prescriptions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated delete prescriptions" ON public.prescriptions FOR DELETE USING (auth.role() = 'authenticated');

-- Expenses: Authenticated manage (checks has_role for manager)
CREATE POLICY "Managers can do everything with expenses" ON public.expenses FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));

-- Invoices & Suppliers & Products & Invoice Items (checks has_role for manager)
CREATE POLICY "Managers can handle suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can handle products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can handle invoices" ON public.invoices FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can handle invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));

-- Website Bookings: Public read/insert/update/delete (allows website user reservations)
CREATE POLICY "Public read website bookings" ON public.website FOR SELECT USING (true);
CREATE POLICY "Public insert website bookings" ON public.website FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update website bookings" ON public.website FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete website bookings" ON public.website FOR DELETE USING (true);

-- ----------------------------------------------------
-- 7. SEED DATA
-- ----------------------------------------------------

-- Seed Doctors (with default password)
INSERT INTO public.doctors (name, initial, password) VALUES
  ('Djihane', 'D', 'djihane123'),
  ('Zineb', 'Z', 'zineb123'),
  ('Imane', 'I', 'imane123'),
  ('Mohamed', 'M', 'mohamed123')
ON CONFLICT (initial) DO NOTHING;

-- Seed Medications
INSERT INTO public.medications (name) VALUES 
  ('Paracétamol'),
  ('Ibuprofène'), 
  ('Amoxicilline')
ON CONFLICT (name) DO NOTHING;

-- Seed Custom Authentication Roles
-- Password: admin123 and accueil123
INSERT INTO public.roles (username, password, role) VALUES 
    ('admin', 'admin123', 'manager'),
    ('accueil', 'accueil123', 'receptionist')
ON CONFLICT (username) DO NOTHING;

-- ----------------------------------------------------
-- 8. REALTIME ENABLEMENT
-- ----------------------------------------------------
-- Enable realtime for key tables
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE queue_entries;
EXCEPTION WHEN OTHERS THEN
  -- Table might already be in publication or publication doesn't exist
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
EXCEPTION WHEN OTHERS THEN
  -- Table might already be in publication or publication doesn't exist
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE website;
EXCEPTION WHEN OTHERS THEN
  -- Table might already be in publication or publication doesn't exist
END $$;
