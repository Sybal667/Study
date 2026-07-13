export const containerStyle: React.CSSProperties = {
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  position: 'relative',
  backgroundImage: "url('/signupbackground.png')",
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}

export const topSectionStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 100,
  paddingTop: '16px',
  pointerEvents: 'none',
}

export const timerContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  padding: '8px 16px',
  margin: '0 auto',
  width: 'fit-content',
  backgroundColor: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(12px)',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.15)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  position: 'relative',
  zIndex: 102,
  pointerEvents: 'auto',
}

export const getTimerTextStyle = (isRunning: boolean): React.CSSProperties => ({
  fontSize: '24px',
  fontWeight: 'bold',
  fontFamily: 'monospace',
  letterSpacing: '2px',
  color: isRunning ? '#4CAF50' : 'white',
  minWidth: '80px',
  textAlign: 'center',
  background: 'none',
  border: 'none',
  outline: 'none',
  padding: '4px',
})

export const getTimerButtonStyle = (isRunning: boolean): React.CSSProperties => ({
  padding: '6px 18px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: isRunning ? '#ff6b6b' : '#4CAF50',
  color: 'white',
  fontWeight: 'bold',
  cursor: 'pointer',
  fontSize: '14px',
  transition: 'all 0.2s ease',
})

export const resetButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.2)',
  backgroundColor: 'rgba(255,255,255,0.1)',
  color: 'white',
  fontSize: '16px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
}

export const getNavContainerStyle = (showNav: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: '0px',
  left: 0,
  right: 0,
  padding: '12px 24px',
  backgroundColor: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  transition: 'transform .45s ease, opacity .45s ease',
  transform: showNav ? 'translateY(0)' : 'translateY(-35px)',
  opacity: showNav ? 1 : 0,
  pointerEvents: showNav ? 'auto' : 'none',
  borderRadius: '0 0 12px 12px',
})

export const navButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.2)',
  backgroundColor: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
}

export const floatingButtonStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '30px',
  right: '30px',
  padding: '16px 24px',
  borderRadius: '30px',
  backgroundColor: 'rgba(30, 58, 138, 0.9)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: 'white',
  fontSize: '18px',
  fontWeight: 'bold',
  backdropFilter: 'blur(4px)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  zIndex: 50,
}

export const getPdfContainerStyle = (sidebarWidth: number): React.CSSProperties => ({
  width: `calc(100vw - ${sidebarWidth}px)`,
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  overflowY: 'auto',
  overflowX: 'hidden',
  position: 'relative',
  display: 'block',
  padding: '80px 0 40px 0',
})

export const getPdfControlsContainerStyle = (showPdfControls: boolean): React.CSSProperties => ({
  position: 'fixed',
  left: 0,
  top: 0,
  bottom: 0,
  zIndex: 50,
  padding: '24px 16px',
  backgroundColor: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(12px)',
  borderRight: '1px solid rgba(255,255,255,0.1)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  transition: 'transform .45s ease, opacity .45s ease',
  transform: showPdfControls ? 'translateX(0)' : 'translateX(-100%)',
  opacity: showPdfControls ? 1 : 0,
  pointerEvents: showPdfControls ? 'auto' : 'none',
  borderRadius: '0 12px 12px 0',
})

export const pdfControlButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.15)',
  backgroundColor: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  width: '100%',
  minWidth: '100px',
}

export const pdfControlGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
}

export const pdfFileNameStyle: React.CSSProperties = {
  color: 'white',
  fontSize: '12px',
  opacity: 0.7,
  maxWidth: '120px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  marginBottom: '8px',
}

export const topHoverZoneStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: '90px',
  zIndex: 99,
  pointerEvents: 'auto',
}

export const leftHoverZoneStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  top: 0,
  bottom: 0,
  width: '60px',
  zIndex: 49,
  pointerEvents: 'auto',
}
