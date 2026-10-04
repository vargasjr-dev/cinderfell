import Stripe from "stripe";

// Two lazy-initialized singletons — one for live, one for test.
// Lazy so the build succeeds even when keys aren't in the environment yet.
let _stripe: Stripe | null = null;
let _stripeTest: Stripe | null = null;

export function getStripe(useTestMode = false): Stripe {
  if (useTestMode) {
    if (!_stripeTest) {
      const key = process.env.STRIPE_TEST_SECRET_KEY;
      if (!key) {
        throw new Error("STRIPE_TEST_SECRET_KEY environment variable is required");
      }
      _stripeTest = new Stripe(key, {
        apiVersion: "2026-04-22.dahlia",
        typescript: true,
      });
    }
    return _stripeTest;
  }

  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    _stripe = new Stripe(key, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

// ─── Product / Price Lookup ──────────────────────────────────────────────────
// Instead of storing IDs as env vars, we query Stripe by hardcoded labels.
// This works across test/live modes without config changes.

const PREMIUM_PRODUCT_NAME = "Cinderfell Premium";
const PREMIUM_PRICE_LOOKUP_KEY = "vellymon_premium_monthly";

let cachedPriceId: string | null = null;
let cachedTestPriceId: string | null = null;

/**
 * Resolve the Cinderfell Premium monthly price ID from a given Stripe client.
 * Uses lookup_key first (preferred), falls back to searching by product name.
 */
async function lookupPremiumPriceId(stripe: Stripe): Promise<string> {
  // Try lookup_key first — fastest and most deterministic
  const byKey = await stripe.prices.list({
    lookup_keys: [PREMIUM_PRICE_LOOKUP_KEY],
    active: true,
    limit: 1,
  });

  if (byKey.data.length > 0) {
    return byKey.data[0].id;
  }

  // Fallback: find product by name, then get its active recurring price
  const products = await stripe.products.list({ active: true, limit: 100 });
  const product = products.data.find((p) => p.name === PREMIUM_PRODUCT_NAME);

  if (!product) {
    throw new Error(
      `Stripe product "${PREMIUM_PRODUCT_NAME}" not found. Create it in the Stripe dashboard.`
    );
  }

  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: "recurring",
    limit: 1,
  });

  if (prices.data.length === 0) {
    throw new Error(
      `No active recurring price found for product "${PREMIUM_PRODUCT_NAME}".`
    );
  }

  return prices.data[0].id;
}

/**
 * Look up the Cinderfell Premium monthly price ID from Stripe.
 * Admins use the test Stripe account; regular users use live.
 * Result is cached per mode for the lifetime of the server process.
 */
export async function getPremiumPriceId(useTestMode = false): Promise<string> {
  if (useTestMode) {
    if (!cachedTestPriceId) {
      cachedTestPriceId = await lookupPremiumPriceId(getStripe(true));
    }
    return cachedTestPriceId;
  }

  if (!cachedPriceId) {
    cachedPriceId = await lookupPremiumPriceId(getStripe(false));
  }
  return cachedPriceId;
}
