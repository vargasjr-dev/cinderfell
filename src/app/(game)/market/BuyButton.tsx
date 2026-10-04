"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { purchaseCinderling } from "./actions";
import { useToast } from "~/components/Toast";

interface BuyButtonProps {
  modelUuid: string;
  cinderlingName: string;
}

export default function BuyButton({ modelUuid, cinderlingName }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const router = useRouter();

  const handleBuy = async () => {
    setLoading(true);
    try {
      const res = await purchaseCinderling(modelUuid);
      if (res.success) {
        addToast(`${cinderlingName} added to your roster!`, "success");
        router.refresh();
      } else {
        addToast(res.message, "error");
      }
    } catch {
      addToast("Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleBuy}
      disabled={loading}
      className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Buying…" : "Buy Now"}
    </button>
  );
}
