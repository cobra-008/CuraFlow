import { useState, useEffect } from 'react'

export function useData<T>(fetcher: () => Promise<T>, intervalMs: number = 0) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true
    let timeout: ReturnType<typeof setTimeout>

    const execute = async () => {
      // Pause polling if tab is not visible
      if (document.hidden && data !== null) {
        if (intervalMs > 0) timeout = setTimeout(execute, intervalMs)
        return
      }
      
      try {
        const result = await fetcher()
        if (mounted) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (mounted) setLoading(false)
        if (mounted && intervalMs > 0) {
          timeout = setTimeout(execute, intervalMs)
        }
      }
    }

    execute()

    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        execute() // revalidate immediately on focus
      }
    }

    document.addEventListener('visibilitychange', onFocus)

    return () => {
      mounted = false
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [fetcher, intervalMs]) // Note: fetcher should ideally be memoized

  return { data, loading, error }
}
