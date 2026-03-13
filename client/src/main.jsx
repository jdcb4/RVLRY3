import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AudioCueProvider } from './audio/AudioCueContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AudioCueProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AudioCueProvider>
  </React.StrictMode>
);
