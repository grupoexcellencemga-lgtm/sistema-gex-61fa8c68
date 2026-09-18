CREATE OR REPLACE FUNCTION public.criar_protocolo(p_empresa_id uuid, p_lead_id uuid, p_atendente_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_numero text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.current_user_is_admin_master() OR EXISTS (
      SELECT 1 FROM public.user_empresa WHERE user_id = auth.uid() AND empresa_id = p_empresa_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem acesso à empresa' USING ERRCODE = '42501';
  END IF;
  IF p_atendente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_empresa WHERE user_id = p_atendente_id AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Responsável não pertence à empresa' USING ERRCODE = '42501';
  END IF;
  -- Serializa assumir/atribuir o mesmo lead e valida sua empresa.
  PERFORM 1 FROM public.leads WHERE id = p_lead_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead não encontrado nesta empresa'; END IF;

  SELECT id, numero_protocolo INTO v_id, v_numero
  FROM public.protocolos_atendimento
  WHERE lead_id = p_lead_id AND empresa_id = p_empresa_id AND status = 'ativo'
  ORDER BY iniciado_em, id LIMIT 1 FOR UPDATE;

  IF v_id IS NOT NULL THEN
    UPDATE public.protocolos_atendimento SET atendente_id = p_atendente_id WHERE id = v_id;
    RETURN json_build_object('id', v_id, 'numero_protocolo', v_numero);
  END IF;

  v_numero := 'P' || LPAD(nextval('public.protocolo_numero_seq'::regclass)::text, 6, '0');
  INSERT INTO public.protocolos_atendimento (empresa_id, lead_id, atendente_id, numero_protocolo, status)
  VALUES (p_empresa_id, p_lead_id, p_atendente_id, v_numero, 'ativo')
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id, 'numero_protocolo', v_numero);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.criar_protocolo(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_protocolo(uuid,uuid,uuid) TO authenticated, service_role;
