
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _user_nome text;
  _acao text;
  _registro_id uuid;
  _registro_nome text;
  _old jsonb;
  _new jsonb;
  _row jsonb;
BEGIN
  _user_id := auth.uid();
  
  SELECT nome INTO _user_nome FROM public.profiles WHERE user_id = _user_id LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    _acao := 'excluir';
    _registro_id := OLD.id;
    _old := to_jsonb(OLD);
    _new := NULL;
    _row := _old;
  ELSIF TG_OP = 'INSERT' THEN
    _acao := 'criar';
    _registro_id := NEW.id;
    _old := NULL;
    _new := to_jsonb(NEW);
    _row := _new;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      _acao := 'excluir';
    ELSE
      _acao := 'editar';
    END IF;
    _registro_id := NEW.id;
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _row := _new;
  END IF;

  -- Use jsonb to safely get name fields without column errors
  _registro_nome := COALESCE(
    _row->>'nome',
    _row->>'cliente_nome',
    _row->>'empresa_nome',
    _row->>'descricao',
    _row->>'titulo',
    _registro_id::text
  );

  INSERT INTO public.audit_logs (user_id, user_nome, acao, tabela, registro_id, registro_nome, dados_anteriores, dados_novos)
  VALUES (_user_id, _user_nome, _acao, TG_TABLE_NAME, _registro_id, _registro_nome, _old, _new);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
