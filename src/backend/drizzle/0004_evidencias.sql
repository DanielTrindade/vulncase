CREATE TABLE "evidencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"achado_id" uuid NOT NULL,
	"nome_original" varchar(255) NOT NULL,
	"nome_armazenado" varchar(64) NOT NULL,
	"tipo_conteudo" varchar(100) NOT NULL,
	"tamanho_bytes" bigint NOT NULL,
	"hash_sha256" char(64) NOT NULL,
	"descricao" varchar(500),
	"enviada_por_id" uuid NOT NULL,
	"enviada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidencias_tamanho_ck" CHECK ("evidencias"."tamanho_bytes" BETWEEN 1 AND 5242880)
);
--> statement-breakpoint
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_achado_id_achados_id_fk" FOREIGN KEY ("achado_id") REFERENCES "public"."achados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_enviada_por_id_usuarios_id_fk" FOREIGN KEY ("enviada_por_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evidencias_nome_armazenado_uq" ON "evidencias" USING btree ("nome_armazenado");--> statement-breakpoint
CREATE INDEX "evidencias_achado_idx" ON "evidencias" USING btree ("achado_id","enviada_em");