// backend/services/googleSheets.js
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json', // Descarga esto desde Google Cloud Console
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function appendToSheet(data) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = 'TU_ID_DE_HOJA_DE_CALCULO';
  
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'A1',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[
        data.solicitadoPor,
        data.numero,
        data.telefono,
        data.correo,
        data.entregarA.nombre,
        data.entregarA.telefono,
        data.entregarA.direccion,
        data.entregarA.notas
      ]]
    },
  });
}

module.exports = { appendToSheet };