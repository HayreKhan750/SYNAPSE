'use client'
// Documents merged into Agents page — redirect transparently
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DocumentsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/agents') }, [router])
  return null
}
