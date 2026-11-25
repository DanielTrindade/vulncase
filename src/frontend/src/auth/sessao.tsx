import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Papel } from '@vulncase/compartilhado'
import { api, enviar, ErroApi, EVENTO_NAO_AUTENTICADO, ler } from '../api/cliente'

export interface Usuario {
  id: string
  nome: string
  email: string
  papel: Papel
}

interface ValorSessao {
  usuario: Usuario | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<Usuario>
  sair: () => Promise<void>
  temPapel: (...papeis: Papel[]) => boolean
}

const ContextoSessao = createContext<ValorSessao | null>(null)

const CHAVE_SESSAO = ['sessao'] as const

async function buscarSessao(): Promise<Usuario | null> {
  try {
    const { usuario } = await ler(api.api.auth.me.$get())
    return usuario
  } catch (err) {
    if (err instanceof ErroApi && err.status === 401) return null
    throw err
  }
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const consulta = useQuery({ queryKey: CHAVE_SESSAO, queryFn: buscarSessao, staleTime: 60_000 })

  // Qualquer 401 da API encerra a sessão local e leva à tela de entrada.
  useEffect(() => {
    const aoPerderSessao = () => {
      if (queryClient.getQueryData(CHAVE_SESSAO)) {
        queryClient.setQueryData(CHAVE_SESSAO, null)
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== CHAVE_SESSAO[0] })
      }
    }
    window.addEventListener(EVENTO_NAO_AUTENTICADO, aoPerderSessao)
    return () => window.removeEventListener(EVENTO_NAO_AUTENTICADO, aoPerderSessao)
  }, [queryClient])

  const entrar = useMutation({
    mutationFn: async ({ email, senha }: { email: string; senha: string }) =>
      (await ler(api.api.auth.login.$post({ json: { email, senha } }))).usuario,
    onSuccess: (usuario) => {
      queryClient.clear()
      queryClient.setQueryData(CHAVE_SESSAO, usuario)
    },
  })

  const sair = useMutation({
    mutationFn: () => enviar(api.api.auth.logout.$post()),
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData(CHAVE_SESSAO, null)
    },
  })

  const usuario = consulta.data ?? null
  const valor = useMemo<ValorSessao>(
    () => ({
      usuario,
      carregando: consulta.isPending,
      entrar: (email, senha) => entrar.mutateAsync({ email, senha }),
      sair: () => sair.mutateAsync(),
      temPapel: (...papeis) => usuario !== null && papeis.includes(usuario.papel),
    }),
    // As funções de mutação do TanStack Query são estáveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usuario, consulta.isPending],
  )

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}

export function useSessao(): ValorSessao {
  const valor = useContext(ContextoSessao)
  if (!valor) throw new Error('useSessao deve ser usado dentro de ProvedorSessao')
  return valor
}

/** Usuário autenticado; só use dentro de rotas protegidas. */
export function useUsuario(): Usuario {
  const { usuario } = useSessao()
  if (!usuario) throw new Error('useUsuario fora de rota protegida')
  return usuario
}
