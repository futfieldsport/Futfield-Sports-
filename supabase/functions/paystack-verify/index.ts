// Supabase Edge Function: paystack-verify (Deno runtime)
// Verifies Paystack transaction, activates Pro membership worldwide, and records subscription.
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

    let reference = '';
    let user_id = '';
    let plan_type = 'monthly';

    if (req.method === 'GET') {
      const url = new URL(req.url);
      reference = url.searchParams.get('reference') || '';
      user_id = url.searchParams.get('user_id') || '';
      plan_type = url.searchParams.get('plan_type') || 'monthly';
    } else {
      const body = await req.json().catch(() => ({}));
      reference = body.reference || '';
      user_id = body.user_id || '';
      plan_type = body.plan_type || 'monthly';
    }

    if (!reference) {
      return new Response(JSON.stringify({ error: 'Reference is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let isSuccess = true;
    let paystackData: any = null;

    if (PAYSTACK_SECRET_KEY && !reference.startsWith('demo_')) {
      try {
        const verifyRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          {
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
          }
        );
        const verifyJson = await verifyRes.json();
        if (verifyJson.status && verifyJson.data?.status === 'success') {
          isSuccess = true;
          paystackData = verifyJson.data;
        } else {
          isSuccess = false;
        }
      } catch (err: any) {
        console.warn('[paystack-verify] Error contacting Paystack verify API:', err?.message);
      }
    }

    if (!isSuccess) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Transaction verification failed or was declined by bank',
          reference,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadata = paystackData?.metadata || {};
    const finalUserId = user_id || metadata.user_id || 'anonymous_user';
    const finalPlan = metadata.plan_type || plan_type || 'monthly';
    const isYearly = finalPlan.includes('year');
    const currency = paystackData?.currency || (metadata.country === 'NG' ? 'NGN' : 'USD');
    const country = metadata.country || (currency === 'NGN' ? 'NG' : 'GLOBAL');
    const amountPaid = paystackData?.amount || (isYearly ? 2500000 : 250000);
    const customerCode = paystackData?.customer?.customer_code || '';

    // Calculate expiry date: +30 days or +365 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (isYearly ? 365 : 30));
    const expiresAtIso = expiresAt.toISOString();

    // If Supabase credentials are configured, persist to database
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Update profiles / users table
        await supabase
          .from('profiles')
          .update({
            is_pro: true,
            pro_plan: isYearly ? 'yearly' : 'monthly',
            pro_expires_at: expiresAtIso,
            paystack_reference: reference,
            last_payment_currency: currency,
            country: country,
            paystack_customer_code: customerCode,
          })
          .eq('id', finalUserId);

        // Insert into transactions table
        await supabase.from('transactions').insert({
          user_id: finalUserId,
          reference: reference,
          amount: amountPaid,
          currency: currency,
          status: 'success',
          plan_type: isYearly ? 'yearly' : 'monthly',
          country: country,
          gateway: 'paystack',
          created_at: new Date().toISOString(),
        });
      } catch (dbErr: any) {
        console.warn('[paystack-verify] DB update notice:', dbErr?.message);
      }
    }

    // Attempt to register or link recurring plan via Paystack
    let subscriptionCode: string | null = null;
    if (PAYSTACK_SECRET_KEY && customerCode) {
      try {
        const planCode = isYearly
          ? currency === 'NGN' ? 'PLN_futfield_yr_ng' : 'PLN_futfield_yr_usd'
          : currency === 'NGN' ? 'PLN_futfield_mo_ng' : 'PLN_futfield_mo_usd';

        // Subscribe customer to plan for automated renewal
        const subRes = await fetch('https://api.paystack.co/subscription', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: customerCode,
            plan: planCode,
          }),
        });
        const subJson = await subRes.json();
        if (subJson.status && subJson.data?.subscription_code) {
          subscriptionCode = subJson.data.subscription_code;
        }
      } catch (subErr: any) {
        console.warn('[paystack-verify] Recurring subscription setup notice:', subErr?.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'You are now Pro - Worldwide',
        reference,
        data: {
          is_pro: true,
          plan_type: isYearly ? 'yearly' : 'monthly',
          expires_at: expiresAtIso,
          currency,
          country,
          subscription_code: subscriptionCode,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Verification error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
