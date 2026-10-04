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
    let pingInterval: number

    const connect = () => {
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        // actively ping the backend every 15s to prevent timeouts
        pingInterval = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 15000)
      }

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
            // Trigger a global modal event for other logged-in staff (e.g. nurses)
            window.dispatchEvent(
              new CustomEvent('curaflow:new_admission', {
                detail: data.data,
              })
            )
            // Trigger re-fetch of patients list
            window.dispatchEvent(new Event('curaflow:patients_updated'))
          } else if (data.type === 'CALL_NURSE') {
            if (navigator.vibrate) {
              navigator.vibrate([400, 200, 400])
            }
            window.dispatchEvent(
              new CustomEvent('curaflow:call_nurse', { detail: data.data })
            )
            window.dispatchEvent(new Event('curaflow:patients_updated'))
          } else if (data.type === 'TASK_CREATED') {
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200])
            }
            window.dispatchEvent(
              new CustomEvent('curaflow:task_created', { detail: data.task })
            )
            window.dispatchEvent(new Event('curaflow:tasks_updated'))
          } else if (data.type === 'TASK_UPDATED') {
            window.dispatchEvent(
              new CustomEvent('curaflow:task_updated', { detail: data.task })
            )
            window.dispatchEvent(new Event('curaflow:tasks_updated'))
          }
        } catch (err) {}
      }

      ws.onclose = () => {
        clearInterval(pingInterval)
        // Attempt to reconnect after 3 seconds
        reconnectTimer = window.setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      if (pingInterval) clearInterval(pingInterval)
      if (ws) {
        ws.onclose = null // Prevent reconnect on unmount
        ws.close()
      }
    }
  }, [currentUser])
}
