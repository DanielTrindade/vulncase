import { useQuery } from '@tanstack/react-query'
import { api, ler } from './cliente'

export function usePainelGeral() {
  return useQuery({ queryKey: ['painel', 'geral'], queryFn: () => ler(api.api.painel.$get()) })
}

export function usePainelProjeto(id: string) {
  return useQuery({
    queryKey: ['painel', 'projeto', id],
    queryFn: () => ler(api.api.projetos[':id'].painel.$get({ param: { id } })),
  })
}

export type Indicadores = Omit<
  NonNullable<ReturnType<typeof usePainelGeral>['data']>,
  'projetosAtivos'
>
