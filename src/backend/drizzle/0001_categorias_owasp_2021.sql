-- Carga das categorias do OWASP Top 10 (edição 2021), adotada na disciplina.
-- A coluna "versao" permite incluir outra edição sem alterar achados já classificados.
INSERT INTO "categorias_owasp" ("id", "versao", "codigo", "nome") VALUES
	(1, '2021', 'A01', 'Broken Access Control'),
	(2, '2021', 'A02', 'Cryptographic Failures'),
	(3, '2021', 'A03', 'Injection'),
	(4, '2021', 'A04', 'Insecure Design'),
	(5, '2021', 'A05', 'Security Misconfiguration'),
	(6, '2021', 'A06', 'Vulnerable and Outdated Components'),
	(7, '2021', 'A07', 'Identification and Authentication Failures'),
	(8, '2021', 'A08', 'Software and Data Integrity Failures'),
	(9, '2021', 'A09', 'Security Logging and Monitoring Failures'),
	(10, '2021', 'A10', 'Server-Side Request Forgery (SSRF)');
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('categorias_owasp', 'id'), (SELECT max("id") FROM "categorias_owasp"));
