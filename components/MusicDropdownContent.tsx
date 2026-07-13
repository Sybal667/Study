'use client'

import { useState } from 'react'
import Image from 'next/image'
import { navButtonStyle } from '@/lib/studyStyles'

interface MusicDropdownContentProps {
  onClose: () => void
}

export default function MusicDropdownContent({ onClose }: MusicDropdownContentProps) {
  const [activeProvider, setActiveProvider] = useState<'youtube' | 'spotify'>('youtube')
  const [isPlaying, setIsPlaying] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none')
  const [volume, setVolume] = useState(70)
  const [currentTrack, setCurrentTrack] = useState<{ title: string; artist: string } | null>(null)
  const [hoveredClose, setHoveredClose] = useState(false)
  const [hoveredPlay, setHoveredPlay] = useState(false)
  const [hoveredPrevious, setHoveredPrevious] = useState(false)
  const [hoveredNext, setHoveredNext] = useState(false)
  const [hoveredRepeat, setHoveredRepeat] = useState(false)
  const [hoveredSearch, setHoveredSearch] = useState(false)
  const [hoveredTrack, setHoveredTrack] = useState<number | null>(null)

  // Mock data for demonstration
  const mockResults = [
    { id: 1, title: 'Song 1', artist: 'Artist 1', duration: '3:20' },
    { id: 2, title: 'Song 2', artist: 'Artist 2', duration: '4:15' },
    { id: 3, title: 'Song 3', artist: 'Artist 3', duration: '2:45' },
    { id: 4, title: 'Song 4', artist: 'Artist 4', duration: '5:30' },
  ]

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleRepeatToggle = () => {
    if (repeatMode === 'none') setRepeatMode('all')
    else if (repeatMode === 'all') setRepeatMode('one')
    else setRepeatMode('none')
  }

  const getRepeatIcon = () => {
    if (repeatMode === 'none') return '🔁'
    if (repeatMode === 'all') return '🔁'
    return '🔂'
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
      {/* Provider Toggles with Close Button */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          style={{
            ...navButtonStyle,
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            backgroundColor: activeProvider === 'youtube' ? 'rgba(30, 58, 138, 0.6)' : 'rgba(255,255,255,0.05)',
            borderColor: activeProvider === 'youtube' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
            fontWeight: activeProvider === 'youtube' ? 'bold' : 'normal',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: 'white',
          }}
          onClick={() => setActiveProvider('youtube')}
        >
          <Image
            src="/youtube.png"
            alt="YouTube"
            width={18}
            height={18}
            style={{
              opacity: activeProvider === 'youtube' ? 1 : 0.5,
            }}
          />
          <span>YouTube</span>
        </button>

        <button
          style={{
            ...navButtonStyle,
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            backgroundColor: activeProvider === 'spotify' ? 'rgba(30, 58, 138, 0.6)' : 'rgba(255,255,255,0.05)',
            borderColor: activeProvider === 'spotify' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
            fontWeight: activeProvider === 'spotify' ? 'bold' : 'normal',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: 'white',
          }}
          onClick={() => setActiveProvider('spotify')}
        >
          <Image
            src="/spotify.png"
            alt="Spotify"
            width={18}
            height={18}
            style={{
              opacity: activeProvider === 'spotify' ? 1 : 0.5,
            }}
          />
          <span>Spotify</span>
        </button>

        {/* Close Button */}
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

      {/* Now Playing Section */}
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        {/* Track Info */}
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

        {/* Progress Bar */}
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
                width: '35%',
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
            <span>1:23</span>
            <span>3:45</span>
          </div>
        </div>

        {/* Volume Control */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
          }}
        >
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>🔊</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(parseInt(e.target.value))}
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
      </div>

      {/* Playback Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px',
          padding: '4px 0',
        }}
      >
        <button
          onMouseEnter={() => setHoveredPrevious(true)}
          onMouseLeave={() => setHoveredPrevious(false)}
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

      {/* Search Section */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="🔍 Search for songs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
          style={{
            ...navButtonStyle,
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: hoveredSearch ? 'rgba(30, 58, 138, 0.8)' : 'rgba(30, 58, 138, 0.6)',
            borderColor: 'rgba(255,255,255,0.2)',
          }}
        >
          Search
        </button>
      </div>

      {/* Results List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '180px',
        }}
      >
        {mockResults.map((track) => (
          <div
            key={track.id}
            onMouseEnter={() => setHoveredTrack(track.id)}
            onMouseLeave={() => setHoveredTrack(null)}
            onClick={() => {
              setCurrentTrack({ title: track.title, artist: track.artist })
              setIsPlaying(true)
            }}
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
            <span style={{ marginRight: '12px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>▶</span>
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
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
              {track.duration}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}