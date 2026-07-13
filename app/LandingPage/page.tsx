'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Faculty = {
  faculty_id: number
  faculty_name: string
}

type Degree = {
  degree_id: number
  degree_name: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [degrees, setDegrees] = useState<Degree[]>([])

  const [selectedFaculty, setSelectedFaculty] = useState<number | null>(null)
  const [selectedDegree, setSelectedDegree] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState('')

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [studentNumber, setStudentNumber] = useState<number | null>(null)

  useEffect(() => {
    getFaculties()
    getStudentInfo()
  }, [])

  async function getStudentInfo() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user?.email) {
      const email = user.email
      const num = parseInt(email.split('@')[0])
      if (!isNaN(num)) {
        setStudentNumber(num)
      } else {
        setStudentNumber(1234) // fallback for testing
      }
    }
  }

  async function getFaculties() {
    const { data, error } = await supabase
      .from('faculties')
      .select('*')
      .order('faculty_name')

    if (!error && data) {
      setFaculties(data)
    } else {
      console.error('Error fetching faculties:', error)
      setMessage('Failed to load faculties. Please refresh or report issue.')
    }
  }

  async function selectFaculty(facultyId: number) {
    setSelectedFaculty(facultyId)
    setSelectedDegree(null)
    setSelectedYear('')
    setMessage('')

    const { data, error } = await supabase
      .from('degrees')
      .select('degree_id, degree_name')
      .eq('faculty_id', facultyId)
      .order('degree_name')

    if (!error && data) {
      setDegrees(data)
    } else {
      console.error('Error fetching degrees:', error)
      setMessage('Failed to load degrees. Please refresh or report issue.')
    }
  }

  async function handleContinue() {
    setMessage('')
    setLoading(true)

    if (!selectedFaculty) {
      setMessage('Please select a faculty.')
      setLoading(false)
      return
    }

    if (!selectedDegree) {
      setMessage('Please select a degree.')
      setLoading(false)
      return
    }

    if (!selectedYear) {
      setMessage('Please select your year of study.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      setMessage('User not found. Please sign in again.')
      setLoading(false)
      return
    }

    const email = user.email
    let studentNum = parseInt(email.split('@')[0])

    try {
      const { error: updateError } = await supabase
        .from('students')
        .update({
          degree_id: selectedDegree,
          current_year: Number(selectedYear),
        })
        .eq('student_number', studentNum)

      if (updateError) {
        console.error('Update error:', updateError)
        setMessage(`Error updating student record: ${updateError.message}`)
        setLoading(false)
        return
      }

      setMessage('✅ Onboarding complete! Redirecting...')
      setLoading(false)

      setTimeout(() => {
        router.push('/SelectModule')
      }, 1000)

    } catch (error) {
      console.error('Unexpected error:', error)
      setMessage('An unexpected error occurred. Please try again.')
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
      <div
        style={{
          width: '95%',
          maxWidth: '1500px',
          minHeight: '850px',
          padding: '50px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(6px)',
          color: 'white',
          position: 'relative',
        }}
      >
        <h1
          style={{
            textAlign: 'center',
            fontSize: '55px',
            marginBottom: '50px',
          }}
        >
          Welcome To Wits Study
        </h1>

        <div
          style={{
            width: '420px',
            marginBottom: '50px',
          }}
        >
          <h3>Tell us about yourself</h3>
          <p style={{ opacity: 0.8 }}>
            Select your faculty, degree, and year of study.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '120px',
          }}
        >
          <div style={{ width: '300px' }}>
            <h3>Which faculty?</h3>

            {faculties.map((faculty) => (
              <button
                key={faculty.faculty_id}
                onClick={() => selectFaculty(faculty.faculty_id)}
                style={{
                  ...buttonStyle,
                  backgroundColor:
                    selectedFaculty === faculty.faculty_id
                      ? 'blue'
                      : 'rgba(255,255,255,0.1)',
                }}
              >
                {faculty.faculty_name}
              </button>
            ))}
          </div>

          {selectedFaculty && (
            <div style={{ width: '650px', marginTop: '90px' }}>
              <h3>Which degree are you doing?</h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                }}
              >
                {degrees.map((degree) => (
                  <button
                    key={degree.degree_id}
                    onClick={() => {
                      setSelectedDegree(degree.degree_id)
                    }}
                    style={{
                      ...buttonStyle,
                      width: '100%',
                      marginBottom: '0',
                      backgroundColor:
                        selectedDegree === degree.degree_id
                          ? 'blue'
                          : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    {degree.degree_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedDegree && (
            <div style={{ width: '250px', marginTop: '260px' }}>
              <h3>Year of study?</h3>

              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value)
                  setMessage('')
                }}
                style={selectStyle}
              >
                <option value="">Select Year</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
          )}
        </div>

        {selectedYear && (
          <button
            onClick={handleContinue}
            disabled={loading}
            style={{
              position: 'absolute',
              right: '40px',
              bottom: '40px',
              padding: '15px 40px',
              border: 'none',
              borderRadius: '10px',
              backgroundColor: loading ? '#666' : '#FFD700',
              color: 'black',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        )}

        {/* Message Display */}
        {message && (
          <div
            style={{
              position: 'absolute',
              left: '40px',
              bottom: '40px',
              fontSize: '18px',
              fontWeight: 'bold',
              color: message.includes('✅') ? '#4CAF50' : '#ff6b6b',
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

const buttonStyle = {
  width: '100%',
  padding: '14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.3)',
  backgroundColor: 'rgba(255,255,255,0.1)',
  color: 'white',
  fontSize: '14px',
  cursor: 'pointer',
  marginBottom: '10px',
  transition: 'all 0.2s ease',
}

const inputStyle = {
  width: '100%',
  padding: '14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.3)',
  backgroundColor: 'rgba(255,255,255,0.1)',
  color: 'white',
  fontSize: '16px',
  outline: 'none',
  boxSizing: 'border-box' as const,
}

const selectStyle = {
  width: '100%',
  padding: '14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.3)',
  backgroundColor: 'rgba(255,255,255,0.1)',
  color: 'white',
  fontSize: '16px',
  outline: 'none',
}