CREATE TABLE "ativos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projeto_id" uuid NOT NULL,
	"nome" varchar(120) NOT NULL,
	"tipo" varchar(30) NOT NULL,
	"identificador" varchar(500) NOT NULL,
	"ambiente" varchar(20) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ativos_tipo_ck" CHECK ("ativos"."tipo" IN ('AplicacaoWeb', 'Api', 'AplicativoMovel', 'Servidor', 'ServicoRede', 'RepositorioCodigo', 'Outro')),
	CONSTRAINT "ativos_ambiente_ck" CHECK ("ativos"."ambiente" IN ('Desenvolvimento', 'Homologacao', 'Producao', 'Laboratorio'))
);
--> statement-breakpoint
ALTER TABLE "achados" ADD COLUMN "ativo_id" uuid;--> statement-breakpoint
ALTER TABLE "ativos" ADD CONSTRAINT "ativos_projeto_id_projetos_id_fk" FOREIGN KEY ("projeto_id") REFERENCES "public"."projetos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ativos_id_projeto_uq" ON "ativos" USING btree ("id","projeto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ativos_projeto_nome_uq" ON "ativos" USING btree ("projeto_id","nome");--> statement-breakpoint
ALTER TABLE "achados" ADD CONSTRAINT "achados_ativo_mesmo_projeto_fk" FOREIGN KEY ("ativo_id","projeto_id") REFERENCES "public"."ativos"("id","projeto_id") ON DELETE no action ON UPDATE no action;