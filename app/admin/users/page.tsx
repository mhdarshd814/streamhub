"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  following: number | null;
  is_verified: boolean | null;
  is_admin: boolean | null;
  is_banned: boolean | null;
  is_global_muted: boolean | null;
  is_shadow_banned: boolean | null;
  created_at: string | null;
};

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: myProfile, error: adminError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (adminError || !myProfile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, followers, following, is_verified, is_admin, is_banned, is_global_muted, is_shadow_banned, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setUsers((data || []) as Profile[]);
    setLoading(false);
  }

  async function updateUserFlags(
    targetUser: Profile,
    overrides: Partial<Profile>
  ) {
    setUpdatingId(targetUser.id);

    const { error } = await supabase.rpc("admin_update_user_moderation_flags", {
      target_user_id: targetUser.id,
      make_admin: overrides.is_admin ?? !!targetUser.is_admin,
      make_verified: overrides.is_verified ?? !!targetUser.is_verified,
      make_banned: overrides.is_banned ?? !!targetUser.is_banned,
      make_global_muted:
        overrides.is_global_muted ?? !!targetUser.is_global_muted,
      make_shadow_banned:
        overrides.is_shadow_banned ?? !!targetUser.is_shadow_banned,
    });

    setUpdatingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadUsers();
  }

  const filteredUsers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return users;

    return users.filter((user) => {
      return (
        user.username?.toLowerCase().includes(value) ||
        user.display_name?.toLowerCase().includes(value) ||
        user.id.toLowerCase().includes(value)
      );
    });
  }, [search, users]);

  const adminCount = users.filter((user) => user.is_admin).length;
  const verifiedCount = users.filter((user) => user.is_verified).length;
  const bannedCount = users.filter((user) => user.is_banned).length;
  const mutedCount = users.filter((user) => user.is_global_muted).length;
  const shadowBannedCount = users.filter(
    (user) => user.is_shadow_banned
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <p className="text-gray-400">Loading users...</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-800 bg-red-950/30 p-6 text-center">
          <h1 className="mb-3 text-3xl font-black">Access Denied</h1>
          <p className="text-red-200">
            Your account does not have admin permission.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-5 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-red-400">
              Admin Control Center
            </p>

            <h1 className="text-3xl font-black sm:text-5xl">
              User <span className="text-red-500">Management</span>
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
              Manage bans, mutes, shadow bans, verification and admin access.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <button
              onClick={loadUsers}
              className="rounded-xl bg-gray-800 px-5 py-3 font-bold hover:bg-gray-700"
            >
              Refresh
            </button>

            <Link
              href="/admin"
              className="rounded-xl bg-gray-800 px-5 py-3 text-center font-bold hover:bg-gray-700"
            >
              Admin Home
            </Link>
          </div>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
            <p className="mb-2 text-sm text-gray-400">Users</p>
            <h2 className="text-3xl font-black">{users.length}</h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
            <p className="mb-2 text-sm text-gray-400">Verified</p>
            <h2 className="text-3xl font-black text-blue-400">
              {verifiedCount}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
            <p className="mb-2 text-sm text-gray-400">Admins</p>
            <h2 className="text-3xl font-black text-red-500">{adminCount}</h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
            <p className="mb-2 text-sm text-gray-400">Banned</p>
            <h2 className="text-3xl font-black text-yellow-400">
              {bannedCount}
            </h2>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
            <p className="mb-2 text-sm text-gray-400">Muted/Shadow</p>
            <h2 className="text-3xl font-black text-purple-400">
              {mutedCount + shadowBannedCount}
            </h2>
          </div>
        </div>

        <div className="mb-7 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, display name, or user ID..."
            className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm outline-none focus:border-red-500 sm:p-4 sm:text-base"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <div className="border-b border-gray-800 p-4 sm:p-6">
            <h2 className="text-2xl font-black sm:text-3xl">Users</h2>
            <p className="mt-1 text-sm text-gray-400">
              Showing {filteredUsers.length} user(s)
            </p>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">No users found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredUsers.map((user) => {
                const name =
                  user.display_name || user.username || "Unnamed User";

                return (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-start xl:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-800">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xl">👤</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-lg font-black">
                            {name}
                          </h3>

                          {user.is_verified && (
                            <span className="rounded-full bg-blue-600 px-2 py-1 text-xs font-black">
                              VERIFIED
                            </span>
                          )}

                          {user.is_admin && (
                            <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-black">
                              ADMIN
                            </span>
                          )}

                          {user.is_banned && (
                            <span className="rounded-full bg-yellow-600 px-2 py-1 text-xs font-black">
                              BANNED
                            </span>
                          )}

                          {user.is_global_muted && (
                            <span className="rounded-full bg-purple-600 px-2 py-1 text-xs font-black">
                              MUTED
                            </span>
                          )}

                          {user.is_shadow_banned && (
                            <span className="rounded-full bg-zinc-600 px-2 py-1 text-xs font-black">
                              SHADOW
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-400">
                          @{user.username || "no-username"}
                        </p>

                        <p className="mt-1 break-all text-xs text-gray-500">
                          {user.id}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {user.followers || 0} followers •{" "}
                          {user.following || 0} following
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:min-w-[520px]">
                      <button
                        onClick={() =>
                          updateUserFlags(user, {
                            is_verified: !user.is_verified,
                          })
                        }
                        disabled={updatingId === user.id}
                        className={
                          user.is_verified
                            ? "rounded-xl bg-gray-700 px-4 py-3 text-sm font-bold hover:bg-gray-600 disabled:opacity-50"
                            : "rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                        }
                      >
                        {user.is_verified ? "Remove Verify" : "Verify Creator"}
                      </button>

                      <button
                        onClick={() =>
                          updateUserFlags(user, {
                            is_admin: !user.is_admin,
                          })
                        }
                        disabled={updatingId === user.id}
                        className={
                          user.is_admin
                            ? "rounded-xl bg-gray-700 px-4 py-3 text-sm font-bold hover:bg-gray-600 disabled:opacity-50"
                            : "rounded-xl bg-red-600 px-4 py-3 text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                        }
                      >
                        {user.is_admin ? "Remove Admin" : "Make Admin"}
                      </button>

                      <button
                        onClick={() =>
                          updateUserFlags(user, {
                            is_banned: !user.is_banned,
                          })
                        }
                        disabled={updatingId === user.id}
                        className={
                          user.is_banned
                            ? "rounded-xl bg-green-700 px-4 py-3 text-sm font-bold hover:bg-green-600 disabled:opacity-50"
                            : "rounded-xl bg-yellow-600 px-4 py-3 text-sm font-bold hover:bg-yellow-700 disabled:opacity-50"
                        }
                      >
                        {user.is_banned ? "Unban User" : "Ban User"}
                      </button>

                      <button
                        onClick={() =>
                          updateUserFlags(user, {
                            is_global_muted: !user.is_global_muted,
                          })
                        }
                        disabled={updatingId === user.id}
                        className={
                          user.is_global_muted
                            ? "rounded-xl bg-green-700 px-4 py-3 text-sm font-bold hover:bg-green-600 disabled:opacity-50"
                            : "rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
                        }
                      >
                        {user.is_global_muted
                          ? "Remove Global Mute"
                          : "Global Mute"}
                      </button>

                      <button
                        onClick={() =>
                          updateUserFlags(user, {
                            is_shadow_banned: !user.is_shadow_banned,
                          })
                        }
                        disabled={updatingId === user.id}
                        className={
                          user.is_shadow_banned
                            ? "rounded-xl bg-green-700 px-4 py-3 text-sm font-bold hover:bg-green-600 disabled:opacity-50"
                            : "rounded-xl bg-zinc-700 px-4 py-3 text-sm font-bold hover:bg-zinc-600 disabled:opacity-50"
                        }
                      >
                        {user.is_shadow_banned
                          ? "Remove Shadow Ban"
                          : "Shadow Ban"}
                      </button>

                      {user.username && (
                        <Link
                          href={`/user/${user.username}`}
                          className="rounded-xl bg-gray-800 px-4 py-3 text-center text-sm font-bold hover:bg-gray-700"
                        >
                          View Profile
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}