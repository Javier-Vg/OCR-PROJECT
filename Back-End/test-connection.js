// backend/test-connection.js
const { google } = require('googleapis');

async function testConnection() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // ID de tu hoja de cálculo
    const spreadsheetId = 'TU_ID_DE_SPREADSHEET';
    
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A1:A1',
    });
    
    console.log('Conexión exitosa:', result.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testConnection();