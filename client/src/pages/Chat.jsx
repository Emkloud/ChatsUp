import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../lib/api'
import { createSocket } from '../lib/socket'
import EmojiPicker from 'emoji-picker-react'
import { jwtDecode } from 'jwt-decode'

export default function Chat() {
  const [me, setMe] = useState(null)
  const [users, setUsers] = useState([])
  const [activeUser, setActiveUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const socketRef = useRef(null)
  const listRef = useRef(null)
  const pcRef = useRef(null)
  const localRef = useRef(null)
  const remoteRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const [inCall, setInCall] = useState(false)
  const [callType, setCallType] = useState(null) // 'audio' | 'video'
  const ringCtxRef = useRef(null)
  const ringOscRef = useRef(null)
  const usersRef = useRef([])
  const activeUserRef = useRef(null)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [devices, setDevices] = useState({ mics: [], cams: [], sinks: [] })
  const [selMic, setSelMic] = useState('')
  const [selCam, setSelCam] = useState('')
  const [selSink, setSelSink] = useState('')
  const [showStats, setShowStats] = useState(false)
  const [statsText, setStatsText] = useState('')
  const statsTimerRef = useRef(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const token = useMemo(() => localStorage.getItem('token'), [])

  useEffect(() => {
    if (!token) {
      window.location.href = '/login'
      return
    }

    try {
      const decoded = jwtDecode(token)
      setMe({ id: decoded.id })
    } catch {}

    socketRef.current = createSocket(token)
    const onMessage = (msg) => {
      if ((activeUser && (msg.senderId === activeUser.id || msg.receiverId === activeUser.id)) || !activeUser) {
        setMessages((prev) => [...prev, msg])
      }
    }
    const onEdited = (msg) => {
      setMessages((prev) => prev.map(m => m.id === msg.id ? msg : m))
    }
    socketRef.current.on('message', onMessage)
    socketRef.current.on('messageEdited', onEdited)

    socketRef.current.on('call:offer', async ({ fromUserId, sdp, callType }) => {
      // Ensure we surface the incoming call regardless of current selection
      const ulist = usersRef.current || []
      const currActive = activeUserRef.current
      const caller = ulist.find(u => u.id === fromUserId)
      if (caller && (!currActive || currActive.id !== caller.id)) setActiveUser(caller)
      // If already in a call with this peer, treat as renegotiation: no prompt.
      if (pcRef.current && currActive && caller && currActive.id === caller.id && inCall) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp))
          const answer = await pcRef.current.createAnswer()
          await pcRef.current.setLocalDescription(answer)
          const peerId = caller.id
          socketRef.current.emit('call:answer', { toUserId: peerId, sdp: pcRef.current.localDescription })
        } catch {}
        return
      }
      // Fresh incoming call flow
      startRinging()
      const name = caller?.username || 'Unknown'
      const accept = window.confirm(`Incoming ${callType} call from ${name}. Accept?`)
      if (!accept) return
      stopRinging()
      await startAnswer(callType)
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pcRef.current.createAnswer()
      await pcRef.current.setLocalDescription(answer)
      const peerId = caller?.id || activeUserRef.current?.id
      socketRef.current.emit('call:answer', { toUserId: peerId, sdp: pcRef.current.localDescription })
    })

    socketRef.current.on('call:answer', async ({ fromUserId, sdp }) => {
      const currActive = activeUserRef.current
      if (!currActive || fromUserId !== currActive.id) return
      if (!pcRef.current) return
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp))
    })

    socketRef.current.on('call:ice-candidate', async ({ fromUserId, candidate }) => {
      const currActive = activeUserRef.current
      if (!currActive || fromUserId !== currActive.id) return
      if (!pcRef.current || !candidate) return
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
    })

    socketRef.current.on('call:hangup', ({ fromUserId }) => {
      // Stop any ring and end call regardless of selection; trust the event
      stopRinging()
      if (pcRef.current || inCall) endCall()
    })

    return () => { socketRef.current?.disconnect() }
  }, [token])

  // Keep refs in sync to avoid stale closures in socket handlers
  useEffect(() => { usersRef.current = users }, [users])
  useEffect(() => { activeUserRef.current = activeUser }, [activeUser])

  // Enumerate devices (requires site permission granted at least once)
  const refreshDevices = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      const mics = list.filter(d => d.kind === 'audioinput')
      const cams = list.filter(d => d.kind === 'videoinput')
      const sinks = list.filter(d => d.kind === 'audiooutput')
      setDevices({ mics, cams, sinks })
      if (!selMic && mics[0]) setSelMic(mics[0].deviceId)
      if (!selCam && cams[0]) setSelCam(cams[0].deviceId)
      if (!selSink && sinks[0]) setSelSink(sinks[0].deviceId)
    } catch {}
  }
  useEffect(() => { refreshDevices() }, [])

  useEffect(() => {
    async function bootstrap() {
      setLoading(true)
      setError('')
      try {
        const { data } = await api.get('/users')
        setUsers(data)
        if (data.length) setActiveUser((prev) => prev ?? data[0])
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load users')
      } finally { setLoading(false) }
    }
    bootstrap()
  }, [])

  useEffect(() => {
    async function loadChat() {
      if (!activeUser) return
      try {
        const { data } = await api.get(`/chats/${activeUser.id}`)
        setMessages(data)
        requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight })
      } catch (e) { setError(e.response?.data?.error || 'Failed to load chat') }
    }
    loadChat()
    setReplyTo(null); setEditing(null)
  }, [activeUser])

  const iceServers = () => {
    const stunList = (import.meta.env.VITE_RTC_STUNS || 'stun:stun.l.google.com:19302').split(',').map(u => ({ urls: u.trim() }))
    const turnEnv = (import.meta.env.VITE_RTC_TURNS || '').trim()
    const turns = turnEnv ? turnEnv.split(',').map(u => ({ urls: u.trim(), username: import.meta.env.VITE_RTC_TURN_USER || '', credential: import.meta.env.VITE_RTC_TURN_PASS || '' })) : []
    return [...stunList, ...turns]
  }

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({ iceServers: iceServers() })
    pc.onicecandidate = (e) => {
      if (e.candidate && activeUser) {
        socketRef.current?.emit('call:ice-candidate', { toUserId: activeUser.id, candidate: e.candidate })
      }
    }
    pc.ontrack = (e) => {
      const stream = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track])
      if (e.track.kind === 'audio') {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream
          remoteAudioRef.current.muted = false
          remoteAudioRef.current.volume = 1
          const p = remoteAudioRef.current.play?.(); if (p && p.catch) p.catch(()=>{})
        }
      } else {
        if (remoteRef.current) {
          remoteRef.current.srcObject = stream
          const p = remoteRef.current.play?.(); if (p && p.catch) p.catch(()=>{})
        }
      }
    }
    pc.onconnectionstatechange = () => {
      console.log('RTCPeerConnection state:', pc.connectionState)
    }
    pc.onnegotiationneeded = async () => {
      try {
        if (!activeUserRef.current) return
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketRef.current?.emit('call:offer', { toUserId: activeUserRef.current.id, sdp: pc.localDescription, callType: callType || 'audio' })
      } catch {}
    }
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState
      if (st === 'failed' || st === 'disconnected') {
        // clean up to avoid broken subsequent calls
        endCall()
      }
    }
    return pc
  }

  // Try to get media with graceful fallback
  const acquireStream = async (type) => {
    const baseAudio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    try {
      const audio = selMic ? { ...baseAudio, deviceId: { exact: selMic } } : baseAudio
      const video = type === 'video' ? (selCam ? { deviceId: { exact: selCam } } : true) : false
      return await navigator.mediaDevices.getUserMedia({ audio, video })
    } catch (e1) {
      if (type === 'video') {
        try {
          // Fallback to audio-only if camera is busy/unavailable
          return await navigator.mediaDevices.getUserMedia({ audio: baseAudio, video: false })
        } catch (e2) {
          console.warn('Failed to get audio-only stream as fallback', e2)
          return null
        }
      }
      console.warn('Failed to get media', e1)
      return null
    }
  }

  const startRinging = () => {
    try {
      if (ringCtxRef.current) return
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 800
      gain.gain.value = 0.02
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      ringCtxRef.current = ctx
      ringOscRef.current = { osc, gain }
    } catch {}
  }

  const stopRinging = () => {
    try {
      if (ringOscRef.current) {
        ringOscRef.current.osc.stop(0)
        ringOscRef.current = null
      }
      if (ringCtxRef.current) {
        ringCtxRef.current.close()
        ringCtxRef.current = null
      }
    } catch {}
  }

  const startOffer = async (type) => {
    if (!activeUser) return
    setCallType(type)
    // reset any previous call remnants
    if (pcRef.current) endCall()
    const stream = await acquireStream(type)
    if (stream && localRef.current) { localRef.current.srcObject = stream; const p = localRef.current.play?.(); if (p && p.catch) p.catch(()=>{}) }
    const pc = createPeerConnection()
    if (stream) {
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
    } else {
      // Receive-only so we can still see/hear the peer if our media is unavailable
      pc.addTransceiver('audio', { direction: 'recvonly' })
      if (type === 'video') pc.addTransceiver('video', { direction: 'recvonly' })
    }
    pcRef.current = pc
    setInCall(true)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socketRef.current?.emit('call:offer', { toUserId: activeUser.id, sdp: pc.localDescription, callType: type })
  }

  const startAnswer = async (type) => {
    setCallType(type)
    if (pcRef.current) endCall()
    const stream = await acquireStream(type)
    if (stream && localRef.current) { localRef.current.srcObject = stream; const p = localRef.current.play?.(); if (p && p.catch) p.catch(()=>{}) }
    const pc = createPeerConnection()
    if (stream) {
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' })
      if (type === 'video') pc.addTransceiver('video', { direction: 'recvonly' })
    }
    pcRef.current = pc
    setInCall(true)
  }

  const endCall = () => {
    setInCall(false)
    setCallType(null)
    if (pcRef.current) { pcRef.current.onicecandidate = null; pcRef.current.ontrack = null; pcRef.current.close(); pcRef.current = null }
    if (localRef.current?.srcObject) { localRef.current.srcObject.getTracks().forEach(t => t.stop()); localRef.current.srcObject = null }
    if (remoteRef.current?.srcObject) { remoteRef.current.srcObject.getTracks().forEach(t => t.stop()); remoteRef.current.srcObject = null }
    if (remoteAudioRef.current?.srcObject) { remoteAudioRef.current.srcObject.getTracks().forEach(t => t.stop()); remoteAudioRef.current.srcObject = null }
    if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current = null; setStatsText('') }
  }

  const hangup = () => {
    if (activeUser) socketRef.current?.emit('call:hangup', { toUserId: activeUser.id })
    endCall()
  }

  const toggleMic = async () => {
    const pc = pcRef.current
    if (!pc) return
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio')
    const stream = localRef.current?.srcObject
    const track = stream && stream.getAudioTracks()[0]
    if (sender && sender.track) {
      sender.track.enabled = !sender.track.enabled
      setMicOn(sender.track.enabled)
      return
    }
    // No sender/track yet: try to acquire and add/replace
    const acquired = await acquireStream('audio')
    if (acquired) {
      const a = acquired.getAudioTracks()[0]
      if (a) {
        if (sender) await sender.replaceTrack(a); else pc.addTrack(a, acquired)
        // attach to local stream
        if (localRef.current) {
          const ls = localRef.current.srcObject || new MediaStream()
          if (!ls.getAudioTracks().length) ls.addTrack(a)
          localRef.current.srcObject = ls
        }
        setMicOn(true)
      }
    }
  }
  const toggleCam = async () => {
    const pc = pcRef.current
    if (!pc) return
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video')
    const stream = localRef.current?.srcObject
    const track = stream && stream.getVideoTracks()[0]
    if (sender && sender.track) {
      sender.track.enabled = !sender.track.enabled
      setCamOn(sender.track.enabled)
      return
    }
    if (callType !== 'video') return
    const acquired = await acquireStream('video')
    if (acquired) {
      const v = acquired.getVideoTracks()[0]
      if (v) {
        if (sender) await sender.replaceTrack(v); else pc.addTrack(v, acquired)
        if (localRef.current) {
          const ls = localRef.current.srcObject || new MediaStream()
          if (!ls.getVideoTracks().length) ls.addTrack(v)
          localRef.current.srcObject = ls
        }
        setCamOn(true)
      }
    }
  }

  const applySink = async (deviceId) => {
    try {
      if (remoteAudioRef.current && remoteAudioRef.current.setSinkId) {
        await remoteAudioRef.current.setSinkId(deviceId)
      }
    } catch {}
  }

  // Auto-apply speaker change while in a call
  useEffect(() => { if (inCall && selSink) { applySink(selSink) } }, [inCall, selSink])

  const onChangeMic = async (e) => {
    const id = e.target.value; setSelMic(id)
    const pc = pcRef.current; if (!pc) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: id }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
      const a = stream.getAudioTracks()[0]
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio')
      if (sender && a) await sender.replaceTrack(a)
      const ls = localRef.current?.srcObject || new MediaStream()
      if (a) { if (ls.getAudioTracks().length) ls.removeTrack(ls.getAudioTracks()[0]); ls.addTrack(a); if (localRef.current) localRef.current.srcObject = ls }
    } catch {}
  }

  const onChangeCam = async (e) => {
    const id = e.target.value; setSelCam(id)
    const pc = pcRef.current; if (!pc || callType !== 'video') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id } }, audio: false })
      const v = stream.getVideoTracks()[0]
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video')
      if (sender && v) await sender.replaceTrack(v)
      const ls = localRef.current?.srcObject || new MediaStream()
      if (v) { if (ls.getVideoTracks().length) ls.removeTrack(ls.getVideoTracks()[0]); ls.addTrack(v); if (localRef.current) localRef.current.srcObject = ls }
    } catch {}
  }

  const onChangeSink = async (e) => {
    const id = e.target.value; setSelSink(id); await applySink(id)
  }

  const ensurePlay = (el) => {
    try { const p = el?.play?.(); if (p && p.catch) p.catch(()=>{}) } catch {}
  }

  const startStats = () => {
    if (statsTimerRef.current || !pcRef.current) return
    let last = {}
    statsTimerRef.current = setInterval(async () => {
      const pc = pcRef.current; if (!pc) return
      const stats = await pc.getStats()
      let lines = []
      stats.forEach(r => {
        if (r.type === 'inbound-rtp' && !r.isRemote) {
          const kind = r.kind || r.mediaType
          const prev = last[r.id] || { ts: r.timestamp, bytes: r.bytesReceived || 0 }
          const dt = (r.timestamp - prev.ts) / 1000
          const db = (r.bytesReceived || 0) - prev.bytes
          const kbps = dt > 0 ? ((db * 8) / 1000 / dt).toFixed(1) : '0.0'
          lines.push(`inbound ${kind}: ${kbps} kbps`)
          last[r.id] = { ts: r.timestamp, bytes: r.bytesReceived || 0 }
        }
        if (r.type === 'outbound-rtp' && !r.isRemote) {
          const kind = r.kind || r.mediaType
          const prev = last[r.id] || { ts: r.timestamp, bytes: r.bytesSent || 0 }
          const dt = (r.timestamp - prev.ts) / 1000
          const db = (r.bytesSent || 0) - prev.bytes
          const kbps = dt > 0 ? ((db * 8) / 1000 / dt).toFixed(1) : '0.0'
          lines.push(`outbound ${kind}: ${kbps} kbps`)
          last[r.id] = { ts: r.timestamp, bytes: r.bytesSent || 0 }
        }
      })
      setStatsText(lines.join(' | '))
    }, 1000)
  }

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || !activeUser) return
    if (editing) {
      socketRef.current?.emit('editMessage', { messageId: editing.id, content: text.trim() })
      setEditing(null)
    } else {
      socketRef.current?.emit('sendMessage', { receiverId: activeUser.id, content: text.trim(), replyToId: replyTo?.id })
    }
    setText(''); setReplyTo(null); setShowEmoji(false)
  }

  const startReply = (msg) => { setReplyTo(msg); setEditing(null) }
  const startEdit = (msg) => { setEditing(msg); setReplyTo(null); setText(msg.content) }

  const logout = () => { localStorage.removeItem('token'); window.location.href = '/login' }

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>
  if (error) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-red-600">{error}</div>
      <button className="px-4 py-2 bg-gray-200 rounded" onClick={()=>window.location.reload()}>Retry</button>
    </div>
  )

  return (
    <div className="h-screen grid grid-cols-1 md:grid-cols-3">
      <aside className="border-r md:col-span-1 overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Chats</h2>
          <button onClick={logout} className="text-sm text-red-600">Logout</button>
        </div>
        <ul>
          {users.map((u) => (
            <li key={u.id}>
              <button
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${activeUser?.id===u.id?'bg-gray-100':''}`}
                onClick={()=>setActiveUser(u)}
              >
                <div className="font-medium">{u.username}</div>
                <div className="text-xs text-gray-500">{u.online ? 'online' : 'offline'}</div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="md:col-span-2 flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="font-semibold flex-1">{activeUser?.username || 'Select a chat'}</div>
          {activeUser && (
            <div className="flex items-center gap-2">
              <button aria-label="Call" title="Call" className="p-2 border rounded hover:bg-gray-50" onClick={()=>startOffer('audio')}>
                {/* phone icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.58a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92z"/>
                </svg>
              </button>
              <button aria-label="Video" title="Video" className="p-2 border rounded hover:bg-gray-50" onClick={()=>startOffer('video')}>
                {/* video icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M23 7l-7 5 7 5V7z"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </button>
            </div>
          )}
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          {messages.map((m) => {
            const isMine = m.senderId === me?.id
            const withinEditWindow = (Date.now() - new Date(m.createdAt).getTime()) <= (15 * 60 * 1000)
            return (
              <div key={m.id} className={`max-w-xs md:max-w-md p-3 rounded group relative ${isMine ? 'bg-green-100 self-end ml-auto' : 'bg-white self-start'}`}>
                {m.replyTo && (
                  <div className="text-xs text-gray-500 border-l-2 border-gray-400 pl-2 mb-1">Replying to: {m.replyTo.content}</div>
                )}
                <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                  <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                  {m.edited && <span>(edited)</span>}
                </div>
                <div className="absolute hidden group-hover:flex gap-2 -top-3 right-2 text-xs">
                  <button title="Reply" className="bg-gray-200 px-2 py-0.5 rounded" onClick={()=>startReply(m)}>↩️</button>
                  {isMine && withinEditWindow && (
                    <button title="Edit" className="bg-gray-200 px-2 py-0.5 rounded" onClick={()=>startEdit(m)}>✏️</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {(replyTo || editing) && (
          <div className="px-3 py-2 border-t bg-white flex items-center justify-between text-sm">
            <div className="truncate">
              {editing ? (<><strong>Editing:</strong> {editing.content}</>) : (<><strong>Replying:</strong> {replyTo?.content}</>)}
            </div>
            <button className="text-gray-500" onClick={()=>{ setReplyTo(null); setEditing(null); setText('') }}>✖</button>
          </div>
        )}

        <form onSubmit={send} className="p-3 border-t flex items-end gap-2 relative">
          <div className="relative">
            <button type="button" className="px-2 py-2 border rounded" onClick={()=>setShowEmoji(v=>!v)}>😊</button>
            {showEmoji && (
              <div className="absolute z-10 bottom-12">
                <EmojiPicker onEmojiClick={(e)=>setText(prev=> (prev||'') + e.emoji)} />
              </div>
            )}
          </div>
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder={editing ? 'Edit message' : 'Type a message'}
            value={text}
            onChange={(e)=>setText(e.target.value)}
          />
          <button className="bg-green-600 text-white px-4 py-2 rounded">{editing ? 'Save' : 'Send'}</button>
        </form>
        {inCall && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-4 w-full max-w-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">In {callType} call with {activeUser?.username}</div>
                <div className="flex items-center gap-2">
                  <button className="text-sm text-gray-500" onClick={()=>setShowAdvanced(v=>!v)}>{showAdvanced ? 'Less' : 'More'}</button>
                  <button className="text-red-600" onClick={hangup}>End</button>
                </div>
              </div>
              {callType === 'video' ? (
                <div className="relative w-full">
                  <video ref={remoteRef} autoPlay playsInline className="w-full rounded-lg bg-black max-h-[60vh] object-cover" />
                  <video ref={localRef} autoPlay playsInline muted className="absolute bottom-3 right-3 w-32 h-24 rounded-lg border-2 border-white bg-black object-cover" />
                  <audio ref={remoteAudioRef} autoPlay />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <button className="px-2 py-1 text-xs bg-white/80 rounded" onClick={toggleMic}>{micOn ? 'Mute' : 'Unmute'}</button>
                    <button className="px-2 py-1 text-xs bg-white/80 rounded" onClick={toggleCam}>{camOn ? 'Camera Off' : 'Camera On'}</button>
                  </div>
                  {showAdvanced && (
                  <div className="absolute top-3 right-3 bg-white/80 rounded p-2 text-xs text-black space-y-2">
                    <div className="flex items-center gap-2">
                      <label>Mic</label>
                      <select className="text-xs" value={selMic} onChange={onChangeMic}>
                        {devices.mics.map(d => (<option key={d.deviceId} value={d.deviceId}>{d.label || 'Mic'}</option>))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label>Cam</label>
                      <select className="text-xs" value={selCam} onChange={onChangeCam}>
                        {devices.cams.map(d => (<option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label>Speaker</label>
                      <select className="text-xs" value={selSink} onChange={onChangeSink}>
                        {devices.sinks.map(d => (<option key={d.deviceId} value={d.deviceId}>{d.label || 'Speaker'}</option>))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="stats" type="checkbox" checked={showStats} onChange={(e)=>{ setShowStats(e.target.checked); if (e.target.checked) startStats(); else { if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current=null; setStatsText('') } } }} />
                      <label htmlFor="stats">Show stats</label>
                    </div>
                    {showStats && (<div className="text-[10px] whitespace-pre-wrap max-w-[260px]">{statsText || '…'}</div>)}
                  </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <audio ref={remoteAudioRef} autoPlay />
                  <div className="text-sm text-gray-600">Audio call in progress… speak to test</div>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 text-xs bg-white/80 rounded text-black" onClick={toggleMic}>{micOn ? 'Mute' : 'Unmute'}</button>
                    <button className="px-2 py-1 text-xs bg-white/80 rounded text-black" onClick={()=>setShowAdvanced(v=>!v)}>{showAdvanced ? 'Less' : 'More'}</button>
                  </div>
                  {showAdvanced && (
                    <div className="flex items-center gap-2 text-black bg-white/80 rounded p-2 text-xs">
                      <label>Mic</label>
                      <select className="text-xs" value={selMic} onChange={onChangeMic}>
                        {devices.mics.map(d => (<option key={d.deviceId} value={d.deviceId}>{d.label || 'Mic'}</option>))}
                      </select>
                      <label>Speaker</label>
                      <select className="text-xs" value={selSink} onChange={onChangeSink}>
                        {devices.sinks.map(d => (<option key={d.deviceId} value={d.deviceId}>{d.label || 'Speaker'}</option>))}
                      </select>
                      <label className="ml-2 flex items-center gap-1"><input type="checkbox" checked={showStats} onChange={(e)=>{ setShowStats(e.target.checked); if (e.target.checked) startStats(); else { if (statsTimerRef.current) { clearInterval(statsTimerRef.current); statsTimerRef.current=null; setStatsText('') } } }} /> Stats</label>
                    </div>
                  )}
                  {showAdvanced && showStats && (<div className="text-[10px] whitespace-pre-wrap max-w-[320px] text-black bg-white/80 rounded p-2">{statsText || '…'}</div>)}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Call overlay
/* eslint-disable */
