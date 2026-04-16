import React, { useState } from 'react'
import clsx from 'clsx'
import {
  BrainCircuit, CheckCircle2, Circle, ArrowDown, Thermometer,
  ShieldCheck, Zap, GitBranch, BarChart3, AlertTriangle, ChevronDown,
  ChevronUp, Database, Route, Plane, TrendingUp,
  ChevronRight, Package, type LucideIcon
} from 'lucide-react'
import { Shipment, AgentAction, RouteCandidate, RouteEvaluation } from '../types'
import { formatDistanceToNow } from 'date-fns'

interface AgentWorkflowProps {
  shipments: Shipment[]
  agentActions: AgentAction[]
  selectedShipmentId: string | null
  onSelectShipment: (id: string) => void
}

const riskColors: Record<string, string> = {
  critical: 'text-red-400 border-red-500/40 bg-red-500/10',
  high:     'text-orange-400 border-orange-500/40 bg-orange-500/10',
  medium:   'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  low:      'text-green-400 border-green-500/40 bg-green-500/10',
}

const recColors: Record<string, string> = {
  select:  'text-green-400 border-green-500/40 bg-green-500/10',
  consider:'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  avoid:   'text-red-400 border-red-500/40 bg-red-500/10',
}

function ScorePill({ label, value }: { label: string; value: number }) {
  const color = value >= 7 ? 'text-green-400' : value >= 5 ? 'text-yellow-400' : 'text-red-400'
  return (
    <span className="flex flex-col items-center gap-0.5 min-w-[44px]">
      <span className={clsx('text-sm font-bold font-mono', color)}>{value.toFixed(1)}</span>
      <span className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</span>
    </span>
  )
}

function RouteCandidatesTable({ candidates, evaluations }: { candidates: RouteCandidate[]; evaluations: RouteEvaluation[] }) {
  const evalMap = Object.fromEntries(evaluations.map(e => [e.route_id, e]))
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-white/8">
            {['ID', 'Flight', 'Route', 'Departure', 'Transit', 'Cost', 'Cold Chain', 'Delay Risk', 'Scores', 'Verdict'].map(h => (
              <th key={h} className="pb-2 pr-3 text-slate-500 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map(c => {
            const ev = evalMap[c.route_id]
            const rec = ev?.recommendation ?? ''
            return (
              <tr key={c.route_id} className={clsx(
                'border-b border-white/5 transition-colors',
                rec === 'select' ? 'bg-green-500/5' : ''
              )}>
                <td className="py-2 pr-3 font-mono text-slate-400">{c.route_id}</td>
                <td className="py-2 pr-3 font-mono text-white font-medium">{c.flight_no ?? '—'}</td>
                <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    {c.flight_pattern.split('-').map((iata, i, arr) => (
                      <React.Fragment key={i}>
                        <span className="font-mono font-bold">{iata}</span>
                        {i < arr.length - 1 && <ChevronRight size={10} className="text-slate-600" />}
                      </React.Fragment>
                    ))}
                  </span>
                </td>
                <td className="py-2 pr-3 text-slate-400 whitespace-nowrap max-w-[140px] truncate">{c.earliest_departure}</td>
                <td className="py-2 pr-3 text-slate-300 whitespace-nowrap">{c.transit_hours}h</td>
                <td className="py-2 pr-3 text-white font-mono whitespace-nowrap">${c.cost_usd?.toLocaleString()}</td>
                <td className="py-2 pr-3">
                  {c.pharma_certified
                    ? <span className="text-green-400 font-medium">✓ CEIV{c.cold_storage_cost_per_hr ? ` $${c.cold_storage_cost_per_hr}/hr` : ''}</span>
                    : <span className="text-red-400 font-medium">✗ Dry ice only</span>}
                </td>
                <td className="py-2 pr-3">
                  <span className={clsx('font-medium', {
                    'text-green-400': c.delay_risk === 'low',
                    'text-yellow-400': c.delay_risk === 'medium',
                    'text-red-400': c.delay_risk === 'high',
                  })}>{c.delay_risk ?? '—'}</span>
                </td>
                <td className="py-2 pr-3">
                  {ev ? (
                    <div className="flex items-center gap-3">
                      <ScorePill label="Cost" value={ev.cost_score} />
                      <ScorePill label="Time" value={ev.time_score} />
                      <ScorePill label="GDP" value={ev.compliance_score} />
                      <span className="w-px h-6 bg-white/10" />
                      <span className="flex flex-col items-center gap-0.5">
                        <span className={clsx('text-sm font-bold font-mono', ev.overall_score >= 7 ? 'text-brand-300' : 'text-yellow-400')}>
                          {(typeof ev.overall_score === 'number' ? ev.overall_score : 0).toFixed(1)}
                        </span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider">Overall</span>
                      </span>
                    </div>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="py-2">
                  {rec ? (
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded border', recColors[rec] ?? '')}>
                      {rec.toUpperCase()}
                    </span>
                  ) : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {evaluations.some(e => e.risk_flags?.length > 0) && (
        <div className="mt-2 space-y-1">
          {evaluations.filter(e => e.risk_flags?.length > 0).map(e => (
            <div key={e.route_id} className="flex flex-wrap gap-1">
              <span className="text-[10px] text-slate-500">{e.route_id}:</span>
              {e.risk_flags.map((f, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-300">{f}</span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface NodeCardProps {
  step: number | null
  title: string
  icon: LucideIcon
  active: boolean
  taken: boolean
  tag?: string
  tagColor?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function NodeCard({ step, title, icon: Icon, active, taken, tag, tagColor, defaultOpen = false, children }: NodeCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const statusColor = !taken ? 'border-white/8 opacity-40' : active ? 'border-brand-500/40 bg-brand-500/5' : 'border-green-500/30'

  return (
    <div className={clsx('glass rounded-xl border transition-all', statusColor)}>
      <button
        onClick={() => taken && setOpen(o => !o)}
        className={clsx('w-full flex items-center gap-3 px-4 py-3 text-left', taken ? 'cursor-pointer' : 'cursor-default')}
      >
        <div className={clsx(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
          taken ? 'bg-green-500/20' : 'bg-white/5'
        )}>
          {taken
            ? <CheckCircle2 size={14} className="text-green-400" />
            : <Circle size={14} className="text-slate-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {step !== null && <span className="text-[10px] font-mono text-slate-600">#{step}</span>}
            <Icon size={13} className={taken ? 'text-brand-400' : 'text-slate-600'} />
            <span className={clsx('text-sm font-semibold', taken ? 'text-white' : 'text-slate-600')}>{title}</span>
            {tag && taken && (
              <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded border', tagColor ?? 'border-white/10 text-slate-400')}>
                {tag}
              </span>
            )}
          </div>
        </div>
        {taken && (open
          ? <ChevronUp size={13} className="text-slate-500 shrink-0" />
          : <ChevronDown size={13} className="text-slate-500 shrink-0" />
        )}
      </button>
      {taken && open && (
        <div className="px-4 pb-4 pt-0 border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  )
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex justify-center py-0.5">
      <div className={clsx('flex flex-col items-center gap-0.5', active ? 'opacity-100' : 'opacity-20')}>
        <div className="w-px h-3 bg-brand-500/50" />
        <ArrowDown size={12} className="text-brand-500/70" />
      </div>
    </div>
  )
}

export default function AgentWorkflow({ shipments, agentActions, selectedShipmentId, onSelectShipment }: AgentWorkflowProps) {
  const selectedShipment = shipments.find(s => s.id === selectedShipmentId) ?? null
  const action = agentActions
    .filter(a => a.shipmentId === selectedShipmentId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null

  const path = action?.graphPath ?? 'normal'
  const candidates = action?.routeResearch?.candidates ?? []
  const evaluations = action?.routeResearch?.evaluations ?? []
  const selectedRoute = evaluations.find(e => e.recommendation === 'select')
  const selectedCandidate = candidates.find(c => c.route_id === selectedRoute?.route_id) ?? candidates[0]

  const pathLabels: Record<string, string> = {
    normal:    'Normal Analysis',
    emergency: 'Emergency Response',
    rerouting: 'Post-Emergency Rerouting',
  }
  const pathColors: Record<string, string> = {
    normal:    'text-green-400 border-green-500/40 bg-green-500/10',
    emergency: 'text-red-400 border-red-500/40 bg-red-500/10',
    rerouting: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
  }

  return (
    <div className="flex h-full overflow-hidden gap-4 p-4">
      {/* Left: shipment selector */}
      <div className="w-56 shrink-0 space-y-2 overflow-y-auto">
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider px-1 pb-1">Shipments</p>
        {shipments.map(s => {
          const hasAction = agentActions.some(a => a.shipmentId === s.id)
          return (
            <button
              key={s.id}
              onClick={() => onSelectShipment(s.id)}
              className={clsx(
                'w-full text-left glass rounded-lg border px-3 py-2.5 transition-all',
                s.id === selectedShipmentId
                  ? 'border-brand-500/50 bg-brand-500/10'
                  : 'border-white/8 hover:border-white/15'
              )}
            >
              <p className="text-[10px] font-mono text-slate-500">{s.trackingCode}</p>
              <p className="text-xs font-medium text-white mt-0.5 leading-snug truncate">{s.product}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.origin.city} → {s.destination.city}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded border', riskColors[s.riskLevel])}>
                  {s.riskLevel.toUpperCase()}
                </span>
                {!hasAction && <span className="text-[9px] text-slate-600">no data yet</span>}
              </div>
            </button>
          )
        })}
      </div>

      {/* Right: workflow pipeline */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {/* Header */}
        <div className="glass border border-white/8 rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600/30 flex items-center justify-center">
              <BrainCircuit size={16} className="text-brand-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">LangGraph Agent Pipeline</p>
              {selectedShipment && (
                <p className="text-xs text-slate-400">
                  {selectedShipment.trackingCode} · {selectedShipment.carrier} · {selectedShipment.origin.city} → {selectedShipment.destination.city}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {action && (
              <span className={clsx('text-[10px] font-bold px-2 py-1 rounded border', pathColors[path])}>
                {pathLabels[path]}
              </span>
            )}
            {action && (
              <span className="text-[10px] text-slate-500">
                {formatDistanceToNow(new Date(action.timestamp), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        {!action ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
            <BrainCircuit size={32} className="opacity-30" />
            <p className="text-sm">No agent analysis yet for this shipment</p>
          </div>
        ) : (
          <div className="space-y-0.5">

            {/* ── START ── */}
            <NodeCard step={null} title="START — Shipment Ingested" icon={Package} active={false} taken={true} defaultOpen={false}>
              {selectedShipment && (
                <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                  {[
                    ['Product', selectedShipment.product],
                    ['Type', selectedShipment.productType],
                    ['Carrier', `${selectedShipment.carrier}${selectedShipment.flightNumber ? ` · ${selectedShipment.flightNumber}` : ''}`],
                    ['Temp Range', `${selectedShipment.temperatureMin}°C – ${selectedShipment.temperatureMax}°C`],
                    ['Current Temp', `${selectedShipment.temperature}°C`],
                    ['Progress', `${selectedShipment.progress?.toFixed(1)}%`],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p className="text-slate-500 text-[10px]">{label}</p>
                      <p className="text-white font-medium mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </NodeCard>

            <Connector active={true} />

            {/* ── Node 1: analyze_telemetry ── */}
            <NodeCard
              step={1} title="analyze_telemetry" icon={Thermometer}
              active={false} taken={true} defaultOpen={true}
              tag="LLM" tagColor="border-brand-500/40 text-brand-300 bg-brand-500/10"
            >
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                {action.telemetryAnalysis || action.reasoning || 'Analysis not available.'}
              </p>
            </NodeCard>

            <Connector active={true} />

            {/* ── Router ── */}
            <div className="glass border border-white/8 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch size={14} className="text-brand-400" />
                <span className="text-sm font-semibold text-white">route_decision</span>
                <span className="text-[10px] text-slate-500 ml-1">conditional edge</span>
              </div>
              <div className="flex gap-2">
                {(['normal', 'emergency', 'rerouting'] as const).map(p => (
                  <div key={p} className={clsx(
                    'flex-1 rounded-lg border px-3 py-2 text-center transition-all',
                    path === p ? pathColors[p] + ' border-opacity-60' : 'border-white/8 opacity-30'
                  )}>
                    <p className="text-[10px] font-bold uppercase tracking-wider">
                      {p === 'normal' ? '● Normal' : p === 'emergency' ? '🚨 Emergency' : '✈ Rerouting'}
                    </p>
                    <p className="text-[9px] mt-0.5 opacity-70">
                      {p === 'normal' ? 'assess_compliance' : p === 'emergency' ? 'emergency_response_plan' : 'research_routes'}
                    </p>
                    {path === p && <p className="text-[9px] font-bold mt-1">← ACTIVE</p>}
                  </div>
                ))}
              </div>
            </div>

            <Connector active={true} />

            {/* ── NORMAL PATH ── */}
            {path === 'normal' && (<>
              <NodeCard
                step={2} title="assess_compliance" icon={ShieldCheck}
                active={false} taken={true}
                tag={`${(action.complianceIssues ?? []).length} flags`}
                tagColor={(action.complianceIssues ?? []).length === 0 ? 'border-green-500/40 text-green-400' : 'border-orange-500/40 text-orange-400'}
              >
                {(action.complianceIssues ?? []).length === 0 ? (
                  <p className="mt-2 text-xs text-green-400">✓ Fully compliant — no flags raised</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(action.complianceIssues ?? []).map((f, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/25 text-orange-300 font-mono">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-slate-600">Frameworks: GDP · FDA 21 CFR Part 211 · WHO-PQT · IATA DGR</p>
              </NodeCard>
              <Connector active={true} />

              {/* ── compute_risk_score (step 3 on normal path) ── */}
              <NodeCard
                step={3} title="compute_risk_score" icon={TrendingUp}
                active={false} taken={true}
                tag={`${action.riskLevel.toUpperCase()} ${action.riskScore}`}
                tagColor={riskColors[action.riskLevel]}
                defaultOpen={true}
              >
                <div className="mt-2 grid grid-cols-3 gap-3 mb-3">
                  <div className="glass border border-white/8 rounded-lg p-2.5 text-center">
                    <p className={clsx('text-2xl font-bold font-mono', riskColors[action.riskLevel].split(' ')[0])}>{action.riskScore}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Risk Score</p>
                  </div>
                  <div className="glass border border-white/8 rounded-lg p-2.5 text-center">
                    <p className={clsx('text-lg font-bold', riskColors[action.riskLevel].split(' ')[0])}>{action.riskLevel.toUpperCase()}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Risk Level</p>
                  </div>
                  <div className="glass border border-white/8 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold font-mono text-brand-300">{action.confidence}%</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Confidence</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Reasoning</p>
                    <p className="text-slate-300 leading-relaxed">{action.reasoning}</p>
                  </div>
                  {action.estimatedImpact && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Estimated Impact</p>
                      <p className="text-slate-300 leading-relaxed">{action.estimatedImpact}</p>
                    </div>
                  )}
                </div>
              </NodeCard>
              <Connector active={true} />

              {/* ── generate_cascade_actions (step 4 on normal path) ── */}
              <NodeCard
                step={4} title="generate_cascade_actions" icon={Zap}
                active={false} taken={true}
                tag={`${action.actions.length} actions`}
                tagColor="border-brand-500/40 text-brand-300"
              >
                <div className="mt-2 space-y-1.5">
                  {action.actions.map((ca, i) => (
                    <div key={ca.id} className="flex items-start gap-2 text-xs">
                      <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center shrink-0 text-[10px] font-mono text-slate-400">{i + 1}</span>
                      <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 border',
                        ca.automated ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-orange-400 border-orange-500/30 bg-orange-500/10'
                      )}>{ca.automated ? 'AUTO' : 'MANUAL'}</span>
                      <span className="text-slate-300 leading-snug">{ca.description}</span>
                    </div>
                  ))}
                </div>
              </NodeCard>
            </>)}

            {/* ── EMERGENCY PATH ── */}
            {path === 'emergency' && (
              <NodeCard
                step={2} title="emergency_response_plan" icon={AlertTriangle}
                active={false} taken={true}
                tag="CRITICAL" tagColor="border-red-500/50 text-red-400 bg-red-500/10"
                defaultOpen={true}
              >
                <div className="mt-2 space-y-1.5">
                  {action.actions.map((ca, i) => (
                    <div key={ca.id} className="flex items-start gap-2 text-xs">
                      <span className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center shrink-0 text-[10px] font-mono text-red-400 border border-red-500/20">{i + 1}</span>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">[{ca.type}]</span>
                      <span className="text-slate-300 leading-snug">{ca.description}</span>
                    </div>
                  ))}
                </div>
              </NodeCard>
            )}

            {/* ── REROUTING PATH ── */}
            {path === 'rerouting' && (<>
              <NodeCard
                step={2} title="research_routes" icon={Database}
                active={false} taken={true}
                tag={`${candidates.length} from CSV`}
                tagColor="border-brand-500/40 text-brand-300"
                defaultOpen={true}
              >
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <Database size={11} className="text-brand-400" />
                  <span>Source: static route database · filtered by diversion airport + destination IATA</span>
                </div>
                {candidates.length > 0
                  ? <RouteCandidatesTable candidates={candidates} evaluations={[]} />
                  : <p className="text-xs text-slate-500 mt-2">No route data available</p>
                }
              </NodeCard>
              <Connector active={true} />
              <NodeCard
                step={3} title="evaluate_routes" icon={BarChart3}
                active={false} taken={evaluations.length > 0}
                tag="LLM scored" tagColor="border-brand-500/40 text-brand-300"
                defaultOpen={true}
              >
                {evaluations.length > 0 ? (
                  <RouteCandidatesTable candidates={candidates} evaluations={evaluations} />
                ) : (
                  <p className="text-xs text-slate-500 mt-2">Evaluation data not available</p>
                )}
              </NodeCard>
              <Connector active={true} />
              <NodeCard
                step={4} title="rerouting_plan" icon={Route}
                active={false} taken={true}
                tag="SELECTED" tagColor="border-green-500/40 text-green-400"
                defaultOpen={true}
              >
                {selectedCandidate ? (
                  <div className="mt-2 space-y-3">
                    <div className="glass border border-green-500/25 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Selected Route</p>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Plane size={13} className="text-green-400" />
                        <span className="text-sm font-bold text-white font-mono">{selectedCandidate.flight_no ?? selectedCandidate.flight_pattern}</span>
                        <span className="text-xs text-slate-400">{selectedCandidate.flight_pattern}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        {[
                          ['Carrier', selectedCandidate.carrier],
                          ['Transit', `${selectedCandidate.transit_hours}h`],
                          ['Cost', `$${selectedCandidate.cost_usd?.toLocaleString()}`],
                          ['Departs', selectedCandidate.earliest_departure],
                        ].map(([label, value]) => (
                          <div key={label as string}>
                            <p className="text-[10px] text-slate-500">{label}</p>
                            <p className="text-white font-medium mt-0.5">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Action Plan</p>
                      {action.actions.map((ca, i) => (
                        <div key={ca.id} className="flex items-start gap-2 text-xs">
                          <span className="w-5 h-5 rounded bg-orange-500/10 flex items-center justify-center shrink-0 text-[10px] font-mono text-orange-400 border border-orange-500/20">{i + 1}</span>
                          <span className="font-mono text-[10px] text-slate-500 shrink-0">[{ca.type}]</span>
                          <span className="text-slate-300 leading-snug">{ca.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {action.actions.map((ca, i) => (
                      <div key={ca.id} className="flex items-start gap-2 text-xs">
                        <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center shrink-0 text-[10px] font-mono text-slate-400">{i + 1}</span>
                        <span className="text-slate-300 leading-snug">{ca.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </NodeCard>
            </>)}

            {/* ── compute_risk_score for emergency / rerouting paths ── */}
            {path !== 'normal' && (<>
              <Connector active={true} />
              <NodeCard
                step={path === 'emergency' ? 3 : 5}
                title="compute_risk_score" icon={TrendingUp}
                active={false} taken={true}
                tag={`${action.riskLevel.toUpperCase()} ${action.riskScore}`}
                tagColor={riskColors[action.riskLevel]}
                defaultOpen={true}
              >
                <div className="mt-2 grid grid-cols-3 gap-3 mb-3">
                  <div className="glass border border-white/8 rounded-lg p-2.5 text-center">
                    <p className={clsx('text-2xl font-bold font-mono', riskColors[action.riskLevel].split(' ')[0])}>{action.riskScore}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Risk Score</p>
                  </div>
                  <div className="glass border border-white/8 rounded-lg p-2.5 text-center">
                    <p className={clsx('text-lg font-bold', riskColors[action.riskLevel].split(' ')[0])}>{action.riskLevel.toUpperCase()}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Risk Level</p>
                  </div>
                  <div className="glass border border-white/8 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold font-mono text-brand-300">{action.confidence}%</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Confidence</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500 mb-1">Reasoning</p>
                    <p className="text-slate-300 leading-relaxed">{action.reasoning}</p>
                  </div>
                  {action.estimatedImpact && (
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Estimated Impact</p>
                      <p className="text-slate-300 leading-relaxed">{action.estimatedImpact}</p>
                    </div>
                  )}
                </div>
              </NodeCard>
            </>)}

            <Connector active={true} />

            {/* ── END ── */}
            <div className="glass border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle2 size={16} className="text-green-400 shrink-0" />
              <div>
                <span className="text-sm font-semibold text-white">END — Pipeline Complete</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Decision logged · Compliance recorded · Status: <span className={clsx('font-bold', action.status === 'auto_executed' ? 'text-green-400' : action.status === 'pending_approval' ? 'text-orange-400' : 'text-slate-400')}>{action.status}</span>
                  {action.approvedBy && <span className="text-slate-500"> · Approved by {action.approvedBy}</span>}
                </p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
