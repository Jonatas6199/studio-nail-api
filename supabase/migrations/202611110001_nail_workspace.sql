begin;

create table public.nail_accounts (
  owner_id uuid primary key references auth.users(id) on delete restrict,
  business_name text not null default 'Meu Ateliê' check (length(trim(business_name)) between 1 and 80),
  professional text not null default 'Letícia' check (length(trim(professional)) between 1 and 50),
  phone text not null default '' check (length(phone) <= 24),
  active boolean not null default true,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now()
);

create table public.nail_clients (
  owner_id uuid not null references public.nail_accounts(owner_id),
  id uuid not null, name text not null check (length(trim(name)) between 1 and 100),
  phone text not null default '' check (length(phone) <= 24),
  notes text not null default '' check (length(notes) <= 1000),
  color text not null default 'sand' check (color in ('rose','sage','sand','lilac','clay')),
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table public.nail_procedures (
  owner_id uuid not null references public.nail_accounts(owner_id), id uuid not null,
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null default '' check (length(description) <= 200),
  price integer not null check (price between 0 and 100000000),
  duration integer not null check (duration between 5 and 1440), active boolean not null default true,
  created_at timestamptz not null default now(), primary key (owner_id, id)
);

create table public.nail_appointments (
  owner_id uuid not null references public.nail_accounts(owner_id), id uuid not null,
  client_id uuid not null, appointment_date date not null, start_time time not null,
  duration integer not null check (duration between 5 and 1440),
  procedures jsonb not null check (jsonb_typeof(procedures) = 'array' and jsonb_array_length(procedures) between 1 and 20),
  price integer not null check (price between 0 and 100000000),
  notes text not null default '' check (length(notes) <= 1000),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','absent')),
  overlap_confirmed boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (owner_id, id), foreign key (owner_id, client_id) references public.nail_clients(owner_id, id),
  check (extract(second from start_time) = 0),
  check (extract(epoch from start_time) / 60 + duration <= 1440)
);
create index nail_appointments_date_idx on public.nail_appointments(owner_id, appointment_date, start_time);
create index nail_appointments_client_idx on public.nail_appointments(owner_id, client_id);

create table public.nail_payments (
  owner_id uuid not null references public.nail_accounts(owner_id), id uuid not null,
  appointment_id uuid not null, amount integer not null check (amount between 1 and 100000000),
  payment_date date not null,
  method text not null check (method in ('Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Outro')),
  kind text not null check (kind in ('deposit','balance')),
  created_at timestamptz not null default now(), primary key (owner_id, id),
  foreign key (owner_id, appointment_id) references public.nail_appointments(owner_id, id)
);
create index nail_payments_appointment_idx on public.nail_payments(owner_id, appointment_id);
create index nail_payments_date_idx on public.nail_payments(owner_id, payment_date);

create table public.nail_expenses (
  owner_id uuid not null references public.nail_accounts(owner_id), id uuid not null,
  description text not null check (length(trim(description)) between 1 and 160),
  amount integer not null check (amount between 1 and 100000000), expense_date date not null,
  category text not null check (category in ('Insumos','Equipamentos','Aluguel','Cursos','Marketing','Outros')),
  method text not null check (method in ('Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Outro')),
  created_at timestamptz not null default now(), primary key (owner_id, id)
);
create index nail_expenses_date_idx on public.nail_expenses(owner_id, expense_date);

create table public.nail_availability (
  owner_id uuid not null references public.nail_accounts(owner_id), available_date date not null,
  times text[] not null default '{}' check (cardinality(times) <= 48),
  primary key (owner_id, available_date)
);

-- The receipt prevents duplicate financial records when a network request is retried.
create table public.nail_requests (
  owner_id uuid not null references public.nail_accounts(owner_id), request_id uuid not null,
  command jsonb not null, created_at timestamptz not null default now(),
  primary key (owner_id, request_id)
);

alter table public.nail_accounts enable row level security;
alter table public.nail_clients enable row level security;
alter table public.nail_procedures enable row level security;
alter table public.nail_appointments enable row level security;
alter table public.nail_payments enable row level security;
alter table public.nail_expenses enable row level security;
alter table public.nail_availability enable row level security;
alter table public.nail_requests enable row level security;

create policy nail_account_read on public.nail_accounts for select to authenticated
using (owner_id = (select auth.uid()) and active);

do $$
declare tbl text;
begin
  foreach tbl in array array['nail_clients','nail_procedures','nail_appointments','nail_payments','nail_expenses','nail_availability'] loop
    execute format('create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()) and exists (select 1 from public.nail_accounts a where a.owner_id = (select auth.uid()) and a.active))', tbl || '_read', tbl);
  end loop;
end $$;

revoke all on public.nail_accounts, public.nail_clients, public.nail_procedures,
  public.nail_appointments, public.nail_payments, public.nail_expenses,
  public.nail_availability, public.nail_requests from anon, authenticated;
grant select on public.nail_accounts, public.nail_clients, public.nail_procedures,
  public.nail_appointments, public.nail_payments, public.nail_expenses,
  public.nail_availability to authenticated;

create function public.nail_read_workspace() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_account public.nail_accounts%rowtype;
begin
  select * into v_account from public.nail_accounts where owner_id = v_owner and active for share;
  if v_owner is null or v_account.owner_id is null then raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ALLOWED'; end if;
  return jsonb_build_object('revision', v_account.revision, 'data', jsonb_build_object(
    'version', 1,
    'business', jsonb_build_object('name', v_account.business_name, 'professional', v_account.professional, 'phone', v_account.phone),
    'clients', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'notes', c.notes, 'color', c.color) order by c.name) from public.nail_clients c where owner_id = v_owner), '[]'::jsonb),
    'procedures', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description, 'price', p.price, 'duration', p.duration, 'active', p.active) order by p.created_at, p.id) from public.nail_procedures p where owner_id = v_owner), '[]'::jsonb),
    'appointments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'clientId', a.client_id, 'date', a.appointment_date, 'time', to_char(a.start_time, 'HH24:MI'), 'duration', a.duration, 'procedures', a.procedures, 'price', a.price, 'notes', a.notes, 'status', a.status, 'overlapConfirmed', a.overlap_confirmed) order by a.appointment_date, a.start_time, a.id) from public.nail_appointments a where owner_id = v_owner), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'appointmentId', p.appointment_id, 'amount', p.amount, 'date', p.payment_date, 'method', p.method, 'kind', p.kind) order by p.created_at, p.id) from public.nail_payments p where owner_id = v_owner), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'description', e.description, 'amount', e.amount, 'date', e.expense_date, 'category', e.category, 'method', e.method) order by e.expense_date, e.id) from public.nail_expenses e where owner_id = v_owner), '[]'::jsonb),
    'availability', coalesce((select jsonb_object_agg(a.available_date::text, to_jsonb(a.times)) from public.nail_availability a where owner_id = v_owner), '{}'::jsonb)
  ));
end $$;

create function public.nail_apply_command(p_request_id uuid, p_revision bigint, p_command jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_revision bigint; v_previous jsonb; v_type text := p_command->>'type';
  v_data jsonb; v_client jsonb; v_payment jsonb; v_item jsonb; v_snapshot jsonb; v_snapshots jsonb := '[]'::jsonb;
  v_id uuid; v_date date; v_time time; v_duration integer; v_price integer; v_status text;
  v_paid bigint; v_amount integer; v_confirm boolean; v_has_overlap boolean; v_times text[];
  v_old public.nail_appointments%rowtype; v_procedure public.nail_procedures%rowtype;
begin
  if v_owner is null then raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ALLOWED'; end if;
  -- Serialize writes for this owner so totals and overlap checks are transactional.
  select revision into v_revision from public.nail_accounts where owner_id = v_owner and active for update;
  if not found then raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ALLOWED'; end if;
  if p_request_id is null or p_command is null or p_revision is null then raise exception using errcode = '22023', message = 'INVALID_COMMAND'; end if;
  select command into v_previous from public.nail_requests where owner_id = v_owner and request_id = p_request_id;
  if found then
    if v_previous <> p_command then raise exception 'REQUEST_REUSED'; end if;
    return public.nail_read_workspace();
  end if;
  if v_revision <> p_revision then raise exception 'STALE_REVISION'; end if;

  if v_type = 'client.save' then
    v_client := p_command->'client';
    insert into public.nail_clients(owner_id, id, name, phone, notes, color)
      values(v_owner, (v_client->>'id')::uuid, trim(v_client->>'name'), v_client->>'phone', v_client->>'notes', v_client->>'color')
      on conflict (owner_id, id) do update set name = excluded.name, phone = excluded.phone, notes = excluded.notes, color = excluded.color;
  elsif v_type = 'procedure.save' then
    v_data := p_command->'procedure';
    insert into public.nail_procedures(owner_id, id, name, description, price, duration, active)
      values(v_owner, (v_data->>'id')::uuid, trim(v_data->>'name'), v_data->>'description', (v_data->>'price')::integer, (v_data->>'duration')::integer, (v_data->>'active')::boolean)
      on conflict (owner_id, id) do update set name = excluded.name, description = excluded.description, price = excluded.price, duration = excluded.duration, active = excluded.active;
  elsif v_type = 'appointment.save' then
    v_data := p_command->'appointment'; v_id := (v_data->>'id')::uuid;
    v_date := (v_data->>'date')::date; v_time := (v_data->>'time')::time;
    v_duration := (v_data->>'duration')::integer; v_price := (v_data->>'price')::integer;
    v_confirm := coalesce((v_data->>'overlapConfirmed')::boolean, false);
    select * into v_old from public.nail_appointments where owner_id = v_owner and id = v_id;
    v_status := coalesce(v_old.status, 'scheduled');
    select coalesce(sum(amount), 0) into v_paid from public.nail_payments where owner_id = v_owner and appointment_id = v_id;
    if v_price < v_paid then raise exception 'PRICE_BELOW_PAID'; end if;
    if jsonb_typeof(v_data->'procedures') <> 'array' or jsonb_array_length(v_data->'procedures') not between 1 and 20 then raise exception using errcode = '22023', message = 'INVALID_PROCEDURES'; end if;
    for v_item in select value from jsonb_array_elements(v_data->'procedures') loop
      if exists(select 1 from jsonb_array_elements(v_snapshots) s where s->>'id' = v_item->>'id') then raise exception using errcode = '22023', message = 'DUPLICATE_PROCEDURE'; end if;
      v_snapshot := null;
      if v_old.id is not null then select value into v_snapshot from jsonb_array_elements(v_old.procedures) where value->>'id' = v_item->>'id'; end if;
      if v_snapshot is null then
        select * into v_procedure from public.nail_procedures where owner_id = v_owner and id = (v_item->>'id')::uuid and active;
        if not found then raise exception 'PROCEDURE_UNAVAILABLE'; end if;
        v_snapshot := jsonb_build_object('id', v_procedure.id, 'name', v_procedure.name, 'price', v_procedure.price, 'duration', v_procedure.duration);
      end if;
      v_snapshots := v_snapshots || jsonb_build_array(v_snapshot);
    end loop;
    if v_status in ('scheduled', 'completed') then
      select exists(select 1 from public.nail_appointments a where a.owner_id = v_owner and a.id <> v_id and a.appointment_date = v_date and a.status in ('scheduled','completed')
        and extract(epoch from a.start_time)/60 < extract(epoch from v_time)/60 + v_duration
        and extract(epoch from a.start_time)/60 + a.duration > extract(epoch from v_time)/60) into v_has_overlap;
      if v_has_overlap and not v_confirm then raise exception 'OVERLAP'; end if;
    end if;
    v_client := p_command->'client';
    if v_client is not null and v_client <> 'null'::jsonb then
      if v_client->>'id' <> v_data->>'clientId' then raise exception using errcode = '22023', message = 'INVALID_CLIENT'; end if;
      insert into public.nail_clients(owner_id, id, name, phone, notes, color)
        values(v_owner, (v_client->>'id')::uuid, trim(v_client->>'name'), v_client->>'phone', v_client->>'notes', v_client->>'color');
    end if;
    insert into public.nail_appointments(owner_id, id, client_id, appointment_date, start_time, duration, procedures, price, notes, status, overlap_confirmed)
      values(v_owner, v_id, (v_data->>'clientId')::uuid, v_date, v_time, v_duration, v_snapshots, v_price, v_data->>'notes', v_status, v_confirm)
      on conflict (owner_id, id) do update set client_id = excluded.client_id, appointment_date = excluded.appointment_date, start_time = excluded.start_time, duration = excluded.duration, procedures = excluded.procedures, price = excluded.price, notes = excluded.notes, overlap_confirmed = excluded.overlap_confirmed, updated_at = now();
    v_payment := p_command->'payment';
    if v_payment is not null and v_payment <> 'null'::jsonb then
      if v_old.id is not null or v_payment->>'appointmentId' <> v_id::text then raise exception using errcode = '22023', message = 'INVALID_PAYMENT'; end if;
      v_amount := (v_payment->>'amount')::integer;
      if v_paid + v_amount > v_price then raise exception 'PAYMENT_EXCEEDS_TOTAL'; end if;
      insert into public.nail_payments(owner_id, id, appointment_id, amount, payment_date, method, kind)
        values(v_owner, (v_payment->>'id')::uuid, v_id, v_amount, (v_payment->>'date')::date, v_payment->>'method', case when v_amount < v_price then 'deposit' else 'balance' end);
    end if;
  elsif v_type = 'appointment.status' then
    v_id := (p_command->>'id')::uuid; v_status := p_command->>'status';
    select * into v_old from public.nail_appointments where owner_id = v_owner and id = v_id;
    if not found then raise exception using errcode = '22023', message = 'INVALID_APPOINTMENT'; end if;
    v_confirm := coalesce((p_command->>'overlapConfirmed')::boolean, false);
    if v_status in ('scheduled','completed') and v_old.status in ('cancelled','absent') then
      select exists(select 1 from public.nail_appointments a where a.owner_id = v_owner and a.id <> v_id and a.appointment_date = v_old.appointment_date and a.status in ('scheduled','completed')
        and extract(epoch from a.start_time)/60 < extract(epoch from v_old.start_time)/60 + v_old.duration
        and extract(epoch from a.start_time)/60 + a.duration > extract(epoch from v_old.start_time)/60) into v_has_overlap;
      if v_has_overlap and not v_confirm then raise exception 'OVERLAP'; end if;
    end if;
    update public.nail_appointments set status = v_status, overlap_confirmed = case when v_confirm then true else overlap_confirmed end, updated_at = now() where owner_id = v_owner and id = v_id;
  elsif v_type = 'payment.add' then
    v_payment := p_command->'payment'; v_id := (v_payment->>'appointmentId')::uuid;
    select * into v_old from public.nail_appointments where owner_id = v_owner and id = v_id;
    if not found then raise exception using errcode = '22023', message = 'INVALID_APPOINTMENT'; end if;
    if v_old.status not in ('scheduled','completed') then raise exception 'INACTIVE_APPOINTMENT'; end if;
    select coalesce(sum(amount),0) into v_paid from public.nail_payments where owner_id = v_owner and appointment_id = v_id;
    v_amount := (v_payment->>'amount')::integer;
    if v_paid + v_amount > v_old.price then raise exception 'PAYMENT_EXCEEDS_TOTAL'; end if;
    insert into public.nail_payments(owner_id, id, appointment_id, amount, payment_date, method, kind)
      values(v_owner, (v_payment->>'id')::uuid, v_id, v_amount, (v_payment->>'date')::date, v_payment->>'method', case when v_paid = 0 and v_amount < v_old.price then 'deposit' else 'balance' end);
  elsif v_type = 'expense.add' then
    v_data := p_command->'expense';
    insert into public.nail_expenses(owner_id, id, description, amount, expense_date, category, method)
      values(v_owner, (v_data->>'id')::uuid, trim(v_data->>'description'), (v_data->>'amount')::integer, (v_data->>'date')::date, v_data->>'category', v_data->>'method');
  elsif v_type = 'availability.save' then
    if jsonb_typeof(p_command->'days') <> 'array' or jsonb_array_length(p_command->'days') not between 1 and 366 then raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY'; end if;
    for v_item in select value from jsonb_array_elements(p_command->'days') loop
      if jsonb_typeof(v_item->'times') <> 'array' then raise exception using errcode = '22023', message = 'INVALID_TIMES'; end if;
      select coalesce(array_agg(t order by t),'{}'::text[]) into v_times from jsonb_array_elements_text(v_item->'times') t;
      if exists(select 1 from unnest(v_times) t where t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') or cardinality(v_times) <> (select count(distinct t) from unnest(v_times) t) then raise exception using errcode = '22023', message = 'INVALID_TIMES'; end if;
      insert into public.nail_availability(owner_id, available_date, times) values(v_owner, (v_item->>'date')::date, v_times)
        on conflict (owner_id, available_date) do update set times = excluded.times;
    end loop;
  elsif v_type = 'business.save' then
    v_data := p_command->'business';
    update public.nail_accounts set business_name = trim(v_data->>'name'), professional = trim(v_data->>'professional'), phone = v_data->>'phone' where owner_id = v_owner;
  else
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;
  update public.nail_accounts set revision = revision + 1 where owner_id = v_owner;
  insert into public.nail_requests(owner_id, request_id, command) values(v_owner, p_request_id, p_command);
  return public.nail_read_workspace();
end $$;

revoke all on function public.nail_read_workspace() from public, anon;
revoke all on function public.nail_apply_command(uuid,bigint,jsonb) from public, anon;
grant execute on function public.nail_read_workspace() to authenticated;
grant execute on function public.nail_apply_command(uuid,bigint,jsonb) to authenticated;

comment on function public.nail_apply_command(uuid,bigint,jsonb) is 'Owner-only transactional commands. All writes require a provisioned active account; no service-role key is used by the app.';
commit;
