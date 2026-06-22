"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_banned?: boolean | null;
  is_admin?: boolean | null;
};

type CallStream = {
  id: string;
  title: string;
  status: string;
  user_id: string;
  private_call_price?: number | null;
};

type CallRequest = {
  id: string;
  caller_id: string;
  receiver_id: string;
  stream_id: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  declined_at: string | null;
  expires_at?: string | null;
  ring_status?: string | null;
  caller?: Profile | null;
  receiver?: Profile | null;
  stream?: CallStream | null;
  is_paid?: boolean;
};

export default function CallsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRequest[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Profile[]>([]);
  const [callingId, setCallingId] = useState<string | null>(null);

  const [peopleSearchText, setPeopleSearchText] = useState("");
  const [peopleSearching, setPeopleSearching] = useState(false);
  const [peopleResults, setPeopleResults] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followUpdatingId, setFollowUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadCalls();

    const expiryTimer = setInterval(() => {
      expireStaleCalls();
    }, 60000);

    return () => clearInterval(expiryTimer);
  }, []);

  useEffect(() => {
    if (!userId) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);

      refreshTimer = setTimeout(() => {
        loadCalls();
      }, 700);
    };

    const channel = supabase
      .channel(`calls-page-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "private_call_requests",
        },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    void loadFollowingIds(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const timer = setTimeout(() => {
      searchUsers();
    }, 350);

    return () => clearTimeout(timer);
  }, [searchText, userId]);

  useEffect(() => {
    if (!userId) return;

    const timer = setTimeout(() => {
      searchPeople();
    }, 350);

    return () => clearTimeout(timer);
  }, [peopleSearchText, userId]);

  async function loadCalls() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (myProfile?.is_banned) {
      window.location.href = "/banned";
      return;
    }

    const { data, error } = await supabase
      .from("private_call_requests")
      .select("*")
      .or(`caller_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as CallRequest[];

    const profileIds = Array.from(
      new Set(rows.flatMap((item) => [item.caller_id, item.receiver_id]).filter(Boolean))
    );

    const streamIds = Array.from(
      new Set(rows.map((item) => item.stream_id).filter(Boolean))
    ) as string[];

    const [{ data: profiles }, { data: streams }, { data: payments }] =
      await Promise.all([
        profileIds.length
          ? supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", profileIds)
          : Promise.resolve({ data: [] }),
        streamIds.length
          ? supabase
              .from("streams")
              .select("id, title, status, user_id, private_call_price")
              .in("id", streamIds)
          : Promise.resolve({ data: [] }),
        streamIds.length
          ? supabase
              .from("private_call_payments")
              .select("id, stream_id, caller_id")
              .in("stream_id", streamIds)
          : Promise.resolve({ data: [] }),
      ]);

    const profileMap = new Map((profiles || []).map((item: any) => [item.id, item]));
    const streamMap = new Map((streams || []).map((item: any) => [item.id, item]));
    const paymentSet = new Set(
      (payments || []).map((item: any) => `${item.stream_id}:${item.caller_id}`)
    );

    const enriched = rows.map((item) => {
      const stream = item.stream_id ? streamMap.get(item.stream_id) || null : null;

      return {
        ...item,
        caller: profileMap.get(item.caller_id) || null,
        receiver: profileMap.get(item.receiver_id) || null,
        stream,
        is_paid:
          !!item.stream_id &&
          !!stream?.private_call_price &&
          stream.private_call_price > 0 &&
          paymentSet.has(`${item.stream_id}:${item.receiver_id}`),
      };
    });

    setCalls(enriched);
    setLoading(false);
  }

  async function expireStaleCalls() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    try {
      const response = await fetch("/api/private-call/expire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.warn("Private call expiry API failed:", data?.error || response.statusText);
        return;
      }

      await loadCalls();
    } catch (error) {
      console.warn("Private call expiry API skipped:", error);
    }
  }

  async function loadFollowingIds(currentUserId: string) {
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId);

    setFollowingIds((data || []).map((item: any) => item.following_id));
  }

  async function getMutualFollowIds(currentUserId: string) {
    const [{ data: followingRows }, { data: followerRows }] = await Promise.all([
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId),
      supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", currentUserId),
    ]);

    const followingSet = new Set(
      (followingRows || []).map((item: any) => item.following_id)
    );

    return (followerRows || [])
      .map((item: any) => item.follower_id)
      .filter((id: string) => followingSet.has(id));
  }

  async function isMutualFollow(targetUserId: string) {
    if (!userId) return false;

    const [{ data: iFollow }, { data: followsMe }] = await Promise.all([
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", userId)
        .eq("following_id", targetUserId)
        .maybeSingle(),
      supabase
        .from("follows")
        .select("id")
        .eq("follower_id", targetUserId)
        .eq("following_id", userId)
        .maybeSingle(),
    ]);

    return !!iFollow && !!followsMe;
  }

  async function searchUsers() {
    const keyword = searchText.trim();

    if (!keyword || keyword.length < 2 || !userId) {
      setResults([]);
      return;
    }

    const safeKeyword = keyword.replace(/[,()%]/g, "");

    setSearching(true);

    const mutualIds = await getMutualFollowIds(userId);

    if (mutualIds.length === 0) {
      setSearching(false);
      setResults([]);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_banned, is_admin")
      .in("id", mutualIds)
      .or(`username.ilike.%${safeKeyword}%,display_name.ilike.%${safeKeyword}%`)
      .limit(8);

    setSearching(false);

    if (error) {
      console.error("User search failed:", error.message);
      setResults([]);
      return;
    }

    setResults(
      ((data || []).filter((profile) => !profile.is_banned) as Profile[]).sort(
        (a, b) => Number(!!b.is_admin) - Number(!!a.is_admin)
      )
    );
  }

  async function searchPeople() {
    const keyword = peopleSearchText.trim();

    if (!keyword || keyword.length < 2 || !userId) {
      setPeopleResults([]);
      return;
    }

    const safeKeyword = keyword.replace(/[,()%]/g, "");

    setPeopleSearching(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_banned, is_admin")
      .or(`username.ilike.%${safeKeyword}%,display_name.ilike.%${safeKeyword}%`)
      .limit(10);

    setPeopleSearching(false);

    if (error) {
      console.error("People search failed:", error.message);
      setPeopleResults([]);
      return;
    }

    setPeopleResults(
      ((data || []).filter(
        (profile) => profile.id !== userId && !profile.is_banned
      ) as Profile[]).sort((a, b) => Number(!!b.is_admin) - Number(!!a.is_admin))
    );
  }

  async function followUser(target: Profile) {
    if (!userId || followUpdatingId) return;

    setFollowUpdatingId(target.id);

    const { error } = await supabase.from("follows").insert({
      follower_id: userId,
      following_id: target.id,
    });

    if (error) {
      setFollowUpdatingId(null);
      alert(error.message);
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: target.id,
        type: "new_follower",
        title: "New Follower",
        message: "Someone followed you on StreamHub. Follow back to enable private calls.",
        link: `/profile/${userId}`,
        is_read: false,
      },
    ]);

    setFollowingIds((current) => [...current, target.id]);
    setFollowUpdatingId(null);
    alert("Followed. They can follow back to enable private calls.");
  }

  async function startQuickCall(target: Profile) {
    if (!userId || callingId) return;

    const targetName =
      target.display_name || target.username || "this user";


    setCallingId(target.id);

    const canCall = await isMutualFollow(target.id);

    if (!canCall) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle();

      const callerName =
        myProfile?.display_name || myProfile?.username || "A StreamHub user";

      await supabase.from("notifications").insert([
        {
          user_id: target.id,
          type: "follow_back_for_calls",
          title: "Connection Request",
          message: `${callerName} wants to connect with you. Follow back to enable private calls.`,
          link: `/profile/${userId}`,
          is_read: false,
        },
      ]);

      setCallingId(null);
      alert("You can only call mutual followers. A follow-back notification has been sent.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setCallingId(null);
      window.location.href = "/login";
      return;
    }

    const callTitle = `Private Call with ${targetName}`;
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const { data: streamData, error: streamError } = await supabase
      .from("streams")
      .insert([
        {
          user_id: userId,
          title: callTitle,
          category: "One-on-One Call",
          description: "Private one-on-one video call.",
          tags: "private,call,one-on-one",
          visibility: "private",
          status: "offline",
          thumbnail_url: null,
          private_call_price: 0,
        },
      ])
      .select()
      .single();

    if (streamError || !streamData) {
      setCallingId(null);
      alert(streamError?.message || "Failed to create private call.");
      return;
    }

    const { error: guestError } = await supabase.from("stream_guests").insert([
      {
        stream_id: streamData.id,
        host_id: userId,
        guest_id: target.id,
        status: "pending",
      },
    ]);

    if (guestError) {
      setCallingId(null);
      alert(guestError.message);
      return;
    }

    const { data: callData, error: callError } = await supabase
      .from("private_call_requests")
      .insert([
        {
          caller_id: userId,
          receiver_id: target.id,
          stream_id: streamData.id,
          status: "pending",
          ring_status: "ringing",
          expires_at: expiresAt,
        },
      ])
      .select()
      .single();

    if (callError || !callData) {
      setCallingId(null);
      alert(callError?.message || "Failed to create call request.");
      return;
    }

    await supabase.from("notifications").insert([
      {
        user_id: target.id,
        type: "private_call_request",
        title: "Incoming Private Call",
        message: "Someone is calling you on StreamHub.",
        link: `/incoming-call/${callData.id}`,
        is_read: false,
      },
    ]);

    try {
      await fetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: target.id,
          title: "Incoming Private Call",
          message: "Someone is calling you on StreamHub.",
          url: `/incoming-call/${callData.id}`,
          notificationType: "incoming_call",
          streamId: streamData.id,
          callId: callData.id,
        }),
      });
    } catch (pushError) {
      console.error("Incoming call push failed:", pushError);
    }

    setCallingId(null);
    window.location.href = `/live/${streamData.id}`;
  }

  async function callBack(call: CallRequest) {
    const target =
      call.receiver_id === userId
        ? call.caller
        : call.receiver;

    if (!target) {
      alert("User not found.");
      return;
    }

    await startQuickCall(target);
  }

  async function acceptCall(call: CallRequest) {
    if (!userId || call.receiver_id !== userId || !call.stream_id) return;

    const price = Number(call.stream?.private_call_price || 0);

    const confirmed = confirm(
      price > 0
        ? `Pay $${price.toFixed(2)} and join this private call?`
        : "Accept and join this private call?"
    );

    if (!confirmed) return;

    setUpdatingId(call.id);

    if (price > 0) {
      const { error } = await supabase.rpc("pay_private_call_and_accept", {
        p_call_request_id: call.id,
      });

      if (error) {
        setUpdatingId(null);
        alert(error.message || "Payment failed. Please check your wallet balance.");
        await loadCalls();
        return;
      }
    } else {
      const { error } = await supabase.rpc("accept_private_call_request", {
        p_call_request_id: call.id,
      });

      if (error) {
        setUpdatingId(null);
        alert(error.message);
        return;
      }
    }

    await supabase.from("notifications").insert([
      {
        user_id: call.caller_id,
        type: "private_call_paid",
        title: price > 0 ? "Private Call Payment Received" : "Private Call Accepted",
        message:
          price > 0
            ? `Your private call was accepted and $${price.toFixed(2)} was added to your wallet.`
            : "Your private call request was accepted.",
        link: call.stream_id ? `/live/${call.stream_id}` : "/calls",
        is_read: false,
      },
    ]);

    setUpdatingId(null);
    window.location.href = `/live/${call.stream_id}`;
  }

  async function declineCall(call: CallRequest) {
    if (!userId || call.receiver_id !== userId) return;

    const confirmed = confirm("Decline this private call request?");
    if (!confirmed) return;

    setUpdatingId(call.id);

    const { error } = await supabase
      .from("private_call_requests")
      .update({
        status: "declined",
        ring_status: "declined",
        declined_at: new Date().toISOString(),
      })
      .eq("id", call.id);

    if (error) {
      setUpdatingId(null);
      alert(error.message);
      return;
    }

    if (call.stream_id) {
      await supabase
        .from("stream_guests")
        .update({ status: "declined" })
        .eq("stream_id", call.stream_id)
        .eq("guest_id", userId);
    }

    setUpdatingId(null);
    await loadCalls();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading private calls...</p>
      </main>
    );
  }

  const incoming = calls.filter((call) => call.receiver_id === userId);
  const outgoing = calls.filter((call) => call.caller_id === userId);
  const pending = calls.filter((call) => call.status === "pending");
  const paidCalls = calls.filter(
    (call) => Number(call.stream?.private_call_price || 0) > 0
  ).length;

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold text-purple-300">
              Private Video Calling
            </p>

            <h1 className="text-4xl font-black sm:text-5xl">
              One-on-One <span className="text-purple-400">Calls</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Connect with creators and viewers through private one-on-one video calls.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={loadCalls}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/wallet"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Wallet
            </Link>
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5 sm:p-6">
          <div className="mb-5">
            <p className="mb-2 text-sm font-bold text-purple-300">
              Call Mutual Followers
            </p>
            <h2 className="text-2xl font-black">One-on-One Calls</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Search mutual followers and start a private one-on-one video call.
            </p>
          </div>

          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search username or display name..."
            className="w-full rounded-2xl border border-purple-500/20 bg-black px-4 py-4 text-white outline-none placeholder:text-gray-500 focus:border-purple-500"
          />

          <div className="mt-4 space-y-3">
            {searching && (
              <div className="rounded-xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
                Searching...
              </div>
            )}

            {!searching && searchText.trim().length >= 2 && results.length === 0 && (
              <div className="rounded-xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
                No mutual followers found.
              </div>
            )}

            {results.map((profile) => {
              const name =
                profile.display_name || profile.username || "StreamHub user";

              return (
                <div
                  key={profile.id}
                  className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-black/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "??"
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-lg font-black">{name}</p>
                      <p className="truncate text-sm text-gray-400">
                        @{profile.username || "streamhub"}
                      </p>
                      {profile.is_admin && (
                        <p className="mt-1 w-fit rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs font-black text-yellow-300">
                          ADMIN
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => startQuickCall(profile)}
                    disabled={!!callingId}
                    className="rounded-xl bg-green-600 px-5 py-3 text-sm font-black hover:bg-green-700 disabled:bg-gray-700"
                  >
                    {callingId === profile.id ? "Calling..." : "Call"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
          <div className="mb-5">
            <p className="mb-2 text-sm font-bold text-red-300">
              Find People
            </p>
            <h2 className="text-2xl font-black">Build Your Call Network</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Search StreamHub users, follow them, and wait for a follow back to unlock private calls.
            </p>
          </div>

          <input
            value={peopleSearchText}
            onChange={(e) => setPeopleSearchText(e.target.value)}
            placeholder="Search StreamHub users to follow..."
            className="w-full rounded-2xl border border-gray-700 bg-black px-4 py-4 text-white outline-none placeholder:text-gray-500 focus:border-red-500"
          />

          <div className="mt-4 space-y-3">
            {peopleSearching && (
              <div className="rounded-xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
                Searching people...
              </div>
            )}

            {!peopleSearching &&
              peopleSearchText.trim().length >= 2 &&
              peopleResults.length === 0 && (
                <div className="rounded-xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
                  No users found.
                </div>
              )}

            {peopleResults.map((profile) => {
              const name =
                profile.display_name || profile.username || "StreamHub user";
              const isFollowingUser = followingIds.includes(profile.id);

              return (
                <div
                  key={profile.id}
                  className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-black/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "??"
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-lg font-black">{name}</p>
                      <p className="truncate text-sm text-gray-400">
                        @{profile.username || "streamhub"}
                      </p>
                      {profile.is_admin && (
                        <p className="mt-1 w-fit rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs font-black text-yellow-300">
                          ADMIN
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/profile/${profile.id}?from=calls`}
                      className="rounded-xl bg-gray-800 px-5 py-3 text-sm font-black hover:bg-gray-700"
                    >
                      View Profile
                    </Link>

                    <button
                      onClick={() => followUser(profile)}
                      disabled={isFollowingUser || followUpdatingId === profile.id}
                      className={
                        isFollowingUser
                          ? "rounded-xl bg-gray-700 px-5 py-3 text-sm font-black text-gray-300"
                          : "rounded-xl bg-red-600 px-5 py-3 text-sm font-black hover:bg-red-700 disabled:bg-gray-700"
                      }
                    >
                      {followUpdatingId === profile.id
                        ? "Following..."
                        : isFollowingUser
                        ? "Following"
                        : "Follow"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-4">
          <Stat label="Incoming" value={incoming.length} color="text-purple-300" />
          <Stat label="Outgoing" value={outgoing.length} color="text-blue-400" />
          <Stat label="Pending" value={pending.length} color="text-yellow-300" />
          <Stat label="Paid Calls" value={paidCalls} color="text-green-400" />
        </section>

        <section className="mb-8 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5 sm:p-6">
          <h2 className="mb-5 text-2xl font-black">Incoming Calls</h2>

          {incoming.length === 0 ? (
            <EmptyState text="No incoming private call requests." />
          ) : (
            <div className="space-y-3">
              {incoming.map((call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  currentUserId={userId}
                  updatingId={updatingId}
                  onAccept={() => acceptCall(call)}
                  onDecline={() => declineCall(call)}
                  onCallBack={() => callBack(call)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
          <h2 className="mb-5 text-2xl font-black">Outgoing Calls</h2>

          {outgoing.length === 0 ? (
            <EmptyState text="No outgoing private call requests." />
          ) : (
            <div className="space-y-3">
              {outgoing.map((call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  currentUserId={userId}
                  updatingId={updatingId}
                  onAccept={() => acceptCall(call)}
                  onDecline={() => declineCall(call)}
                  onCallBack={() => callBack(call)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CallCard({
  call,
  currentUserId,
  updatingId,
  onAccept,
  onDecline,
  onCallBack,
}: {
  call: CallRequest;
  currentUserId: string | null;
  updatingId: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onCallBack: () => void;
}) {
  const isIncoming = call.receiver_id === currentUserId;
  const otherPerson = isIncoming ? call.caller : call.receiver;
  const price = Number(call.stream?.private_call_price || 0);
  const name = otherPerson?.display_name || otherPerson?.username || "Unknown user";

  return (
    <div className="rounded-2xl border border-gray-800 bg-black/40 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800">
            {otherPerson?.avatar_url ? (
              <img
                src={otherPerson.avatar_url}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              "??"
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-lg font-black">{name}</p>

            <p className="text-sm text-gray-400">
              {isIncoming ? "Incoming call request" : "Outgoing call request"}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {new Date(call.created_at).toLocaleString()}
            </p>

            {call.stream && (
              <p className="mt-2 text-sm font-bold text-purple-300">
                {call.stream.title} ï¿½ {price > 0 ? `$${price.toFixed(2)}` : "Free"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
                call.status === "accepted"
                  ? "bg-green-500/10 text-green-400"
                  : call.status === "declined"
                  ? "bg-red-500/10 text-red-300"
                  : call.status === "missed"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-yellow-500/10 text-yellow-300"
              }`}
            >
              {call.status.toUpperCase()}
            </span>

            {price > 0 && (
              <span className="w-fit rounded-full bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
                {call.is_paid ? "PAID" : "PAYMENT REQUIRED"}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            {isIncoming && call.status === "pending" && (
              <>
                <button
                  onClick={onAccept}
                  disabled={updatingId === call.id}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold hover:bg-green-700 disabled:bg-gray-700"
                >
                  {updatingId === call.id
                    ? price > 0
                      ? "Paying..."
                      : "Opening..."
                    : price > 0
                    ? `Pay $${price.toFixed(2)} & Join`
                    : "Accept & Join"}
                </button>

                <button
                  onClick={onDecline}
                  disabled={updatingId === call.id}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-700 disabled:bg-gray-700"
                >
                  Decline
                </button>
              </>
            )}

            {call.stream_id && call.status === "accepted" && (
              <Link
                href={`/live/${call.stream_id}`}
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold hover:bg-purple-700"
              >
                Join Room
              </Link>
            )}

            {call.status === "missed" && (
              <button
                onClick={onCallBack}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold hover:bg-green-700"
              >
                Call Back
              </button>
            )}

            {call.stream_id && call.status === "pending" && !isIncoming && (
              <>
                <Link
                  href={`/live/${call.stream_id}`}
                  className="rounded-xl bg-gray-800 px-4 py-2 text-sm font-bold hover:bg-gray-700"
                >
                  Open Waiting Room
                </Link>

                <button
                  onClick={() => cancelCall(call.id, call.stream_id)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold hover:bg-red-700"
                >
                  Cancel Call
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <p className="mb-2 text-sm text-gray-400">{label}</p>
      <h2 className={`text-3xl font-black ${color}`}>{value}</h2>
    </div>
  );
}

async function cancelCall(callId: string, streamId?: string | null) {

  const { error } = await supabase
    .from("private_call_requests")
    .update({
      status: "cancelled",
      ring_status: "cancelled",
    })
    .eq("id", callId)
    .eq("status", "pending");

  if (error) {
    alert(error.message);
    return;
  }

  if (streamId) {
    await supabase
      .from("stream_guests")
      .update({ status: "cancelled" })
      .eq("stream_id", streamId);
  }

  window.location.reload();
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-black/30 p-6 text-center text-gray-400">
      {text}
    </div>
  );
}













