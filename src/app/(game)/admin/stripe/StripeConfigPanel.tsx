"use client";

import { useState } from "react";
import {
  verifyStripeConfig,
  bootstrapStripeProducts,
  type StripeConfigStatus,
} from "./actions";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium ${
        ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {ok ? "✅" : "❌"} {label}
    </span>
  );
}

function StripeEnvPanel({
  label,
  useTestMode,
}: {
  label: string;
  useTestMode: boolean;
}) {
  const [config, setConfig] = useState<StripeConfigStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleVerify() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await verifyStripeConfig(useTestMode);
      setConfig(result);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap() {
    setBootstrapping(true);
    setMessage(null);
    try {
      const result = await bootstrapStripeProducts(useTestMode);
      setMessage(result.message);
      if (result.success) {
        const updated = await verifyStripeConfig(useTestMode);
        setConfig(updated);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Bootstrap failed");
    } finally {
      setBootstrapping(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1">{label}</h2>
      <p className="text-gray-500 text-sm mb-4">
        {useTestMode ? "Uses STRIPE_TEST_SECRET_KEY" : "Uses STRIPE_SECRET_KEY"}
      </p>

      <div className="flex gap-3 mb-4">
        <button
          onClick={handleVerify}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? "Checking..." : "Verify"}
        </button>

        <button
          onClick={handleBootstrap}
          disabled={bootstrapping}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
        >
          {bootstrapping ? "Creating..." : "Bootstrap"}
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md text-sm text-gray-700 break-all">
          {message}
        </div>
      )}

      {config && (
        <div className="space-y-3">
          <StatusBadge ok={config.connected} label="Connected" />

          {config.error && (
            <div className="p-3 bg-red-50 rounded-md text-sm text-red-700">
              {config.error}
            </div>
          )}

          {config.connected && (
            <>
              <div className="border-t pt-3">
                <h3 className="font-semibold text-gray-800 mb-1">Product</h3>
                <StatusBadge
                  ok={config.product.exists}
                  label={
                    config.product.exists
                      ? `${config.product.name} (${config.product.id})`
                      : "Cinderling Premium — not found"
                  }
                />
              </div>

              <div className="border-t pt-3">
                <h3 className="font-semibold text-gray-800 mb-1">Price</h3>
                <StatusBadge
                  ok={config.price.exists}
                  label={
                    config.price.exists
                      ? `$${(config.price.amount ?? 0) / 100}/${config.price.interval} (${config.price.id})`
                      : "$8/month recurring — not found"
                  }
                />
                {config.price.lookupKey && (
                  <p className="text-xs text-gray-500 mt-1">
                    Lookup key: {config.price.lookupKey}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function StripeConfigPanel() {
  return (
    <div className="space-y-6">
      <StripeEnvPanel label="Live" useTestMode={false} />
      <StripeEnvPanel label="Test" useTestMode={true} />
    </div>
  );
}
