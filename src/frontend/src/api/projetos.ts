import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { EntradaAtivo, EntradaProjeto } from '@vulncase/compartilhado'
import { api, ler } from './cliente'

export const chavesProjetos = {
  todos: ['projetos'] as const,
  lista: (arquivados: boolean) => [...chavesProjetos.todos, 'lista', { arquivados }] as const,
  detalhe: (id: string) => [...chavesProjetos.todos, 'detalhe', id] as const,
}

export function useProjetos(arquivados = false) {
  return useQuery({
    queryKey: chavesProjetos.lista(arquivados),
    queryFn: async () =>
      (
        await ler(
          api.api.projetos.$get({ query: { arquivados: String(arquivados) as 'true' | 'false' } }),
        )
      ).itens,
  })
}

export type Projeto = NonNullable<ReturnType<typeof useProjetos>['data']>[number]

export function useProjeto(id: string | undefined) {
  return useQuery({
    queryKey: chavesProjetos.detalhe(id ?? ''),
    queryFn: () => ler(api.api.projetos[':id'].$get({ param: { id: id! } })),
    enabled: !!id,
  })
}

export function useSalvarProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: EntradaProjeto }) =>
      id
        ? ler(api.api.projetos[':id'].$put({ param: { id }, json: dados }))
        : ler(api.api.projetos.$post({ json: dados })),
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesProjetos.todos }),
  })
}

export function useArquivarProjeto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ler(api.api.projetos[':id'].arquivar.$post({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesProjetos.todos }),
  })
}

export function useAtivos(projetoId: string | undefined) {
  return useQuery({
    queryKey: [...chavesProjetos.todos, 'ativos', projetoId ?? ''],
    queryFn: async () =>
      (await ler(api.api.projetos[':id'].ativos.$get({ param: { id: projetoId! } }))).itens,
    enabled: !!projetoId,
  })
}

export function useCriarAtivo(projetoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dados: EntradaAtivo) =>
      ler(api.api.projetos[':id'].ativos.$post({ param: { id: projetoId }, json: dados })),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: [...chavesProjetos.todos, 'ativos', projetoId] }),
  })
}
