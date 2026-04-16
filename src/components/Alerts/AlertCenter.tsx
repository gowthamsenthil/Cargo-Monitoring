import React from 'react'
import clsx from 'clsx'
import { Bell, CheckCheck, Thermometer, Clock, Shield, MapPin, Zap, AlertTriangle } from 'lucide-react'
import { Alert } from '../../types'
import { format } from 'date-fns'

interface Props {
  alerts: Alert[]
  onAcknowledge: (id: string) => void
}

const typeIcon: Record<string, React.ElementType> = {
  temperature: Thermometer,
  humidity: Zap,
  shock: AlertTriangle,
  delay: Clock,
  customs: Shield,
  geofence: MapPin,
  equipment: Zap,
}

const severityStyle = {
  critical: 'border-red-500/30 bg-red-500/8',
  high: 'border-orange-500/30 bg-orange-500/8',
  medium: 'border-yellow-500/30 bg-yellow-500/8',
  low: 'border-white/10 bg-white/3',
}

const severityText = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-slate-400',
}

const severityBadge = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export default function AlertCenter({ alerts, onAcknowledge }: Props) {
  const unacked = alerts.filter(a => !a.acknowledged)
  const acked = alerts.filter(a => a.acknowledged)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Bell size={18} className="text-brand-400" />
            Alert Center
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">24/7 monitoring · Automated escalation workflows</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
            {unacked.length} unacknowledged
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
          const count = alerts.filter(a => a.severity === sev).length
          return (
            <div key={sev} className={clsx('rounded-xl border p-3 text-center', severityStyle[sev])}>
              <p className={clsx('text-xl font-bold', severityText[sev])}>{count}</p>
              <p className="text-xs text-slate-400 capitalize">{sev}</p>
            </div>
          )
        })}
      </div>

      {unacked.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Active Alerts</p>
          <div className="space-y-2">
            {unacked.map(alert => {
              const Icon = typeIcon[alert.type] || Bell
              return (
                <div key={alert.id} className={clsx('rounded-xl border p-4 glass fade-in', severityStyle[alert.severity])}>
                  <div className="flex items-start gap-3">
                    <div className={clsx('p-2 rounded-lg shrink-0', {
                      'bg-red-500/15': alert.severity === 'critical',
                      'bg-orange-500/15': alert.severity === 'high',
                      'bg-yellow-500/15': alert.severity === 'medium',
                      'bg-slate-500/15': alert.severity === 'low',
                    })}>
                      <Icon size={15} className={severityText[alert.severity]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-white">{alert.title}</span>
                        <span className={clsx('text-xs px-1.5 py-0 rounded border font-medium', severityBadge[alert.severity])}>
                          {alert.severity}
                        </span>
                        {alert.escalated && (
                          <span className="text-xs px-1.5 py-0 rounded bg-red-500/20 text-red-300 border border-red-500/20">escalated</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mb-2 leading-relaxed">{alert.message}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{alert.shipmentCode}</span>
                        <span>·</span>
                        <span>{format(new Date(alert.timestamp), 'MMM d HH:mm')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onAcknowledge(alert.id)}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/8 hover:bg-white/15 text-slate-300 border border-white/10 transition-colors flex items-center gap-1.5"
                    >
                      <CheckCheck size={12} />
                      ACK
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {acked.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Acknowledged</p>
          <div className="space-y-2">
            {acked.map(alert => {
              const Icon = typeIcon[alert.type] || Bell
              return (
                <div key={alert.id} className="rounded-xl border border-white/5 p-3 glass opacity-60">
                  <div className="flex items-start gap-3">
                    <Icon size={14} className="text-slate-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-400">{alert.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{alert.shipmentCode} · {format(new Date(alert.timestamp), 'MMM d HH:mm')}</p>
                    </div>
                    <CheckCheck size={13} className="text-green-500 shrink-0 mt-0.5" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
