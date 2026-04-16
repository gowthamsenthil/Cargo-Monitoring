import React, { Suspense, lazy, useState } from 'react'
import clsx from 'clsx'
import {
  Package, Thermometer, AlertTriangle, TrendingUp, Activity,
  Clock, DollarSign, BrainCircuit, ChevronRight,
  Wifi, Battery, MapPin, Globe, Plus, ServerCrash, FlaskConical, PlaneTakeoff,
  Truck, Building2, CheckCircle2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useShipments } from './hooks/useShipments'
import Sidebar from './components/Layout/Sidebar'
import KpiCard from './components/Dashboard/KpiCard'
import ShipmentList from './components/Shipments/ShipmentList'
import TelemetryChart from './components/Charts/TelemetryChart'
import AgentPanel from './components/Agent/AgentPanel'
import AlertCenter from './components/Alerts/AlertCenter'
import ComplianceLogView from './components/Compliance/ComplianceLog'
import AnalyticsView from './components/Analytics/AnalyticsView'
import CreateShipmentModal from './components/Shipments/CreateShipmentModal'
import SimulationPanel from './components/Simulation/SimulationPanel'
import AgentWorkflow from './components/AgentWorkflow'

const ShipmentMap = lazy(() => import('./components/Map/ShipmentMap'))

const riskColors = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/25',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
  low: 'text-green-400 bg-green-500/10 border-green-500/25',
}

const statusLabels: Record<string, string> = {
  in_transit: 'In Transit', delayed: 'Delayed', customs_hold: 'Customs Hold',
  delivered: 'Delivered', at_risk: 'At Risk', diverted: 'Diverted',
}

function ShipmentDetailPanel({ shipment }: { shipment: import('./types').Shipment | null }) {
  if (!shipment) return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Select a shipment to view details
    </div>
  )

  const tempOk = shipment.temperature >= shipment.temperatureMin && shipment.temperature <= shipment.temperatureMax
  const lastTelemetry = shipment.telemetryHistory[shipment.telemetryHistory.length - 1]

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      <div className={clsx('rounded-xl border p-4 glass', riskColors[shipment.riskLevel as keyof typeof riskColors])}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-mono text-slate-400">{shipment.trackingCode}</p>
            <p className="text-sm font-bold text-white mt-0.5 leading-snug">{shipment.product}</p>
            <p className="text-xs text-slate-400 mt-1">{shipment.carrier} {shipment.flightNumber ? `· ${shipment.flightNumber}` : ''}</p>
          </div>
          <div className="text-right space-y-1">
            <span className={clsx('text-xs font-bold px-2 py-1 rounded-full border', riskColors[shipment.riskLevel as keyof typeof riskColors])}>
              {shipment.riskLevel.toUpperCase()} {shipment.riskScore}
            </span>
            {shipment.quarantined && (
              <div className="flex justify-end">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/60 bg-red-500/15 text-red-300 animate-pulse">
                  🚫 QUARANTINE
                </span>
              </div>
            )}
            {shipment.acarsDispatched && !shipment.quarantined && (
              <div className="flex justify-end">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-orange-500/50 bg-orange-500/10 text-orange-300">
                  ✈ ACARS SENT
                </span>
              </div>
            )}
            <p className="text-xs text-slate-400">{statusLabels[shipment.status as keyof typeof statusLabels]}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1 text-xs">
          <MapPin size={11} className="text-slate-500" />
          <span className="text-slate-300 font-medium">{shipment.origin.city}</span>
          <ChevronRight size={10} className="text-slate-600" />
          <span className="text-slate-400">{shipment.currentLocation.city}</span>
          <ChevronRight size={10} className="text-slate-600" />
          <span className="text-slate-300 font-medium">{shipment.destination.city}</span>
        </div>

        <div className="mt-2">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{shipment.progress.toFixed(0)}% complete</span>
            {shipment.delayHours > 0 && <span className="text-orange-400">+{shipment.delayHours}h delay</span>}
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all duration-1000',
                shipment.riskLevel === 'critical' ? 'bg-red-500' :
                shipment.riskLevel === 'high' ? 'bg-orange-500' :
                shipment.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
              )}
              style={{ width: `${shipment.progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="glass border border-white/8 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Temperature</p>
          <p className={clsx('text-xl font-bold font-mono', tempOk ? 'text-green-400' : 'text-red-400 blink')}>
            {shipment.temperature}°C
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Range: {shipment.temperatureMin}–{shipment.temperatureMax}°C</p>
        </div>
        <div className="glass border border-white/8 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Humidity</p>
          <p className="text-xl font-bold font-mono text-purple-400">{shipment.humidity}%</p>
          <p className="text-xs text-slate-500 mt-0.5">Normal: 40–65%</p>
        </div>
        <div className="glass border border-white/8 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Shock</p>
          <p className={clsx('text-xl font-bold font-mono', shipment.shock > 1.5 ? 'text-orange-400' : 'text-slate-300')}>
            {shipment.shock}G
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Max: 5G</p>
        </div>
        <div className="glass border border-white/8 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Customs</p>
          <p className={clsx('text-sm font-bold capitalize', {
            'text-green-400': shipment.customsStatus === 'cleared',
            'text-red-400': shipment.customsStatus === 'hold',
            'text-yellow-400': shipment.customsStatus === 'pending',
            'text-orange-400': shipment.customsStatus === 'escalated',
          })}>
            {shipment.customsStatus}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Border status</p>
        </div>
      </div>

      {/* Stability budget card */}
      {shipment.stabilityBudgetMinutes !== undefined && (
        <div className={clsx(
          'glass rounded-xl border p-3',
          shipment.quarantined ? 'border-red-500/40 bg-red-500/5' :
          (shipment.stabilityExceedanceMinutes ?? 0) > 0 ? 'border-orange-500/30' :
          'border-white/8'
        )}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Stability Budget</p>
            <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded border',
              shipment.quarantined ? 'border-red-500/60 text-red-300 bg-red-500/10' :
              (shipment.stabilityExceedanceMinutes ?? 0) > 0 ? 'border-orange-500/40 text-orange-300' :
              'border-green-500/40 text-green-300'
            )}>
              {shipment.quarantined ? 'EXHAUSTED' : (shipment.stabilityExceedanceMinutes ?? 0) > 0 ? 'AT RISK' : 'INTACT'}
            </span>
          </div>
          <div className="flex items-end justify-between mb-1.5">
            <span className={clsx('text-lg font-bold font-mono',
              shipment.quarantined ? 'text-red-400' :
              (shipment.stabilityExceedanceMinutes ?? 0) > 0 ? 'text-orange-400' : 'text-green-400'
            )}>
              {(shipment.stabilityExceedanceMinutes ?? 0).toFixed(1)} min
            </span>
            <span className="text-xs text-slate-500">/ {shipment.stabilityBudgetMinutes} min budget</span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all duration-1000',
                shipment.quarantined ? 'bg-red-500' :
                (shipment.stabilityExceedanceMinutes ?? 0) / (shipment.stabilityBudgetMinutes ?? 45) > 0.5 ? 'bg-orange-500' :
                'bg-green-500'
              )}
              style={{ width: `${Math.min(100, ((shipment.stabilityExceedanceMinutes ?? 0) / (shipment.stabilityBudgetMinutes ?? 45)) * 100)}%` }}
            />
          </div>
          {/* Stability audit ruling */}
          {shipment.stabilityAuditRuling && (
            <div className={clsx('mt-2 pt-2 border-t border-white/5 text-xs',
              shipment.quarantined ? 'text-red-300' :
              shipment.stabilityAuditRuling.includes('MARGINAL') ? 'text-orange-300' : 'text-green-400'
            )}>
              <p className="font-semibold">Audit: {shipment.stabilityAuditRuling.split('—')[0].trim()}</p>
              {shipment.stabilityAuditDetail && (
                <p className="text-slate-500 mt-0.5 leading-snug text-[11px]">{shipment.stabilityAuditDetail}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Last check-in / current phase */}
      {shipment.lastCheckInName && (
        <div className="glass border border-brand-500/20 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Current Phase</p>
            {shipment.lastCheckInAt && (
              <span className="text-xs text-slate-500">
                {formatDistanceToNow(new Date(shipment.lastCheckInAt), { addSuffix: true })}
              </span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 text-brand-400">
              {shipment.currentPhase?.startsWith('flight') ? <PlaneTakeoff size={13} /> :
               shipment.currentPhase?.includes('customs') ? <Building2 size={13} /> :
               shipment.currentPhase?.includes('road') || shipment.currentPhase?.includes('last_mile') ? <Truck size={13} /> :
               <CheckCircle2 size={13} />}
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-snug">{shipment.lastCheckInName}</p>
              {shipment.lastCheckInDesc && (
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{shipment.lastCheckInDesc}</p>
              )}
            </div>
          </div>

          {/* Phase timeline */}
          {shipment.transitPhases && shipment.transitPhases.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex gap-0.5">
                {shipment.transitPhases.map((ph, i) => {
                  const done = shipment.progress >= ph.endProgress
                  const active = shipment.currentPhase === ph.id
                  return (
                    <div
                      key={ph.id}
                      title={ph.name}
                      className={clsx(
                        'flex-1 h-1.5 rounded-sm transition-colors',
                        done ? 'bg-brand-500' :
                        active ? 'bg-brand-400 animate-pulse' :
                        'bg-white/10'
                      )}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-600">{shipment.origin.city}</span>
                <span className="text-[10px] text-slate-600">{shipment.destination.city}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="glass border border-white/8 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-400">Sensor Status</p>
          <div className="flex items-center gap-1">
            <Wifi size={11} className="text-green-400" />
            <span className="text-xs text-green-400">Live</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Battery size={11} className="text-slate-400" />
            <span className="text-slate-400">Battery: </span>
            <span className="text-white font-medium">{lastTelemetry?.batteryLevel ?? '--'}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wifi size={11} className="text-slate-400" />
            <span className="text-slate-400">Signal: </span>
            <span className="text-white font-medium">{lastTelemetry?.signalStrength ?? '--'}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Package size={11} className="text-slate-400" />
            <span className="text-slate-400">Container: </span>
            <span className="text-white font-mono font-medium">{shipment.containerId}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Globe size={11} className="text-slate-400" />
            <span className="text-slate-400">Qty: </span>
            <span className="text-white font-medium">{shipment.quantity.toLocaleString()} {shipment.unit}</span>
          </div>
        </div>
      </div>

      {shipment.complianceFlags.length > 0 && (
        <div className="glass border border-orange-500/20 rounded-xl p-3">
          <p className="text-xs font-medium text-orange-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle size={11} />
            Active Compliance Flags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shipment.complianceFlags.map((flag: string) => (
              <span key={flag} className="text-xs px-2 py-0.5 rounded bg-orange-500/15 text-orange-300 border border-orange-500/20">
                {flag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {shipment.healthcarePartner && (
        <div className="glass border border-white/8 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Healthcare Partner</p>
          <p className="text-sm font-medium text-white">{shipment.healthcarePartner}</p>
          {shipment.appointments && (
            <p className="text-xs text-slate-400 mt-0.5">
              {shipment.appointments.toLocaleString()} patient appointments linked
            </p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">
            Cargo value: <span className="text-white">${shipment.value.toLocaleString()}</span>
          </p>
        </div>
      )}

      {shipment.emergencyActive && shipment.emergencyAirport && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/12 p-3 animate-pulse-slow">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <p className="text-xs font-bold text-red-300">🚨 Active Emergency — Cold Storage Failure</p>
          </div>
          <p className="text-xs text-red-200/80 mb-1">
            Current temp: <strong>{shipment.temperature}°C</strong> · Limit: {shipment.temperatureMax}°C
          </p>
          <p className="text-xs text-red-200/80">
            Nearest diversion: <strong>{shipment.emergencyAirport.name} ({shipment.emergencyAirport.iata})</strong>,{' '}
            {shipment.emergencyAirport.country}
          </p>
          <p className="text-xs text-red-200/60 mt-1.5">
            Open <strong>Simulate</strong> panel → "Cold Storage Fixed" to resolve.
          </p>
        </div>
      )}

      {shipment.emergencyResolved && !shipment.emergencyActive && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/8 p-3">
          <div className="flex items-center gap-2 mb-1">
            <PlaneTakeoff size={13} className="text-yellow-400 shrink-0" />
            <p className="text-xs font-bold text-yellow-300">Emergency Resolved — Re-routing in Progress</p>
          </div>
          {shipment.reroutingFrom && (
            <p className="text-xs text-yellow-200/70">
              Diverted to <strong>{shipment.reroutingFrom.city} ({shipment.reroutingFrom.iata})</strong>.
              AI agent generating cost-optimised route to <strong>{shipment.destination.city}</strong>.
            </p>
          )}
        </div>
      )}

      <TelemetryChart shipment={shipment} />
    </div>
  )
}

function DashboardView() {
  const sim = useShipments()
  const [showCreate, setShowCreate] = useState(false)
  const [showSim, setShowSim] = useState(false)
  const pendingActions = sim.agentActions.filter(a => a.status === 'pending_approval').length
  const unackedAlerts = sim.alerts.filter(a => !a.acknowledged).length

  const tabLabel: Record<string, string> = {
    dashboard: 'Operations Overview',
    tracking: 'Live Global Tracking',
    agent: 'AI Agent Console',
    workflow: 'LangGraph Workflow',
    alerts: 'Alert Center',
    compliance: 'Compliance & Audit Log',
    analytics: 'Predictive Analytics',
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#1F6F4A]">
      {showCreate && (
        <CreateShipmentModal
          onClose={() => setShowCreate(false)}
          onCreate={sim.createShipment}
        />
      )}

      {showSim && (
        <SimulationPanel
          shipments={sim.shipments}
          selectedShipmentId={sim.selectedShipmentId}
          onSelectShipment={sim.setSelectedShipmentId}
          onTriggerScenario={sim.triggerScenario}
          onResolveEmergency={sim.resolveEmergency}
          onClose={() => setShowSim(false)}
        />
      )}

      <Sidebar
        activeTab={sim.activeTab}
        setActiveTab={sim.setActiveTab}
        criticalAlerts={unackedAlerts}
        pendingActions={pendingActions}
        agentThinking={sim.agentThinking}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {sim.backendError && (
          <div className="shrink-0 px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 text-xs text-red-300">
            <ServerCrash size={13} className="shrink-0" />
            <span>Backend unreachable — start the Python server: <code className="font-mono bg-white/5 px-1 rounded">cd backend && uvicorn main:app --reload</code></span>
          </div>
        )}

        <header className="shrink-0 px-6 py-3 border-b border-white/5 glass-dark flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-white">{tabLabel[sim.activeTab]}</h1>
            <p className="text-xs text-slate-100">ALTA · LangGraph Agent · {new Date().toUTCString().slice(0, 25)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-100">
              <span>Poll rate:</span>
              {[1, 2, 5].map(s => (
                <button
                  key={s}
                  onClick={() => sim.setSimulationSpeed(s)}
                  className={clsx(
                    'px-2 py-1 rounded text-xs font-medium border transition-colors',
                    sim.simulationSpeed === s
                      ? 'bg-brand-500/20 border-brand-500/30 text-brand-300'
                      : 'border-white/10 text-slate-100 hover:text-white'
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
            {sim.agentThinking && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/15 border border-brand-500/20">
                <BrainCircuit size={13} className="text-brand-400" />
                <span className="text-xs text-brand-300">Agent analysing…</span>
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 blink" />
              </div>
            )}
            <button
              onClick={() => setShowSim(v => !v)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                showSim
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                  : 'border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
              )}
            >
              <FlaskConical size={13} />
              Simulate
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors"
            >
              <Plus size={13} />
              New Shipment
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {sim.activeTab === 'dashboard' && sim.shipments.length === 0 && !sim.backendError && (
            <div className="h-full flex flex-col items-center justify-center gap-6 p-8">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
                  <Package size={28} className="text-brand-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">No Active Shipments</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Create your first shipment to start monitoring. The LangGraph AI agent will
                  immediately analyse temperature compliance, regulatory risk, and generate
                  cascading operational recommendations.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full max-w-lg text-center">
                {[
                  { icon: BrainCircuit, label: 'LangGraph Agent', desc: '4-node pipeline' },
                  { icon: Thermometer, label: 'Cold Chain Monitor', desc: 'Real-time telemetry' },
                  { icon: Activity, label: 'GDP / FDA Compliance', desc: 'Immutable audit log' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="glass border border-white/8 rounded-xl p-4">
                    <Icon size={20} className="text-brand-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Create First Shipment
              </button>
            </div>
          )}

          {sim.activeTab === 'dashboard' && sim.shipments.length > 0 && (
            <div className="h-full flex flex-col overflow-auto p-6 space-y-5">
              <div className="grid grid-cols-5 gap-3 shrink-0">
                <KpiCard title="Active Shipments" value={sim.kpis.activeShipments} icon={Package} color="blue" subtitle={`${sim.kpis.totalShipments} total`} trendLabel="Global pharmaceutical distribution" />
                <KpiCard title="At-Risk Shipments" value={sim.kpis.atRiskShipments} icon={AlertTriangle} color="red" subtitle="Requiring intervention" trendLabel="High + Critical risk levels" />
                <KpiCard title="Temp. Compliance" value={`${sim.kpis.temperatureCompliance}%`} icon={Thermometer} color="green" subtitle="Within target range" trendLabel="Cold chain integrity score" />
                <KpiCard title="On-Time Rate" value={`${sim.kpis.onTimeRate}%`} icon={Clock} color="purple" subtitle="< 2h delay threshold" trendLabel="Delivery performance KPI" />
                <KpiCard title="Exposure" value={`$${(sim.kpis.potentialLoss / 1000).toFixed(0)}K`} icon={DollarSign} color="orange" subtitle="Potential loss" trendLabel="AI risk-weighted estimate" />
              </div>

              <div className="grid grid-cols-3 gap-3 shrink-0">
                <div className="glass border border-brand-500/15 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit size={15} className="text-brand-400" />
                    <p className="text-xs font-medium text-slate-300">Agent Activity</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{sim.kpis.agentActionsToday}</p>
                  <p className="text-xs text-slate-400 mt-1">recommendations generated</p>
                  <p className="text-xs text-slate-500 mt-1">{sim.kpis.automatedResolutions} auto-executed · {pendingActions} pending approval</p>
                </div>
                <div className="glass border border-white/8 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity size={15} className="text-green-400" />
                    <p className="text-xs font-medium text-slate-300">Avg Risk Score</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{sim.kpis.avgRiskScore}</p>
                  <p className="text-xs text-slate-400 mt-1">fleet-wide composite</p>
                  <div className="mt-2 h-1.5 bg-slate-700 rounded-full">
                    <div
                      className={clsx('h-full rounded-full',
                        sim.kpis.avgRiskScore >= 65 ? 'bg-red-500' :
                        sim.kpis.avgRiskScore >= 40 ? 'bg-orange-500' : 'bg-green-500'
                      )}
                      style={{ width: `${sim.kpis.avgRiskScore}%` }}
                    />
                  </div>
                </div>
                <div className="glass border border-white/8 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={15} className="text-purple-400" />
                    <p className="text-xs font-medium text-slate-300">Unacknowledged Alerts</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{unackedAlerts}</p>
                  <p className="text-xs text-slate-400 mt-1">requiring operator attention</p>
                  <p className="text-xs text-slate-500 mt-1">{sim.alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length} critical</p>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
                <div className="col-span-1 glass border border-white/8 rounded-xl flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 shrink-0">
                    <p className="text-sm font-semibold text-white">Shipments</p>
                    <p className="text-xs text-slate-400">{sim.shipments.length} active routes</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <ShipmentList
                      shipments={sim.shipments}
                      selectedId={sim.selectedShipmentId}
                      onSelect={sim.setSelectedShipmentId}
                    />
                  </div>
                </div>

                <div className="col-span-2 glass border border-white/8 rounded-xl flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 shrink-0">
                    <p className="text-sm font-semibold text-white">Shipment Detail</p>
                    {sim.selectedShipment && (
                      <p className="text-xs text-slate-400">{sim.selectedShipment.trackingCode} · Live telemetry</p>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <ShipmentDetailPanel shipment={sim.selectedShipment} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {sim.activeTab === 'tracking' && (
            <div className="h-full flex gap-0 overflow-hidden">
              <div className="w-72 shrink-0 glass-dark border-r border-white/5 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 shrink-0">
                  <p className="text-sm font-semibold text-white">Active Routes</p>
                  <p className="text-xs text-slate-400">{sim.shipments.length} shipments tracked</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <ShipmentList
                    shipments={sim.shipments}
                    selectedId={sim.selectedShipmentId}
                    onSelect={sim.setSelectedShipmentId}
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 relative">
                  <Suspense fallback={
                    <div className="h-full flex items-center justify-center text-slate-500">
                      Loading map...
                    </div>
                  }>
                    <ShipmentMap
                      shipments={sim.shipments}
                      selectedId={sim.selectedShipmentId}
                      onSelect={sim.setSelectedShipmentId}
                    />
                  </Suspense>
                  <div className="absolute top-3 right-3 glass-dark border border-white/10 rounded-xl p-3 z-[1000]">
                    <div className="space-y-1.5">
                      {(['critical', 'high', 'medium', 'low'] as const).map(level => (
                        <div key={level} className="flex items-center gap-2">
                          <div className={clsx('w-2.5 h-2.5 rounded-full', {
                            'bg-red-500': level === 'critical',
                            'bg-orange-500': level === 'high',
                            'bg-yellow-500': level === 'medium',
                            'bg-green-500': level === 'low',
                          })} />
                          <span className="text-xs text-slate-400 capitalize">{level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {sim.selectedShipment && (
                  <div className="h-48 shrink-0 glass-dark border-t border-white/5 p-4 overflow-y-auto">
                    <ShipmentDetailPanel shipment={sim.selectedShipment} />
                  </div>
                )}
              </div>
            </div>
          )}

          {sim.activeTab === 'workflow' && (
            <AgentWorkflow
              shipments={sim.shipments}
              agentActions={sim.agentActions}
              selectedShipmentId={sim.selectedShipmentId}
              onSelectShipment={sim.setSelectedShipmentId}
            />
          )}

          {sim.activeTab === 'agent' && (
            <div className="h-full overflow-y-auto p-6">
              <AgentPanel
                actions={sim.agentActions}
                agentThinking={sim.agentThinking}
                onApprove={sim.approveAction}
                onReject={sim.rejectAction}
                decisionHistory={sim.decisionHistory}
              />
            </div>
          )}

          {sim.activeTab === 'alerts' && (
            <div className="h-full overflow-y-auto p-6">
              <AlertCenter alerts={sim.alerts} onAcknowledge={sim.acknowledgeAlert} />
            </div>
          )}

          {sim.activeTab === 'compliance' && (
            <div className="h-full overflow-y-auto p-6">
              <ComplianceLogView logs={sim.complianceLogs} />
            </div>
          )}

          {sim.activeTab === 'analytics' && (
            <div className="h-full overflow-y-auto p-6">
              <AnalyticsView shipments={sim.shipments} kpis={sim.kpis} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return <DashboardView />
}
