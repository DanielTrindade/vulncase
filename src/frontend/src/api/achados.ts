import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  EntradaAtribuirResponsavel,
  EntradaCriarAchado,
  EntradaEditarAchado,
  EntradaTransicao,
} from '@vulncase/compartilhado'
import { api, enviar, ler } from './cliente'
import { chavesProjetos } from './projetos'

export const chavesAchados = {
  todos: ['achados'] as const,
  lista: (consulta: Record<string, string | string[]>) =>
    [...chavesAchados.todos, 'lista', consulta] as const,
  detalhe: (id: string) => [...chavesAchados.todos, 'detalhe', id] as const,
  historico: (id: string) => [...chavesAchados.todos, 'historico', id] as const,
}

/** Consulta montada a partir da URL; a API valida os valores. */
export function useAchados(consulta: Record<string, string | string[]>) {
  return useQuery({
    queryKey: chavesAchados.lista(consulta),
    queryFn: () => ler(api.api.achados.$get({ query: consulta })),
    placeholderData: keepPreviousData,
  })
}

export type PaginaAchados = NonNullable<ReturnType<typeof useAchados>['data']>
export type ItemAchado = PaginaAchados['itens'][number]

export function useAchado(id: string | undefined) {
  return useQuery({
    queryKey: chavesAchados.detalhe(id ?? ''),
    queryFn: () => ler(api.api.achados[':id'].$get({ param: { id: id! } })),
    enabled: !!id,
  })
}

export type Achado = NonNullable<ReturnType<typeof useAchado>['data']>

export function useHistorico(id: string) {
  return useQuery({
    queryKey: chavesAchados.historico(id),
    queryFn: async () =>
      (await ler(api.api.achados[':id'].historico.$get({ param: { id } }))).itens,
  })
}

export type EventoHistorico = NonNullable<ReturnType<typeof useHistorico>['data']>[number]

export function useCategoriasOwasp() {
  return useQuery({
    queryKey: ['categorias-owasp'],
    queryFn: async () => (await ler(api.api['categorias-owasp'].$get())).itens,
    staleTime: Infinity,
  })
}

/** Após qualquer alteração: atualiza o detalhe e invalida listas, histórico e projetos. */
function useAoAlterar() {
  const qc = useQueryClient()
  return (achado: Achado) => {
    qc.setQueryData(chavesAchados.detalhe(achado.id), achado)
    void qc.invalidateQueries({ queryKey: [...chavesAchados.todos, 'lista'] })
    void qc.invalidateQueries({ queryKey: chavesAchados.historico(achado.id) })
    void qc.invalidateQueries({ queryKey: chavesProjetos.todos })
    void qc.invalidateQueries({ queryKey: ['painel'] })
  }
}

export function useRegistrarAchado() {
  const aoAlterar = useAoAlterar()
  return useMutation({
    mutationFn: ({ projetoId, dados }: { projetoId: string; dados: EntradaCriarAchado }) =>
      ler(api.api.projetos[':id'].achados.$post({ param: { id: projetoId }, json: dados })),
    onSuccess: aoAlterar,
  })
}

export function useEditarAchado() {
  const aoAlterar = useAoAlterar()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: EntradaEditarAchado }) =>
      ler(api.api.achados[':id'].$put({ param: { id }, json: dados })),
    onSuccess: aoAlterar,
  })
}

export function useAtribuirResponsavel() {
  const aoAlterar = useAoAlterar()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: EntradaAtribuirResponsavel }) =>
      ler(api.api.achados[':id'].responsavel.$put({ param: { id }, json: dados })),
    onSuccess: aoAlterar,
  })
}

export function useTransicionar() {
  const aoAlterar = useAoAlterar()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: EntradaTransicao }) =>
      ler(api.api.achados[':id'].transicoes.$post({ param: { id }, json: dados })),
    onSuccess: aoAlterar,
  })
}

export const chavesEvidencias = (achadoId: string) =>
  [...chavesAchados.todos, 'evidencias', achadoId] as const

export function useEvidencias(achadoId: string) {
  return useQuery({
    queryKey: chavesEvidencias(achadoId),
    queryFn: async () =>
      (await ler(api.api.achados[':id'].evidencias.$get({ param: { id: achadoId } }))).itens,
  })
}

export type Evidencia = NonNullable<ReturnType<typeof useEvidencias>['data']>[number]

/** Envio multipart; a rota valida o corpo manualmente, então usa fetch diretamente. */
export function useEnviarEvidencia(achadoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ arquivo, descricao }: { arquivo: File; descricao: string }) => {
      const form = new FormData()
      form.append('arquivo', arquivo)
      if (descricao.trim()) form.append('descricao', descricao.trim())
      return ler(
        fetch(`/api/achados/${encodeURIComponent(achadoId)}/evidencias`, {
          method: 'POST',
          body: form,
          credentials: 'same-origin',
        }) as Promise<{ ok: boolean; status: number; json(): Promise<Evidencia> }>,
      )
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesEvidencias(achadoId) })
      void qc.invalidateQueries({ queryKey: chavesAchados.historico(achadoId) })
    },
  })
}

export function useRemoverEvidencia(achadoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => enviar(api.api.evidencias[':id'].$delete({ param: { id } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: chavesEvidencias(achadoId) })
      void qc.invalidateQueries({ queryKey: chavesAchados.historico(achadoId) })
    },
  })
}

export function useComentar(achadoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (texto: string) =>
      ler(api.api.achados[':id'].comentarios.$post({ param: { id: achadoId }, json: { texto } })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: chavesAchados.historico(achadoId) }),
  })
}
