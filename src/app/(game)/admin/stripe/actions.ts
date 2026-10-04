"use server";

import { headers } from "next/headers";
import { auth } from "~/lib/auth.server";
import { requireAdmin } from "~/lib/admin";
import { getStripe, getPremiumPriceId } from "../../../../../lib/stripe";
import type Stripe from "stripe";

// ─── Constants ───────────────────────────────────────────────────────────────

const PREMIUM_PRODUCT_NAME = "Cinderling Premium";
const PREMIUM_PRODUCT_DESCRIPTION =
  "Monthly subscription — AI cosmetic builder, season pass, and ranked play.";
const PREMIUM_PRICE_AMOUNT = 800; // $8.00 in cents
const PREMIUM_PRICE_CURRENCY = "usd";
const PREMIUM_PRICE_LOOKUP_KEY = "vellymon_premium_monthly";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StripeConfigStatus = {
  connected: boolean;
  product: {
    exists: boolean;
    id?: string;
    name?: string;
    active?: boolean;
  };
  price: {
    exists: boolean;
    id?: string;
    amount?: number;
    currency?: string;
    interval?: string;
    lookupKey?: string;
    active?: boolean;
  };
  error?: string;
};

// ─── Verify Config ───────────────────────────────────────────────────────────

export async function verifyStripeConfig(useTestMode = false): Promise<StripeConfigStatus> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  requireAdmin(session);

  const result: StripeConfigStatus = {
    connected: false,
    product: { exists: false },
    price: { exists: false },
  };

  try {
    const stripe = getStripe(useTestMode);

    // Verify connection by listing products (will throw if key is invalid)
    const products = await stripe.products.list({ active: true, limit: 100 });
    result.connected = true;

    // Check for Cinderling Premium product
    const product = products.data.find(
      (p: Stripe.Product) => p.name === PREMIUM_PRODUCT_NAME
    );

    if (product) {
      result.product = {
        exists: true,
        id: product.id,
        name: product.name,
        active: product.active,
      };

      // Check for the monthly price on this product
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        type: "recurring",
        limit: 10,
      });

      const monthlyPrice = prices.data.find(
        (p: Stripe.Price) =>
          p.recurring?.interval === "month" &&
          p.unit_amount === PREMIUM_PRICE_AMOUNT &&
          p.currency === PREMIUM_PRICE_CURRENCY
      );

      if (monthlyPrice) {
        result.price = {
          exists: true,
          id: monthlyPrice.id,
          amount: monthlyPrice.unit_amount ?? undefined,
          currency: monthlyPrice.currency,
          interval: monthlyPrice.recurring?.interval,
          lookupKey: monthlyPrice.lookup_key ?? undefined,
          active: monthlyPrice.active,
        };
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error";
  }

  return result;
}

// ─── Bootstrap Products ──────────────────────────────────────────────────────

export async function bootstrapStripeProducts(useTestMode = false): Promise<{
  success: boolean;
  message: string;
  priceId?: string;
}> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  requireAdmin(session);

  try {
    const stripe = getStripe(useTestMode);

    // Find or create product
    const products = await stripe.products.list({ active: true, limit: 100 });
    let product = products.data.find(
      (p: Stripe.Product) => p.name === PREMIUM_PRODUCT_NAME
    );

    if (!product) {
      product = await stripe.products.create({
        name: PREMIUM_PRODUCT_NAME,
        description: PREMIUM_PRODUCT_DESCRIPTION,
      });
    }

    // Find or create price
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      type: "recurring",
      limit: 10,
    });

    let price = prices.data.find(
      (p: Stripe.Price) =>
        p.recurring?.interval === "month" &&
        p.unit_amount === PREMIUM_PRICE_AMOUNT &&
        p.currency === PREMIUM_PRICE_CURRENCY
    );

    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: PREMIUM_PRICE_AMOUNT,
        currency: PREMIUM_PRICE_CURRENCY,
        recurring: { interval: "month" },
        lookup_key: PREMIUM_PRICE_LOOKUP_KEY,
      });
    }

    // Verify the lookup works end-to-end
    const resolvedId = await getPremiumPriceId(useTestMode);

    return {
      success: true,
      message: `Product "${product.name}" (${product.id}) with price $${PREMIUM_PRICE_AMOUNT / 100}/mo (${price.id}) ready. Lookup resolves to: ${resolvedId}`,
      priceId: resolvedId,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
