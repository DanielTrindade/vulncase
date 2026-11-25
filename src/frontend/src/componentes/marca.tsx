import { cn } from '@/lib/utils'

/**
 * Marca: o nome com a escala de severidade em miniatura, a mesma linguagem visual da
 * faixa do painel.
 */
export function Marca({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-2.5 font-semibold tracking-[-0.01em]', className)}
    >
      <span aria-hidden className="flex h-4 items-end gap-[2px]">
        <span className="h-4 w-[3px] rounded-[1px] bg-sev-critica" />
        <span className="h-3.5 w-[3px] rounded-[1px] bg-sev-alta" />
        <span className="h-3 w-[3px] rounded-[1px] bg-sev-media" />
        <span className="h-2.5 w-[3px] rounded-[1px] bg-sev-baixa" />
        <span className="h-2 w-[3px] rounded-[1px] bg-sev-informativa" />
      </span>
      VulnCase
    </span>
  )
}
