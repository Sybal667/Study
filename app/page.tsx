'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundImage: "url('/signupbackground.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div
        style={{
          width: '850px',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          color: 'white',
          backgroundColor: 'transparent',
          backdropFilter: 'blur(6px)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '55px', marginBottom: '20px' }}>
          Study Hub
        </h1>

        <p style={{ fontSize: '18px', marginBottom: '40px', opacity: 0.9 }}>
          A platform for Wits students to connect, share, and explore opportunities.
        </p>

        <button onClick={() => router.push('/logIn')} style={buttonStyle}>
          Login
        </button>

        <br /><br />

        <button onClick={() => router.push('/signup')} style={buttonStyle}>
          Sign Up
        </button>

        <br /><br />

        <button
          onClick={signInWithGoogle}
          style={{
            ...buttonStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <img src="/Googlelogo.jpg" alt="Google" width="20" height="20" />
          Sign in with Google
        </button>
      </div>
    </div>
  )
}

const buttonStyle = {
  width: '80%',
  padding: '14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.3)',
  backgroundColor: 'rgba(255,255,255,0.1)',
  color: 'white',
  fontSize: '16px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}