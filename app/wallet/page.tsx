"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Wallet = {
  id: string;
  creator_id: string;
  available_balance_usd: number;
  pending_balance_usd: number;
  lifetime_earnings_usd: number;
};

type Tip = {
  id: string;
  amount_usd: number;
  platform_fee_usd: number;
  creator_amount_usd: number;
  message: string | null;
  status: string;
  provider: string;
  created_at: string;
  streams?: { title?: string | null } | null;
};

type PayoutRequest = {
  id: string;
  amount_usd: number;
  status: string;
  payout_note: string | null;
  admin_note: string | null;
  created_at: string;
};

type PrivateCallPayment = {
  id: string;
  amount_usd: number;
  created_at: string;
  streams?: { title?: string | null } | null;
  profiles?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [privateCallPayments, setPrivateCallPayments] = useState<PrivateCallPayment[]>([]);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Upsert wallet
    await supabase.from("creator_wallets").upsert({ creator_id: user.id });

    const { data: walletData } = await supabase
      .from("creator_wallets")
      .select("*")
      .eq("creator_id", user.id)
      .maybeSingle();

    setWallet(walletData);

    // Load tips, payouts, private calls...

    const { data: tipData } = await supabase
      .from("stream_tips")
      .select("*")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);

    setTips(tipData || []);

    // Similar for payouts and private calls...
  }

  async function requestPayout() {
    // Your existing payout logic...
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="uppercase tracking-widest text-red-400 text-sm font-bold">CREATOR WALLET</p>
          <h1 className="text-5xl font-black tracking-tighter mt-2">Earnings</h1>
        </div>

        {/* Your premium stats and sections here */}
        <p className="text-gray-400">Wallet UI coming soon...</p>
      </div>
    </main>
  );
}