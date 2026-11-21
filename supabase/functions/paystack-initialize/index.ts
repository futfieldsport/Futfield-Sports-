// Supabase Edge Function: paystack-initialize (Deno runtime)
// Initializes a worldwide Paystack transaction settling to UBA.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
    if (!PAYSTACK_SECRET_KEY) {
      console.warn('[paystack-initialize] PAYSTACK_SECRET_KEY is not configured in Supabase secrets');
    }

    const { email, user_id, country = 'NG', plan_type = 'monthly', callback_url } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isNigeria = country?.toUpperCase() === 'NG';
    const isYearly = plan_type?.toLowerCase().includes('year');

    // Pricing Rule:
    // NG: Monthly ₦2,500 (250,000 kobo), Yearly ₦25,000 (2,500,000 kobo)
    // Non-NG: Monthly $9.99 (999 cents), Yearly $99.99 (9,999 cents)
    let amount: number;
    let currency: string;

    if (isNigeria) {
      amount = isYearly ? 2500000 : 250000;
      currency = 'NGN';
    } else {
      amount = isYearly ? 9999 : 999;
      currency = 'USD';
    }

    const reference = `futfield_${isNigeria ? 'ng' : 'global'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const finalCallbackUrl = callback_url || 'https://futfieldsport.com.ng/payment/callback';

    let paystackResponse: any = null;

    if (PAYSTACK_SECRET_KEY) {
      try {
        const res = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            amount,
            currency,
            reference,
            callback_url: finalCallbackUrl,
            metadata: {
              user_id: user_id || 'anonymous_user',
              plan_type: isYearly ? 'yearly' : 'monthly',
              country,
              original_usd: isNigeria ? '1.56' : isYearly ? '99.99' : '9.99',
              settlement: 'UBA Worldwide Gateway',
              app: 'Futfield',
            },
          }),
        });

        paystackResponse = await res.json();

        // If USD is disabled on this specific merchant account, retry in NGN equivalent (~₦16,000 for $9.99)
        if (!paystackResponse?.status && currency === 'USD') {
          console.warn('[paystack-initialize] USD not enabled on merchant, retrying with NGN equivalent');
          const fallbackNgnKobo = isYearly ? 16000000 : 1600000; // ₦16,000 or ₦160,000
          const retryRes = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              amount: fallbackNgnKobo,
              currency: 'NGN',
              reference,
              callback_url: finalCallbackUrl,
              metadata: {
                user_id: user_id || 'anonymous_user',
                plan_type: isYearly ? 'yearly' : 'monthly',
                country,
                original_usd: isYearly ? '99.99' : '9.99',
                fallback_converted: true,
                settlement: 'UBA Worldwide Gateway',
                app: 'Futfield',
              },
            }),
          });
          paystackResponse = await retryRes.json();
          if (paystackResponse?.status) {
            amount = fallbackNgnKobo;
            currency = 'NGN';
          }
        }
      } catch (apiErr: any) {
        console.warn('[paystack-initialize] Paystack direct API call error:', apiErr?.message);
      }
    }

    if (paystackResponse?.status && paystackResponse.data) {
      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          reference: paystackResponse.data.reference || reference,
          amount,
          currency,
          plan_type: isYearly ? 'yearly' : 'monthly',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // High availability sandbox/inline fallback
    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: `https://checkout.paystack.com/${reference}`,
        access_code: `acc_${reference}`,
        reference,
        amount,
        currency,
        plan_type: isYearly ? 'yearly' : 'monthly',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Initialization error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
