import { Hono } from 'hono'
import { asc } from 'drizzle-orm'
import type { Ambiente } from '../ambiente.js'
import { categoriasOwasp } from '../db/schema.js'

/** Catálogo de categorias do OWASP Top 10 (RF14). */
export const rotasCategorias = new Hono<Ambiente>().get('/', async (c) => {
  const itens = await c
    .get('deps')
    .db.select()
    .from(categoriasOwasp)
    .orderBy(asc(categoriasOwasp.versao), asc(categoriasOwasp.codigo))
  return c.json({ itens }, 200)
})
