'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter} from 'next/navigation'

export default function LoginPage() {
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  setError(params.get('error'))
}, [])

  const [studentNumber, setStudentNumber] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()


  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/SelectModule')
      }
    }
    checkUser()
  }, [])

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
            hd: 'students.wits.ac.za' // Restrict to Wits emails only
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
      {/* Error messages from URL params */}
      {error === 'auth-failed' && (
        <p style={{ color: 'red', position: 'absolute', top: '20px' }}>
          Login failed. Please try again.
        </p>
      )}

      {error === 'invalid-email' && (
        <p style={{ color: 'red', position: 'absolute', top: '20px' }}>
          Invalid email. Please check your email format and try again.
        </p>
      )}

      {error === 'db-error' && (
        <p style={{ color: 'red', position: 'absolute', top: '20px' }}>
          Database error occurred. Please try again.
        </p>
      )}

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
          Welcome Back
        </h4>
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
          Don't have an account?{' '}
          <a href="/signup" style={{ color: '#0070f3', textDecoration: 'none' }}>
            Sign up here
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