import { Navigate, Outlet, useLocation } from 'react-router'
import type { Papel } from '@vulncase/compartilhado'
import { Carregando } from '../componentes/estado'
import { useSessao } from './sessao'

/** Exige sessão; sem ela, leva à tela de entrada guardando o destino. */
export function RotaProtegida() {
  const { usuario, carregando } = useSessao()
  const local = useLocation()
  if (carregando) return <Carregando tela />
  if (!usuario)
    return <Navigate to="/entrar" replace state={{ destino: local.pathname + local.search }} />
  return <Outlet />
}

/**
 * Oculta telas não permitidas ao papel. É apenas usabilidade: a autorização real
 * é sempre verificada no back-end (RNF06).
 */
export function RotaPapel({ papeis }: { papeis: Papel[] }) {
  const { temPapel } = useSessao()
  if (!temPapel(...papeis)) return <Navigate to="/" replace />
  return <Outlet />
}
