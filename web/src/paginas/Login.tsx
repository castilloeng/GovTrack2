import { Link } from '../router'
import { IcoCandado, IcoGoogle } from '../iconos'

// Acceso con Google (diseno/pantallas/Login.dc.html). Sin conexión todavía: el botón entra al Panel.
export default function Login() {
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
          <Link to="/" className="btn-google">
            <IcoGoogle />
            Continuar con Google
          </Link>
          <div className="aviso">
            <IcoCandado />
            <span>Solo pueden entrar usuarios activos y con el correo verificado por Google. GovTrack no guarda contraseñas.</span>
          </div>
          <div className="nota" style={{ fontSize: 13 }}>
            ¿No tienes acceso? Pídelo a tu administrador.
          </div>
        </div>
      </main>
    </div>
  )
}
