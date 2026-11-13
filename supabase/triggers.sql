CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role user_role := 'recepcao';
  v_name TEXT;
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    v_role := (NEW.raw_user_meta_data->>'role')::user_role;
  ELSIF NEW.email LIKE '%recepcao%' THEN
    v_role := 'recepcao';
  ELSIF NEW.email LIKE '%enfermagem%' THEN
    v_role := 'enfermagem';
  ELSIF NEW.email LIKE '%medico%' THEN
    v_role := 'medico';
  ELSIF NEW.email LIKE '%gestao%' THEN
    v_role := 'gestao';
  ELSIF NEW.email LIKE '%painel%' THEN
    v_role := 'painel';
  END IF;

  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, v_name, v_role)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
