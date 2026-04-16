import React from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ScatterChart, Scatter, ZAxis, Cell, PieChart, Pie, Legend
} from 'recharts'
import { BarChart3, TrendingDown, AlertTriangle, Package } from 'lucide-react'
import { Shipment, KpiMetrics } from '../../types'

interface Props {
  shipments: Shipment[]
  kpis: KpiMetrics
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e']

export default function AnalyticsView({ shipments, kpis }: Props) {
  const riskDistribution = [
    { name: 'Critical', value: shipments.filter(s => s.riskLevel === 'critical').length, color: '#ef4444' },
    { name: 'High', value: shipments.filter(s => s.riskLevel === 'high').length, color: '#f97316' },
    { name: 'Medium', value: shipments.filter(s => s.riskLevel === 'medium').length, color: '#eab308' },
    { name: 'Low', value: shipments.filter(s => s.riskLevel === 'low').length, color: '#22c55e' },
  ]

  const delayData = shipments.map(s => ({
    name: s.trackingCode,
    delay: s.delayHours,
    risk: s.riskScore,
    value: s.value / 1000,
  }))

  const radarData = [
    { metric: 'Temp. Compliance', value: kpis.temperatureCompliance },
    { metric: 'On-Time Rate', value: kpis.onTimeRate },
    { metric: 'Documentation', value: 88 },
    { metric: 'Agent Coverage', value: 94 },
    { metric: 'Route Efficiency', value: 79 },
    { metric: 'Risk Mitigation', value: 100 - kpis.avgRiskScore },
  ]

  const shipmentsByCarrier = [
    { carrier: 'Emirates Cargo', count: 1, value: 420 },
    { carrier: 'SIA Cargo', count: 1, value: 185 },
    { carrier: 'LATAM Cargo', count: 1, value: 64 },
    { carrier: 'Ethiopian', count: 1, value: 312 },
    { carrier: 'ANA Cargo', count: 1, value: 580 },
    { carrier: 'Air France', count: 1, value: 250 },
  ]

  const predictedRiskTrend = Array.from({ length: 12 }, (_, i) => ({
    hour: `+${(i + 1) * 2}h`,
    risk: Math.max(10, kpis.avgRiskScore + (Math.sin(i * 0.5) * 8) + (i * 0.5)),
    threshold: 65,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <BarChart3 size={18} className="text-brand-400" />
          Predictive Analytics
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">AI-driven risk forecasting · Bottleneck analysis · Performance KPIs</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass border border-white/8 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-1">Risk Level Distribution</p>
          <p className="text-xs text-slate-400 mb-3">Active shipments by risk category</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={riskDistribution}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {riskDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend
                formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{value}</span>}
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass border border-white/8 rounded-xl p-4">
          <p className="text-sm font-semibold text-white mb-1">Performance Radar</p>
          <p className="text-xs text-slate-400 mb-3">Multi-dimensional KPI health score</p>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 9 }} />
              <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass border border-white/8 rounded-xl p-4">
        <p className="text-sm font-semibold text-white mb-1">Risk Score Forecast (24h)</p>
        <p className="text-xs text-slate-400 mb-3">AI-predicted aggregate risk trajectory — threshold line at 65</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={predictedRiskTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="risk" name="Risk Score" radius={[3, 3, 0, 0]}>
              {predictedRiskTrend.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.risk >= 65 ? '#ef4444' : entry.risk >= 40 ? '#f97316' : '#22c55e'} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass border border-white/8 rounded-xl p-4">
        <p className="text-sm font-semibold text-white mb-1">Carrier Performance vs Cargo Value</p>
        <p className="text-xs text-slate-400 mb-3">Shipment count and cargo value ($K) by carrier</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={shipmentsByCarrier} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="carrier" tick={{ fill: '#64748b', fontSize: 9 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="value" name="Value ($K)" fill="#3b82f6" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass border border-white/8 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-green-400" />
            <p className="text-xs font-medium text-slate-300">Avg Delay</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {(shipments.reduce((a, s) => a + s.delayHours, 0) / shipments.length).toFixed(1)}h
          </p>
          <p className="text-xs text-slate-500 mt-1">across all active routes</p>
        </div>
        <div className="glass border border-white/8 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-orange-400" />
            <p className="text-xs font-medium text-slate-300">Exposure</p>
          </div>
          <p className="text-2xl font-bold text-white">${(kpis.potentialLoss / 1000).toFixed(0)}K</p>
          <p className="text-xs text-slate-500 mt-1">potential product loss</p>
        </div>
        <div className="glass border border-white/8 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package size={14} className="text-brand-400" />
            <p className="text-xs font-medium text-slate-300">Total Value</p>
          </div>
          <p className="text-2xl font-bold text-white">
            ${(shipments.reduce((a, s) => a + s.value, 0) / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-slate-500 mt-1">cargo under monitoring</p>
        </div>
      </div>
    </div>
  )
}
