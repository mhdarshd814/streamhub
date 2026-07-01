-- ============================================================
-- StreamHub Messaging Schema (WhatsApp-style)
-- Consistent with existing conventions: snake_case, uuid PKs,
-- references profiles(id), RLS-friendly.
-- ============================================================

-- 1. CONVERSATIONS
-- A conversation is either "direct" (2 people) or "group" (N people).
create table conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  name text,                          -- group name (null for direct)
  avatar_url text,                    -- group avatar (null for direct)
  created_by uuid references profiles(id),
  last_message_id uuid,               -- denormalized for fast inbox sort (FK added after messages table)
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate direct conversations between the same two people.
-- Enforced in app logic (check existing before insert) since a partial
-- unique index across a join table is awkward in Postgres.

-- 2. CONVERSATION PARTICIPANTS
create table conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_message_id uuid,          -- watermark for unread count / read receipts
  last_read_at timestamptz,
  muted_until timestamptz,            -- null = not muted
  is_archived boolean not null default false,
  is_pinned boolean not null default false,
  unique (conversation_id, user_id)
);

create index idx_conv_participants_user on conversation_participants(user_id);
create index idx_conv_participants_conv on conversation_participants(conversation_id);

-- 3. MESSAGES
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  reply_to_message_id uuid references messages(id) on delete set null,
  message_type text not null default 'text'
    check (message_type in ('text', 'image', 'video', 'voice', 'file', 'system')),
  content text,                       -- text body (null for pure media messages)
  media_url text,                     -- storage URL for image/video/voice/file
  media_meta jsonb,                   -- { duration, width, height, size, mime_type, thumbnail_url }
  is_edited boolean not null default false,
  is_deleted boolean not null default false,   -- soft delete ("this message was deleted")
  deleted_for text default 'none' check (deleted_for in ('none', 'everyone', 'sender_only')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index idx_messages_conversation on messages(conversation_id, created_at desc);
create index idx_messages_sender on messages(sender_id);

alter table conversations
  add constraint fk_last_message foreign key (last_message_id) references messages(id) on delete set null;

-- 4. MESSAGE STATUS (per-recipient delivery/read receipts — the "double ticks")
create table message_status (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'sent' check (status in ('sent', 'delivered', 'read')),
  updated_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index idx_message_status_message on message_status(message_id);
create index idx_message_status_user on message_status(user_id, status);

-- 5. MESSAGE REACTIONS (emoji reactions)
create table message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

-- 6. TYPING INDICATORS
-- Ephemeral by nature — cheap table + short TTL cleanup, or do this
-- purely via Supabase Realtime Presence/Broadcast (recommended, see plan.md).
-- Included here only if you want a persisted fallback:
create table typing_indicators (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- 7. PRESENCE (online / last seen)
create table user_presence (
  user_id uuid primary key references profiles(id) on delete cascade,
  status text not null default 'offline' check (status in ('online', 'offline', 'away')),
  last_seen_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table conversations enable row level security;
alter table conversation_participants enable row level security;
alter table messages enable row level security;
alter table message_status enable row level security;
alter table message_reactions enable row level security;
alter table typing_indicators enable row level security;
alter table user_presence enable row level security;

-- Helper: is the current user a participant in a conversation?
create or replace function is_conversation_participant(conv_id uuid)
returns boolean as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Conversations: only participants can see/update
create policy "participants can view conversation"
  on conversations for select
  using (is_conversation_participant(id));

create policy "authenticated users can create conversations"
  on conversations for insert
  with check (auth.uid() = created_by);

create policy "participants can update conversation"
  on conversations for update
  using (is_conversation_participant(id));

-- Participants: only visible to other participants of the same conversation
create policy "participants can view participant list"
  on conversation_participants for select
  using (is_conversation_participant(conversation_id));

create policy "participants can add others to group"
  on conversation_participants for insert
  with check (is_conversation_participant(conversation_id) or user_id = auth.uid());

create policy "users can update their own participant row"
  on conversation_participants for update
  using (user_id = auth.uid());

create policy "users can leave conversation"
  on conversation_participants for delete
  using (user_id = auth.uid());

-- Messages: only participants can read; only sender can insert as themselves
create policy "participants can view messages"
  on messages for select
  using (is_conversation_participant(conversation_id));

create policy "participants can send messages"
  on messages for insert
  with check (sender_id = auth.uid() and is_conversation_participant(conversation_id));

create policy "sender can edit/delete own messages"
  on messages for update
  using (sender_id = auth.uid());

-- Message status: participants can view; users manage only their own status row
create policy "participants can view message status"
  on message_status for select
  using (
    exists (
      select 1 from messages m
      where m.id = message_id and is_conversation_participant(m.conversation_id)
    )
  );

create policy "users manage their own message status"
  on message_status for insert
  with check (user_id = auth.uid());

create policy "users update their own message status"
  on message_status for update
  using (user_id = auth.uid());

-- Reactions
create policy "participants can view reactions"
  on message_reactions for select
  using (
    exists (
      select 1 from messages m
      where m.id = message_id and is_conversation_participant(m.conversation_id)
    )
  );

create policy "users manage their own reactions"
  on message_reactions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Typing indicators
create policy "participants can view typing"
  on typing_indicators for select
  using (is_conversation_participant(conversation_id));

create policy "users manage their own typing state"
  on typing_indicators for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Presence: readable by everyone (like WhatsApp "last seen" visible to contacts;
-- tighten this to followers/contacts only if you want stricter privacy)
create policy "presence is publicly readable"
  on user_presence for select
  using (true);

create policy "users manage their own presence"
  on user_presence for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Keep conversations.last_message_id / last_message_at in sync on new message
create or replace function update_conversation_last_message()
returns trigger as $$
begin
  update conversations
  set last_message_id = new.id,
      last_message_at = new.created_at,
      updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_update_conversation_last_message
  after insert on messages
  for each row execute function update_conversation_last_message();

-- Auto-create a 'sent' status row for every OTHER participant when a message is sent
create or replace function create_message_status_rows()
returns trigger as $$
begin
  insert into message_status (message_id, user_id, status)
  select new.id, cp.user_id, 'sent'
  from conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id != new.sender_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_create_message_status_rows
  after insert on messages
  for each row execute function create_message_status_rows();

-- ============================================================
-- HELPFUL RPC: unread count per conversation for a user
-- ============================================================
create or replace function get_unread_count(p_conversation_id uuid, p_user_id uuid)
returns integer as $$
  select count(*)::int
  from message_status ms
  join messages m on m.id = ms.message_id
  where m.conversation_id = p_conversation_id
    and ms.user_id = p_user_id
    and ms.status != 'read';
$$ language sql stable;
