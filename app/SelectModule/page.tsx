'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type ModuleSource = 'degree' | 'elective' | 'extra'

type Module = {
  module_id: number
  module_code: string
  module_name: string
  semester: string
  source: ModuleSource
  is_custom: boolean
}

type SearchResult = {
  module_id: number
  module_code: string
  module_name: string
}

type StudentInfo = {
  full_name: string
  degree_name: string
  current_year: number
  degree_id: number
  specializations: string[]
}

type LayoutRow = { module_id: number; position: number; hidden: boolean }

export default function SelectModule() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null)
  const [studentNumber, setStudentNumber] = useState<number | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [hiddenModules, setHiddenModules] = useState<Module[]>([])
  const [dragId, setDragId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [writingOwn, setWritingOwn] = useState(false)
  const [ownName, setOwnName] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const searchSeq = useRef(0)

  useEffect(() => {
    loadStudentModules()
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
      setStudentNumber(studentNum)

      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select(`
          full_name,
          current_year,
          degree_id,
          specialization_id,
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

      if (!studentData.degree_id || !studentData.current_year) {
        router.push('/LandingPage')
        return
      }
      const { data: offered } = await supabase
        .from('degree_specializations')
        .select('specialization_id, specialization_name')
        .eq('degree_id', studentData.degree_id)
        .lte('starts_year_level', studentData.current_year)

      const { data: chosenRows } = await supabase
        .from('student_specializations')
        .select('specialization_id')
        .eq('student_number', studentNum)

      const offeredIds = (offered ?? []).map((s: any) => s.specialization_id as number)
      let chosenIds = (chosenRows ?? [])
        .map((r: any) => r.specialization_id as number)
        .filter((id) => offeredIds.includes(id))

      if (chosenIds.length === 0 && studentData.specialization_id && offeredIds.includes(studentData.specialization_id)) {
        chosenIds = [studentData.specialization_id]
      }

      if (offeredIds.length > 0 && chosenIds.length === 0) {
        router.push('/LandingPage')
        return
      }

      const chosenNames = (offered ?? [])
        .filter((s: any) => chosenIds.includes(s.specialization_id))
        .map((s: any) => s.specialization_name as string)

      const degreeObj = studentData.degrees as any
      setStudentInfo({
        full_name: studentData.full_name,
        degree_name: degreeObj?.degree_name || 'Your Degree',
        current_year: studentData.current_year,
        degree_id: studentData.degree_id,
        specializations: chosenNames,
      })

      let moduleQuery = supabase
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

      moduleQuery = chosenIds.length > 0
        ? moduleQuery.or(`specialization_id.is.null,specialization_id.in.(${chosenIds.join(',')})`)
        : moduleQuery.is('specialization_id', null)

      const { data: moduleData, error: moduleError } = await moduleQuery

      if (moduleError) {
        console.error('Module fetch error:', moduleError)
        setErrorMsg('Failed to load your modules. Please try again.')
        setLoading(false)
        return
      }

      const all = new Map<number, Module>()
      for (const dm of (moduleData ?? []) as any[]) {
        if (!dm.modules || all.has(dm.modules.module_id)) continue
        all.set(dm.modules.module_id, {
          module_id: dm.modules.module_id,
          module_code: dm.modules.module_code,
          module_name: dm.modules.module_name,
          semester: dm.semester || 'F',
          source: 'degree',
          is_custom: false,
        })
      }
      const degreeOrder = Array.from(all.values()).sort((a, b) => a.module_code.localeCompare(b.module_code))
      all.clear()
      for (const m of degreeOrder) all.set(m.module_id, m)

      const { data: reqData } = await supabase
        .from('degree_elective_requirements')
        .select('pool_id, specialization_id, semester')
        .eq('degree_id', studentData.degree_id)
        .eq('year_level', studentData.current_year)

      const activeReqs = (reqData ?? []).filter(
        (r: any) => r.specialization_id === null || chosenIds.includes(r.specialization_id)
      )
      if (activeReqs.length > 0) {
        const poolIds = activeReqs.map((r: any) => r.pool_id as number)
        const semesterOfPool = new Map<number, string>()
        for (const r of activeReqs as any[]) semesterOfPool.set(r.pool_id, r.semester || 'F')

        const { data: pickRows } = await supabase
          .from('student_elective_choices')
          .select('pool_id, module_id')
          .eq('student_number', studentNum)
          .in('pool_id', poolIds)

        const pickIds = Array.from(new Set((pickRows ?? []).map((p: any) => p.module_id as number)))
        if (pickIds.length > 0) {
          const { data: pickMods } = await supabase
            .from('modules')
            .select('module_id, module_code, module_name')
            .in('module_id', pickIds)

          const electives = ((pickMods ?? []) as any[])
            .map((m) => {
              const pool = (pickRows ?? []).find((p: any) => p.module_id === m.module_id) as any
              return {
                module_id: m.module_id,
                module_code: m.module_code,
                module_name: m.module_name,
                semester: semesterOfPool.get(pool?.pool_id) || 'F',
                source: 'elective' as ModuleSource,
                is_custom: false,
              }
            })
            .sort((a, b) => a.module_code.localeCompare(b.module_code))
          for (const m of electives) if (!all.has(m.module_id)) all.set(m.module_id, m)
        }
      }

      const { data: extraRows } = await supabase
        .from('student_extra_modules')
        .select('module_id, created_at')
        .eq('student_number', studentNum)
        .order('created_at', { ascending: true })

      const extraIds = (extraRows ?? []).map((e: any) => e.module_id as number)
      if (extraIds.length > 0) {
        const { data: extraMods } = await supabase
          .from('modules')
          .select('module_id, module_code, module_name, is_custom')
          .in('module_id', extraIds)

        const byId = new Map<number, any>()
        for (const m of (extraMods ?? []) as any[]) byId.set(m.module_id, m)
        for (const id of extraIds) {
          const m = byId.get(id)
          if (!m || all.has(id)) continue
          all.set(id, {
            module_id: m.module_id,
            module_code: m.module_code,
            module_name: m.module_name,
            semester: 'F',
            source: 'extra',
            is_custom: !!m.is_custom,
          })
        }
      }

      const { data: layoutRows } = await supabase
        .from('student_module_layout')
        .select('module_id, position, hidden')
        .eq('student_number', studentNum)

      const layout = new Map<number, LayoutRow>()
      for (const l of (layoutRows ?? []) as LayoutRow[]) layout.set(l.module_id, l)

      const defaultOrder = Array.from(all.values())
      const visible = defaultOrder.filter((m) => !layout.get(m.module_id)?.hidden)
      const hidden = defaultOrder.filter((m) => layout.get(m.module_id)?.hidden)

      const placed = visible
        .filter((m) => layout.has(m.module_id))
        .sort((a, b) => layout.get(a.module_id)!.position - layout.get(b.module_id)!.position)
      const unplaced = visible.filter((m) => !layout.has(m.module_id))

      setModules([...placed, ...unplaced])
      setHiddenModules(hidden)
    } catch (err: any) {
      console.error('Error loading modules:', err)
      setErrorMsg('Failed to load your modules. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
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

  async function saveOrder(list: Module[]) {
    if (studentNumber === null) return
    const rows = list.map((m, index) => ({
      student_number: studentNumber,
      module_id: m.module_id,
      position: index,
      hidden: false,
    }))
    const { error } = await supabase
      .from('student_module_layout')
      .upsert(rows, { onConflict: 'student_number,module_id' })
    if (error) {
      console.error('Save order error:', error)
      setErrorMsg('Could not save your new order. Please try again.')
    }
  }

  function handleDrop(targetId: number) {
    if (dragId === null || dragId === targetId) {
      setDragId(null)
      setOverId(null)
      return
    }
    const from = modules.findIndex((m) => m.module_id === dragId)
    const to = modules.findIndex((m) => m.module_id === targetId)
    if (from < 0 || to < 0) return
    const next = [...modules]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setModules(next)
    setDragId(null)
    setOverId(null)
    saveOrder(next)
  }

  // ---------- remove / restore ----------

  async function removeModule(mod: Module) {
    if (studentNumber === null) return
    const message = mod.is_custom
      ? `Remove "${mod.module_name}"? This is your own module and it will be deleted from your list.`
      : `Remove "${mod.module_name}" from your modules? You can restore it later.`
    if (!window.confirm(message)) return

    setErrorMsg('')
    if (mod.source === 'extra') {
      const { error } = await supabase
        .from('student_extra_modules')
        .delete()
        .eq('student_number', studentNumber)
        .eq('module_id', mod.module_id)
      if (error) {
        console.error('Remove extra error:', error)
        setErrorMsg('Could not remove the module. Please try again.')
        return
      }
      await supabase
        .from('student_module_layout')
        .delete()
        .eq('student_number', studentNumber)
        .eq('module_id', mod.module_id)
      setModules((prev) => prev.filter((m) => m.module_id !== mod.module_id))
      return
    }

    const { error } = await supabase
      .from('student_module_layout')
      .upsert(
        [{ student_number: studentNumber, module_id: mod.module_id, position: 0, hidden: true }],
        { onConflict: 'student_number,module_id' }
      )
    if (error) {
      console.error('Hide module error:', error)
      setErrorMsg('Could not remove the module. Please try again.')
      return
    }
    setModules((prev) => prev.filter((m) => m.module_id !== mod.module_id))
    setHiddenModules((prev) => [...prev, mod])
  }

  async function restoreModule(mod: Module) {
    if (studentNumber === null) return
    const { error } = await supabase
      .from('student_module_layout')
      .upsert(
        [{ student_number: studentNumber, module_id: mod.module_id, position: modules.length, hidden: false }],
        { onConflict: 'student_number,module_id' }
      )
    if (error) {
      console.error('Restore module error:', error)
      setErrorMsg('Could not restore the module. Please try again.')
      return
    }
    setHiddenModules((prev) => prev.filter((m) => m.module_id !== mod.module_id))
    setModules((prev) => [...prev, mod])
  }

  // ---------- add module popup ----------

  function openAdd() {
    setShowAdd(true)
    setQuery('')
    setResults([])
    setWritingOwn(false)
    setOwnName('')
    setAddError('')
  }

  function closeAdd() {
    setShowAdd(false)
    setAdding(false)
  }

  // Search the module catalogue as the student types (not case sensitive , i hate developers who make it case sensitive even when not neccessary)
  useEffect(() => {
    if (!showAdd || writingOwn) return
    const text = query.replace(/[,()%*\\]/g, ' ').trim()
    if (text.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    const seq = ++searchSeq.current
    setSearching(true)
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('modules')
        .select('module_id, module_code, module_name')
        .eq('is_custom', false)
        .or(`module_name.ilike.%${text}%,module_code.ilike.%${text}%`)
        .order('module_code')
        .limit(30)

      if (seq !== searchSeq.current) return
      if (error) {
        console.error('Module search error:', error)
        setResults([])
      } else {
        setResults((data as SearchResult[]) ?? [])
      }
      setSearching(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query, showAdd, writingOwn])

  async function addCatalogueModule(result: SearchResult) {
    if (studentNumber === null || adding) return
    setAdding(true)
    setAddError('')

    if (modules.some((m) => m.module_id === result.module_id)) {
      setAddError('That module is already in your list.Sheba hantle')
      setAdding(false)
      return
    }

    const hidden = hiddenModules.find((m) => m.module_id === result.module_id)
    if (hidden) {
      await restoreModule(hidden)
      closeAdd()
      return
    }

    const { error } = await supabase
      .from('student_extra_modules')
      .insert({ student_number: studentNumber, module_id: result.module_id })

    if (error) {
      console.error('Add module error:', error)
      setAddError('Could not add the module. Please try again.')
      setAdding(false)
      return
    }

    setModules((prev) => [
      ...prev,
      {
        module_id: result.module_id,
        module_code: result.module_code,
        module_name: result.module_name,
        semester: 'F',
        source: 'extra',
        is_custom: false,
      },
    ])
    closeAdd()
  }

  async function addOwnModule() {
    const name = ownName.trim()
    if (name.length < 2) {
      setAddError('Please type the module name.')
      return
    }
    setAdding(true)
    setAddError('')

    const { data, error } = await supabase.rpc('add_custom_module', { p_name: name })
    const row = Array.isArray(data) ? data[0] : data

    if (error || !row) {
      console.error('Add custom module error:', error)
      setAddError(error?.message || 'Could not add your module. Please try again.')
      setAdding(false)
      return
    }

    setModules((prev) => [
      ...prev,
      {
        module_id: row.module_id,
        module_code: row.module_code,
        module_name: row.module_name,
        semester: 'F',
        source: 'extra',
        is_custom: true,
      },
    ])
    closeAdd()
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

  const typed = query.trim()

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
              {studentInfo && studentInfo.specializations.length > 0 &&
                ` • ${studentInfo.specializations.join(', ')}`}
            </p>
            <button
              onClick={() => router.push('/LandingPage')}
              style={{ background: 'none', border: 'none', color: 'white', opacity: 0.7, cursor: 'pointer', padding: 0, marginTop: '6px', textDecoration: 'underline', fontSize: '13px' }}
            >
              Change year, specialisation or electives
            </button>
          </div>
          <button
            onClick={handleLogout}
            style={logoutButtonStyle}
          >
            Logout
          </button>
        </div>

        {/* Error Message */}
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
              {modules.length} module{modules.length !== 1 ? 's' : ''} • drag a card to rearrange
            </span>
          </div>

          <div style={gridStyle}>
            {modules.map((mod) => (
              <div
                key={mod.module_id}
                draggable
                onDragStart={(e) => {
                  setDragId(mod.module_id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(mod.module_id))
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (overId !== mod.module_id) setOverId(mod.module_id)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(mod.module_id)
                }}
                onDragEnd={() => {
                  setDragId(null)
                  setOverId(null)
                }}
                onClick={() => handleModuleClick(mod.module_code)}
                style={{
                  ...moduleCardStyle,
                  opacity: dragId === mod.module_id ? 0.4 : 1,
                  outline: overId === mod.module_id && dragId !== mod.module_id ? '2px dashed #FFD700' : 'none',
                  position: 'relative' as const,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'
                }}
              >
                <div style={cardHeaderStyle}>
                  <span style={badgeStyle}>
                    {mod.semester === 'F' ? '📅 Full Year' : `📅 Semester ${mod.semester}`}
                  </span>
                  <span style={moduleCodeStyle}>
                    {mod.is_custom ? 'Custom' : mod.module_code}
                  </span>
                </div>
                <h3 style={moduleNameStyle}>{mod.module_name}</h3>
                <div style={cardFooterStyle}>
                  {mod.source !== 'degree' && (
                    <span style={{ ...tagStyle, marginRight: 'auto' }}>
                      {mod.source === 'elective' ? 'Elective' : 'Added by you'}
                    </span>
                  )}
                  <span style={studyButtonStyle}>Start Studying →</span>
                </div>
                <button
                  title="Remove module"
                  aria-label={`Remove ${mod.module_name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeModule(mod)
                  }}
                  style={removeButtonStyle}
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Empty slot to add a module */}
            <div
              onClick={openAdd}
              style={addCardStyle}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openAdd()
              }}
            >
              <span style={{ fontSize: '40px', lineHeight: 1 }}>+</span>
              <span style={{ marginTop: '8px', fontWeight: 'bold' }}>Add a module</span>
            </div>
          </div>

          {modules.length === 0 && (
            <p style={{ opacity: 0.6, textAlign: 'center', marginTop: '20px' }}>
              No modules yet. Use “Add a module” to build your list.
            </p>
          )}

          {hiddenModules.length > 0 && (
            <div style={{ marginTop: '30px' }}>
              <p style={{ opacity: 0.7, fontSize: '14px', marginBottom: '8px' }}>Removed modules (click to restore)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {hiddenModules.map((m) => (
                  <button key={m.module_id} onClick={() => restoreModule(m)} style={restoreChipStyle}>
                    ↩ {m.module_code} {m.module_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Add module popup */}
      {showAdd && (
        <div style={overlayStyle} onClick={closeAdd}>
          <div
            style={popupStyle}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeAdd()
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '22px' }}>
                {writingOwn ? 'Write your own module' : 'Add a module'}
              </h2>
              <button onClick={closeAdd} style={popupCloseStyle} aria-label="Close">✕</button>
            </div>

            {!writingOwn ? (
              <>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setAddError('')
                  }}
                  placeholder="Search by module name or code..."
                  style={searchInputStyle}
                />

                <div style={resultListStyle}>
                  {/* "Other" is always the first option */}
                  <button
                    onClick={() => {
                      setOwnName(typed)
                      setWritingOwn(true)
                      setAddError('')
                    }}
                    style={{ ...resultItemStyle, borderColor: '#FFD700', color: '#FFD700' }}
                  >
                    ✏️ Other — write my own module name
                  </button>

                  {searching && <p style={{ opacity: 0.6, margin: '8px 4px' }}>Searching...</p>}

                  {!searching && typed.length >= 2 && results.length === 0 && (
                    <p style={{ opacity: 0.6, margin: '8px 4px' }}>
                      No modules match “{typed}”. Use “Other” to add it yourself.
                    </p>
                  )}

                  {typed.length < 2 && (
                    <p style={{ opacity: 0.5, margin: '8px 4px', fontSize: '13px' }}>
                      Type at least 2 letters to search all modules.
                    </p>
                  )}

                  {results.map((r) => {
                    const already = modules.some((m) => m.module_id === r.module_id)
                    return (
                      <button
                        key={r.module_id}
                        disabled={already || adding}
                        onClick={() => addCatalogueModule(r)}
                        style={{ ...resultItemStyle, opacity: already ? 0.4 : 1, cursor: already ? 'default' : 'pointer' }}
                      >
                        <span style={{ opacity: 0.6, marginRight: '10px' }}>{r.module_code}</span>
                        {r.module_name}
                        {already && <span style={{ float: 'right', opacity: 0.7 }}>Added</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <>
                <input
                  autoFocus
                  value={ownName}
                  maxLength={120}
                  onChange={(e) => {
                    setOwnName(e.target.value)
                    setAddError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addOwnModule()
                  }}
                  placeholder="Module name, e.g. Intro to Statistics"
                  style={searchInputStyle}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button
                    onClick={() => {
                      setWritingOwn(false)
                      setAddError('')
                    }}
                    style={secondaryButtonStyle}
                  >
                    Back
                  </button>
                  <button onClick={addOwnModule} disabled={adding} style={primaryButtonStyle}>
                    {adding ? 'Adding...' : 'Add module'}
                  </button>
                </div>
              </>
            )}

            {addError && <p style={{ color: '#ff6b6b', marginTop: '12px', marginBottom: 0 }}>{addError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundImage: "url('/signupbackground.jpg.jpeg')",
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
const tagStyle = {
  backgroundColor: 'rgba(255,255,255,0.12)',
  color: 'white',
  padding: '3px 10px',
  borderRadius: '20px',
  fontSize: '11px',
}

const removeButtonStyle = {
  position: 'absolute' as const,
  top: '8px',
  right: '8px',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(255,107,107,0.18)',
  color: '#ff6b6b',
  cursor: 'pointer',
  fontSize: '12px',
  lineHeight: 1,
}

const addCardStyle = {
  border: '2px dashed rgba(255,255,255,0.35)',
  borderRadius: '12px',
  height: '180px',
  boxSizing: 'border-box' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.8)',
  background: 'rgba(255,255,255,0.03)',
}

const restoreChipStyle = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: 'white',
  borderRadius: '20px',
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: '13px',
}

const overlayStyle = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1000,
}

const popupStyle = {
  width: '100%',
  maxWidth: '560px',
  background: 'rgba(25,25,35,0.97)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '14px',
  padding: '24px',
  color: 'white',
  boxShadow: '0 10px 50px rgba(0,0,0,0.5)',
}

const popupCloseStyle = {
  background: 'none',
  border: 'none',
  color: 'white',
  opacity: 0.7,
  cursor: 'pointer',
  fontSize: '18px',
}

const searchInputStyle = {
  width: '100%',
  marginTop: '16px',
  padding: '14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.3)',
  backgroundColor: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontSize: '16px',
  outline: 'none',
  boxSizing: 'border-box' as const,
}

const resultListStyle = {
  marginTop: '12px',
  maxHeight: '320px',
  overflowY: 'auto' as const,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6px',
}

const resultItemStyle = {
  textAlign: 'left' as const,
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)',
  color: 'white',
  fontSize: '14px',
  cursor: 'pointer',
}

const primaryButtonStyle = {
  flex: 1,
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  background: '#FFD700',
  color: 'black',
  fontWeight: 'bold' as const,
  cursor: 'pointer',
}

const secondaryButtonStyle = {
  padding: '12px 22px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.3)',
  background: 'transparent',
  color: 'white',
  cursor: 'pointer',
}