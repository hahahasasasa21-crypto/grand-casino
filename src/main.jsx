import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './shared/ui'

// 何かで例外が起きても真っ白にならないよう、全体をエラー境界で包む
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary title="アプリの起動でエラーが発生しました">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
