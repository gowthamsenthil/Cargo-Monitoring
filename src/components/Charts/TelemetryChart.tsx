import React from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend
} from 'recharts'
import { Shipment } from '../../types'
import { format } from 'date-fns'

interface Props {
  shipment: Shipment
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-dark border border-white/10 rounded-lg p-3 text-xs">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-bold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
          {p.name === 'Temperature' ? '°C' : p.name === 'Humidity' ? '%' : 'G'}
        </p>
      ))}
    </div>
  )
}

export default function TelemetryChart({ shipment }: Props) {
  const data = shipment.telemetryHistory.slice(-24).map(r => ({
    time: format(new Date(r.timestamp), 'HH:mm'),
    Temperature: r.temperature,
    Humidity: r.humidity,
    Shock: r.shock,
  }))

  const excursionCount = shipment.telemetryHistory.filter(
    r => r.temperature < shipment.temperatureMin || r.temperature > shipment.temperatureMax
  ).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Temperature History (24h)</h3>
          <p className="text-xs text-slate-400">
            Target range: {shipment.temperatureMin}°C – {shipment.temperatureMax}°C
            {excursionCount > 0 && (
              <span className="ml-2 text-red-400 font-medium">· {excursionCount} excursion events</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${
            shipment.temperature < shipment.temperatureMin || shipment.temperature > shipment.temperatureMax
              ? 'bg-red-500 blink' : 'bg-green-500'
          }`} />
          <span className="text-xs text-slate-400">
            Current: <span className="font-mono font-bold text-white">{shipment.temperature}°C</span>
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} interval={3} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={shipment.temperatureMax} stroke="#ef444466" strokeDasharray="4 2" label={{ value: 'MAX', fill: '#ef4444', fontSize: 9 }} />
          <ReferenceLine y={shipment.temperatureMin} stroke="#ef444466" strokeDasharray="4 2" label={{ value: 'MIN', fill: '#ef4444', fontSize: 9 }} />
          <Area type="monotone" dataKey="Temperature" stroke="#3b82f6" strokeWidth={2} fill="url(#tempGrad)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-400 mb-1">Humidity (24h)</p>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 8 }} interval={5} />
              <YAxis tick={{ fill: '#64748b', fontSize: 8 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Humidity" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#humGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Shock Events (G-force)</p>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="shockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 8 }} interval={5} />
              <YAxis tick={{ fill: '#64748b', fontSize: 8 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Shock" stroke="#f97316" strokeWidth={1.5} fill="url(#shockGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
