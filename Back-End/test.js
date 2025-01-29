const tesseract = require('node-tesseract-ocr');

const config = {
  lang: "eng",
  oem: 1,
  psm: 3
};

tesseract.recognize("test-image.png", config)
  .then(text => console.log("Texto reconocido:", text))
  .catch(error => console.error("Error en OCR:", error));





