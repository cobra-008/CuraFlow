import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { opsApi, type HospitalState, type Bottleneck, type Recommendation } from '../services/opsApi'

/**
 * CuraFlow Automated Clinical & Operational Notification Pipeline
 * Continuously evaluates hospital state, bottlenecks, recommendations,
 * crisis triggers, and workflow events to dispatch proactive alerts.
 */
export function useNotificationPipeline(hospitalState?: HospitalState | null) {
  const addNotification = useStore((s) => s.addNotification)
  const notifications = useStore((s) => s.notifications)
  const seenKeysRef = useRef<Set<string>>(new Set())
  const prevCrisisRef = useRef<boolean | null>(null)
  const initialSeededRef = useRef(false)

  // 1. Evaluate Hospital State & Crisis Status
  useEffect(() => {
    if (!hospitalState) return

    // Crisis mode transitions
    if (prevCrisisRef.current !== null && prevCrisisRef.current !== hospitalState.crisis_mode) {
      if (hospitalState.crisis_mode) {
        addNotification({
          title: '🚨 CRISIS PROTOCOL ACTIVATED',
          message: 'Mass casualty / emergency surge protocol initiated. All clinical reserves dispatched.',
          severity: 'critical',
          type: 'crisis',
          actionRoute: 'emergency',
          actionLabel: 'Emergency Command',
        })
      } else {
        addNotification({
          title: 'Crisis Resolved',
          message: 'Hospital operations restored to standard baseline protocols.',
          severity: 'success',
          type: 'crisis',
          actionRoute: 'command',
          actionLabel: 'View Dashboard',
        })
      }
    }
    prevCrisisRef.current = hospitalState.crisis_mode

    // ICU Saturation check
    if (hospitalState.icu.occupancy_pct >= 90) {
      const key = `icu-sat-${Math.floor(Date.now() / (1000 * 60 * 5))}` // once per 5 min
      if (!seenKeysRef.current.has(key)) {
        seenKeysRef.current.add(key)
        addNotification({
          title: 'ICU Capacity Warning',
          message: `ICU occupancy is at ${hospitalState.icu.occupancy_pct}% (${hospitalState.icu.occupied}/${hospitalState.icu.total} beds occupied).`,
          severity: 'critical',
          type: 'bottleneck',
          actionRoute: 'capacity',
          actionLabel: 'Manage Capacity',
        })
      }
    }

    // ER Surge check
    if (hospitalState.emergency.waiting >= 15) {
      const key = `er-surge-${Math.floor(Date.now() / (1000 * 60 * 5))}`
      if (!seenKeysRef.current.has(key)) {
        seenKeysRef.current.add(key)
        addNotification({
          title: 'Emergency Department Surge',
          message: `${hospitalState.emergency.waiting} patients in ER queue. Expected triage wait time increasing.`,
          severity: 'warning',
          type: 'bottleneck',
          actionRoute: 'emergency',
          actionLabel: 'ER Command',
        })
      }
    }
  }, [hospitalState, addNotification])

  // 2. Poll & evaluate recommendations & bottlenecks
  useEffect(() => {
    async function evaluatePipeline() {
      try {
        const [recsRes, botsRes] = await Promise.all([
          opsApi.getRecommendations(),
          opsApi.getBottlenecks(),
        ])

        // Evaluate pending recommendations
        const pendingRecs = (recsRes.recommendations || []).filter((r: Recommendation) => r.status === 'pending')
        for (const rec of pendingRecs) {
          const key = `rec-${rec.id}`
          if (!seenKeysRef.current.has(key)) {
            seenKeysRef.current.add(key)
            addNotification({
              title: `Approval Required: ${rec.title || 'Clinical Recommendation'}`,
              message: rec.summary || rec.reason || 'AI recommendation awaiting clinician decision.',
              severity: rec.priority === 'critical' ? 'critical' : rec.priority === 'high' ? 'warning' : 'info',
              type: 'approval',
              actionRoute: 'approvals',
              actionLabel: 'Review in Approvals',
            })
          }
        }

        // Evaluate severe bottlenecks
        const critBots = (botsRes.bottlenecks || []).filter((b: Bottleneck) => b.severity === 'critical' || b.severity === 'high')
        for (const bot of critBots) {
          const key = `bot-${bot.id}`
          if (!seenKeysRef.current.has(key)) {
            seenKeysRef.current.add(key)
            addNotification({
              title: `Bottleneck: ${bot.bottleneck_type.replace(/_/g, ' ').toUpperCase()}`,
              message: bot.description || `Resource pressure detected on ${bot.resource_type} (Confidence: ${Math.round(bot.confidence * 100)}%).`,
              severity: bot.severity === 'critical' ? 'critical' : 'warning',
              type: 'bottleneck',
              actionRoute: 'flow',
              actionLabel: 'View Flow Graph',
            })
          }
        }

        // Seed initial notifications if store is empty on fresh login
        if (!initialSeededRef.current && notifications.length === 0) {
          initialSeededRef.current = true
          if (pendingRecs.length > 0) {
            // Already handled above
          } else {
            addNotification({
              title: 'CuraFlow AI Orchestrator Online',
              message: 'Autonomous multi-agent monitoring connected to hospital telemetry pipeline.',
              severity: 'info',
              type: 'system',
              actionRoute: 'command',
              actionLabel: 'Open Command Center',
            })
          }
        }
      } catch {
        // silent background polling
      }
    }

    evaluatePipeline()
    const interval = setInterval(evaluatePipeline, 12000)
    return () => clearInterval(interval)
  }, [addNotification, notifications.length])
}
