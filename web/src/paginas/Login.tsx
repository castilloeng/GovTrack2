import { urlLogin } from '../api'
import { IcoCandado, IcoGoogle } from '../iconos'

// Acceso con Google (diseno/pantallas/Login.dc.html). El Worker redirige aquí con ?error= si el login falla
// (worker/auth.ts); el mensaje sustituye al aviso fijo, en el mismo lugar (DISENO.md §5).
const ERRORES: Record<string, string> = {
  'sin-acceso': 'Esa cuenta de Google no está dada de alta en GovTrack. Pide acceso a tu administrador.',
  inactivo: 'Tu usuario está desactivado. Pide a tu administrador que lo reactive.',
  'no-verificado': 'Google no ha verificado el correo de esa cuenta. Verifícalo e inténtalo de nuevo.',
  cancelado: 'Se canceló el inicio de sesión con Google.',
  estado: 'El inicio de sesión expiró o no es válido. Inténtalo de nuevo.',
  google: 'No se pudo validar la respuesta de Google. Inténtalo de nuevo.',
  config: 'El inicio de sesión con Google no está configurado en el servidor.',
}

export default function Login() {
  const params = new URLSearchParams(location.search)
  const codigo = params.get('error')
  const error = codigo ? (ERRORES[codigo] ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.') : null
  return (
    <div className="login">
      <div className="login-marca">
        <div className="login-logo">
          <div className="logo">G</div>
          <div className="side-nombre">GovTrack</div>
        </div>
        <div className="login-propuesta">
          <h1>Estructura territorial y resultados electorales, en un solo lugar.</h1>
          <p>Operadores, enlaces y colonias por sección, junto a la lista nominal y los votos de cada casilla.</p>
        </div>
        <div className="login-datos">
          <div>
            <div className="num">Municipio</div>Sección · Colonia
          </div>
          <div>
            <div className="num">Operador</div>1 o 2 enlaces
          </div>
          <div>
            <div className="num">Casilla</div>Votos por elección
          </div>
        </div>
      </div>

      <main className="login-form">
        <div>
          <div>
            <h2>Iniciar sesión</h2>
            <p>Entra con la cuenta de Google que te dio de alta el administrador.</p>
          </div>
          <a href={urlLogin(params.get('volver'))} className="btn-google">
            <IcoGoogle />
            Continuar con Google
          </a>
          <div className="aviso" role={error ? 'alert' : undefined}>
            <IcoCandado />
            <span>{error ?? 'Solo pueden entrar usuarios activos y con el correo verificado por Google. GovTrack no guarda contraseñas.'}</span>
          </div>
          <div className="nota" style={{ fontSize: 13 }}>
            ¿No tienes acceso? Pídelo a tu administrador.
          </div>
        </div>
      </main>
    </div>
  )
}
