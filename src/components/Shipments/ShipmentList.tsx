import React from 'react'
import clsx from 'clsx'
import { Thermometer, Clock, MapPin, Package } from 'lucide-react'
import { Shipment } from '../../types'

interface Props {
  shipments: Shipment[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const riskColors = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low: 'text-green-400 bg-green-500/10 border-green-500/30',
}

const statusLabel: Record<string, string> = {
  in_transit: 'In Transit',
  delayed: 'Delayed',
  customs_hold: 'Customs Hold',
  delivered: 'Delivered',
  at_risk: 'At Risk',
  diverted: 'Diverted',
}

const statusColor: Record<string, string> = {
  in_transit: 'text-blue-400',
  delayed: 'text-orange-400',
  customs_hold: 'text-red-400',
  delivered: 'text-green-400',
  at_risk: 'text-red-500',
  diverted: 'text-purple-400',
}

export default function ShipmentList({ shipments, selectedId, onSelect }: Props) {
  return (
    <div className="space-y-2">
      {shipments.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={clsx(
            'w-full text-left rounded-xl border p-3 transition-all glass',
            selectedId === s.id
              ? 'border-brand-500/40 bg-brand-500/10'
              : 'border-white/5 hover:border-white/15 hover:bg-white/5'
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{s.product}</p>
              <p className="text-xs text-slate-400">{s.trackingCode}</p>
            </div>
            <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full border', riskColors[s.riskLevel])}>
              {s.riskScore}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <MapPin size={11} className="text-slate-500 shrink-0" />
              <span className="text-xs text-slate-400 truncate">{s.currentLocation.city}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Thermometer size={11} className={clsx('shrink-0',
                s.temperature < s.temperatureMin || s.temperature > s.temperatureMax
                  ? 'text-red-400' : 'text-green-400'
              )} />
              <span className={clsx('text-xs font-mono',
                s.temperature < s.temperatureMin || s.temperature > s.temperatureMax
                  ? 'text-red-400' : 'text-slate-300'
              )}>{s.temperature}°C</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={clsx('text-xs', statusColor[s.status])}>{statusLabel[s.status]}</span>
            </div>
            {s.delayHours > 0 && (
              <div className="flex items-center gap-1.5">
                <Clock size={11} className="text-orange-400 shrink-0" />
                <span className="text-xs text-orange-400">+{s.delayHours}h delay</span>
              </div>
            )}
          </div>

          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{s.origin.city}</span>
              <span>{s.destination.city}</span>
            </div>
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-1000',
                  s.riskLevel === 'critical' ? 'bg-red-500' :
                  s.riskLevel === 'high' ? 'bg-orange-500' :
                  s.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                )}
                style={{ width: `${s.progress}%` }}
              />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Package size={11} className="text-slate-500" />
            <span className="text-xs text-slate-500">{s.quantity.toLocaleString()} {s.unit} · {s.carrier}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
