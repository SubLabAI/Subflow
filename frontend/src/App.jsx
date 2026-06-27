import { useState, useRef } from 'react'
import './index.css'

const BACKEND_WS = 'wss://SubLabAI-Subflow.hf.space/transcribe'
const BACKEND_HEALTH = 'https://SubLabAI-Subflow.hf.space/health'

const s = {
  app: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'var(--bg-header)', backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border)',
    padding: '0 20px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', height: '56px',
  },
  logo: {
    fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
    letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px',
    fontFamily: 'var(--font-mono)',
  },
  main: { flex: 1, padding: '24px 16px', maxWidth: '800px', margin: '0 auto', width: '100%' },
  hero: { textAlign: 'center', padding: '48px 16px 32px' },
  heroTitle: {
    fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700,
    color: 'var(--text-primary)', marginBottom: '12px',
    letterSpacing: '-1px', fontFamily: 'var(--font-mono)',
  },
  heroAccent: { color: 'var(--accent)' },
  heroSub: { fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 32px' },
  dropzone: {
    border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
    padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
    transition: 'all var(--transition)', background: 'var(--bg-card)',
  },
  dropzoneActive: {
    border: '2px dashed var(--accent)', background: 'var(--accent-dim)',
  },
  dropIcon: { fontSize: '48px', marginBottom: '16px' },
  dropText: { fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '8px' },
  dropSub: { fontSize: '13px', color: 'var(--text-muted)' },
  statusCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '20px 24px', marginTop: '24px',
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
  spinner: {
    width: '20px', height: '20px', border: '2px solid var(--border)',
    borderTop: '2px solid var(--accent)', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite', flexShrink: 0,
  },
  statusText: { fontSize: '14px', color: 'var(--text-secondary)' },
  progressTrack: { height: '4px', background: 'var(--bg-hover)', borderRadius: '2px' },
  progressBar: { height: '100%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s ease' },
  resultCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', marginTop: '24px', overflow: 'hidden',
    animation: 'fadeIn 0.3s ease both',
  },
  resultHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  resultTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  downloadBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)',
    color: '#fff', cursor: 'pointer', padding: '8px 18px', fontSize: '13px',
    fontWeight: 600, fontFamily: 'var(--font-fa)', transition: 'background var(--transition)',
  },
  srtPreview: {
    padding: '20px', fontFamily: 'var(--font-mono)', fontSize: '12px',
    color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: '400px',
    overflowY: 'auto', lineHeight: 1.8,
  },
  errorCard: {
    background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius-md)', padding: '16px 20px', marginTop: '24px',
    fontSize: '13px', color: 'var(--error)',
  },
  footer: {
    borderTop: '1px solid var(--border)', padding: '12px 20px',
    textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)',
  },
}

const STATUS_LABELS = {
  receiving: '📥 سرور داره فایل رو میگیره...',
  transcribing: '🎙️ Whisper داره متن رو استخراج می‌کنه...',
  processing: '⚙️ Post-Processing در حال اجراست...',
  done: '✅ تموم شد!',
  error: '❌ خطا',
  connecting: '🔌 در حال اتصال به سرور...',
  waking: '⏳ سرور داره بیدار میشه، لطفاً صبر کن...',
}

const STATUS_PROGRESS = {
  connecting: 10, waking: 20, receiving: 40, transcribing: 70, processing: 90, done: 100,
}

export default function App() {
  const [phase, setPhase] = useState('idle')
  const [status, setStatus] = useState('')
  const [srt, setSrt] = useState('')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef(null)

  const processFile = async (file) => {
    if (!file) return
    setFileName(file.name)
    setPhase('processing')
    setError('')
    setSrt('')
    setMeta(null)

    // چک کردن سرور — اگه خواب بود صبر کنیم
    setStatus('connecting')
    let serverReady = false
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(BACKEND_HEALTH)
        if (res.ok) { serverReady = true; break }
      } catch {}
      if (i === 1) setStatus('waking')
      await new Promise(r => setTimeout(r, 10000))
    }

    if (!serverReady) {
      setError('سرور در دسترس نیست. لطفاً چند دقیقه صبر کن و دوباره امتحان کن.')
      setPhase('idle')
      return
    }

    // ارسال از طریق WebSocket
    const ws = new WebSocket(BACKEND_WS)

    ws.onopen = () => {
      setStatus('receiving')
      file.arrayBuffer().then(buffer => ws.send(buffer))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      setStatus(msg.status)
      if (msg.status === 'done') {
        setSrt(msg.srt)
        setMeta({ language: msg.language, duration: msg.duration })
        setPhase('done')
      } else if (msg.status === 'error') {
        setError(msg.message)
        setPhase('idle')
      }
    }

    ws.onerror = () => {
      setError('خطای اتصال به سرور.')
      setPhase('idle')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const downloadSrt = () => {
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.replace(/\.(wav|mp4|mkv|avi)$/i, '') + '.srt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    setPhase('idle')
    setStatus('')
    setSrt('')
    setMeta(null)
    setError('')
    setFileName('')
  }

  const progress = STATUS_PROGRESS[status] || 0

  return (
    <div style={s.app}>
      <header style={s.header}>
        <div style={s.logo}>
          <span style={{ color: 'var(--accent)' }}>▶</span> SubFlow
        </div>
        {phase !== 'idle' && (
          <button
            onClick={reset}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--error)', cursor: 'pointer', padding: '6px 14px', fontSize: '13px', fontFamily: 'var(--font-fa)' }}
          >
            × شروع مجدد
          </button>
        )}
      </header>

      <main style={s.main}>
        {phase === 'idle' && (
          <div style={s.hero} className="fade-in">
            <div style={s.heroTitle}>
              زیرنویس خودکار<br />
              <span style={s.heroAccent}>با هوش مصنوعی</span>
            </div>
            <p style={s.heroSub}>
              فایل ویدیو یا صدا آپلود کن — SubFlow زیرنویس انگلیسی سینک‌شده تحویل میده
            </p>

            <div
              style={{ ...s.dropzone, ...(isDragging ? s.dropzoneActive : {}) }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div style={s.dropIcon}>🎬</div>
              <div style={s.dropText}>فایل رو اینجا بکش یا کلیک کن</div>
              <div style={s.dropSub}>WAV • MP3 • MP4 • MKV</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".wav,.mp3,.mp4,.mkv,.avi,.mov"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
            </div>

            {error && <div style={s.errorCard}>{error}</div>}
          </div>
        )}

        {phase === 'processing' && (
          <div style={s.statusCard} className="fade-in">
            <div style={s.statusRow}>
              <div style={s.spinner} />
              <span style={s.statusText}>{STATUS_LABELS[status] || '...'}</span>
            </div>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressBar, width: `${progress}%` }} />
            </div>
          </div>
        )}

        {phase === 'done' && srt && (
          <div className="fade-in">
            {meta && (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>
                زبان: <span style={{ color: 'var(--accent)' }}>{meta.language}</span>
                {' · '}
                مدت: <span style={{ color: 'var(--accent)' }}>{Math.round(meta.duration)} ثانیه</span>
              </div>
            )}
            <div style={s.resultCard}>
              <div style={s.resultHeader}>
                <span style={s.resultTitle}>📄 زیرنویس آماده‌ست</span>
                <button
                  style={s.downloadBtn}
                  onClick={downloadSrt}
                  onMouseEnter={e => e.target.style.background = 'var(--accent-hover)'}
                  onMouseLeave={e => e.target.style.background = 'var(--accent)'}
                >
                  ⬇ دانلود SRT
                </button>
              </div>
              <div style={s.srtPreview}>{srt}</div>
            </div>
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                onClick={reset}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 20px', fontSize: '13px', fontFamily: 'var(--font-fa)' }}
              >
                ← فایل جدید
              </button>
            </div>
          </div>
        )}
      </main>

      <footer style={s.footer}>
        SubFlow · زیرنویس خودکار با Whisper AI
      </footer>
    </div>
  )
}
