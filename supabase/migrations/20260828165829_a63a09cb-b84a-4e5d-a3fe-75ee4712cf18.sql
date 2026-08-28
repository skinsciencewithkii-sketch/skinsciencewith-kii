CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  payment_link_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  email TEXT,
  contact TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.purchases TO service_role;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE INDEX purchases_email_idx ON public.purchases (lower(email));
CREATE INDEX purchases_contact_idx ON public.purchases (contact);