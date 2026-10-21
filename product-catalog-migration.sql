-- Saved brand/group names; no customer or existing product rows are modified.
create table public.product_catalog_entries (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null default private.current_company_id() references public.companies(id) on delete cascade,
 kind text not null check (kind in ('brand','group')),
 name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
 created_at timestamptz not null default now()
);
create unique index product_catalog_entries_company_kind_name_key
 on public.product_catalog_entries(company_id,kind,lower(btrim(name)));
alter table public.product_catalog_entries enable row level security;
revoke all on table public.product_catalog_entries from public,anon,authenticated;
grant select,insert,update,delete on table public.product_catalog_entries to authenticated;
create policy product_catalog_read on public.product_catalog_entries
 for select to authenticated
 using (company_id = (select private.current_company_id()) and (select auth.uid()) is not null and (select private.helion_access('products')));
create policy product_catalog_insert on public.product_catalog_entries
 for insert to authenticated
 with check (company_id = (select private.current_company_id()) and (select auth.uid()) is not null and (select private.helion_access('products')) and (select private.helion_is_admin()));
create policy product_catalog_update on public.product_catalog_entries
 for update to authenticated
 using (company_id = (select private.current_company_id()) and (select auth.uid()) is not null and (select private.helion_access('products')) and (select private.helion_is_admin()))
 with check (company_id = (select private.current_company_id()) and (select auth.uid()) is not null and (select private.helion_access('products')) and (select private.helion_is_admin()));
create policy product_catalog_delete on public.product_catalog_entries
 for delete to authenticated
 using (company_id = (select private.current_company_id()) and (select auth.uid()) is not null and (select private.helion_access('products')) and (select private.helion_is_admin()));
comment on table public.product_catalog_entries is 'Tenant-scoped saved brands and product groups. Product text fields and imported values stay unchanged.';
notify pgrst,'reload schema';
