-- HENRINEWS - PATCH DE PERFIS AUTOMÁTICOS POR DOMÍNIO DE E-MAIL
-- Execute este arquivo no SQL Editor se você já executou o database.sql anteriormente.

begin;

create or replace function public.role_from_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
    select case
        when lower(split_part(coalesce(p_email, ''), '@', 2)) = 'prof.educacao.sp.gov.br' then 'admin'
        else 'student'
    end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, full_name, email, role)
    values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'Aluno'), '@', 1)),
        new.email,
        public.role_from_email(new.email)
    )
    on conflict (id) do update
       set full_name = excluded.full_name,
           email = excluded.email,
           role = excluded.role;
    return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.profiles
       set email = new.email,
           role = public.role_from_email(new.email)
     where id = new.id;
    return new;
end;
$$;

-- Atualiza perfis que já existem para obedecer à nova regra.
update public.profiles
   set role = public.role_from_email(email);

commit;
