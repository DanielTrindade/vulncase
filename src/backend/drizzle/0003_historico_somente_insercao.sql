-- A07: o histórico só recebe inserções. Qualquer UPDATE, DELETE ou TRUNCATE é recusado
-- pelo próprio banco, mesmo que a aplicação tente.
CREATE FUNCTION eventos_historico_somente_insercao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'eventos_historico aceita apenas inserções'
		USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER eventos_historico_bloqueia_alteracao
	BEFORE UPDATE OR DELETE ON eventos_historico
	FOR EACH ROW EXECUTE FUNCTION eventos_historico_somente_insercao();
--> statement-breakpoint
CREATE TRIGGER eventos_historico_bloqueia_truncate
	BEFORE TRUNCATE ON eventos_historico
	FOR EACH STATEMENT EXECUTE FUNCTION eventos_historico_somente_insercao();
