import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useStore } from '../../store'

export const DecisionNode = memo(function DecisionNode({ data, id }: NodeProps) {
  const nodeStates = useStore((s) => s.nodeStates)
  const status = nodeStates[id]?.status ?? 'idle'

  const borderColor = status === 'complete' ? 'var(--accent-teal)'
    : status === 'skipped'                  ? 'var(--border-a)'
    : 'var(--accent-blue)'

  const glowColor = status === 'complete' ? 'rgba(15,118,110,0.15)'
    : status === 'skipped'                ? 'transparent'
    : 'rgba(30,80,160,0.15)'

  const bgColor = status === 'complete'
    ? 'var(--bg-raised)'
    : status === 'skipped'
    ? 'var(--bg-base)'
    : 'var(--bg-surface)'

  const textColor = status === 'skipped'
    ? 'var(--text-muted)'
    : 'var(--text-primary)'

  const opacity = status === 'skipped' ? 0.6 : 1
  const question = (data as { question?: string }).question ?? ''

  return (
    <div style={{ width: 140, height: 140, position: 'relative', opacity }}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--border-s)', border: '2px solid var(--bg-surface)', width: 10, height: 10 }}
      />
      <Handle
        id="yes"
        type="source"
        position={Position.Top}
        style={{ background: 'var(--border-s)', border: '2px solid var(--bg-surface)', width: 10, height: 10 }}
      />
      <Handle
        id="no"
        type="source"
        position={Position.Bottom}
        style={{ background: 'var(--border-s)', border: '2px solid var(--bg-surface)', width: 10, height: 10 }}
      />

      {/* Diamond body */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%) rotate(45deg)',
        width: 100, height: 100,
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        boxShadow: `0 0 16px ${glowColor}`,
        transition: 'border-color 0.3s, box-shadow 0.3s, background 0.3s',
      }} />

      {/* Question label */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 120,
        textAlign: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        <span style={{
          fontSize: 12,
          color: textColor,
          fontFamily: 'inherit',
          fontWeight: 600,
          lineHeight: 1.2,
          display: 'block',
          transition: 'color 0.3s',
        }}>
          {question}?
        </span>
      </div>
    </div>
  )
})
