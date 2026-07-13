import React, { useEffect, useRef, useState } from 'react';

interface DictionaryPopupProps {
  selection: {
    word: string;
    x: number;
    y: number;
  };
  onClose: () => void;
}

interface Definition {
  word: string;
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
    }[];
  }[];
}

export default function DictionaryPopup({ selection, onClose }: DictionaryPopupProps) {
  const [definitions, setDefinitions] = useState<Definition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    const fetchDefinition = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(selection.word)}`
        );
        
        if (!response.ok) {
          if (response.status === 404) {
            setError(true);
            return;
          }
          throw new Error('Failed to fetch definition');
        }
        
        const data = await response.json();
        setDefinitions(data[0]);
        setError(false);
      } catch (err) {
        console.error('Dictionary fetch error:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchDefinition();
  }, [selection.word]);

  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(selection.x, window.innerWidth - 350),
    top: Math.min(selection.y + 20, window.innerHeight - 350),
    maxWidth: '320px',
    maxHeight: '300px',
    overflowY: 'auto',
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    padding: '14px 18px',
    zIndex: 9999,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    color: '#e8e8e8',
    fontSize: '14px',
    lineHeight: '1.5',
    pointerEvents: 'auto',
  };

  if (loading || error || !definitions) {
    return null;
  }

  return (
    <div ref={popupRef} style={popupStyle}>
      {definitions ? (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#fff' }}>
            {definitions.word}
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: 8 }}>
            {definitions.meanings?.[0]?.partOfSpeech || ''}
          </div>
<div style={{ fontSize: '13px', color: '#d0d0d0' }}>
            {definitions.meanings?.slice(0, 3).map((meaning, idx) => (
              <div key={idx} style={{ marginBottom: 6 }}>
                {meaning.definitions?.[0]?.definition || ''}
                {meaning.definitions?.[0]?.example && (
                  <div style={{ color: '#888', fontSize: '12px', fontStyle: 'italic', marginTop: 2 }}>
                    "{meaning.definitions[0].example}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
} 
