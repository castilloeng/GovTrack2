import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react'

// Router mínimo sobre la History API. El Worker sirve index.html para cualquier ruta (modo SPA),
// así que cada pantalla tiene su propia URL y funciona el botón atrás del sistema.

const EVENTO = 'govtrack:navegar'

export function navegar(to: string, opts: { reemplazar?: boolean } = {}) {
  if (to === location.pathname + location.search) return
  if (opts.reemplazar) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  window.dispatchEvent(new Event(EVENTO))
  window.scrollTo(0, 0)
}

export function useRuta() {
  const [ruta, setRuta] = useState(location.pathname)
  useEffect(() => {
    const actualizar = () => setRuta(location.pathname)
    window.addEventListener('popstate', actualizar)
    window.addEventListener(EVENTO, actualizar)
    return () => {
      window.removeEventListener('popstate', actualizar)
      window.removeEventListener(EVENTO, actualizar)
    }
  }, [])
  return ruta
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

export function Link({ to, onClick, ...rest }: LinkProps) {
  function alClic(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navegar(to)
  }
  return <a href={to} onClick={alClic} {...rest} />
}
