CREATE TABLE "achados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projeto_id" uuid NOT NULL,
	"codigo" varchar(10) NOT NULL,
	"titulo" varchar(160) NOT NULL,
	"descricao" text NOT NULL,
	"origem" varchar(30) NOT NULL,
	"severidade" varchar(15) NOT NULL,
	"status" varchar(25) DEFAULT 'Aberto' NOT NULL,
	"localizacao" varchar(500) NOT NULL,
	"impacto" text,
	"passos_reproducao" text,
	"correcao_proposta" text NOT NULL,
	"categoria_owasp_id" integer,
	"cwe_id" integer,
	"cve_id" varchar(20),
	"nota_cvss" numeric(3, 1),
	"responsavel_id" uuid,
	"registrado_por_id" uuid NOT NULL,
	"data_limite" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"encerrado_em" timestamp with time zone,
	"versao" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "achados_cwe_ck" CHECK ("achados"."cwe_id" > 0),
	CONSTRAINT "achados_cve_ck" CHECK ("achados"."cve_id" ~ '^CVE-[0-9]{4}-[0-9]{4,}$'),
	CONSTRAINT "achados_cvss_ck" CHECK ("achados"."nota_cvss" BETWEEN 0 AND 10),
	CONSTRAINT "achados_descricao_ck" CHECK (char_length("achados"."descricao") <= 10000),
	CONSTRAINT "achados_impacto_ck" CHECK (char_length("achados"."impacto") <= 4000),
	CONSTRAINT "achados_passos_ck" CHECK (char_length("achados"."passos_reproducao") <= 10000),
	CONSTRAINT "achados_correcao_ck" CHECK (char_length("achados"."correcao_proposta") <= 10000),
	CONSTRAINT "achados_origem_ck" CHECK ("achados"."origem" IN ('AnaliseRede', 'TesteAplicacaoWeb', 'TesteAplicacaoMovel', 'RevisaoCodigo', 'AnaliseConfiguracao', 'Outra')),
	CONSTRAINT "achados_severidade_ck" CHECK ("achados"."severidade" IN ('Critica', 'Alta', 'Media', 'Baixa', 'Informativa')),
	CONSTRAINT "achados_status_ck" CHECK ("achados"."status" IN ('Aberto', 'EmCorrecao', 'AguardandoVerificacao', 'Corrigido', 'FalsoPositivo', 'RiscoAceito')),
	CONSTRAINT "achados_versao_ck" CHECK ("achados"."versao" >= 1)
);
--> statement-breakpoint
CREATE TABLE "categorias_owasp" (
	"id" serial PRIMARY KEY NOT NULL,
	"versao" varchar(10) NOT NULL,
	"codigo" varchar(10) NOT NULL,
	"nome" varchar(120) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eventos_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"achado_id" uuid NOT NULL,
	"autor_id" uuid NOT NULL,
	"tipo" varchar(30) NOT NULL,
	"campo" varchar(50),
	"valor_anterior" text,
	"valor_novo" text,
	"justificativa" text,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eventos_historico_tipo_ck" CHECK ("eventos_historico"."tipo" IN ('Criacao', 'EdicaoCampo', 'TrocaResponsavel', 'Transicao', 'EvidenciaAdicionada', 'EvidenciaRemovida', 'Comentario'))
);
--> statement-breakpoint
CREATE TABLE "projetos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prefixo" varchar(5) NOT NULL,
	"nome" varchar(120) NOT NULL,
	"descricao" text,
	"responsavel_tecnico_id" uuid NOT NULL,
	"arquivado" boolean DEFAULT false NOT NULL,
	"proximo_numero_achado" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projetos_prefixo_ck" CHECK ("projetos"."prefixo" ~ '^[A-Z]{2,5}$'),
	CONSTRAINT "projetos_descricao_ck" CHECK (char_length("projetos"."descricao") <= 4000),
	CONSTRAINT "projetos_proximo_numero_ck" CHECK ("projetos"."proximo_numero_achado" >= 1)
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" char(64) NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"ip" varchar(64),
	"user_agent" varchar(512)
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"papel" varchar(20) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"tentativas_falhas" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_papel_ck" CHECK ("usuarios"."papel" IN ('Administrador', 'Analista', 'Desenvolvedor'))
);
--> statement-breakpoint
ALTER TABLE "achados" ADD CONSTRAINT "achados_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achados" ADD CONSTRAINT "achados_categoria_owasp_id_categorias_owasp_id_fk" FOREIGN KEY ("categoria_owasp_id") REFERENCES "public"."categorias_owasp"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achados" ADD CONSTRAINT "achados_responsavel_id_usuarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achados" ADD CONSTRAINT "achados_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_historico" ADD CONSTRAINT "eventos_historico_achado_id_achados_id_fk" FOREIGN KEY ("achado_id") REFERENCES "public"."achados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_historico" ADD CONSTRAINT "eventos_historico_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_responsavel_tecnico_id_usuarios_id_fk" FOREIGN KEY ("responsavel_tecnico_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achados_codigo_uq" ON "achados" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "achados_projeto_status_severidade_idx" ON "achados" USING btree ("projeto_id","status","severidade");--> statement-breakpoint
CREATE INDEX "achados_responsavel_status_idx" ON "achados" USING btree ("responsavel_id","status");--> statement-breakpoint
CREATE INDEX "achados_data_limite_abertos_idx" ON "achados" USING btree ("data_limite") WHERE "achados"."encerrado_em" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_owasp_versao_codigo_uq" ON "categorias_owasp" USING btree ("versao","codigo");--> statement-breakpoint
CREATE INDEX "eventos_historico_achado_ocorrido_idx" ON "eventos_historico" USING btree ("achado_id","ocorrido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "projetos_prefixo_uq" ON "projetos" USING btree ("prefixo");--> statement-breakpoint
CREATE UNIQUE INDEX "sessoes_token_hash_uq" ON "sessoes" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_normalizado_uq" ON "usuarios" USING btree (lower("email"));