begin;
create or replace function public.nail_claim_push(p_limit integer default 20,p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.nail_push_subscriptions%rowtype; v_items jsonb; v_result jsonb:='[]'::jsonb; v_local timestamp:=p_now at time zone 'America/Sao_Paulo';
begin
  for s in select p.* from public.nail_push_subscriptions p join public.nail_accounts b on b.owner_id=p.owner_id and b.active where p.retry_after<=now() order by p.retry_after limit least(greatest(p_limit,1),20) for update of p skip locked loop
    select coalesce(jsonb_agg(jsonb_build_object('appointmentId',a.id,'fingerprint',md5(public.nail_message_context(a.owner_id,a.id)::text))), '[]'::jsonb) into v_items
    from public.nail_appointments a
    where a.owner_id=s.owner_id and a.status='scheduled' and not a.time_unknown and a.appointment_date+a.start_time>=v_local
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

revoke all on function public.nail_claim_push(integer,timestamptz) from public,anon,authenticated;
grant execute on function public.nail_claim_push(integer,timestamptz) to nail_push_worker;
commit;
