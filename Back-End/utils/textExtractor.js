// backend/utils/textExtractor.js
function extractInformation(text) {
    const extraerCampo = (texto, campo) => {
      const regex = new RegExp(`${campo}[:\\s]+([^\\n]+)`, 'i');
      const match = texto.match(regex);
      return match ? match[1].trim() : '';
    };
  
    return {
      solicitadoPor: {
        numero: extraerCampo(text, 'Número'),
        nombre: extraerCampo(text, 'Nombre'),
        telefono: extraerCampo(text, 'Teléfono'),
        correo: extraerCampo(text, 'Correo'),
      },
      entregarA: {
        nombre: extraerCampo(text, 'Entregar a[:\\s]+Nombre'),
        telefono: extraerCampo(text, 'Entregar a[:\\s]+Teléfono'),
        direccion: extraerCampo(text, 'Dirección'),
        notas: extraerCampo(text, 'Notas'),
      }
    };
  }