const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getContactos: (filtro) => ipcRenderer.invoke('get-contactos', filtro),
  getSecciones: (filtro) => ipcRenderer.invoke('get-secciones', filtro),
  getColonias: (filtro) => ipcRenderer.invoke('get-colonias', filtro),
  getColonias2: (filtro) => ipcRenderer.invoke('get-colonias2', filtro),
  getLideres: (filtro) => ipcRenderer.invoke('get-lideres', filtro),
  getLideres2: (colonia, seccion) => ipcRenderer.invoke('get-lideres2', { colonia, seccion }),
  getContactosDet: (filtro) => ipcRenderer.invoke('get-contactosdet', filtro),
  insertContactoDet: (data) => ipcRenderer.invoke('insert-contactodet', data),
  insertContacto: (contacto) => ipcRenderer.invoke('insert-contacto', contacto),
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  getExcelSheets: (filePath) => ipcRenderer.invoke('get-excel-sheets', filePath),
  readExcelPreview: (params) => ipcRenderer.invoke('read-excel-preview', params),
  importExcelData: (params) => ipcRenderer.invoke('import-excel-data', params),
  importSeccionData: (params) => ipcRenderer.invoke('import-seccion-data', params)
});