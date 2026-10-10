#!/bin/bash
 
# Script para actualizar el repositorio y las dependencias npm
# Uso: ./desktop/Update.sh (desde la raíz del repo) o ./Update.sh (desde desktop/)
 
set -e  # Detiene el script si algún comando falla

# Trabaja siempre desde desktop/, sin importar desde dónde se invoque
cd "$(dirname "$0")"
 
echo "🔄 Actualizando repositorio desde el remoto..."
git pull --ff-only
 
echo ""
echo "📦 Instalando/actualizando módulos de npm..."
npm install
 
echo ""
echo "✅ Actualización completada."
 
echo ""
echo "ℹ️  Para iniciar la aplicación ejecuta: cd desktop && npm start"
# npm start