-- Tabla para almacenar tokens de notificaciones push de dispositivos móviles
create table if not exists public.push_tokens (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid references auth.users(id) on delete cascade not null,
    token text not null,
    plataforma text not null check (plataforma in ('android', 'ios', 'web')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(usuario_id, token)
);

-- RLS habilitado
alter table public.push_tokens enable row level security;

-- Políticas RLS
create policy "Usuarios pueden ver sus propios tokens"
    on public.push_tokens for select
    using (auth.uid() = usuario_id);

create policy "Usuarios pueden insertar sus propios tokens"
    on public.push_tokens for insert
    with check (auth.uid() = usuario_id);

create policy "Usuarios pueden actualizar sus propios tokens"
    on public.push_tokens for update
    using (auth.uid() = usuario_id);

create policy "Usuarios pueden eliminar sus propios tokens"
    on public.push_tokens for delete
    using (auth.uid() = usuario_id);

-- Función con SECURITY DEFINER y search_path fijo para registrar token
create or replace function public.registrar_push_token(
    p_token text,
    p_plataforma text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Usuario no autenticado';
    end if;

    insert into public.push_tokens (usuario_id, token, plataforma, updated_at)
    values (auth.uid(), p_token, p_plataforma, now())
    on conflict (usuario_id, token)
    do update set updated_at = now();
end;
$$;
