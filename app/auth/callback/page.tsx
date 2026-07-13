'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userFullName, setUserFullName] = useState('')
  const [studentNumber, setStudentNumber] = useState<number | null>(null)

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          console.error('Auth error:', authError)
          router.push('/signup?error=auth-failed')
          return
        }

        const email = user.email || ''
        const fullName = user.user_metadata?.full_name || 'Unknown'

        console.log('📧 Email:', email)
        console.log('👤 Full Name:', fullName)

        const studentNum = parseInt(email.split('@')[0])

        if (isNaN(studentNum)) {
          console.error('❌ Invalid student number from email:', email)
          router.push('/logIn?error=invalid-email')
          return
        }

        setUserEmail(email)
        setUserFullName(fullName)
        setStudentNumber(studentNum)

        const hasPassword = user.identities?.some(
          identity => identity.provider === 'email'
        )

        if (!hasPassword) {
          console.log('🔑 Google user without password - asking for password')
          setShowPasswordForm(true)
          return
        }

        await handleExistingUser(email, fullName, studentNum)

      } catch (error) {
        console.error('❌ Unexpected error:', error)
        router.push('/login?error=unexpected')
      }
    }
    handleAuthCallback()
  }, [])

  async function handleExistingUser(email: string, fullName: string, studentNum: number) {
    const { data: existingStudent, error: checkError } = await supabase
      .from('students')
      .select('student_number, full_name, degree_id, current_year')
      .eq('student_number', studentNum)
      .maybeSingle()

    if (checkError) {
      console.error(checkError)
      router.push('/logIn?error=db-error')
      return
    }

    if (existingStudent) {
      console.log('✅ Existing student found - LOGIN')
      if (existingStudent.full_name !== fullName) {
        await supabase
          .from('students')
          .update({ full_name: fullName })
          .eq('student_number', studentNum)
      }

      if (!existingStudent.degree_id || !existingStudent.current_year) {
        console.log('⚠️ Student needs onboarding')
        router.push('/LandingPage')
      } else {
        console.log('✅ Student has all info')
        router.push('/LandingPage')
      }
      return
    }

    const { error: insertError } = await supabase
      .from('students')
      .insert({
        student_number: studentNum,
        email: email,
        full_name: fullName ,
        degree_id: null,
        current_year: null
      })

    if (insertError) {
      console.error('❌ Database insert error:', insertError)
      router.push('/signup?error=db-error')
      return
    }

    console.log('✅ New student created')
    router.push('/LandingPage')
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!password || !confirmPassword) {
      setMessage('Please enter and confirm your password.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      setMessage(`Error: ${updateError.message}`)
      setLoading(false)
      return
    }

    if (userEmail && studentNumber) {
      await handleExistingUser(userEmail, userFullName, studentNumber)
    }

    setLoading(false)
  }

  if (showPasswordForm) {
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
          onSubmit={handleSetPassword}
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
          <h4 style={{ fontSize: '40px', marginBottom: '20px', textAlign: 'center' }}>
            Set Your Password
          </h4>
          <p style={{ fontSize: '18px', marginBottom: '30px', opacity: 0.8 }}>
            You signed up with Google. Set a password so you can login with email too.
          </p>
          
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
          /><br /><br />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
            required
          /><br /><br />

          {message && (
            <p style={{ color: message.includes('Error') ? '#ff6b6b' : '#51cf66' }}>
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
            {loading ? 'Setting password...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    )
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
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(6px)',
          color: 'white',
          textAlign: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)',
        }}
      >
        <h2 style={{ marginBottom: '10px' }}>🔄 Processing...</h2>
        <p style={{ opacity: 0.8, fontSize: '18px' }}>
          {typeof window !== 'undefined' && window.location.search.includes('code') 
            ? 'Signing you in with Google...' 
            : 'Verifying your account...'}
        </p>
        <div
          style={{
            marginTop: '20px',
            display: 'inline-block',
            border: '4px solid rgba(255,255,255,0.1)',
            borderTop: '4px solid #0070f3',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
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