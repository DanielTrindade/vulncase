/**
 * Substituto do pacote `react-style-singleton`, usado pelo `react-remove-scroll` do Radix
 * para travar a rolagem do fundo em diálogos e selects. O original injeta uma tag <style>
 * em tempo de execução, que a CSP da aplicação (style-src 'self') bloqueia. Este módulo
 * mantém a mesma API sem injetar nada; a regra equivalente está em estilos.css
 * (body[data-scroll-locked]), e o atributo continua sendo aplicado pelo Radix.
 */
import type { FC } from 'react'

export const stylesheetSingleton = () => ({
  add: (_estilo: string) => undefined,
  remove: () => undefined,
})

export const styleHookSingleton = () => (_estilos: string, _dinamico?: boolean) => undefined

export const styleSingleton = (): FC<{ styles: string; dynamic?: boolean }> => () => null
