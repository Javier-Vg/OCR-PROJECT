import { useState } from 'react';
import axios from 'axios';
import '../css/UI.css';


const PDFProcessor = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
      setSuccess(false);
    } else {
      setError('Por favor, selecciona un archivo PDF válido');
      setFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('pdfFile', file);

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await axios.post('http://localhost:3001/api/process-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResults(response.data);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pdf-processor">
      <div className="pdf-card">
        <h2>Procesador de PDF</h2>
        
        <form onSubmit={handleSubmit} className="upload-form">
          <div className="file-input-container">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".pdf"
              className="file-input"
              id="file-input"
            />
            <label htmlFor="file-input" className="file-label">
              {file ? file.name : 'Seleccionar PDF'}
            </label>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              Archivo procesado correctamente
            </div>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            className="submit-button"
          >
            {loading ? 'Procesando...' : 'Procesar PDF'}
          </button>
        </form>

        {results && (
          <div className="results-container">
            <h3>Resultados:</h3>
            
            <div className="results-section">
              <h4>Solicitado por:</h4>
              <div className="results-grid">
                <div className="result-item">
                  <label>Número:</label>
                  <input value={results.solicitadoPor?.numero || ''} readOnly />
                </div>
                <div className="result-item">
                  <label>Nombre:</label>
                  <input value={results.solicitadoPor?.nombre || ''} readOnly />
                </div>
                <div className="result-item">
                  <label>Teléfono:</label>
                  <input value={results.solicitadoPor?.telefono || ''} readOnly />
                </div>
                <div className="result-item">
                  <label>Correo:</label>
                  <input value={results.solicitadoPor?.correo || ''} readOnly />
                </div>
              </div>
            </div>

            <div className="results-section">
              <h4>Entregar a:</h4>
              <div className="results-grid">
                <div className="result-item">
                  <label>Nombre:</label>
                  <input value={results.entregarA?.nombre || ''} readOnly />
                </div>
                <div className="result-item">
                  <label>Teléfono:</label>
                  <input value={results.entregarA?.telefono || ''} readOnly />
                </div>
                <div className="result-item">
                  <label>Dirección:</label>
                  <input value={results.entregarA?.direccion || ''} readOnly />
                </div>
                <div className="result-item">
                  <label>Notas:</label>
                  <textarea value={results.entregarA?.notas || ''} readOnly />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFProcessor;