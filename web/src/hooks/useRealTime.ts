import { useEffect } from 'react'
import { getToken } from '../services/api'
import { useStore } from '../store'

export function useRealTime() {
  const currentUser = useStore((s) => s.currentUser)

  useEffect(() => {
    if (!currentUser) return

    const token = getToken()
    if (!token) return

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/ops/stream?token=${token}`
    let ws: WebSocket | null = null
    let reconnectTimer: number

    const connect = () => {
      ws = new WebSocket(wsUrl)

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'ping') {
            ws?.send(JSON.stringify({ type: 'pong' }))
          } else if (data.type === 'NEW_ADMISSION') {
            // Trigger device vibration
            if (navigator.vibrate) {
              navigator.vibrate([400, 200, 400])
            }
            // Trigger an actionable toast via custom event
            window.dispatchEvent(
              new CustomEvent('curaflow:toast', {
                detail: {
                  title: 'New Patient Assigned',
                  message: `${data.data.name} has been admitted to ${data.data.location}. Action required.`,
                  type: 'success',
                },
              })
            )
            // Trigger re-fetch of patients list
            window.dispatchEvent(new Event('curaflow:patients_updated'))
          }
        } catch (err) {}
      }

      ws.onclose = () => {
        // Attempt to reconnect after 3 seconds
        reconnectTimer = window.setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null // Prevent reconnect on unmount
        ws.close()
      }
    }
  }, [currentUser])
}
