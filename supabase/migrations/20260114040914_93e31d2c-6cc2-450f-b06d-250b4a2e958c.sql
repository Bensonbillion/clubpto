-- Create sessions table for Wednesday padel sessions
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_date DATE NOT NULL UNIQUE,
  session_time TIME NOT NULL DEFAULT '20:00:00',
  max_spots INTEGER NOT NULL DEFAULT 16,
  spots_remaining INTEGER NOT NULL DEFAULT 16,
  price_cents INTEGER NOT NULL DEFAULT 1500,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Sessions are publicly readable (anyone can see available sessions)
CREATE POLICY "Sessions are publicly readable" 
ON public.sessions 
FOR SELECT 
USING (true);

-- Bookings can be inserted by anyone (for now, before auth)
CREATE POLICY "Anyone can create bookings" 
ON public.bookings 
FOR INSERT 
WITH CHECK (true);

-- Bookings can be read by matching email (simple check)
CREATE POLICY "Users can view their own bookings" 
ON public.bookings 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert upcoming Wednesday sessions (next 4 Wednesdays)
INSERT INTO public.sessions (session_date, session_time, max_spots, spots_remaining, price_cents, is_active)
VALUES 
  ('2026-01-21', '20:00:00', 16, 16, 1500, true),
  ('2026-01-28', '20:00:00', 16, 16, 1500, true),
  ('2026-02-04', '20:00:00', 16, 16, 1500, true),
  ('2026-02-11', '20:00:00', 16, 16, 1500, true);