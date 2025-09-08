import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import FluentThemeProvider from './components/providers/FluentThemeProvider.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FluentThemeProvider>
      <App />
    </FluentThemeProvider>
  </React.StrictMode>,
)
