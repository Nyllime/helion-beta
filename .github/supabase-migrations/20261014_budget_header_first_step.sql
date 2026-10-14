create or replace function private.helion_document_header(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  cid uuid := private.current_company_id();
  actor uuid := private.helion_employee_id();
  client_id uuid := nullif(payload->>'client_id','')::uuid;
  seller_id uuid := nullif(payload->>'seller_id','')::uuid;
  result uuid;
begin
  if auth.uid() is null or actor is null then
    raise exception 'Sessão inválida.';
  end if;
  perform private.helion_require_document('budget', null);
  if cid is null or not private.helion_access('budgets') then
    raise exception 'Sem permissão para criar orçamento.';
  end if;
  if payload is null or jsonb_typeof(payload) is distinct from 'object'
     or nullif(payload->>'id','') is not null
     or payload ? 'items'
     or coalesce(nullif(payload->>'discount','')::numeric,0) <> 0 then
    raise exception 'Dados inválidos para o cabeçalho do orçamento.';
  end if;
  if client_id is null or not exists (
    select 1 from public.clients c
    where c.id=client_id and c.company_id=cid
  ) then
    raise exception 'Selecione um cliente válido.';
  end if;
  if seller_id is null or not exists (
    select 1 from public.employee_profiles e
    where e.id=seller_id and e.company_id=cid and e.active
  ) then
    raise exception 'Selecione um responsável válido.';
  end if;
  if not private.helion_is_admin() and seller_id is distinct from actor then
    raise exception 'Use seu próprio responsável.';
  end if;
  if nullif(payload->>'valid_until','') is null then
    raise exception 'Informe a validade.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(cid::text,0));
  insert into public.budgets(
    company_id, client_id, seller_id, status, valid_until,
    subtotal, total, commercial_type, commercial_percent, notes
  ) values (
    cid, client_id, seller_id, 'draft', (payload->>'valid_until')::date,
    0, 0, 'discount_amount', 0, nullif(trim(payload->>'notes'),'')
  ) returning id into result;

  insert into public.audit_logs(company_id,employee_id,action,entity_type,entity_id,new_data)
  values(cid,actor,'budget_header_saved','budget',result,jsonb_build_object('stage','header'));

  return result;
end
$function$;

create or replace function public.helion_document_header(payload jsonb)
returns uuid
language sql
set search_path to ''
as $function$
  select private.helion_document_header(payload)
$function$;

revoke all on function private.helion_document_header(jsonb) from public, anon;
grant execute on function private.helion_document_header(jsonb) to authenticated;
revoke all on function public.helion_document_header(jsonb) from public, anon;
grant execute on function public.helion_document_header(jsonb) to authenticated;