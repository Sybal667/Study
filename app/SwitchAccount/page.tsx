'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SwitchAccountPage() {
  const router = useRouter()
  const [studentNumber, setStudentNumber] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')


  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!studentNumber || !password) {
      setMessage('Please fill in all fields')
      setLoading(false)
      return
    }

    try {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('email')
        .eq('student_number', parseInt(studentNumber))
        .single()

      if (studentError || !student) {
        setMessage('❌ Invalid student number')
        console.error('Student not found:', studentError)
        setLoading(false)
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: student.email,
        password: password
      })

      if (signInError) {
        setMessage('❌ Invalid password. Please try again.')
        console.error('Login error:', signInError)
        setLoading(false)
        return
      }

      setMessage('✅ Login successful! Redirecting...')
      
      setTimeout(() => {
        router.push('/SelectModule')
        router.refresh()
      }, 1500)

    } catch (error: any) {
      console.error('Login error:', error)
      setMessage('❌ Login failed: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    setLoading(true)
    setMessage('Redirecting to Google...')

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            hd: 'students.wits.ac.za'
          }
        }
      })

      if (error) throw error

    } catch (error: any) {
      console.error('Google login error:', error)
      setMessage('❌ Google login failed: ' + error.message)
      setLoading(false)
    }
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
      <form
        onSubmit={handleManualLogin}
        style={{
          width: '850px',
          padding: '25px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
          color: 'white',
          backgroundColor: 'transparent',
          backdropFilter: 'blur(6px)',
          textAlign: 'center'
        }}
      >
        <h4 style={{ fontSize: '50px', marginBottom: '20px', textAlign: 'center' }}>
          Switch Account
        </h4>
        <p style={{ opacity: 0.7, marginBottom: '20px', fontSize: '16px' }}>
          You are currently logged out. Log in with a different account.
        </p>
        <br/>
        
        <input
          type="number"
          placeholder="Student Number"
          value={studentNumber}
          onChange={(e) => setStudentNumber(e.target.value)}
          style={inputStyle}
          required
        /><br /><br />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          required
        /><br /><br />

        {message && (
          <p style={{ 
            color: message.includes('Error') || message.includes('Invalid') || message.includes('failed') 
              ? '#ff6b6b' 
              : '#51cf66',
            marginTop: '10px'
          }}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '80%',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: loading ? '#6c757d' : '#0070f3',
            color: 'white',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '15px'
          }}
        >
          {loading ? 'Logging in...' : 'Login with Student Number'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '25px 0' }}>
          <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
          <span style={{ margin: '0 15px', color: 'white', fontWeight: 'bold' }}>OR</span>
          <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
        </div>

        {/* GOOGLE LOGIN BUTTON */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '80%',
            padding: '14px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.3)',
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: 'white',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            margin: '0 auto',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
          }}
        >
          <img src="/Googlelogo.jpg" alt="Google" width="20" height="20" />
          {loading ? 'Please wait...' : 'Sign in with Google'}
        </button>

        <p style={{ marginTop: '20px', fontSize: '14px' }}>
          Go back to{' '}
          <a href="/login" style={{ color: '#0070f3', textDecoration: 'none' }}>
            regular login
          </a>
        </p>
      </form>
    </div>
  )
}

const inputStyle = {
  width: '80%',
  padding: '14px 18px',
  margin: '8px 0',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  backgroundColor: 'rgba(255, 255, 255, 0.4)',
  color: 'white',
  fontSize: '16px',
  outline: 'none',
  backdropFilter: 'blur(5px)',
}