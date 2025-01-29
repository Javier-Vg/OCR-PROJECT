// backend/services/pdfConverter.js
const { fromPath } = require('pdf2pic');

async function convertPDFToImage(pdfPath) {
  const options = {
    density: 300,
    saveFilename: "page",
    savePath: "./images",
    format: "png",
    width: 2480,
    height: 3508
  };
  
  const convert = fromPath(pdfPath, options);
  return await convert.bulk(-1); // Convierte todas las páginas
}

module.exports = { convertPDFToImage };