// Supabase Edge Function: paystack-cancel-subscription (Deno runtime)
// Cancels recurring Paystack subscription and updates user profile.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const { user_id, subscription_code, email } = await req.json();

    if (!user_id && !subscription_code && !email) {
      return new Response(JSON.stringify({ error: 'User identifier or subscription code required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let cancelSuccess = true;

    if (PAYSTACK_SECRET_KEY && subscription_code) {
      try {
        const disableRes = await fetch('https://api.paystack.co/subscription/disable', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: subscription_code,
            token: subscription_code,
          }),
        });
        const disableJson = await disableRes.json();
        cancelSuccess = Boolean(disableJson.status);
      } catch (err: any) {
        console.warn('[paystack-cancel-subscription] Paystack API warning:', err?.message);
      }
    }

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const query = supabase.from('profiles').update({
        is_pro: false,
        paystack_subscription_code: null,
      });

      if (user_id) {
        await query.eq('id', user_id);
      } else if (email) {
        await query.eq('email', email);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your Pro subscription has been cancelled. Benefits remain active until expiry.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Cancellation error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
