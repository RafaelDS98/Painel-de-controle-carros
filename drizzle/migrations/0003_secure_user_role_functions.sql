CREATE OR REPLACE FUNCTION public.list_users_with_roles()
 RETURNS TABLE(user_id uuid, full_name text, email text, role app_role, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Apenas master pode ver usuários'; END IF;
  RETURN QUERY SELECT u.id, p.full_name, u.email::text, r.role, u.created_at
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id LEFT JOIN public.user_roles r ON r.user_id = u.id
    ORDER BY u.created_at;
END $function$;

CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN RAISE EXCEPTION 'Apenas master pode alterar perfis'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Você não pode alterar o seu próprio perfil'; END IF;
  IF _role IS NULL THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role <> _role;
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role) ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.list_users_with_roles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, app_role) TO authenticated;