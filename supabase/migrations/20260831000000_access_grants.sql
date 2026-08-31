-- Access grant audit log. Written after a verified Razorpay payment
-- (checkout or payment-link webhook) records or confirms a purchase.
-- Not used for access checks itself (see public.purchases for that) —
-- this is a secondary audit trail of how each grant was issued.
CREATE TABLE public.access_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razorpay_payment_id TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.access_grants TO service_role;

ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX access_grants_payment_id_idx ON public.access_grants (razorpay_payment_id);
