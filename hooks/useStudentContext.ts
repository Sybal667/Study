import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useStudentContext() {
  const [studentNumber, setStudentNumber] = useState<number | null>(null)
  const [moduleId, setModuleId] = useState<number | null>(null)
  const [documents, setDocuments] = useState<any[]>([])

  const loadContext = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    console.log('Auth user:', user)
    console.log('Auth error:', error)

    if (!user?.email) return

    const studentNum = parseInt(user.email.split('@')[0])
    console.log('Student number:', studentNum)
    setStudentNumber(studentNum)
    const pathParts = window.location.pathname.split('/')
    const moduleCode = pathParts[pathParts.length - 1]

    // fetching module_id -- i forget the names of  the column🤣
    const { data: mod } = await supabase
      .from('modules')
      .select('module_id')
      .eq('module_code', moduleCode)
      .single()
    console.log('Module query:', mod)
    setModuleId(mod?.module_id || null)
  }

  const loadDocuments = async () => {
    console.log('CHECK INPUTS', {
      studentNumber,
      moduleId,
    })
    const { data, error } = await supabase
      .from('student_pdfs')
      .select('*')
      .eq('student_number', studentNumber)
      .eq('module_id', moduleId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setDocuments(data || [])
  }

  useEffect(() => {
    console.log('Calling loadContext...')
    loadContext()
  }, [])

  useEffect(() => {
    if (!studentNumber || !moduleId) return
    loadDocuments()
  }, [studentNumber, moduleId])

  return { studentNumber, moduleId, documents, loadDocuments }
}
