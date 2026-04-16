import React from 'react'
import clsx from 'clsx'
import { ShieldCheck, CheckCircle, AlertTriangle, XCircle, Hash } from 'lucide-react'
import { ComplianceLog } from '../../types'
import { format } from 'date-fns'

interface Props {
  logs: ComplianceLog[]
}

const statusStyle = {
  compliant: { badge: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle, iconColor: 'text-green-400' },
  warning: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertTriangle, iconColor: 'text-yellow-400' },
  violation: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle, iconColor: 'text-red-400' },
  remediated: { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: CheckCircle, iconColor: 'text-blue-400' },
}

const frameworkColor: Record<string, string> = {
  GDP: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  FDA_21CFR: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  WHO_PQT: 'text-green-400 bg-green-500/10 border-green-500/20',
  IATA_DGR: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

export default function ComplianceLogView({ logs }: Props) {
  const compliantCount = logs.filter(l => l.status === 'compliant').length
  const warningCount = logs.filter(l => l.status === 'warning').length
  const violationCount = logs.filter(l => l.status === 'violation').length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-400" />
            Compliance & Audit Log
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">GDP · FDA 21 CFR · WHO-PQT · IATA DGR — Immutable audit trail</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass border border-green-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{compliantCount}</p>
          <p className="text-xs text-slate-400">Compliant</p>
        </div>
        <div className="glass border border-yellow-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{warningCount}</p>
          <p className="text-xs text-slate-400">Warnings</p>
        </div>
        <div className="glass border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{violationCount}</p>
          <p className="text-xs text-slate-400">Violations</p>
        </div>
      </div>

      <div className="glass border border-white/8 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Audit Entries</p>
          <p className="text-xs text-slate-500">{logs.length} records</p>
        </div>
        <div className="divide-y divide-white/5 max-h-[520px] overflow-y-auto">
          {logs.map(log => {
            const style = statusStyle[log.status]
            const Icon = style.icon
            return (
              <div key={log.id} className="p-4 hover:bg-white/2 transition-colors">
                <div className="flex items-start gap-3">
                  <Icon size={15} className={clsx('mt-0.5 shrink-0', style.iconColor)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-white">{log.event}</span>
                      <span className={clsx('text-xs px-1.5 rounded border', style.badge)}>
                        {log.status}
                      </span>
                      <span className={clsx('text-xs px-1.5 rounded border', frameworkColor[log.framework])}>
                        {log.framework.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-2 leading-relaxed">{log.details}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="font-medium text-slate-400">{log.shipmentCode}</span>
                      <span>·</span>
                      <span>{format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}</span>
                      <span>·</span>
                      <span>Operator: {log.operator}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Hash size={10} className="text-slate-600" />
                      <span className="text-xs text-slate-600 font-mono truncate">{log.auditHash}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="glass border border-white/8 rounded-xl p-4">
        <p className="text-xs font-medium text-slate-300 mb-2">Regulatory Framework Coverage</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'EU GDP Guidelines', status: 'Active', desc: 'Good Distribution Practice — Chapter 9 Temperature Control' },
            { name: 'FDA 21 CFR Part 211', status: 'Active', desc: 'Current Good Manufacturing Practice — Finished Pharmaceuticals' },
            { name: 'WHO PQ Guidelines', status: 'Active', desc: 'Prequalification — Temperature-sensitive transport' },
            { name: 'IATA DGR Section 10', status: 'Active', desc: 'Dangerous Goods — Biological substances, diagnostic specimens' },
          ].map(fw => (
            <div key={fw.name} className="p-3 rounded-lg bg-white/3 border border-white/6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-white">{fw.name}</p>
                <span className="text-xs text-green-400">{fw.status}</span>
              </div>
              <p className="text-xs text-slate-500">{fw.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
