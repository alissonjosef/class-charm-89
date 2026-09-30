-- A senha do master é fixa: nem ele mesmo nem ninguém pode alterá-la.
CREATE OR REPLACE FUNCTION public.reset_user_password(_user_id UUID, _new_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Somente o usuário master pode redefinir senhas';
  END IF;
  IF public.is_master(_user_id) THEN
    RAISE EXCEPTION 'A senha do usuário master não pode ser alterada';
  END IF;
  IF length(_new_password) < 6 OR length(_new_password) > 72 THEN
    RAISE EXCEPTION 'A senha precisa ter entre 6 e 72 caracteres';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = _user_id;

  DELETE FROM auth.sessions WHERE user_id = _user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_user_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_user_password(uuid, text) TO authenticated;

-- Bloqueia também a troca pela própria conta (Auth "update user" / recuperação de senha).
DROP TRIGGER IF EXISTS auth_users_protect_master_password ON auth.users;
CREATE TRIGGER auth_users_protect_master_password
BEFORE UPDATE OF encrypted_password ON auth.users
FOR EACH ROW WHEN (public.is_master(OLD.id) AND NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password)
EXECUTE FUNCTION public.protect_master();
