const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron'); 
const path = require('path');
const { setupIpcHandlers } = require('./js/ipcHandlers'); // importa los handlers


function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'js/preload.js') // importante para exponer API
    }
  });
 

  win.loadFile('view/index.html'); // pantalla inicial con links


 // Definir menú personalizado
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de GovTrack',
          click: () => {
            dialog.showMessageBox(win, {
                          type: 'info',
                          title: 'Acerca de GovTrack',
                          message: 'GovTrack',
                          detail: `
            Aplicación para gestión de operadores y enlaces.
            Versión: ${app.getVersion()}
            Autor: David Chong Eng
            © 2026 Todos los derechos reservados

            Licencia: Software propietario
            Este programa está protegido por las leyes de derechos de autor.
            Se concede permiso para su uso personal y profesional,
            pero queda prohibida su copia, distribución o modificación
            sin autorización expresa del autor.

            Plataforma: ${process.platform}
            Contacto: dceng@hotmail.com
                          `,
                          buttons: ['Cerrar']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);


}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers(); // carga todos los ipcMain.handle
});