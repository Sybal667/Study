'use client'

import { useState } from 'react'
import Image from 'next/image'
import { navButtonStyle } from '@/lib/studyStyles'
import { useMusicContext } from '@/lib/musicContext'

interface MusicDropdownContentProps {
  onClose: () => void
}

interface YouTubeTrack {
  id: string
  title: string
  artist: string
  thumbnail?: string
}

export default function MusicDropdownContent({ onClose }: MusicDropdownContentProps) {
  const {
    searchResults,
    setSearchResults,
    currentTrack,
    isPlaying,
    volume,
    repeatMode,
    progress,
    playTrackAtIndex,
    handlePlayPause,
    handlePrevious,
    handleNext,
    handleRepeatToggle,
    setVolumeLevel,
  } = useMusicContext()

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [hoveredClose, setHoveredClose] = useState(false)
  const [hoveredPlay, setHoveredPlay] = useState(false)
  const [hoveredPrevious, setHoveredPrevious] = useState(false)
  const [hoveredNext, setHoveredNext] = useState(false)
  const [hoveredRepeat, setHoveredRepeat] = useState(false)
  const [hoveredSearch, setHoveredSearch] = useState(false)
  const [hoveredTrack, setHoveredTrack] = useState<string | null>(null)

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getRepeatIcon = () => {
    if (repeatMode === 'none') return '🔁'
    if (repeatMode === 'all') return '🔁'
    return '🔂'
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchError(null)

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`)
      if (!res.ok) throw new Error('Search failed')

      const data = await res.json()
      setSearchResults(data.results)
    } catch (err) {
      console.error(err)
      setSearchError('Could not load results. Try again.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: '480px',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div
          style={{
            ...navButtonStyle,
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            backgroundColor: 'rgba(30, 58, 138, 0.6)',
            borderColor: 'rgba(255,255,255,0.3)',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: 'white',
          }}
        >
          <Image src="/youtube.png" alt="YouTube" width={18} height={18} />
          <span>YouTube</span>
        </div>

        <button
          onClick={onClose}
          onMouseEnter={() => setHoveredClose(true)}
          onMouseLeave={() => setHoveredClose(false)}
          style={{
            ...navButtonStyle,
            flex: 0.4,
            padding: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: hoveredClose ? 'rgba(255, 0, 0, 0.4)' : 'rgba(255, 0, 0, 0.2)',
            borderColor: 'rgba(255, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '6px',
              backgroundColor: 'rgba(30, 58, 138, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0,
            }}
          >
            🎵
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: 'white',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentTrack?.title || 'No track selected'}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.6)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentTrack?.artist || 'Ready to play'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '10px' }}>
          <div
            style={{
              height: '3px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '2px',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: progress.duration
                  ? `${Math.min((progress.current / progress.duration) * 100, 100)}%`
                  : '0%',
                height: '100%',
                backgroundColor: 'rgba(76, 175, 80, 0.8)',
                borderRadius: '2px',
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.5)',
              marginTop: '4px',
            }}
          >
            <span>{formatTime(progress.current)}</span>
            <span>{formatTime(progress.duration)}</span>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '20px',
            marginTop: '8px',
          }}
        >
          <button
            onMouseEnter={() => setHoveredPrevious(true)}
            onMouseLeave={() => setHoveredPrevious(false)}
            onClick={handlePrevious}
            style={{
              background: 'none',
              border: '1px solid transparent',
              color: 'white',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '20px',
              borderRadius: '6px',
              transition: 'all 0.2s',
              backgroundColor: hoveredPrevious ? 'rgba(255,255,255,0.1)' : 'transparent',
            }}
          >
            ⏮️
          </button>

          <button
            onMouseEnter={() => setHoveredPlay(true)}
            onMouseLeave={() => setHoveredPlay(false)}
            onClick={handlePlayPause}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              cursor: 'pointer',
              padding: '10px 14px',
              fontSize: '24px',
              borderRadius: '50%',
              backgroundColor: hoveredPlay ? 'rgba(30, 58, 138, 0.8)' : 'rgba(30, 58, 138, 0.6)',
              transition: 'all 0.2s',
            }}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>

          <button
            onMouseEnter={() => setHoveredNext(true)}
            onMouseLeave={() => setHoveredNext(false)}
            onClick={handleNext}
            style={{
              background: 'none',
              border: '1px solid transparent',
              color: 'white',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '20px',
              borderRadius: '6px',
              transition: 'all 0.2s',
              backgroundColor: hoveredNext ? 'rgba(255,255,255,0.1)' : 'transparent',
            }}
          >
            ⏭️
          </button>

          <button
            onMouseEnter={() => setHoveredRepeat(true)}
            onMouseLeave={() => setHoveredRepeat(false)}
            onClick={handleRepeatToggle}
            style={{
              background: 'none',
              border: '1px solid transparent',
              color: repeatMode !== 'none' ? 'rgba(76, 175, 80, 1)' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              padding: '8px',
              fontSize: '18px',
              borderRadius: '6px',
              transition: 'all 0.2s',
              backgroundColor: hoveredRepeat ? 'rgba(255,255,255,0.1)' : 'transparent',
            }}
          >
            {getRepeatIcon()}
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 0',
        }}
      >
        <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>🔊</span>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolumeLevel(parseInt(e.target.value))}
          style={{
            flex: 1,
            height: '3px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
            accentColor: 'rgba(76, 175, 80, 0.8)',
            cursor: 'pointer',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="🔍 Search for songs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch()
          }}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.4)'
          }}
          onBlur={(e) => {
            ;(e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.2)'
          }}
        />
        <button
          onMouseEnter={() => setHoveredSearch(true)}
          onMouseLeave={() => setHoveredSearch(false)}
          onClick={handleSearch}
          disabled={isSearching}
          style={{
            ...navButtonStyle,
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: hoveredSearch ? 'rgba(30, 58, 138, 0.8)' : 'rgba(30, 58, 138, 0.6)',
            borderColor: 'rgba(255,255,255,0.2)',
            opacity: isSearching ? 0.6 : 1,
            cursor: isSearching ? 'not-allowed' : 'pointer',
          }}
        >
          {isSearching ? '...' : 'Search'}
        </button>
      </div>

      <div
        className="music-results-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '180px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.25) transparent',
        }}
      >
        {searchError && (
          <div style={{ padding: '10px', fontSize: '12px', color: 'rgba(255,120,120,0.9)' }}>
            {searchError}
          </div>
        )}

        {!searchError && !isSearching && searchResults.length === 0 && (
          <div style={{ padding: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            Search for a song to get started.
          </div>
        )}

        {searchResults.map((track: YouTubeTrack, index: number) => (
          <div
            key={track.id}
            onMouseEnter={() => setHoveredTrack(track.id)}
            onMouseLeave={() => setHoveredTrack(null)}
            onClick={() => playTrackAtIndex(index, false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: hoveredTrack === track.id ? 'rgba(255,255,255,0.08)' : 'transparent',
              borderColor: hoveredTrack === track.id ? 'rgba(255,255,255,0.1)' : 'transparent',
            }}
          >
            {track.thumbnail ? (
              <img
                src={track.thumbnail}
                alt=""
                style={{ width: '36px', height: '36px', borderRadius: '6px', marginRight: '10px', flexShrink: 0 }}
              />
            ) : (
              <span style={{ marginRight: '12px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>▶</span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  color: 'white',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {track.title}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.5)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {track.artist}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .music-results-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .music-results-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .music-results-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.18);
          border-radius: 10px;
        }
        .music-results-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.35);
        }
      `}</style>
    </div>
  )
}