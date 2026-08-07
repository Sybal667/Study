'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

interface YouTubeTrack {
  id: string
  title: string
  artist: string
  thumbnail?: string
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

interface MusicContextValue {
  searchResults: YouTubeTrack[]
  setSearchResults: (tracks: YouTubeTrack[]) => void
  currentTrack: { title: string; artist: string } | null
  currentIndex: number
  isPlaying: boolean
  volume: number
  repeatMode: 'none' | 'all' | 'one'
  progress: { current: number; duration: number }
  isPlayerReady: boolean
  playTrackAtIndex: (index: number, wrap: boolean) => void
  handlePlayPause: () => void
  handlePrevious: () => void
  handleNext: () => void
  handleRepeatToggle: () => void
  setVolumeLevel: (v: number) => void
}

const MusicContext = createContext<MusicContextValue | null>(null)

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const playerRef = useRef<any>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)

  const [searchResults, setSearchResults] = useState<YouTubeTrack[]>([])
  const [currentTrack, setCurrentTrack] = useState<{ title: string; artist: string } | null>(null)
  const [currentIndex, setCurrentIndex] = useState<number>(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(70)
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none')
  const [progress, setProgress] = useState({ current: 0, duration: 0 })

  const repeatModeRef = useRef(repeatMode)
  const searchResultsRef = useRef(searchResults)
  useEffect(() => { repeatModeRef.current = repeatMode }, [repeatMode])
  useEffect(() => { searchResultsRef.current = searchResults }, [searchResults])

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsPlayerReady(true)
      return
    }

    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'youtube-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }

    window.onYouTubeIframeAPIReady = () => setIsPlayerReady(true)
  }, [])

  const playTrackAtIndex = (index: number, wrap: boolean) => {
    const results = searchResultsRef.current
    if (results.length === 0) return

    const targetIndex = wrap
      ? ((index % results.length) + results.length) % results.length
      : index

    const track = results[targetIndex]
    if (!track || !playerRef.current) return

    playerRef.current.loadVideoById(track.id)
    playerRef.current.playVideo()
    setCurrentTrack({ title: track.title, artist: track.artist })
    setCurrentIndex(targetIndex)
    setIsPlaying(true)
  }

  useEffect(() => {
    if (!isPlayerReady || playerRef.current || !playerContainerRef.current) return

    playerRef.current = new window.YT.Player(playerContainerRef.current, {
      height: '0',
      width: '0',
      playerVars: { autoplay: 0 },
      events: {
        onReady: (event: any) => event.target.setVolume(volume),
        onStateChange: (event: any) => {
          const state = window.YT.PlayerState
          if (event.data === state.PLAYING) setIsPlaying(true)
          if (event.data === state.PAUSED) setIsPlaying(false)

          if (event.data === state.ENDED) {
            const mode = repeatModeRef.current
            if (mode === 'one') {
              event.target.seekTo(0)
              event.target.playVideo()
            } else if (mode === 'all') {
              playTrackAtIndex(currentIndex + 1, true)
            } else {
              const next = currentIndex + 1
              if (next < searchResultsRef.current.length) playTrackAtIndex(next, false)
              else setIsPlaying(false)
            }
          }
        },
      },
    })
  }, [isPlayerReady])

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      const player = playerRef.current
      if (player?.getCurrentTime && player?.getDuration) {
        setProgress({ current: player.getCurrentTime() || 0, duration: player.getDuration() || 0 })
      }
    }, 500)
    return () => clearInterval(interval)
  }, [isPlaying])

  const handlePlayPause = () => {
    const player = playerRef.current
    if (!player) return
    isPlaying ? player.pauseVideo() : player.playVideo()
  }

  const handlePrevious = () => {
    if (currentIndex > 0) playTrackAtIndex(currentIndex - 1, false)
  }

  const handleNext = () => {
    if (currentIndex >= 0) playTrackAtIndex(currentIndex + 1, repeatMode === 'all')
  }

  const handleRepeatToggle = () => {
    setRepeatMode((prev) => (prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none'))
  }

  const setVolumeLevel = (v: number) => {
    setVolume(v)
    playerRef.current?.setVolume(v)
  }

  return (
    <MusicContext.Provider
      value={{
        searchResults,
        setSearchResults,
        currentTrack,
        currentIndex,
        isPlaying,
        volume,
        repeatMode,
        progress,
        isPlayerReady,
        playTrackAtIndex,
        handlePlayPause,
        handlePrevious,
        handleNext,
        handleRepeatToggle,
        setVolumeLevel,
      }}
    >
      <div style={{ display: 'none' }}>
        <div ref={playerContainerRef} suppressHydrationWarning />
      </div>
      {children}
    </MusicContext.Provider>
  )
}

export function useMusicContext() {
  const ctx = useContext(MusicContext)
  if (!ctx) throw new Error('useMusicContext must be used inside MusicProvider')
  return ctx
}