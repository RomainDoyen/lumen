const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('lumenDesktop', {
  isDesktop: true,
});
