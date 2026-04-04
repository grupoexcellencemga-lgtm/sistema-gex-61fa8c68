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
  _resolved jsonb;
  _tmp_name text;
  _has_deleted_at boolean;
BEGIN
  _user_id := auth.uid();
  
  SELECT nome INTO _user_nome FROM public.profiles WHERE user_id = _user_id LIMIT 1;

  -- Check if the table has a deleted_at column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME AND column_name = 'deleted_at'
  ) INTO _has_deleted_at;

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
    IF _has_deleted_at AND (to_jsonb(OLD)->>'deleted_at') IS NULL AND (to_jsonb(NEW)->>'deleted_at') IS NOT NULL THEN
      _acao := 'excluir';
    ELSE
      _acao := 'editar';
    END IF;
    _registro_id := NEW.id;
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _row := _new;
  END IF;

  _registro_nome := COALESCE(
    _row->>'nome',
    _row->>'cliente_nome',
    _row->>'empresa_nome',
    _row->>'descricao',
    _row->>'titulo',
    _registro_id::text
  );

  _resolved := '{}'::jsonb;

  IF _row ? 'aluno_id' AND (_row->>'aluno_id') IS NOT NULL THEN
    BEGIN
      SELECT nome INTO _tmp_name FROM public.alunos WHERE id = (_row->>'aluno_id')::uuid;
      IF _tmp_name IS NOT NULL THEN
        _resolved := _resolved || jsonb_build_object('aluno_id__nome', _tmp_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF _row ? 'produto_id' AND (_row->>'produto_id') IS NOT NULL THEN
    BEGIN
      SELECT nome INTO _tmp_name FROM public.produtos WHERE id = (_row->>'produto_id')::uuid;
      IF _tmp_name IS NOT NULL THEN
        _resolved := _resolved || jsonb_build_object('produto_id__nome', _tmp_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF _row ? 'turma_id' AND (_row->>'turma_id') IS NOT NULL THEN
    BEGIN
      SELECT nome INTO _tmp_name FROM public.turmas WHERE id = (_row->>'turma_id')::uuid;
      IF _tmp_name IS NOT NULL THEN
        _resolved := _resolved || jsonb_build_object('turma_id__nome', _tmp_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF _row ? 'comercial_id' AND (_row->>'comercial_id') IS NOT NULL THEN
    BEGIN
      SELECT nome INTO _tmp_name FROM public.comerciais WHERE id = (_row->>'comercial_id')::uuid;
      IF _tmp_name IS NOT NULL THEN
        _resolved := _resolved || jsonb_build_object('comercial_id__nome', _tmp_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF _row ? 'profissional_id' AND (_row->>'profissional_id') IS NOT NULL THEN
    BEGIN
      SELECT nome INTO _tmp_name FROM public.profissionais WHERE id = (_row->>'profissional_id')::uuid;
      IF _tmp_name IS NOT NULL THEN
        _resolved := _resolved || jsonb_build_object('profissional_id__nome', _tmp_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF _row ? 'categoria_id' AND (_row->>'categoria_id') IS NOT NULL THEN
    BEGIN
      SELECT nome INTO _tmp_name FROM public.categorias_despesas WHERE id = (_row->>'categoria_id')::uuid;
      IF _tmp_name IS NOT NULL THEN
        _resolved := _resolved || jsonb_build_object('categoria_id__nome', _tmp_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF _row ? 'conta_bancaria_id' AND (_row->>'conta_bancaria_id') IS NOT NULL THEN
    BEGIN
      SELECT nome INTO _tmp_name FROM public.contas_bancarias WHERE id = (_row->>'conta_bancaria_id')::uuid;
      IF _tmp_name IS NOT NULL THEN
        _resolved := _resolved || jsonb_build_object('conta_bancaria_id__nome', _tmp_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF _new IS NOT NULL AND _resolved != '{}'::jsonb THEN
    _new := _new || jsonb_build_object('_nomes', _resolved);
  END IF;
  IF _old IS NOT NULL AND _resolved != '{}'::jsonb THEN
    _old := _old || jsonb_build_object('_nomes', _resolved);
  END IF;

  INSERT INTO public.audit_logs (user_id, user_nome, acao, tabela, registro_id, registro_nome, dados_anteriores, dados_novos)
  VALUES (_user_id, _user_nome, _acao, TG_TABLE_NAME, _registro_id, _registro_nome, _old, _new);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;