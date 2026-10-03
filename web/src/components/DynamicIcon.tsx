import * as LucideIcons from 'lucide-react'

export function DynamicIcon({ name, ...props }: { name: string; size?: number; className?: string }) {
  const IconCmp = (LucideIcons as any)[name] || LucideIcons.Bot
  return <IconCmp {...props} />
}
