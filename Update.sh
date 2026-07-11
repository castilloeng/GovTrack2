#!/bin/bash
 
# Script para actualizar el repositorio y las dependencias npm
# Uso: ./update.sh
 
set -e  # Detiene el script si algún comando falla
 
echo "🔄 Actualizando repositorio desde el remoto..."
git pull --ff-only
 
echo ""
echo "📦 Instalando/actualizando módulos de npm..."
npm install
 
echo ""
echo "✅ Actualización completada."
 
echo ""
echo "ℹ️  Para iniciar la aplicación ejecuta: npm start"
# npm start