import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 480 : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 480)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fieldStyle = {
    width: '100%',
    height: 46,
    padding: '0 14px',
    borderRadius: 12,
    border: '1.5px solid #cbd5e1',
    background: '#fff',
    color: '#1e293b',
    fontSize: 14,
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box'
  }

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
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'radial-gradient(circle at 20% 20%, #dbeafe 0%, #ede9fe 40%, #fce7f3 100%)',
      padding: 16
    }}>
      <div style={{
        position: 'fixed',
        width: 180,
        height: 180,
        borderRadius: '50%',
        background: 'rgba(99, 102, 241, 0.22)',
        top: -30,
        left: -40,
        filter: 'blur(2px)'
      }} />
      <div style={{
        position: 'fixed',
        width: 220,
        height: 220,
        borderRadius: '50%',
        background: 'rgba(236, 72, 153, 0.2)',
        bottom: -50,
        right: -40,
        filter: 'blur(2px)'
      }} />
      <div style={{
        width: '100%',
        maxWidth: 420,
        borderRadius: 28,
        padding: isMobile ? '22px 16px 18px' : '26px 22px 22px',
        background: 'rgba(255,255,255,0.93)',
        border: '1.5px solid #e2e8f0',
        boxShadow: '0 22px 55px rgba(76, 63, 160, 0.18)',
        backdropFilter: 'blur(6px)',
        position: 'relative',
        zIndex: 2
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            width: 70,
            height: 70,
            borderRadius: '50%',
            margin: '0 auto 10px',
            background: 'linear-gradient(135deg,#6c63ff 0%,#ec4899 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: 24,
            fontFamily: "'Nunito', sans-serif",
            boxShadow: '0 10px 25px rgba(108,99,255,.35)'
          }}>
            TL
          </div>
          <h1 style={{
            margin: 0,
            fontWeight: 900,
            fontSize: isMobile ? 23 : 27,
            color: '#1f2a44',
            fontFamily: "'Nunito', sans-serif"
          }}>
            Trúc Linh Education Center
          </h1>
          <p style={{
            margin: '6px 0 0',
            fontSize: 14,
            color: '#64748b',
            fontWeight: 700
          }}>
            Quản lý điểm danh - ghi chú - học phí
          </p>
        </div>

        <div style={{
          borderRadius: 16,
          padding: 14,
          background: 'linear-gradient(135deg,#eef2ff 0%,#fdf4ff 100%)',
          border: '1px solid #ddd6fe',
          marginBottom: 14
        }}>
          <p style={{ margin: 0, fontSize: 13, color: '#5b21b6', fontWeight: 700 }}>
            👋 Chào mừng cô quay lại hệ thống
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569', fontWeight: 600 }}>
            Vui lòng đăng nhập để tiếp tục quản lý lớp học.
          </p>
        </div>

        {errorMsg && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '10px 12px',
            borderRadius: 12,
            marginBottom: 12,
            fontSize: 13,
            fontWeight: 700
          }}>
            {errorMsg}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, color: '#475569' }}>
            Email đăng nhập
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '34px 1fr',
            alignItems: 'center',
            gap: 8,
            border: '1.5px solid #cbd5e1',
            borderRadius: 12,
            background: '#fff',
            padding: '0 10px 0 0'
          }}>
            <div style={{
              height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#6366f1', fontWeight: 800, fontSize: 14, borderRight: '1px solid #e2e8f0'
            }}>
              @
            </div>
            <input
              type="email"
              placeholder="Nhập email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              style={{ ...fieldStyle, border: 'none', padding: '0 2px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, color: '#475569' }}>
            Mật khẩu
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '34px 1fr',
            alignItems: 'center',
            gap: 8,
            border: '1.5px solid #cbd5e1',
            borderRadius: 12,
            background: '#fff',
            padding: '0 10px 0 0'
          }}>
            <div style={{
              height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a855f7', fontWeight: 800, fontSize: 13, borderRight: '1px solid #e2e8f0'
            }}>
              🔒
            </div>
            <input
              type="password"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              style={{ ...fieldStyle, border: 'none', padding: '0 2px' }}
            />
          </div>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: 13,
            background: 'linear-gradient(135deg,#6c63ff 0%,#a855f7 55%,#ec4899 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 13,
            fontWeight: 800,
            fontSize: 14,
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: '0 10px 24px rgba(168,85,247,.35)'
          }}
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập hệ thống'}
        </button>
        <p style={{ textAlign: 'center', margin: '12px 0 0', fontSize: 11, color: '#64748b', fontWeight: 700 }}>
          Hệ thống quản lý Trúc Linh Education Center
        </p>
      </div>
    </div>
  )
}