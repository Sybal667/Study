'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Module = {
  module_id: number
  module_code: string
  module_name: string
  semester: string
}

type StudentInfo = {
  full_name: string
  degree_name: string
  current_year: number
  degree_id: number
}

export default function SelectModule() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null)
  const [modules, setModules] = useState<Module[]>([])

  useEffect(() => {
    loadStudentModules()
  }, [])

  useEffect(() => {
  const checkUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    console.log("SELECT MODULE USER:", user)
    console.log("SELECT MODULE ERROR:", error)
  }

  checkUser()
}, [])

  async function loadStudentModules() {
    try {
      setLoading(true)
      setErrorMsg('')
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user?.email) {
        router.push('/login')
        return
      }

      const studentNum = parseInt(user.email.split('@')[0])
      if (isNaN(studentNum)) {
        throw new Error('Invalid student email format')
      }

      console.log('🎓 Student Number:', studentNum)

      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`
          full_name,
          current_year,
          degree_id,
          degrees (
          degree_name
          )
        `)
        .eq('student_number', studentNum)
        .single()

      if (studentError || !studentData) {
        console.error('Student fetch error:', studentError)
        setErrorMsg('Could not find your student profile. Please complete onboarding first.')
        setLoading(false)
        return
      }

      console.log('👤 Student Data:', studentData)
      console.log('📚 Degree ID:', studentData.degree_id)
      console.log('📚 Current Year:', studentData.current_year)

      if (!studentData.degree_id || !studentData.current_year) {
        router.push('/LandingPage')
        return
      }

      const degreeObj = studentData.degrees as any
      setStudentInfo({
        full_name: studentData.full_name,
        degree_name: degreeObj?.degree_name || 'Your Degree',
        current_year: studentData.current_year,
        degree_id: studentData.degree_id
      })

      console.log('🔍 Querying degree_modules with:')
      console.log('degree_id:', studentData.degree_id)
      console.log('year_level:', studentData.current_year)

      const { data: moduleData, error: moduleError } = await supabase
        .from('degree_modules')
        .select(`
          semester,
          modules (
            module_id,
            module_code,
            module_name
          )
        `)
        .eq('degree_id', studentData.degree_id)
        .eq('year_level', studentData.current_year)

      console.log('📦 Module Data:', moduleData)
      console.log('❌ Module Error:', moduleError)

      if (moduleError) {
        console.error('Module fetch error:', moduleError)
        setErrorMsg('Failed to load your modules. Please try again.')
        setLoading(false)
        return
      }

      if (moduleData && moduleData.length > 0) {
        const formattedModules: Module[] = moduleData.map((dm: any) => ({
          module_id: dm.modules.module_id,
          module_code: dm.modules.module_code,
          module_name: dm.modules.module_name,
          semester: dm.semester || 'F'
        }))
        setModules(formattedModules)
        console.log('✅ Formatted Modules:', formattedModules)
      } else {
        setModules([])
        setErrorMsg('No modules found for your degree and year level.')
      }

    } catch (err: any) {
      console.error('Error loading modules:', err)
      setErrorMsg('Failed to load your modules. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      // Close the current session
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Logout error:', error)
        setErrorMsg('Failed to logout. Please try again.')
        return
      }

      setStudentInfo(null)
      setModules([])
      router.push('/SwitchAccount')
      router.refresh()
      
    } catch (err) {
      console.error('Logout error:', err)
      setErrorMsg('An error occurred during logout.')
    }
  }

  const handleModuleClick = (moduleCode: string) => {
    router.push(`/StudyPage/${moduleCode}`)
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={glassCardStyle}>
          <h2 style={{ textAlign: 'center' }}>Loading your modules...</h2>
          <div style={loadingSpinnerStyle} />
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={glassCardStyle}>
        
        {/* Header Section */}
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>
              Welcome back, {studentInfo?.full_name || 'Student'} 👋
            </h1>
            <p style={subtitleStyle}>
              {studentInfo?.degree_name} • Year {studentInfo?.current_year}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            style={logoutButtonStyle}
          >
            Logout
          </button>
        </div>

        {/* Error Message , the most important */}
        {errorMsg && (
          <div style={errorContainerStyle}>
            <p style={errorTextStyle}>{errorMsg}</p>
          </div>
        )}

        {/* Modules Grid */}
        <div style={modulesSectionStyle}>
          <div style={modulesHeaderStyle}>
            <h2 style={modulesTitleStyle}>Your Modules</h2>
            <span style={moduleCountStyle}>
              {modules.length} module{modules.length !== 1 ? 's' : ''}
            </span>
          </div>

          {modules.length === 0 ? (
            <div style={emptyStateStyle}>
              <p>📚 No modules found</p>
              <p style={{ fontSize: '14px', opacity: 0.6, marginTop: '10px' }}>
                Please contact your academic advisor.
              </p>
            </div>
          ) : (
            <div style={gridStyle}>
              {modules.map((mod) => (
                <div
                  key={mod.module_id}
                  onClick={() => handleModuleClick(mod.module_code)}
                  style={moduleCardStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.03)'
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'
                  }}
                >
                  <div style={cardHeaderStyle}>
                    <span style={badgeStyle}>
                      {mod.semester === 'F' ? '📅 Full Year' : `📅 Semester ${mod.semester}`}
                    </span>
                    <span style={moduleCodeStyle}>{mod.module_code}</span>
                  </div>
                  <h3 style={moduleNameStyle}>{mod.module_name}</h3>
                  <div style={cardFooterStyle}>
                    <span style={studyButtonStyle}>Start Studying →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundImage: "url('/signupbackground.png')",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  padding: '40px 20px',
  boxSizing: 'border-box' as const,
}

const glassCardStyle = {
  width: '95%',
  maxWidth: '1200px',
  minHeight: '600px',
  padding: '50px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.18)',
  boxShadow: '0 4px 30px rgba(0,0,0,0.1)',
  backdropFilter: 'blur(6px)',
  color: 'white',
  display: 'flex',
  flexDirection: 'column' as const,
}

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: '20px',
  marginBottom: '30px',
}

const titleStyle = {
  fontSize: '38px',
  margin: '0 0 5px 0',
  fontWeight: 'bold' as const,
}

const subtitleStyle = {
  opacity: 0.8,
  fontSize: '18px',
  margin: 0,
  color: '#FFD700',
}

const logoutButtonStyle = {
  background: 'rgba(255, 107, 107, 0.2)',
  border: '1px solid rgba(255, 107, 107, 0.3)',
  color: '#ff6b6b',
  padding: '8px 20px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  transition: 'all 0.2s ease',
}

const errorContainerStyle = {
  background: 'rgba(255, 107, 107, 0.1)',
  border: '1px solid rgba(255, 107, 107, 0.2)',
  borderRadius: '10px',
  padding: '15px 20px',
  marginBottom: '20px',
}

const errorTextStyle = {
  color: '#ff6b6b',
  margin: 0,
  fontWeight: 'bold' as const,
}

const modulesSectionStyle = {
  flex: 1,
}

const modulesHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '20px',
}

const modulesTitleStyle = {
  fontSize: '24px',
  margin: 0,
}

const moduleCountStyle = {
  opacity: 0.6,
  fontSize: '14px',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '25px',
}

const moduleCardStyle = {
  background: 'rgba(255, 255, 255, 0.07)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '12px',
  padding: '25px',
  cursor: 'pointer',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  display: 'flex',
  flexDirection: 'column' as const,
  height: '180px',
}

const cardHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '15px',
}

const badgeStyle = {
  backgroundColor: 'rgba(255, 215, 0, 0.15)',
  color: '#FFD700',
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: '12px',
  fontWeight: 'bold' as const,
}

const moduleCodeStyle = {
  fontSize: '14px',
  opacity: 0.5,
  fontWeight: 'bold' as const,
}

const moduleNameStyle = {
  fontSize: '20px',
  margin: '0 0 20px 0',
  color: '#fff',
  flex: 1,
}

const cardFooterStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 'auto',
}

const studyButtonStyle = {
  color: '#FFD700',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  opacity: 0.8,
}

const emptyStateStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
  opacity: 0.7,
}

const loadingSpinnerStyle = {
  marginTop: '30px',
  border: '4px solid rgba(255,255,255,0.1)',
  borderTop: '4px solid #0070f3',
  borderRadius: '50%',
  width: '40px',
  height: '40px',
  animation: 'spin 1s linear infinite',
}