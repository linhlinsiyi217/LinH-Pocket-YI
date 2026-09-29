-- LinH Pocket YI · 邀请码防二传（在 Supabase SQL Editor 里执行一次）
-- 前提：已按说明建好 invite_codes(code text, is_used boolean) 和
--       users(user_id uuid, email text, qq_number text, invite_code text, is_whitelisted boolean, registered_at timestamptz)
-- 思路：前端只能调用下面两个函数，不能直接读写 invite_codes；邀请码的核销在一条 UPDATE 里原子完成。

-- 1. 约束：一个账号一行、一个 QQ 号只能绑定一个账号、一个邀请码只能绑定一个账号
alter table public.users add constraint users_user_id_key unique (user_id);
alter table public.users add constraint users_qq_number_key unique (qq_number);
alter table public.users add constraint users_invite_code_key unique (invite_code);
alter table public.invite_codes add constraint invite_codes_code_key unique (code);

-- 2. RLS：invite_codes 前端完全不可读写；users 只能读自己那一行，不能自己写（is_whitelisted 不能自己改）
alter table public.invite_codes enable row level security;
alter table public.users enable row level security;
drop policy if exists "read own row" on public.users;
create policy "read own row" on public.users for select to authenticated using (user_id = auth.uid());

-- 3. 预检：邀请码是否存在且未使用（不核销，只用于注册页提示）
create or replace function public.check_invite(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from invite_codes where code = p_code and is_used = false);
$$;

-- 4. 核销：必须是已验证邮箱的登录用户；抢占邀请码 + 写入 users 在同一个事务里，任一步失败整体回滚
create or replace function public.redeem_invite(p_code text, p_qq text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_constraint text;
begin
  if v_uid is null then return 'not_signed_in'; end if;
  select email, email_confirmed_at into v_email, v_confirmed from auth.users where id = v_uid;
  if v_confirmed is null then return 'not_confirmed'; end if;
  if exists (select 1 from users where user_id = v_uid) then return 'already_registered'; end if;
  if p_qq !~ '^[1-9][0-9]{4,10}$' then return 'bad_qq'; end if;

  begin
    -- 行锁 + is_used = false 条件：两个人同时用同一个码，只有一个能更新成功
    update invite_codes set is_used = true where code = p_code and is_used = false;
    if not found then return 'invalid_code'; end if;
    insert into users (user_id, email, qq_number, invite_code, is_whitelisted, registered_at)
    values (v_uid, v_email, p_qq, p_code, true, now());
  exception when unique_violation then
    -- 回滚到 begin 之前：邀请码不会被白白用掉
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'users_qq_number_key' then return 'qq_taken'; end if;
    if v_constraint = 'users_user_id_key' then return 'already_registered'; end if;
    return 'invalid_code';
  end;
  return 'ok';
end;
$$;

-- 5. 只开放这两个函数给前端
revoke all on function public.check_invite(text) from public, anon, authenticated;
revoke all on function public.redeem_invite(text, text) from public, anon, authenticated;
grant execute on function public.check_invite(text) to anon, authenticated;
grant execute on function public.redeem_invite(text, text) to authenticated;

-- 提示：邀请码请用足够长的随机串（例如 12 位以上字母数字），避免被 check_invite 逐个试出来。
-- 如果 qq_number 列是 bigint，把 insert 里的 p_qq 改成 p_qq::bigint。
