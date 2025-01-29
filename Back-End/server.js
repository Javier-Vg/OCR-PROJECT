const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs'); // Agregamos fs síncrono
const path = require('path');
const { google } = require('googleapis');
const tesseract = require('node-tesseract-ocr');
const { fromPath } = require('pdf2pic');
require('dotenv').config();

const app = express();


// Configuraciones básicas
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
}));

// Configuración de Google Auth
const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

// Cliente de Google Sheets
const sheets = google.sheets({ version: 'v4', auth });

// Configuración mejorada de Google Auth
let googleAuth;
async function initializeGoogleAuth() {
  try {
    googleAuth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    // Verificar la autenticación inmediatamente
    const client = await googleAuth.getClient();
    console.log('Autenticación de Google configurada correctamente');
    return client;
  } catch (error) {
    console.error('Error al inicializar Google Auth:', error);
    throw error;
  }
}

// Configuración de directorios
const uploadDir = path.join(__dirname, 'uploads');
if (!fsSync.existsSync(uploadDir)){
    fsSync.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'));
    }
  }
});


// Al inicio del archivo, después de los requires
const TESSDATA_PATH = process.env.TESSDATA_PREFIX || 'C:\\Program Files\\Tesseract-OCR\\tessdata';

// Configuración mejorada de Tesseract
const config = {
  lang: "spa",
  oem: 1,
  psm: 3,
  dpi: 300,
  tessdata: TESSDATA_PATH
};


// Configuración para convertir PDF a imagen
const pdfToImageOptions = {
  density: 300,
  saveFilename: "page",
  savePath: uploadDir,
  format: "png",
  width: 2480,
  height: 3508,
  quality: 100,
  pageNumbers: [1] // Inicialmente solo convertiremos la primera página
};

const { convert } = require('pdf-poppler');

async function convertPDFToImage(pdfPath) {
  try {
    await fs.access(pdfPath);
    
    console.log('Iniciando conversión del archivo:', pdfPath);
    
    const options = {
      format: 'png',
      out_dir: uploadDir,
      out_prefix: 'page',
      page: 1,
      scale: 2.0,
      dpi: 300
    };

    // Convertir PDF a imagen
    await convert(pdfPath, options);
    
    // Construir la ruta de la imagen generada
    const outputImagePath = path.join(uploadDir, 'page-1.png');
    
    // Verificar que la imagen se creó correctamente
    await fs.access(outputImagePath);
    
    console.log('Conversión completada:', outputImagePath);
    
    return [{
      path: outputImagePath,
      page: 1
    }];
  } catch (error) {
    console.error('Error detallado en la conversión:', error);
    throw new Error(`Error al convertir PDF a imágenes: ${error.message}`);
  }
}

// Función mejorada para extraer información del texto
function extractInformation(text) {
  console.log('Texto completo para extracción:', text); // Para debugging

  const extraerCampo = (texto, campo) => {
    // Versión más flexible del regex
    const regexVariations = [
      new RegExp(`${campo}[:\\s]+([^\\n]+)`, 'i'),
      new RegExp(`${campo}[\\s]*[:\\s]*([^\\n]+)`, 'i'),
      new RegExp(`${campo}[^\\n]*?[:\\s]+([^\\n]+)`, 'i')
    ];

    let resultado = '';
    for (const regex of regexVariations) {
      const match = texto.match(regex);
      if (match && match[1]) {
        resultado = match[1].trim();
        break;
      }
    }

    console.log(`Buscando campo ${campo}: ${resultado}`); // Para debugging
    return resultado;
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

// Función mejorada para guardar en Google Sheets
async function appendToSheet(data) {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID no está configurado en las variables de entorno');
    }

    const sheets = await getGoogleSheetsClient();
    
    // Verificar permisos antes de intentar escribir
    try {
      await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });
    } catch (error) {
      if (error.code === 403) {
        throw new Error('No tienes permisos para acceder a esta hoja de cálculo. Verifica que la cuenta de servicio tenga acceso de edición.');
      }
      throw error;
    }

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          data.solicitadoPor.nombre,
          data.solicitadoPor.numero,
          data.solicitadoPor.telefono,
          data.solicitadoPor.correo,
          data.entregarA.nombre,
          data.entregarA.telefono,
          data.entregarA.direccion,
          data.entregarA.notas,
          new Date().toISOString()
        ]]
      },
    });
    
    console.log('Datos guardados en Google Sheets:', response.data);
    return response;
  } catch (error) {
    console.error('Error detallado al guardar en Google Sheets:', error);
    
    // Manejo específico de errores comunes
    if (error.code === 403) {
      throw new Error('Error de permisos: La cuenta de servicio no tiene acceso de escritura a la hoja de cálculo');
    } else if (error.code === 404) {
      throw new Error('La hoja de cálculo no fue encontrada. Verifica el SPREADSHEET_ID');
    } else {
      throw new Error(`Error al guardar en Google Sheets: ${error.message}`);
    }
  }
}

// Función mejorada para limpiar archivos
async function cleanupFiles(filePath, images) {
  try {
    await fs.unlink(filePath);
    for (const image of images) {
      if (image.path) {
        await fs.unlink(image.path);
      }
    }
    console.log('Archivos temporales limpiados correctamente');
  } catch (error) {
    console.error('Error al limpiar archivos:', error);
    // No lanzamos el error para no interrumpir el flujo principal
  }
}

// En la ruta del API, reemplaza la implementación actual con esta:
app.post('/api/process-pdf', upload.single('pdfFile'), async (req, res) => {
  let pdfPath = '';
  let imagePaths = [];
  
  try {
    console.log("Iniciando procesamiento de PDF");

    // Verificar la configuración de Google Sheets al inicio
    await initializeGoogleAuth();
    
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
    }
    
    pdfPath = req.file.path;
    console.log("Archivo recibido:", pdfPath);

    // 1. Convertir PDF a imágenes
    console.log("Iniciando conversión de PDF a imágenes");
    imagePaths = await convertPDFToImage(pdfPath);
    console.log('Imágenes convertidas:', imagePaths);

    if (!imagePaths || imagePaths.length === 0 || !imagePaths[0].path) {
      throw new Error('Error al generar la imagen del PDF');
    }

    // 2. Verificar archivo de idioma y realizar OCR
    console.log("Iniciando OCR en la imagen");
    console.log("Usando tessdata path:", TESSDATA_PATH);
    
    const langFile = path.join(TESSDATA_PATH, 'spa.traineddata');
    try {
      await fs.access(langFile);
      console.log('Archivo de idioma encontrado:', langFile);
    } catch (error) {
      throw new Error(`No se encontró el archivo de idioma español en ${langFile}. Por favor, asegúrate de que está instalado.`);
    }

    // 3. Realizar OCR
    const ocrText = await tesseract.recognize(imagePaths[0].path, config);
    console.log('Texto extraído por OCR:', ocrText);

    // 4. Extraer información del texto
    const extractedData = extractInformation(ocrText);
    console.log('Datos extraídos:', extractedData);

    // 5. Guardar en Google Sheets con mejor manejo de errores
    if (process.env.SPREADSHEET_ID) {
      try {
        await appendToSheet(extractedData);
        console.log('Datos guardados en Google Sheets');
      } catch (sheetsError) {
        console.error('Error específico de Google Sheets:', sheetsError);
        return res.status(500).json({
          success: false,
          error: sheetsError.message,
          type: 'GOOGLE_SHEETS_ERROR'
        });
      }
    } else {
      console.log('SPREADSHEET_ID no configurado, omitiendo guardado en Google Sheets');
    }

    // 6. Enviar respuesta al cliente
    res.json({
      success: true,
      message: 'PDF procesado correctamente',
      data: extractedData,
      images: imagePaths
    });

  } catch (error) {
    console.error('Error en el procesamiento:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  } finally {
    // 7. Limpiar archivos temporales
    try {
      // Esperar un poco antes de limpiar para asegurar que los archivos no están en uso
      setTimeout(async () => {
        try {
          if (pdfPath && fsSync.existsSync(pdfPath)) {
            await fs.unlink(pdfPath);
          }
          for (const image of imagePaths) {
            if (image.path && fsSync.existsSync(image.path)) {
              await fs.unlink(image.path);
            }
          }
          console.log('Archivos temporales limpiados correctamente');
        } catch (cleanupError) {
          console.error('Error al limpiar archivos temporales:', cleanupError);
        }
      }, 1000);
    } catch (cleanupError) {
      console.error('Error al limpiar archivos temporales:', cleanupError);
    }
  }
});




const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  try {
    await initializeGoogleAuth();
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);
    console.log(`CORS habilitado para: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
});


































// const express = require('express');
// const multer = require('multer');
// const cors = require('cors');
// const pdf = require('pdf-parse');
// const fs = require('fs').promises;
// const path = require('path');
// const tesseract = require('node-tesseract-ocr');

// const app = express();

// // Configuración de middlewares
// // backend/server.js

// app.use(cors({
//     origin: process.env.FRONTEND_URL || 'http://localhost:3000',
//     methods: ['GET', 'POST'],
//     allowedHeaders: ['Content-Type', 'Authorization']
//   }));

// app.use(express.json());

// // Configuración de multer para subida de archivos
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/');
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + '-' + file.originalname);
//   }
// });

// const upload = multer({ 
//   storage: storage,
//   limits: {
//     fileSize: 10 * 1024 * 1024 // Límite de 10MB
//   },
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype === 'application/pdf') {
//       cb(null, true);
//     } else {
//       cb(new Error('Solo se permiten archivos PDF'));
//     }
//   }
// });

// // Asegurarse de que existe el directorio de uploads
// const uploadDir = path.join(__dirname, 'uploads');
// fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// // Configuración de Tesseract
// const config = {
//   lang: "spa",
//   oem: 1,
//   psm: 3,
// };

// // Ruta para procesar PDF
// // app.post('/api/process-pdf', upload.single('pdfFile'), async (req, res) => {
// //   try {
// //     if (!req.file) {
// //       return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
// //     }

// //     // Leer el archivo PDF
// //     const dataBuffer = await fs.readFile(req.file.path);
    
// //     // Procesar el PDF
// //     const data = await pdf(dataBuffer);
    
// //     // Realizar OCR en el texto
// //     const result = await tesseract.recognize(req.file.path, config);
    
// //     // Extraer información mediante expresiones regulares
// //     const extraerInfo = (texto, patron) => {
// //       const match = texto.match(patron);
// //       return match ? match[1].trim() : '';
// //     };

// //     // Patrones para extraer información
// //     const patrones = {
// //       solicitadoPor: /Solicitado por:\s*([^\n]+)/i,
// //       numero: /Número:\s*([^\n]+)/i,
// //       telefono: /Teléfono:\s*([^\n]+)/i,
// //       correo: /Correo:\s*([^\n]+)/i
// //     };

// //     // Extraer la información
// //     const informacion = {
// //       solicitadoPor: extraerInfo(result, patrones.solicitadoPor),
// //       numero: extraerInfo(result, patrones.numero),
// //       telefono: extraerInfo(result, patrones.telefono),
// //       correo: extraerInfo(result, patrones.correo)
// //     };

// //     // Limpiar el archivo subido
// //     await fs.unlink(req.file.path);

// //     res.json(informacion);

// //   } catch (error) {
// //     console.error('Error al procesar el PDF:', error);
// //     res.status(500).json({ 
// //       error: 'Error al procesar el PDF', 
// //       details: error.message 
// //     });
// //   }
// // });

// // Actualizar la ruta en server.js
// app.post('/api/process-pdf', upload.single('pdfFile'), async (req, res) => {
//     try {
//       // 1. Convertir PDF a imágenes
//       const images = await convertPDFToImage(req.file.path);
      
//       // 2. Procesar cada imagen con OCR
//       const results = [];
//       for (const image of images) {
//         const text = await tesseract.recognize(image.path, config);
//         results.push(text);
//       }
      
//       // 3. Extraer información
//       const extractedData = extractInformation(results.join('\n'));
      
//       // 4. Guardar en Google Sheets
//       await appendToSheet(extractedData);
      
//       // 5. Limpiar archivos temporales
//       await cleanup(req.file.path, images);
      
//       res.json(extractedData);
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: error.message });
//     }
//   });


// // Manejo de errores
// app.use((error, req, res, next) => {
//   if (error instanceof multer.MulterError) {
//     if (error.code === 'LIMIT_FILE_SIZE') {
//       return res.status(400).json({
//         error: 'El archivo es demasiado grande. Máximo 10MB'
//       });
//     }
//   }
//   res.status(500).json({
//     error: error.message || 'Error interno del servidor'
//   });
// });

// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//   console.log(`Servidor ejecutándose en el puerto ${PORT}`);
// });

