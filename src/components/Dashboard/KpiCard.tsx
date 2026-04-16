import React from 'react'
import clsx from 'clsx'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'yellow'
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
}

const colorMap = {
  blue: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  green: 'text-green-400 bg-green-500/10 border-green-500/20',
  red: 'text-red-400 bg-red-500/10 border-red-500/20',
  orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
}

const iconBg = {
  blue: 'bg-brand-500/20',
  green: 'bg-green-500/20',
  red: 'bg-red-500/20',
  orange: 'bg-orange-500/20',
  purple: 'bg-purple-500/20',
  yellow: 'bg-yellow-500/20',
}

export default function KpiCard({ title, value, subtitle, icon: Icon, color, trendLabel }: KpiCardProps) {
  return (
    <div className={clsx('rounded-xl border p-4 glass fade-in', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={clsx('p-2.5 rounded-lg', iconBg[color])}>
          <Icon size={20} className={clsx(
            color === 'blue' ? 'text-brand-400' :
            color === 'green' ? 'text-green-400' :
            color === 'red' ? 'text-red-400' :
            color === 'orange' ? 'text-orange-400' :
            color === 'purple' ? 'text-purple-400' : 'text-yellow-400'
          )} />
        </div>
      </div>
      {trendLabel && (
        <p className="text-xs text-slate-500 mt-2 border-t border-white/5 pt-2">{trendLabel}</p>
      )}
    </div>
  )
}
