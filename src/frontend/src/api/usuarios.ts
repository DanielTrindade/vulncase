import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  EntradaAlterarUsuario,
  EntradaCriarUsuario,
  EntradaTrocarSenha,
} from '@vulncase/compartilhado'
import { api, enviar, ler } from './cliente'

export const chavesUsuarios = {
  todos: ['usuarios'] as const,
  lista: () => [...chavesUsuarios.todos, 'lista'] as const,
  responsaveis: () => [...chavesUsuarios.todos, 'responsaveis'] as const,
}

export function useUsuarios() {
  return useQuery({
    queryKey: chavesUsuarios.lista(),
    queryFn: async () => (await ler(api.api.usuarios.$get())).itens,
  })
}

export function useResponsaveis(habilitado = true) {
  return useQuery({
    queryKey: chavesUsuarios.responsaveis(),
    queryFn: async () => (await ler(api.api.usuarios.responsaveis.$get())).itens,
    enabled: habilitado,
    staleTime: 60_000,
  })
}

export type UsuarioLista = NonNullable<ReturnType<typeof useUsuarios>['data']>[number]

export function useCriarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dados: EntradaCriarUsuario) => ler(api.api.usuarios.$post({ json: dados })),
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesUsuarios.todos }),
  })
}

export function useAlterarUsuario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: EntradaAlterarUsuario }) =>
      ler(api.api.usuarios[':id'].$patch({ param: { id }, json: dados })),
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesUsuarios.todos }),
  })
}

export function useTrocarSenha() {
  return useMutation({
    mutationFn: (dados: EntradaTrocarSenha) => enviar(api.api.auth.senha.$put({ json: dados })),
  })
}
