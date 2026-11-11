begin;
create table public.nail_push_subscriptions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.nail_accounts(owner_id),
  endpoint text not null unique check(length(endpoint)<=2048), p256dh text not null check(length(p256dh)<=128),
  auth text not null check(length(auth)<=64), created_at timestamptz not null default now(),
  retry_after timestamptz not null default now()
);
create index nail_push_owner_idx on public.nail_push_subscriptions(owner_id);
create table public.nail_push_deliveries (
  subscription_id uuid not null references public.nail_push_subscriptions(id) on delete cascade,
  appointment_id uuid not null, fingerprint text not null check(length(fingerprint)=32), delivered_at timestamptz not null default now(),
  primary key(subscription_id,appointment_id,fingerprint)
);
alter table public.nail_push_subscriptions enable row level security;
alter table public.nail_push_deliveries enable row level security;
revoke all on public.nail_push_subscriptions,public.nail_push_deliveries from public,anon,authenticated;

create function public.nail_push_subscription(p_action text,p_subscription jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_endpoint text:=p_subscription->>'endpoint'; v_count integer;
begin
  perform 1 from public.nail_accounts where owner_id=v_owner and active for update;
  if not found then raise exception using errcode='42501',message='ACCOUNT_NOT_ALLOWED'; end if;
  if p_action='save' then
    if length(v_endpoint)>2048 or v_endpoint !~ '^https://([a-zA-Z0-9-]+[.])*push[.]apple[.]com/' and v_endpoint !~ '^https://fcm[.]googleapis[.]com/' and v_endpoint !~ '^https://([a-zA-Z0-9-]+[.])*push[.]services[.]mozilla[.]com/' then raise exception using errcode='22023',message='INVALID_ENDPOINT'; end if;
    if coalesce(p_subscription#>>'{keys,p256dh}','') !~ '^[A-Za-z0-9_-]{87}=?$' or coalesce(p_subscription#>>'{keys,auth}','') !~ '^[A-Za-z0-9_-]{22}={0,2}$' then raise exception using errcode='22023',message='INVALID_KEYS'; end if;
    select count(*) into v_count from public.nail_push_subscriptions where owner_id=v_owner and endpoint<>v_endpoint;
    if v_count>=5 then raise exception using errcode='22023',message='TOO_MANY_DEVICES'; end if;
    insert into public.nail_push_subscriptions(owner_id,endpoint,p256dh,auth) values(v_owner,v_endpoint,p_subscription#>>'{keys,p256dh}',p_subscription#>>'{keys,auth}')
    on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth where nail_push_subscriptions.owner_id=v_owner;
    if not found then raise exception using errcode='42501',message='ACCOUNT_NOT_ALLOWED'; end if;
    return jsonb_build_object('enabled',true);
  elsif p_action='remove' then
    delete from public.nail_push_subscriptions where owner_id=v_owner and endpoint=v_endpoint;
    return jsonb_build_object('enabled',false);
  elsif p_action='status' then
    return jsonb_build_object('enabled',exists(select 1 from public.nail_push_subscriptions where owner_id=v_owner and endpoint=v_endpoint));
  elsif p_action='test' then
    return (select jsonb_build_object('endpoint',endpoint,'keys',jsonb_build_object('p256dh',p256dh,'auth',auth)) from public.nail_push_subscriptions where owner_id=v_owner and endpoint=v_endpoint);
  end if;
  raise exception using errcode='22023',message='INVALID_COMMAND';
end $$;
revoke all on function public.nail_push_subscription(text,jsonb) from public,anon;
grant execute on function public.nail_push_subscription(text,jsonb) to authenticated;

-- This dedicated worker can claim and acknowledge reminder jobs only. It cannot read the workspace.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='nail_push_worker') then create role nail_push_worker nologin noinherit; end if;
end $$;
grant usage on schema public to nail_push_worker;

create function public.nail_claim_push(p_limit integer default 20,p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.nail_push_subscriptions%rowtype; v_items jsonb; v_result jsonb:='[]'::jsonb; v_local timestamp:=p_now at time zone 'America/Sao_Paulo';
begin
  for s in select p.* from public.nail_push_subscriptions p join public.nail_accounts b on b.owner_id=p.owner_id and b.active where p.retry_after<=now() order by p.retry_after limit least(greatest(p_limit,1),20) for update of p skip locked loop
    select coalesce(jsonb_agg(jsonb_build_object('appointmentId',a.id,'fingerprint',md5(public.nail_message_context(a.owner_id,a.id)::text))), '[]'::jsonb) into v_items
    from public.nail_appointments a
    where a.owner_id=s.owner_id and a.status='scheduled' and a.appointment_date+a.start_time>=v_local
      and (a.appointment_date-2)+time '09:00'<=v_local
      and not exists(select 1 from public.nail_messages m where m.owner_id=a.owner_id and m.appointment_id=a.id and m.kind='reminder' and m.context=public.nail_message_context(a.owner_id,a.id))
      and not exists(select 1 from public.nail_push_deliveries d where d.subscription_id=s.id and d.appointment_id=a.id and d.fingerprint=md5(public.nail_message_context(a.owner_id,a.id)::text));
    update public.nail_push_subscriptions set retry_after=now()+interval '5 minutes' where id=s.id;
    if jsonb_array_length(v_items)>0 then
      v_result:=v_result||jsonb_build_array(jsonb_build_object('id',s.id,'subscription',jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth)),'items',v_items));
    end if;
  end loop;
  return v_result;
end $$;

create function public.nail_complete_push(p_id uuid,p_items jsonb,p_outcome text) returns void
language plpgsql security definer set search_path='' as $$
declare v_item jsonb;
begin
  if p_outcome='expired' then delete from public.nail_push_subscriptions where id=p_id;
  elsif p_outcome='delivered' then
    for v_item in select value from jsonb_array_elements(p_items) loop
      insert into public.nail_push_deliveries(subscription_id,appointment_id,fingerprint) values(p_id,(v_item->>'appointmentId')::uuid,v_item->>'fingerprint') on conflict do nothing;
    end loop;
    update public.nail_push_subscriptions set retry_after=now() where id=p_id;
  else update public.nail_push_subscriptions set retry_after=now()+interval '10 minutes' where id=p_id;
  end if;
end $$;
revoke all on function public.nail_claim_push(integer,timestamptz),public.nail_complete_push(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.nail_claim_push(integer,timestamptz),public.nail_complete_push(uuid,jsonb,text) to nail_push_worker;
commit;
