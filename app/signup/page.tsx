'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { deleteAuthUser } from '@/app/actions/auth'
import {  useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  setError(params.get('error'))
  }, [])
  
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [attempts, setAttempts] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!fullName || !email || !password) {
      setMessage('Please fill in all fields')
      setLoading(false)
      return
    }

    if (!email.endsWith('@students.wits.ac.za')) {
      setMessage('Please use your Wits student email address (e.g., 1234567@students.wits.ac.za)')
      setLoading(false)
      return
    }
    
    const studentNumberPart = email.split('@')[0]
    const studentNumber = parseInt(studentNumberPart) || 0
    const authEmail = email

    let userId: string | undefined

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: password,
        options: {
          data: {
            full_name: fullName,
            student_number: studentNumber,
            wits_email: email,
          }
        }
      })

      if (authError) {
        if (authError.message.toLowerCase().includes('rate limit')) {
          setMessage('⏳ Too many signup attempts. Please wait 15-30 minutes and try again.')
          setAttempts(prev => prev + 1)
          if (attempts >= 3) {
            setMessage('⏳ Too many attempts. Please try "Sign up with Google" instead, or wait 30 minutes.')
          }
        } else if (authError.message.toLowerCase().includes('already registered')) {
          setMessage('❌ This email is already registered. Please login or use "Forgot Password".')
        } else {
          setMessage('❌ Auth Error: ' + authError.message)
          console.log("Full auth error:", authError)
          console.log("Status:", authError?.status)
          console.log("Code:", authError?.code)
          console.log("Message:", authError?.message)
        }
        setLoading(false)
        return
      }

      userId = authData.user?.id

      const { error: dbError } = await supabase
        .from('students')
        .insert([{
          student_number: studentNumber,
          full_name: fullName,
          email: email,  
          degree_id: null,           
          current_year: null        
        }])

      if (dbError) {
        console.error('Database error:', dbError)
        if (userId) {
          const result = await deleteAuthUser(userId)
          if (result.success) {
            setMessage('❌ Database Error: ' + dbError.message + ' Auth account rolled back. Please try again.')
          } else {
            console.error('Failed to delete auth user:', result.error)
            setMessage('❌ Database Error: ' + dbError.message + '. Auth account may still exist. Please contact support.')
          }
        } else {
          setMessage('❌ Database Error: ' + dbError.message)
        }
        
        setLoading(false)
        return
      }
      setMessage('✅ Account created successfully!Ke ya leboha fro trying the app🙏')
      setAttempts(0)
      
      setTimeout(() => {
        router.push('/LandingPage')
      }, 1500)

    } catch (error: any) {
      console.error('Unexpected error:', error)
      
      if (userId) {
        const result = await deleteAuthUser(userId)
        if (result.success) {
          console.log('Auth user cleaned up after unexpected error')
        } else {
          console.error('Failed to cleanup auth user:', result.error)
        }
      }
      
      setMessage('❌ Unexpected error: ' + error.message)
    } finally {
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
      {error === 'auth-failed' && (
        <p style={{ color: 'red', position: 'absolute', top: '20px' }}>
          Login failed. Please try again.
        </p>
      )}
      
      {error === 'db-error' && (
        <p style={{ color: 'red', position: 'absolute', top: '20px' }}>
          Database error occurred. Please try again.
        </p>
      )}
      
      <form
        onSubmit={handleSubmit}
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
          Create Account
        </h4>
        
        
        {attempts >= 2 && (
          <p style={{ 
            color: '#ffd93d', 
            backgroundColor: 'rgba(255, 217, 61, 0.1)',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '15px',
            fontSize: '14px'
          }}>
            ⚠️ Multiple signup attempts detected. Consider using "Sign up with Google" or wait 15-30 minutes.
          </p>
        )}
        
        <br/>
        
        <input
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
          required
        /><br /><br />

        <input
          type="email"
          placeholder="Your Wits Email (e.g., 1234567@students.wits.ac.za)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          required
        /><br /><br />

        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          required
        /><br /><br />

        {message && (
          <p style={{ 
            color: message.includes('Error') || message.includes('Wits') || message.includes('Auth') || message.includes('attempts') || message.includes('failed')
              ? '#ff6b6b' 
              : '#51cf66',
            backgroundColor: message.includes('attempts') ? 'rgba(255, 107, 107, 0.1)' : 'transparent',
            padding: message.includes('attempts') ? '8px' : '0',
            borderRadius: '4px',
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
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '25px 0' }}>
          <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
          <span style={{ margin: '0 15px', color: 'white', fontWeight: 'bold' }}>OR</span>
          <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
        </div>

        <button
          type="button"
          onClick={() => {
            supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: `${window.location.origin}/auth/callback`
              }
            })
          }}
          style={{
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
            gap: '10px',
            margin: '0 auto',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
          }}
        >
          <img src="/Googlelogo.jpg" alt="Google" width="20" height="20" />
          Sign up with Google
        </button>

        <p style={{ marginTop: '20px', fontSize: '14px' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#0070f3', textDecoration: 'none' }}>
            Login here
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