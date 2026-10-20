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

type Specialization = {
  specialization_id: number
  specialization_name: string
  starts_year_level: number
}

// Degrees where a student may pick MORE than one specialisation (e.g. two majors).
// Every other degree with specialisations lets the student pick exactly one.
const MULTI_SPECIALIZATION_DEGREES = [33, 46]

const DEFAULT_MAX_YEAR = 4

function yearLabel(n: number) {
  if (n === 1) return '1st Year'
  if (n === 2) return '2nd Year'
  if (n === 3) return '3rd Year'
  return `${n}th Year`
}

export default function OnboardingPage() {
  const router = useRouter()
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [degrees, setDegrees] = useState<Degree[]>([])

  const [selectedFaculty, setSelectedFaculty] = useState<number | null>(null)
  const [selectedDegree, setSelectedDegree] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState('')
  const [maxYear, setMaxYear] = useState(DEFAULT_MAX_YEAR)
  const [specializations, setSpecializations] = useState<Specialization[]>([])
  const [selectedSpecs, setSelectedSpecs] = useState<number[]>([])

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
    setSpecializations([])
    setSelectedSpecs([])
    setMaxYear(DEFAULT_MAX_YEAR)
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

  // How many years does this degree have? Use the highest year that has modules.
  async function loadMaxYear(degreeId: number) {
    const { data } = await supabase
      .from('degree_modules')
      .select('year_level')
      .eq('degree_id', degreeId)
      .order('year_level', { ascending: false })
      .limit(1)

    const top = data && data.length > 0 ? data[0].year_level : 0
    setMaxYear(Math.max(DEFAULT_MAX_YEAR, top))
  }

  // Which specialisations does this degree offer at the chosen year?
  async function loadSpecializations(degreeId: number, year: number) {
    const { data, error } = await supabase
      .from('degree_specializations')
      .select('specialization_id, specialization_name, starts_year_level')
      .eq('degree_id', degreeId)
      .lte('starts_year_level', year)
      .order('specialization_name')

    if (error) {
      console.error('Error fetching specialisations:', error)
      setSpecializations([])
      return
    }
    setSpecializations(data ?? [])
  }

  function toggleSpecialization(id: number) {
    setMessage('')
    if (selectedDegree && MULTI_SPECIALIZATION_DEGREES.includes(selectedDegree)) {
      setSelectedSpecs((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      )
    } else {
      setSelectedSpecs([id])
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

    if (specializations.length > 0 && selectedSpecs.length === 0) {
      setMessage('Please choose your specialisation.')
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
          // first choice kept here for older code; the full list lives in student_specializations
          specialization_id: selectedSpecs.length > 0 ? selectedSpecs[0] : null,
        })
        .eq('student_number', studentNum)

      if (updateError) {
        console.error('Update error:', updateError)
        setMessage(`Error updating student record: ${updateError.message}`)
        setLoading(false)
        return
      }

      // Replace the student's specialisation choices with the new ones
      const { error: clearError } = await supabase
        .from('student_specializations')
        .delete()
        .eq('student_number', studentNum)

      if (clearError) {
        console.error('Clear specialisations error:', clearError)
        setMessage(`Error saving specialisation: ${clearError.message}`)
        setLoading(false)
        return
      }

      if (selectedSpecs.length > 0) {
        const { error: specError } = await supabase
          .from('student_specializations')
          .insert(
            selectedSpecs.map((id) => ({
              student_number: studentNum,
              specialization_id: id,
            }))
          )

        if (specError) {
          console.error('Save specialisations error:', specError)
          setMessage(`Error saving specialisation: ${specError.message}`)
          setLoading(false)
          return
        }
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
                      setSelectedYear('')
                      setSpecializations([])
                      setSelectedSpecs([])
                      loadMaxYear(degree.degree_id)
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
                  const value = e.target.value
                  setSelectedYear(value)
                  setSelectedSpecs([])
                  setMessage('')
                  if (value && selectedDegree) {
                    loadSpecializations(selectedDegree, Number(value))
                  } else {
                    setSpecializations([])
                  }
                }}
                style={selectStyle}
              >
                <option value="" style={{ backgroundColor: '#222', color: 'white' }}>
                  Select Year
                </option>
                {Array.from({ length: maxYear }, (_, i) => i + 1).map((y) => (
                  <option
                    key={y}
                    value={String(y)}
                    style={{ backgroundColor: '#222', color: 'white' }}
                  >
                    {yearLabel(y)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedYear && specializations.length > 0 && (
          <div style={{ marginTop: '40px', paddingBottom: '90px' }}>
            <h3>
              {selectedDegree && MULTI_SPECIALIZATION_DEGREES.includes(selectedDegree)
                ? 'Choose your specialisations (you can pick more than one)'
                : 'Choose your specialisation'}
            </h3>
            <p style={{ opacity: 0.8, marginTop: 0 }}>
              Your modules will depend on what you choose here.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '10px',
              }}
            >
              {specializations.map((spec) => (
                <button
                  key={spec.specialization_id}
                  onClick={() => toggleSpecialization(spec.specialization_id)}
                  style={{
                    ...buttonStyle,
                    marginBottom: 0,
                    backgroundColor: selectedSpecs.includes(spec.specialization_id)
                      ? 'blue'
                      : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {spec.specialization_name}
                </button>
              ))}
            </div>
          </div>
        )}

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