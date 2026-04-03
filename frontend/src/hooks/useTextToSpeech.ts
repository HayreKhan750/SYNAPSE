/**
 * useTextToSpeech — Browser SpeechSynthesis API hook
 *
 * TASK-304-F2: Uses the Web Speech API (window.speechSynthesis) to read
 * AI responses aloud. No API key required — runs entirely in the browser.
 *
 * Usage:
 *   const { isSpeaking, speak, stop, isSupported } = useTextToSpeech()
 *   speak("Hello, world!")    // starts TTS
 *   stop()                    // stops immediately
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseTextToSpeechReturn {
  isSpeaking:  boolean
  isSupported: boolean
  speak:       (text: string) => void
  stop:        () => void
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [isSpeaking,  setIsSpeaking]  = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Check browser support (only available in browser, not SSR)
  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel()
    }
  }, [isSupported])

  const stop = useCallback(() => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [isSupported])

  const speak = useCallback((text: string) => {
    if (!isSupported || !text.trim()) return

    // Cancel any current speech
    window.speechSynthesis.cancel()
    setIsSpeaking(false)

    // Strip markdown-style formatting for cleaner TTS
    const clean = text
      .replace(/```[\s\S]*?```/g, 'code block')   // code blocks → "code block"
      .replace(/`[^`]+`/g, '')                     // inline code → removed
      .replace(/\*\*([^*]+)\*\*/g, '$1')           // bold → plain
      .replace(/\*([^*]+)\*/g, '$1')               // italic → plain
      .replace(/#+\s/g, '')                         // headings → plain
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // links → link text only
      .replace(/\n{2,}/g, '. ')                    // paragraph breaks → pause
      .replace(/\n/g, ' ')
      .trim()

    if (!clean) return

    const utterance = new SpeechSynthesisUtterance(clean)
    utteranceRef.current = utterance

    // Prefer a natural-sounding English voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice =
      voices.find(v => v.lang.startsWith('en') && v.localService && v.name.includes('Natural')) ??
      voices.find(v => v.lang.startsWith('en') && v.localService) ??
      voices.find(v => v.lang.startsWith('en')) ??
      null

    if (preferredVoice) utterance.voice = preferredVoice
    utterance.rate   = 1.0
    utterance.pitch  = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend   = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [isSupported])

  return { isSpeaking, isSupported, speak, stop }
}
