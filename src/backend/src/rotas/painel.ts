import { Hono } from 'hono'
import type { Ambiente } from '../ambiente.js'
import { painelGeral } from '../servicos/painel.js'

export const rotasPainel = new Hono<Ambiente>().get('/', async (c) =>
  c.json(await painelGeral(c.get('deps').db), 200),
)
