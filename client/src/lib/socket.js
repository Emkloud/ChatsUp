import { io } from 'socket.io-client'

export function createSocket(token) {
  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin
  return io(url, {
    auth: { token },
    transports: ['websocket']
  })
}
