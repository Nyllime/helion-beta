-- Proposed compatibility patch. Existing RLS and table grants are unchanged.
-- Only manager-authorized, same-company accounting metadata is writable via the RPC.
BEGIN;
CREATE OR REPLACE FUNCTION private.helion_expense_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare actor uuid; cs public.cash_sessions; f public.finance_entries;
begin
select id into actor from public.employee_profiles where auth_user_id=auth.uid() and active;
if actor is null or new.company_id is distinct from private.current_company_id() then raise exception 'Acesso inválido.'; end if;
-- Report metadata can change without reviewing or rewriting the expense.
if TG_OP='UPDATE'
 and new.accounting_include is distinct from old.accounting_include
 and (to_jsonb(new)-'accounting_include') is not distinct from (to_jsonb(old)-'accounting_include') then
 if not private.helion_cash_reviewer() then raise exception 'Somente o Gestor pode alterar a decisão contábil.';end if;
 return new;
end if;
if TG_OP='INSERT' then
if new.status<>'pending' or new.requested_by<>actor or new.reviewed_at is not null or new.reviewed_by is not null or new.review_notes is not null then raise exception 'A saída deve começar aguardando aprovação.'; end if;
if new.expense_date>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Para saídas futuras, cadastre uma conta a pagar no Financeiro.'; end if;
if new.session_id is not null then select * into cs from public.cash_sessions where id=new.session_id and company_id=new.company_id and opened_by=actor and closed_at is null for update; if cs.id is null then raise exception 'Caixa inválido ou fechado.'; end if; end if;
if new.method='Dinheiro' and new.session_id is null then raise exception 'Abra o seu Caixa para solicitar saída em dinheiro.'; end if;
if new.finance_id is not null then select * into f from public.finance_entries where id=new.finance_id and company_id=new.company_id and entry_type='payable'; if f.id is null or f.paid_at is not null or new.amount>f.amount-f.paid_amount then raise exception 'Conta a pagar inválida ou valor maior que o saldo.'; end if; end if;
else
if not private.helion_cash_reviewer() or old.status<>'pending' or new.status not in('approved','rejected') then raise exception 'Somente o Gestor pode aprovar ou recusar uma solicitação pendente.'; end if;
if (to_jsonb(new)-array['status','reviewed_by','reviewed_at','review_notes']) is distinct from (to_jsonb(old)-array['status','reviewed_by','reviewed_at','review_notes']) then raise exception 'A solicitação original não pode ser alterada.'; end if;
if new.status='rejected' and nullif(trim(new.review_notes),'') is null then raise exception 'Explique o motivo da recusa.'; end if;
new.reviewed_by:=actor;new.reviewed_at:=now();
end if;
return new;
end $function$
;
CREATE OR REPLACE FUNCTION private.helion_expense_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare f public.finance_entries; fid uuid; available numeric; cs public.cash_sessions;
begin
-- A flag-only edit must never replay approval or post a second payment.
if TG_OP='UPDATE'
 and new.accounting_include is distinct from old.accounting_include
 and (to_jsonb(new)-'accounting_include') is not distinct from (to_jsonb(old)-'accounting_include') then
 insert into public.audit_logs(company_id,employee_id,action,entity_type,entity_id,new_data)
 values(new.company_id,private.helion_employee_id(),'Decisão contábil atualizada','cash_expense',new.id,
 jsonb_build_object('accounting_include_before',old.accounting_include,'accounting_include_after',new.accounting_include));
 return new;
end if;
if new.status='approved' then
if new.session_id is not null then select * into cs from public.cash_sessions where id=new.session_id and company_id=new.company_id for update; if cs.closed_at is not null then raise exception 'O Caixa foi fechado; recuse esta solicitação e registre novamente.'; end if; end if;
if new.method='Dinheiro' then select cs.opening_amount+coalesce(sum(case when kind='withdrawal' then -amount else amount end),0) into available from public.cash_events where session_id=cs.id and method='Dinheiro'; if new.amount>available then raise exception 'Dinheiro insuficiente na gaveta para esta saída.'; end if; end if;
if new.finance_id is null then
insert into public.finance_entries(company_id,entry_type,description,amount,due_date,paid_amount,paid_at,category,counterparty,reference,document_type,document_number,accounting_date,accounting_method,recorded_by,accounting_include)
values(new.company_id,'payable',new.reason,new.amount,new.expense_date,0,null,'Saída aprovada do Caixa',new.counterparty,new.reference,new.document_type,new.document_number,new.expense_date,new.method,new.requested_by,new.accounting_include) returning id into fid;
else fid:=new.finance_id; update public.finance_entries set accounting_include=new.accounting_include where id=fid and company_id=new.company_id; end if;
select * into f from public.finance_entries where id=fid and company_id=new.company_id and entry_type='payable' for update;
if f.id is null or f.paid_at is not null or new.amount>f.amount-f.paid_amount then raise exception 'O saldo desta conta mudou. Confira antes de aprovar.'; end if;
insert into public.finance_payments(company_id,entry_id,amount,method,performed_by,expense_request_id) values(new.company_id,fid,new.amount,new.method,new.reviewed_by,new.id);
update public.finance_entries set paid_amount=paid_amount+new.amount,paid_at=case when paid_amount+new.amount=amount then now() end where id=fid;
if new.session_id is not null then insert into public.cash_events(company_id,session_id,finance_id,kind,amount,method,reason,performed_by,expense_request_id) values(new.company_id,new.session_id,fid,'withdrawal',new.amount,new.method,new.reason,new.reviewed_by,new.id); end if;
end if;
insert into public.audit_logs(company_id,employee_id,action,entity_type,entity_id) values(new.company_id,coalesce(new.reviewed_by,new.requested_by),case when TG_OP='INSERT' then 'Saída aguardando aprovação' when new.status='approved' then 'Saída aprovada' else 'Saída recusada' end,'cash_expense',new.id);
return new;
end $function$
;
CREATE OR REPLACE FUNCTION private.helion_accounting_include(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare
 cid uuid:=private.current_company_id();
 actor uuid:=private.helion_employee_id();
 eid uuid;
 target text:=payload->>'entity';
 flag boolean;
 previous boolean;
begin
 if auth.uid() is null or cid is null or actor is null then raise exception 'Sessão inválida.';end if;
 if not private.helion_cash_reviewer() then raise exception 'Somente o Gestor pode alterar a decisão contábil.';end if;
 if jsonb_typeof(payload->'include') is distinct from 'boolean' then raise exception 'Informe Sim ou Não para a contabilidade.';end if;
 if target is null or target not in ('finance','expense') then raise exception 'Lançamento contábil inválido.';end if;
 eid:=nullif(payload->>'id','')::uuid;
 flag:=(payload->>'include')::boolean;
 if eid is null then raise exception 'Informe o lançamento contábil.';end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,0));
 if target='expense' then
  select accounting_include into previous from public.cash_expense_requests where id=eid and company_id=cid for update;
  if not found then raise exception 'Lançamento não encontrado nesta empresa.';end if;
  if previous is distinct from flag then
   update public.cash_expense_requests set accounting_include=flag where id=eid and company_id=cid;
  end if;
 else
  select accounting_include into previous from public.finance_entries where id=eid and company_id=cid for update;
  if not found then raise exception 'Lançamento não encontrado nesta empresa.';end if;
  if previous is distinct from flag then
   update public.finance_entries set accounting_include=flag where id=eid and company_id=cid;
   insert into public.audit_logs(company_id,employee_id,action,entity_type,entity_id,new_data)
   values(cid,actor,'Decisão contábil atualizada','finance_entry',eid,
   jsonb_build_object('accounting_include_before',previous,'accounting_include_after',flag));
  end if;
 end if;
 return jsonb_build_object('id',eid,'entity',target,'accounting_include',flag,'changed',previous is distinct from flag);
end $function$;

REVOKE ALL ON FUNCTION private.helion_accounting_include(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.helion_accounting_include(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.helion_accounting_include(payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT private.helion_accounting_include(payload) $function$;
REVOKE ALL ON FUNCTION public.helion_accounting_include(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.helion_accounting_include(jsonb) TO authenticated, service_role;

COMMIT;

