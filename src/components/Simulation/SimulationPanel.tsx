import React, { useState } from 'react'
import clsx from 'clsx'
import {
  X, Thermometer, Zap, Package, Clock, AlertTriangle,
  PlaneTakeoff, Wind, CheckCircle2, RefreshCw, Loader2
} from 'lucide-react'
import { Shipment } from '../../types'

interface Props {
  shipments: Shipment[]
  selectedShipmentId: string | null
  onSelectShipment: (id: string) => void
  onTriggerScenario: (shipmentId: string, type: string) => Promise<void>
  onResolveEmergency: (shipmentId: string) => Promise<void>
  onClose: () => void
}

interface Scenario {
  type: string
  label: string
  description: string
  severity: 'critical' | 'high' | 'medium'
  icon: React.ElementType
  emergency?: boolean
}

const SCENARIOS: Scenario[] = [
  {
    type: 'cold_storage_failure',
    label: 'Cold Storage Failure',
    description: 'Refrigeration unit fails mid-flight. Triggers emergency landing branch in LangGraph.',
    severity: 'critical',
    icon: Thermometer,
    emergency: true,
  },
  {
    type: 'temperature_excursion',
    label: 'Temperature Excursion',
    description: 'Mild temp drift 1.5–4.5°C above upper limit. Agent generates compliance and cooling actions.',
    severity: 'high',
    icon: Thermometer,
  },
  {
    type: 'shock_event',
    label: 'High Shock Event',
    description: 'Vibration spike to 4.8–9.2 G detected. Agent assesses cargo damage risk.',
    severity: 'high',
    icon: Zap,
  },
  {
    type: 'customs_hold',
    label: 'Customs Hold',
    description: 'Shipment detained at customs. Agent escalates with documentation actions.',
    severity: 'high',
    icon: Package,
  },
  {
    type: 'route_disruption',
    label: 'Route Disruption',
    description: 'Flight diverted. Agent recommends re-routing and partner notification.',
    severity: 'high',
    icon: Wind,
  },
  {
    type: 'delay_increase',
    label: 'Delay Increase',
    description: 'Significant delay added to schedule. Agent updates ETA and notifies stakeholders.',
    severity: 'medium',
    icon: Clock,
  },
  {
    type: 'normalize',
    label: 'Reset to Normal',
    description: 'Reset all sensor readings to nominal values for this shipment.',
    severity: 'medium',
    icon: RefreshCw,
  },
]

const severityBorder: Record<string, string> = {
  critical: 'border-red-500/30 hover:border-red-500/60',
  high: 'border-orange-500/30 hover:border-orange-500/60',
  medium: 'border-slate-500/30 hover:border-slate-500/50',
}

const severityIcon: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-slate-400',
}

export default function SimulationPanel({
  shipments, selectedShipmentId, onSelectShipment,
  onTriggerScenario, onResolveEmergency, onClose,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  const selectedShipment = shipments.find(s => s.id === selectedShipmentId)

  async function handleScenario(type: string) {
    if (!selectedShipmentId) return
    setLoading(type)
    try {
      await onTriggerScenario(selectedShipmentId, type)
    } finally {
      setLoading(null)
    }
  }

  async function handleResolve() {
    if (!selectedShipmentId) return
    setLoading('resolve')
    try {
      await onResolveEmergency(selectedShipmentId)
    } finally {
      setLoading(null)
    }
  }

  const isEmergency = selectedShipment?.emergencyActive
  const isRerouting = selectedShipment?.emergencyResolved && !selectedShipment?.emergencyActive

  return (
    <div className="fixed right-0 top-0 h-full w-80 z-40 flex flex-col glass-dark border-l border-white/8 shadow-2xl">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-white/8 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-white">Simulation Controls</p>
          <p className="text-xs text-slate-400 mt-0.5">Inject scenarios · verify agent alerts</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Shipment selector */}
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Target Shipment</p>
          <div className="space-y-1.5">
            {shipments.length === 0 && (
              <p className="text-xs text-slate-500 italic">No shipments created yet</p>
            )}
            {shipments.map(s => (
              <button
                key={s.id}
                onClick={() => onSelectShipment(s.id)}
                className={clsx(
                  'w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors',
                  selectedShipmentId === s.id
                    ? 'bg-brand-500/15 border-brand-500/40 text-white'
                    : 'border-white/8 text-slate-300 hover:border-white/20 hover:bg-white/4'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium">{s.trackingCode}</span>
                  {s.emergencyActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse">
                      🚨 EMERGENCY
                    </span>
                  )}
                  {s.emergencyResolved && !s.emergencyActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                      ↪ RE-ROUTING
                    </span>
                  )}
                </div>
                <div className="text-slate-500 mt-0.5 truncate">{s.product}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Emergency resolve banner */}
        {isEmergency && selectedShipment && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <p className="text-xs font-bold text-red-300">Active Emergency</p>
            </div>
            <p className="text-xs text-red-200/80 mb-1">
              Temp: <strong>{selectedShipment.temperature}°C</strong> (limit {selectedShipment.temperatureMax}°C)
            </p>
            {selectedShipment.emergencyAirport && (
              <p className="text-xs text-red-200/80 mb-3">
                Nearest airport: <strong>{selectedShipment.emergencyAirport.name} ({selectedShipment.emergencyAirport.iata})</strong>
              </p>
            )}
            <button
              onClick={handleResolve}
              disabled={loading === 'resolve'}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors disabled:opacity-60"
            >
              {loading === 'resolve'
                ? <><Loader2 size={12} className="animate-spin" /> Resolving...</>
                : <><CheckCircle2 size={12} /> Cold Storage Fixed — Resolve Emergency</>
              }
            </button>
          </div>
        )}

        {/* Post-resolution banner */}
        {isRerouting && selectedShipment && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/8 p-3">
            <div className="flex items-center gap-2 mb-1">
              <PlaneTakeoff size={14} className="text-yellow-400 shrink-0" />
              <p className="text-xs font-bold text-yellow-300">Re-routing in Progress</p>
            </div>
            <p className="text-xs text-yellow-200/70">
              Agent is generating cost-optimised alternative route from{' '}
              <strong>{selectedShipment.reroutingFrom?.city ?? selectedShipment.emergencyAirport?.city}</strong>
              {' '}to <strong>{selectedShipment.destination.city}</strong>.
            </p>
          </div>
        )}

        {/* Scenario grid */}
        {!selectedShipmentId && (
          <p className="text-xs text-slate-500 italic text-center py-4">Select a shipment above to inject scenarios</p>
        )}

        {selectedShipmentId && (
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Inject Scenario</p>
            <div className="space-y-2">
              {SCENARIOS.map(sc => {
                const Icon = sc.icon
                const isLoading = loading === sc.type
                const disabled = !!loading || (isEmergency && sc.type !== 'normalize')

                return (
                  <button
                    key={sc.type}
                    onClick={() => handleScenario(sc.type)}
                    disabled={disabled}
                    className={clsx(
                      'w-full text-left p-3 rounded-lg border transition-colors group',
                      severityBorder[sc.severity],
                      disabled && !isLoading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                      sc.emergency ? 'bg-red-500/5' : 'bg-white/2'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={clsx('mt-0.5 shrink-0', severityIcon[sc.severity])}>
                        {isLoading
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Icon size={13} />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-white">{sc.label}</p>
                          {sc.emergency && (
                            <span className="text-[9px] px-1 py-0 rounded border border-red-500/40 text-red-400">EMERGENCY</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{sc.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* LangGraph path info */}
        <div className="glass border border-brand-500/15 rounded-xl p-3">
          <p className="text-xs font-medium text-brand-300 mb-2">LangGraph Route</p>
          <div className="space-y-1 text-[11px] text-slate-400">
            {isEmergency ? (
              <p className="text-red-300">analyze_telemetry → <strong className="text-red-400">emergency_response_plan</strong> → compute_risk_score</p>
            ) : isRerouting ? (
              <p className="text-yellow-300">analyze_telemetry → <strong className="text-yellow-400">rerouting_plan</strong> → compute_risk_score</p>
            ) : (
              <p>analyze_telemetry → assess_compliance → <span className="text-brand-400">generate_cascade_actions</span> → compute_risk_score</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
