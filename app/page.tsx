'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.get('error')) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/auth/callback')
      } else {
        router.replace('/logIn?error=auth-failed')
      }
    })
  }, [])

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
        backgroundImage: "url('/signupbackground.jpg.jpeg')",
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <h1 style={{ fontSize: '55px', marginBottom: '20px' }}>
          Study
        </h1>

        <p style={{ fontSize: '18px', marginBottom: '40px', opacity: 0.9 }}>
         All your study tools in one place. Read, annotate, take notes, practise with AI, and stay focused.
        </p>

        <button onClick={() => router.push('/logIn')} style={buttonStyle}>
          Login
        </button>

        <button onClick={() => router.push('/signup')} style={{ ...buttonStyle, marginTop: '20px' }}>
          Sign Up
        </button>

        <button
          onClick={signInWithGoogle}
          style={{
            ...buttonStyle,
            marginTop: '20px',
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