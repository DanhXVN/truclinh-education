import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async () => {
  setLoading(true)
  setErrorMsg('') // reset lỗi

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    setErrorMsg('❌ Email hoặc mật khẩu không đúng!')
  } else {
    onLogin(data.user)
  }

  setLoading(false)
}
  

  return (
  <div style={{
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #bbf7d0, #93c5fd)'
  }}>
    
    <div style={{
      width: '90%',
      maxWidth: 360,
      padding: 30,
      borderRadius: 20,
      background: '#ffffff',
      boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
      textAlign: 'center'
    }}>

      {/* ICON + TITLE */}
      <div style={{ marginBottom: 15 }}>
        <div style={{ fontSize: 52 }}>🎓</div>

        <h1 style={{
          fontWeight: 800,
          fontSize: 26,
          marginBottom: 5,
          background: 'linear-gradient(135deg, #059669, #2563eb)',
          WebkitBackgroundClip: 'text',
          color: 'transparent'
        }}>
          Trúc Linh
        </h1>

        <div style={{
          fontSize: 13,
          color: '#2563eb',
          letterSpacing: '2px',
          fontWeight: 700
        }}>
          EDUCATION
        </div>
      </div>

      {/* SUBTITLE */}
      <p style={{
        marginBottom: 20,
        fontSize: 16,
        fontWeight: 600,
        color: '#1e293b'
      }}>
        Đăng nhập để quản lý lớp học
      </p>

      {/* BÁO LỖI */}
      {errorMsg && (
        <div style={{
          background: '#fee2e2',
          color: '#dc2626',
          padding: 10,
          borderRadius: 10,
          marginBottom: 10,
          fontSize: 14
        }}>
          {errorMsg}
        </div>
      )}

      {/* EMAIL */}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: '100%',
          padding: 12,
          marginBottom: 10,
          borderRadius: 12,
          border: '2px solid #bbf7d0',
          background: '#f0fdf4',
          color: '#065f46'
        }}
      />

      {/* PASSWORD */}
      <input
        type="password"
        placeholder="Mật khẩu"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          width: '100%',
          padding: 12,
          marginBottom: 15,
          borderRadius: 12,
          border: '2px solid #bfdbfe',
          background: '#eff6ff',
          color: '#1e3a8a'
        }}
      />

      {/* BUTTON */}
      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: '100%',
          padding: 12,
          background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>

    </div>
  </div>
)
}