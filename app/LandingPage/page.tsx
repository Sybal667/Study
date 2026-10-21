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

type ElectiveModule = {
  module_id: number
  module_code: string
  module_name: string
}

type ElectiveGroup = {
  pool_id: number
  specialization_id: number | null
  choose_count: number
  required: number
  modules: ElectiveModule[]
}

// Degrees where a student may follow several specialisations at once (BA, BSc General)
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
  const [electiveGroups, setElectiveGroups] = useState<ElectiveGroup[]>([])
  const [selectedElectives, setSelectedElectives] = useState<Record<number, number[]>>({})
  const [optionsLoading, setOptionsLoading] = useState(false)

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
    resetYearChoices()
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

  function resetYearChoices() {
    setSelectedYear('')
    setSpecializations([])
    setSelectedSpecs([])
    setElectiveGroups([])
    setSelectedElectives({})
  }

  async function loadMaxYear(degreeId: number) {
    const { data } = await supabase
      .from('degree_modules')
      .select('year_level')
      .eq('degree_id', degreeId)
      .order('year_level', { ascending: false })
      .limit(1)

    const top = data?.[0]?.year_level ?? DEFAULT_MAX_YEAR
    setMaxYear(Math.max(DEFAULT_MAX_YEAR, top))
  }

  // Loads what the student has to choose in this year: specialisations and electives
  async function chooseYear(year: number) {
    if (!selectedDegree) return
    setSelectedYear(String(year))
    setSelectedSpecs([])
    setSelectedElectives({})
    setSpecializations([])
    setElectiveGroups([])
    setMessage('')
    setOptionsLoading(true)

    try {
      const { data: specData, error: specError } = await supabase
        .from('degree_specializations')
        .select('specialization_id, specialization_name, starts_year_level')
        .eq('degree_id', selectedDegree)
        .lte('starts_year_level', year)
        .order('specialization_name')

      if (specError) console.error('Error fetching specialisations:', specError)
      setSpecializations((specData as Specialization[]) ?? [])

      const { data: reqData, error: reqError } = await supabase
        .from('degree_elective_requirements')
        .select('specialization_id, pool_id, choose_count')
        .eq('degree_id', selectedDegree)
        .eq('year_level', year)
        .order('pool_id')

      if (reqError) {
        console.error('Error fetching electives:', reqError)
        return
      }

      const reqs = reqData ?? []
      if (reqs.length === 0) return

      const poolIds = reqs.map((r: any) => r.pool_id as number)
      const { data: linkData } = await supabase
        .from('elective_pool_modules')
        .select('pool_id, module_id')
        .in('pool_id', poolIds)

      const moduleIds = Array.from(new Set((linkData ?? []).map((l: any) => l.module_id as number)))
      const { data: modData } = moduleIds.length
        ? await supabase
            .from('modules')
            .select('module_id, module_code, module_name')
            .in('module_id', moduleIds)
        : { data: [] as ElectiveModule[] }

      const byId = new Map<number, ElectiveModule>()
      for (const m of (modData ?? []) as ElectiveModule[]) byId.set(m.module_id, m)

      const groups: ElectiveGroup[] = reqs.map((r: any) => {
        const mods = (linkData ?? [])
          .filter((l: any) => l.pool_id === r.pool_id)
          .map((l: any) => byId.get(l.module_id))
          .filter((m): m is ElectiveModule => !!m)
          .sort((a, b) => a.module_name.localeCompare(b.module_name))
        return {
          pool_id: r.pool_id,
          specialization_id: r.specialization_id,
          choose_count: r.choose_count,
          required: Math.min(r.choose_count, mods.length),
          modules: mods,
        }
      })
      setElectiveGroups(groups.filter((g) => g.modules.length > 0))
    } finally {
      setOptionsLoading(false)
    }
  }

  function toggleSpecialization(id: number) {
    setMessage('')
    if (selectedDegree !== null && MULTI_SPECIALIZATION_DEGREES.includes(selectedDegree)) {
      setSelectedSpecs((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
    } else {
      setSelectedSpecs((prev) => (prev.includes(id) ? [] : [id]))
    }
  }

  function toggleElective(group: ElectiveGroup, moduleId: number) {
    setMessage('')
    setSelectedElectives((prev) => {
      const current = prev[group.pool_id] ?? []
      if (current.includes(moduleId)) {
        return { ...prev, [group.pool_id]: current.filter((m) => m !== moduleId) }
      }
      if (group.choose_count === 1) return { ...prev, [group.pool_id]: [moduleId] }
      if (current.length >= group.choose_count) return prev
      return { ...prev, [group.pool_id]: [...current, moduleId] }
    })
  }

  // Elective groups that apply to the current choices (common ones + those of chosen specialisations)
  const visibleGroups = electiveGroups.filter(
    (g) => g.specialization_id === null || selectedSpecs.includes(g.specialization_id)
  )

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

    for (const g of visibleGroups) {
      const picked = (selectedElectives[g.pool_id] ?? []).length
      if (picked < g.required) {
        setMessage(`Please choose ${g.required} elective${g.required !== 1 ? 's' : ''} in every elective group.`)
        setLoading(false)
        return
      }
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
          specialization_id: selectedSpecs[0] ?? null,
        })
        .eq('student_number', studentNum)

      if (updateError) {
        console.error('Update error:', updateError)
        setMessage(`Error updating student record: ${updateError.message}`)
        setLoading(false)
        return
      }

      // Specialisation choices (replace the old ones)
      const { error: delSpecError } = await supabase
        .from('student_specializations')
        .delete()
        .eq('student_number', studentNum)
      if (delSpecError) {
        console.error('Specialisation delete error:', delSpecError)
        setMessage(`Error saving specialisation: ${delSpecError.message}`)
        setLoading(false)
        return
      }
      if (selectedSpecs.length > 0) {
        const { error: insSpecError } = await supabase
          .from('student_specializations')
          .insert(selectedSpecs.map((id) => ({ student_number: studentNum, specialization_id: id })))
        if (insSpecError) {
          console.error('Specialisation insert error:', insSpecError)
          setMessage(`Error saving specialisation: ${insSpecError.message}`)
          setLoading(false)
          return
        }
      }

      // Elective choices (replace the old ones)
      const { error: delElecError } = await supabase
        .from('student_elective_choices')
        .delete()
        .eq('student_number', studentNum)
      if (delElecError) {
        console.error('Elective delete error:', delElecError)
        setMessage(`Error saving electives: ${delElecError.message}`)
        setLoading(false)
        return
      }
      const electiveRows = visibleGroups.flatMap((g) =>
        (selectedElectives[g.pool_id] ?? []).map((module_id) => ({
          student_number: studentNum,
          pool_id: g.pool_id,
          module_id,
        }))
      )
      if (electiveRows.length > 0) {
        const { error: insElecError } = await supabase
          .from('student_elective_choices')
          .insert(electiveRows)
        if (insElecError) {
          console.error('Elective insert error:', insElecError)
          setMessage(`Error saving electives: ${insElecError.message}`)
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
                      resetYearChoices()
                      setMessage('')
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
            <div style={{ width: '420px', marginTop: '90px' }}>
              {!selectedYear ? (
                <>
                  <h3>Year of study?</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {Array.from({ length: maxYear }, (_, i) => i + 1).map((year) => (
                      <button
                        key={year}
                        onClick={() => chooseYear(year)}
                        style={{ ...buttonStyle, marginBottom: '0' }}
                      >
                        {yearLabel(year)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <h3 style={{ margin: 0 }}>{yearLabel(Number(selectedYear))}</h3>
                    <button
                      onClick={() => {
                        resetYearChoices()
                        setMessage('')
                      }}
                      style={linkButtonStyle}
                    >
                      Change year
                    </button>
                  </div>

                  {optionsLoading && <p style={{ opacity: 0.7 }}>Loading your options...</p>}

                  {!optionsLoading && specializations.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      <h3 style={{ marginBottom: '4px' }}>
                        {selectedDegree !== null && MULTI_SPECIALIZATION_DEGREES.includes(selectedDegree)
                          ? 'Choose your specialisation(s)'
                          : 'Choose your specialisation'}
                      </h3>
                      <p style={{ opacity: 0.7, marginTop: 0, fontSize: '13px' }}>
                        {selectedDegree !== null && MULTI_SPECIALIZATION_DEGREES.includes(selectedDegree)
                          ? 'You can pick more than one.'
                          : 'Pick the one you are following.'}
                      </p>
                      <div style={optionListStyle}>
                        {specializations.map((spec) => (
                          <button
                            key={spec.specialization_id}
                            onClick={() => toggleSpecialization(spec.specialization_id)}
                            style={{
                              ...buttonStyle,
                              marginBottom: '0',
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

                  {!optionsLoading &&
                    visibleGroups.map((group, index) => {
                      const picked = selectedElectives[group.pool_id] ?? []
                      const specName = specializations.find(
                        (s) => s.specialization_id === group.specialization_id
                      )?.specialization_name
                      return (
                        <div key={group.pool_id} style={{ marginTop: '20px' }}>
                          <h3 style={{ marginBottom: '4px' }}>
                            {visibleGroups.length > 1 ? `Electives (group ${index + 1})` : 'Choose your electives'}
                            {specName ? ` · ${specName}` : ''}
                          </h3>
                          <p style={{ opacity: 0.7, marginTop: 0, fontSize: '13px' }}>
                            Choose {group.required} ({picked.length}/{group.required} picked)
                          </p>
                          <div style={optionListStyle}>
                            {group.modules.map((mod) => (
                              <button
                                key={mod.module_id}
                                onClick={() => toggleElective(group, mod.module_id)}
                                style={{
                                  ...buttonStyle,
                                  marginBottom: '0',
                                  textAlign: 'left' as const,
                                  backgroundColor: picked.includes(mod.module_id)
                                    ? 'blue'
                                    : 'rgba(255,255,255,0.1)',
                                }}
                              >
                                <span style={{ opacity: 0.6, marginRight: '8px' }}>{mod.module_code}</span>
                                {mod.module_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                  {!optionsLoading && specializations.length === 0 && visibleGroups.length === 0 && (
                    <p style={{ opacity: 0.7, marginTop: '20px' }}>
                      Nothing to choose for this year. Press Continue.
                    </p>
                  )}
                </>
              )}
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

const optionListStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '8px',
  maxHeight: '320px',
  overflowY: 'auto' as const,
  paddingRight: '4px',
}

const linkButtonStyle = {
  background: 'none',
  border: 'none',
  color: 'white',
  opacity: 0.7,
  cursor: 'pointer',
  textDecoration: 'underline',
  fontSize: '13px',
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