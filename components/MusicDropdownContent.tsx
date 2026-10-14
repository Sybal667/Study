'use client'

import { useState } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Volume1,
  Volume2,
  VolumeX,
  Search,
  X,
  Music2,
} from 'lucide-react'
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

const QUICK_PICKS = ['Lo-fi beats', 'Study music', 'Classical piano', 'Jazz', 'Rain sounds', 'Ambient']

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
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
    seekTo,
  } = useMusicContext()

  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [lastVolume, setLastVolume] = useState(70)

  const runSearch = async (q: string) => {
    const query = q.trim()
    if (!query) return
    setIsSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`)
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

  const toggleMute = () => {
    if (volume > 0) {
      setLastVolume(volume)
      setVolumeLevel(0)
    } else {
      setVolumeLevel(lastVolume || 70)
    }
  }

  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2
  const progressPct = progress.duration ? Math.min((progress.current / progress.duration) * 100, 100) : 0

  return (
    <div className="mp">
      {/* 1. Header */}
      <div className="mp-header">
        <div className="mp-title">
          <Music2 size={16} color="#ff0033" />
          <span>YouTube Music</span>
        </div>
        <button className="mp-icon-btn" onClick={onClose} aria-label="Close music player">
          <X size={18} />
        </button>
      </div>

      {/* 2. Search */}
      <div className="mp-search">
        <input
          type="text"
          placeholder="Search songs, artists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch(searchQuery)
          }}
        />
        <div className="mp-search-actions">
          {searchQuery && (
            <button className="mp-search-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
          <button className="mp-search-btn" onClick={() => runSearch(searchQuery)} aria-label="Search">
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* 3. Results */}
      <div className="mp-results">
        {searchError && <div className="mp-error">{searchError}</div>}

        {isSearching &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mp-row mp-skeleton">
              <div className="mp-skel-thumb" />
              <div className="mp-skel-lines">
                <div />
                <div />
              </div>
            </div>
          ))}

        {!isSearching && !searchError && searchResults.length === 0 && (
          <div className="mp-empty">
            <div className="mp-empty-label">Try one of these</div>
            <div className="mp-chips">
              {QUICK_PICKS.map((q) => (
                <button
                  key={q}
                  className="mp-chip"
                  onClick={() => {
                    setSearchQuery(q)
                    runSearch(q)
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isSearching && searchResults.length > 0 && <div className="mp-results-label">Results</div>}

        {!isSearching &&
          searchResults.map((track: YouTubeTrack, index: number) => {
            const isCurrent = !!track.id && currentTrack?.id === track.id
            return (
              <div
                key={`${track.id ?? 'track'}-${index}`}
                className={`mp-row ${isCurrent ? 'current' : ''}`}
                onClick={() => playTrackAtIndex(index, false)}
              >
                <div className="mp-thumb-wrap">
                  {track.thumbnail ? (
                    <img className="mp-thumb" src={track.thumbnail} alt="" />
                  ) : (
                    <div className="mp-thumb mp-thumb-empty" />
                  )}
                  <div className="mp-thumb-overlay">
                    {isCurrent && isPlaying ? (
                      <span className="mp-eq">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </div>
                </div>
                <div className="mp-row-text">
                  <div className="mp-row-title">{track.title}</div>
                  <div className="mp-row-artist">{track.artist}</div>
                </div>
              </div>
            )
          })}
      </div>

      {/* 4. Controls + volume */}
      <div className="mp-player">
        <div className="mp-controls">
          <button className="mp-icon-btn" onClick={handlePrevious} aria-label="Previous">
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="mp-play" onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />
            )}
          </button>
          <button className="mp-icon-btn" onClick={handleNext} aria-label="Next">
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button
            className={`mp-icon-btn ${repeatMode !== 'none' ? 'active' : ''}`}
            onClick={handleRepeatToggle}
            aria-label="Repeat"
            title={repeatMode === 'none' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
          >
            {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>

        <div className="mp-seek">
          <span className="mp-time">{formatTime(progress.current)}</span>
          <input
            className="mp-range"
            type="range"
            min={0}
            max={progress.duration || 1}
            step={1}
            value={progress.current}
            disabled={!currentTrack}
            onChange={(e) => seekTo(Number(e.target.value))}
            style={{ ['--pct' as string]: `${progressPct}%` }}
            aria-label="Seek"
          />
          <span className="mp-time">{formatTime(progress.duration)}</span>
        </div>

        <div className="mp-volume">
          <button className="mp-icon-btn small" onClick={toggleMute} aria-label="Mute">
            <VolumeIcon size={16} />
          </button>
          <input
            className="mp-range"
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolumeLevel(parseInt(e.target.value))}
            style={{ ['--pct' as string]: `${volume}%` }}
            aria-label="Volume"
          />
        </div>
      </div>

      {/* 5. Now playing (small picture + name) */}
      <div className="mp-now">
        {currentTrack?.thumbnail ? (
          <img className="mp-now-thumb" src={currentTrack.thumbnail} alt="" />
        ) : (
          <div className="mp-now-thumb mp-now-empty">
            <Music2 size={20} />
          </div>
        )}
        <div className="mp-now-text">
          <div className="mp-now-title">{currentTrack?.title || 'Nothing playing'}</div>
          <div className="mp-now-artist">{currentTrack?.artist || 'Pick a song from the results'}</div>
        </div>
      </div>

      <style jsx>{`
        .mp {
          display: flex;
          flex-direction: column;
          color: #fff;
          max-height: 640px;
        }

        /* header */
        .mp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 12px 6px 16px;
        }
        .mp-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        /* shared buttons */
        .mp-icon-btn {
          background: none;
          border: none;
          color: #b3b3b3;
          cursor: pointer;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s, background 0.15s, transform 0.1s;
        }
        .mp-icon-btn.small {
          width: 28px;
          height: 28px;
        }
        .mp-icon-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }
        .mp-icon-btn:active {
          transform: scale(0.94);
        }
        .mp-icon-btn.active {
          color: #1db954;
        }

        /* search */
        .mp-search {
          position: relative;
          margin: 4px 16px 10px;
        }
        .mp-search input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 76px 10px 16px;
          border-radius: 999px;
          border: 1px solid transparent;
          background: #2a2a2a;
          color: #fff;
          font-size: 13px;
          outline: none;
          transition: background 0.15s, border-color 0.15s;
        }
        .mp-search input::placeholder {
          color: #8a8a8a;
        }
        .mp-search input:hover {
          background: #333;
        }
        .mp-search input:focus {
          background: #333;
          border-color: rgba(255, 255, 255, 0.6);
        }
        .mp-search-actions {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .mp-search-btn {
          width: 30px;
          height: 30px;
          border: none;
          border-radius: 50%;
          background: none;
          color: #b3b3b3;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s, background 0.15s;
        }
        .mp-search-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        /* results */
        .mp-results {
          overflow-y: auto;
          height: 300px;
          padding: 0 8px 8px;
          scrollbar-width: thin;
        }
        .mp-results-label {
          font-size: 12px;
          font-weight: 700;
          color: #a7a7a7;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 2px 8px 8px;
        }
        .mp-error {
          padding: 10px 12px;
          font-size: 12px;
          color: #ff7a7a;
        }
        .mp-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 7px 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .mp-row:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .mp-row.current {
          background: rgba(255, 255, 255, 0.07);
        }
        .mp-thumb-wrap {
          position: relative;
          width: 72px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 6px;
          overflow: hidden;
          background: #282828;
        }
        .mp-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .mp-thumb-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          background: rgba(0, 0, 0, 0.5);
          opacity: 0;
          transition: opacity 0.15s;
        }
        .mp-row:hover .mp-thumb-overlay,
        .mp-row.current .mp-thumb-overlay {
          opacity: 1;
        }
        .mp-row-text {
          flex: 1;
          min-width: 0;
        }
        .mp-row-title {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .mp-row.current .mp-row-title {
          color: #1db954;
        }
        .mp-row-artist {
          font-size: 12px;
          color: #a7a7a7;
          margin-top: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* equalizer */
        .mp-eq {
          display: inline-flex;
          align-items: flex-end;
          gap: 2px;
          height: 14px;
        }
        .mp-eq i {
          width: 3px;
          background: #1db954;
          border-radius: 1px;
          animation: mp-bounce 0.9s ease-in-out infinite;
        }
        .mp-eq i:nth-child(1) {
          height: 60%;
          animation-delay: -0.4s;
        }
        .mp-eq i:nth-child(2) {
          height: 100%;
          animation-delay: -0.2s;
        }
        .mp-eq i:nth-child(3) {
          height: 40%;
        }
        @keyframes mp-bounce {
          0%,
          100% {
            transform: scaleY(0.4);
          }
          50% {
            transform: scaleY(1);
          }
        }

        /* empty state chips */
        .mp-empty {
          padding: 8px;
        }
        .mp-empty-label {
          font-size: 12px;
          color: #a7a7a7;
          margin-bottom: 10px;
        }
        .mp-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .mp-chip {
          padding: 7px 14px;
          border-radius: 999px;
          border: none;
          background: #2a2a2a;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .mp-chip:hover {
          background: #3a3a3a;
        }

        /* loading skeleton */
        .mp-skeleton {
          cursor: default;
          pointer-events: none;
        }
        .mp-skel-thumb {
          width: 72px;
          height: 44px;
          border-radius: 6px;
          background: #2a2a2a;
          animation: mp-pulse 1.2s ease-in-out infinite;
        }
        .mp-skel-lines {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .mp-skel-lines div {
          height: 9px;
          border-radius: 4px;
          background: #2a2a2a;
          animation: mp-pulse 1.2s ease-in-out infinite;
        }
        .mp-skel-lines div:first-child {
          width: 75%;
        }
        .mp-skel-lines div:last-child {
          width: 45%;
        }
        @keyframes mp-pulse {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }

        /* controls + volume */
        .mp-player {
          padding: 10px 16px 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: #181818;
        }
        .mp-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
        }
        .mp-controls .mp-icon-btn {
          color: #fff;
        }
        .mp-controls .mp-icon-btn.active {
          color: #1db954;
        }
        .mp-play {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: none;
          background: #fff;
          color: #000;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s, background 0.15s;
        }
        .mp-play:hover {
          transform: scale(1.06);
          background: #f0f0f0;
        }
        .mp-play:active {
          transform: scale(0.97);
        }
        .mp-seek {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
        .mp-time {
          font-size: 11px;
          color: #a7a7a7;
          min-width: 32px;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .mp-volume {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
        }

        /* sliders */
        .mp-range {
          -webkit-appearance: none;
          appearance: none;
          flex: 1;
          width: 100%;
          height: 4px;
          border-radius: 2px;
          outline: none;
          cursor: pointer;
          background: linear-gradient(to right, #fff var(--pct), rgba(255, 255, 255, 0.2) var(--pct));
        }
        .mp-range:hover {
          background: linear-gradient(to right, #1db954 var(--pct), rgba(255, 255, 255, 0.2) var(--pct));
        }
        .mp-range:disabled {
          cursor: default;
          opacity: 0.5;
        }
        .mp-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .mp-range:hover::-webkit-slider-thumb {
          opacity: 1;
        }
        .mp-range::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border: none;
          border-radius: 50%;
          background: #fff;
          opacity: 0;
        }
        .mp-range:hover::-moz-range-thumb {
          opacity: 1;
        }

        /* now playing */
        .mp-now {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px 14px;
          background: #181818;
        }
        .mp-now-thumb {
          width: 48px;
          height: 48px;
          border-radius: 6px;
          object-fit: cover;
          flex-shrink: 0;
          background: #282828;
        }
        .mp-now-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6a6a6a;
        }
        .mp-now-text {
          flex: 1;
          min-width: 0;
        }
        .mp-now-title {
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mp-now-artist {
          font-size: 12px;
          color: #a7a7a7;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}
