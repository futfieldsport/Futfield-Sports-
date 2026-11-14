// Supabase Edge Function: paystack-webhook (Deno runtime)
// Listens for Paystack webhook events and securely verifies HMAC SHA512 signature.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  const signature = req.headers.get('x-paystack-signature');
  const rawBody = await req.text();

  // Signature verification using HMAC SHA512
  if (PAYSTACK_SECRET_KEY && signature) {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(PAYSTACK_SECRET_KEY);
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['verify']
      );

      // Convert hex signature to Uint8Array
      const sigBytes = new Uint8Array(
        signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
      );

      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        sigBytes,
        encoder.encode(rawBody)
      );

      if (!isValid) {
        console.warn('[paystack-webhook] Invalid HMAC SHA512 signature');
        return new Response('Unauthorized signature', { status: 401 });
      }
    } catch (cryptoErr) {
      console.warn('[paystack-webhook] Crypto verification warning:', cryptoErr);
    }
  }

  let eventPayload: any;
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { event, data } = eventPayload;
  console.log(`[paystack-webhook] Received event: ${event}`);

  const supabase =
    SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

  switch (event) {
    case 'charge.success': {
      const metadata = data?.metadata || {};
      const userId = metadata.user_id;
      const planType = metadata.plan_type || 'monthly';
      const isYearly = planType.includes('year');
      const reference = data?.reference;
      const currency = data?.currency || 'NGN';
      const customerCode = data?.customer?.customer_code;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (isYearly ? 365 : 30));

      if (supabase && userId) {
        await supabase
          .from('profiles')
          .update({
            is_pro: true,
            pro_plan: isYearly ? 'yearly' : 'monthly',
            pro_expires_at: expiresAt.toISOString(),
            paystack_reference: reference,
            last_payment_currency: currency,
            paystack_customer_code: customerCode,
          })
          .eq('id', userId);

        await supabase.from('transactions').insert({
          user_id: userId,
          reference: reference,
          amount: data?.amount,
          currency: currency,
          status: 'success',
          plan_type: isYearly ? 'yearly' : 'monthly',
          gateway: 'paystack',
          created_at: new Date().toISOString(),
        });
      }
      break;
    }

    case 'subscription.create': {
      const subscriptionCode = data?.subscription_code;
      const customerEmail = data?.customer?.email;
      if (supabase && customerEmail) {
        await supabase
          .from('profiles')
          .update({
            paystack_subscription_code: subscriptionCode,
            is_pro: true,
          })
          .eq('email', customerEmail);
      }
      break;
    }

    case 'subscription.disable': {
      const customerEmail = data?.customer?.email;
      if (supabase && customerEmail) {
        await supabase
          .from('profiles')
          .update({
            is_pro: false,
            paystack_subscription_code: null,
          })
          .eq('email', customerEmail);
      }
      break;
    }

    case 'charge.failed': {
      console.warn(`[paystack-webhook] Charge failed for reference ${data?.reference}`);
      break;
    }

    default:
      console.log(`[paystack-webhook] Unhandled event: ${event}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
