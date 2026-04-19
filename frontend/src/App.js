import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  // Kintamieji duomenims saugoti
  const [file, setFile] = useState(null);  // Pasirinktas failas
  const [loading, setLoading] = useState(false);  // Ar vyksta apdorojimas
  const [result, setResult] = useState(null);  // Atsakymas iš backend
  const [error, setError] = useState(null);  // Klaidos pranešimas

  // Kai vartotojas pasirenka failą
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
    setResult(null);
  };

  // Kai spaudžiamas mygtukas "Analizuoti"
  const handleUpload = async () => {
    if (!file) {
      setError("Prašome pasirinkti Excel arba CSV failą");
      return;
    }

    setLoading(true);
    setError(null);

    // Sukuriame FormData objektą failui siųsti
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Siunčiame užklausą į Python backend
      const response = await axios.post('http://localhost:8000/clean', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResult(response.data);
    } catch (err) {
      setError("Klaida: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Funkcija atsisiųsti sutvarkytą failą
  const downloadCleanedFile = () => {
    if (!result || !result.cleaned_file_base64) return;
    
    // Konvertuojame base64 atgal į binary
    const byteCharacters = atob(result.cleaned_file_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // Sukuriame Blob (failą naršyklėje)
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    // Sukuriame laikiną nuorodą ir spaudžiame
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Išvalome atmintį
    URL.revokeObjectURL(url);
  };

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🤖 AI Excel Asistentas</h1>
      <p>Įkelkite Excel ar CSV failą ir gausite analizės rekomendacijas bei sutvarkytą failą</p>

      {/* Failo pasirinkimo laukas */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="file" 
          accept=".xlsx,.csv" 
          onChange={handleFileChange}
          style={{ marginRight: '10px' }}
        />
        <button 
          onClick={handleUpload} 
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Apdorojama...' : 'Analizuoti su AI'}
        </button>
      </div>

      {/* Klaidos pranešimas */}
      {error && (
        <div style={{ color: 'red', padding: '10px', backgroundColor: '#ffebee', borderRadius: '5px', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Įkrovimo indikatorius */}
      {loading && (
        <div style={{ marginTop: '20px' }}>
          <p>🔄 Apdorojami duomenys ir klausiama AI...</p>
          <p style={{ fontSize: '14px', color: '#666' }}>Tai gali užtrukti kelias sekundes</p>
        </div>
      )}

      {/* Rezultatų atvaizdavimas */}
      {result && (
        <div style={{ marginTop: '30px', textAlign: 'left' }}>
          <h2>📊 Analizės rezultatai</h2>
          
          {/* Statistika */}
          <div style={{ 
            backgroundColor: '#f0f8ff', 
            padding: '15px', 
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Bendroji informacija:</h3>
            <p><strong>Eilučių skaičius:</strong> {result.eiluciu_skaicius}</p>
            <p><strong>Stulpeliai:</strong> {result.stulpeliai.join(', ')}</p>
          </div>

          {/* AI rekomendacijos */}
          <div style={{ 
            backgroundColor: '#f0fff0', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #90EE90',
            marginBottom: '20px'
          }}>
            <h3>🤖 AI rekomendacijos analizei:</h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {result.AI_suggestions}
            </p>
          </div>

          {/* Mygtukas atsisiųsti sutvarkytą failą */}
          <div style={{ 
            backgroundColor: '#fff3cd', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #ffc107',
            textAlign: 'center'
          }}>
            <h3>💾 Sutvarkytas failas</h3>
            <p style={{ marginBottom: '15px' }}>
              Faile pašalintos dublikatų eilutės ir tušti laukai
            </p>
            <button
              onClick={downloadCleanedFile}
              style={{
                padding: '12px 24px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              ⬇️ Atsisiųsti sutvarkytą Excel failą
            </button>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
              Failo pavadinimas: {result.filename}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

