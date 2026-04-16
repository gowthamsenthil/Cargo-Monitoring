import { useState, useEffect, useCallback, useRef } from 'react'
import { Shipment, Alert, AgentAction, ComplianceLog, KpiMetrics } from '../types'
import { SHIPMENTS, ALERTS, COMPLIANCE_LOGS } from '../data/syntheticData'
import { runAgentAnalysis, updateShipmentTelemetry } from '../data/agentLogic'

function computeKpis(shipments: Shipment[], alerts: Alert[], agentActions: AgentAction[]): KpiMetrics {
  const active = shipments.filter(s => s.status !== 'delivered')
  const atRisk = shipments.filter(s => s.riskLevel === 'critical' || s.riskLevel === 'high')
  const critical = alerts.filter(a => a.severity === 'critical' && !a.acknowledged)
  const onTime = shipments.filter(s => s.delayHours < 2).length
  const tempCompliant = shipments.filter(s => {
    return s.temperature >= s.temperatureMin && s.temperature <= s.temperatureMax
  }).length
  const totalRisk = shipments.reduce((acc, s) => acc + s.riskScore, 0)
  const potentialLoss = atRisk.reduce((acc, s) => acc + s.value * (s.riskScore / 100) * 0.6, 0)
  const autoExec = agentActions.filter(a => a.status === 'auto_executed').length

  return {
    totalShipments: shipments.length,
    activeShipments: active.length,
    atRiskShipments: atRisk.length,
    criticalAlerts: critical.length,
    onTimeRate: Math.round((onTime / shipments.length) * 100),
    temperatureCompliance: Math.round((tempCompliant / shipments.length) * 100),
    avgRiskScore: Math.round(totalRisk / shipments.length),
    potentialLoss: Math.round(potentialLoss),
    agentActionsToday: agentActions.length,
    automatedResolutions: autoExec,
  }
}

export function useSimulation() {
  const [shipments, setShipments] = useState<Shipment[]>(SHIPMENTS)
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS)
  const [agentActions, setAgentActions] = useState<AgentAction[]>(() => runAgentAnalysis(SHIPMENTS))
  const [complianceLogs, setComplianceLogs] = useState<ComplianceLog[]>(COMPLIANCE_LOGS)
  const [kpis, setKpis] = useState<KpiMetrics>(() => computeKpis(SHIPMENTS, ALERTS, runAgentAnalysis(SHIPMENTS)))
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>('SHP-001')
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tracking' | 'agent' | 'alerts' | 'compliance' | 'analytics'>('dashboard')
  const [agentThinking, setAgentThinking] = useState(false)
  const [simulationSpeed, setSimulationSpeed] = useState(1)
  const tickRef = useRef(0)

  const tick = useCallback(() => {
    tickRef.current += 1

    setShipments(prev => {
      const updated = prev.map(s => updateShipmentTelemetry(s))
      return updated
    })

    if (tickRef.current % 10 === 0) {
      setAgentThinking(true)
      setTimeout(() => {
        setShipments(prev => {
          const newActions = runAgentAnalysis(prev)
          setAgentActions(newActions)
          setKpis(computeKpis(prev, alerts, newActions))
          setAgentThinking(false)
          return prev
        })
      }, 1200)
    } else {
      setShipments(prev => {
        setKpis(computeKpis(prev, alerts, agentActions))
        return prev
      })
    }
  }, [alerts, agentActions])

  useEffect(() => {
    const interval = setInterval(tick, 3000 / simulationSpeed)
    return () => clearInterval(interval)
  }, [tick, simulationSpeed])

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a))
  }, [])

  const approveAction = useCallback((actionId: string) => {
    setAgentActions(prev => prev.map(a =>
      a.id === actionId ? {
        ...a,
        status: 'approved',
        approvedBy: 'Operations Manager',
        actions: a.actions.map(ca => ca.automated ? ca : { ...ca, status: 'executing' as const })
      } : a
    ))

    const log: ComplianceLog = {
      id: `CMP-${Date.now()}`,
      timestamp: new Date().toISOString(),
      shipmentId: agentActions.find(a => a.id === actionId)?.shipmentId ?? '',
      shipmentCode: agentActions.find(a => a.id === actionId)?.shipmentCode ?? '',
      framework: 'GDP',
      event: 'Agent Action Approved by Human Operator',
      details: `Action package ${actionId} approved. Human-in-the-loop process completed. Cascading actions initiated.`,
      operator: 'Operations Manager',
      status: 'compliant',
      auditHash: `sha256:${Math.random().toString(36).substr(2, 16)}`,
    }
    setComplianceLogs(prev => [log, ...prev])
  }, [agentActions])

  const rejectAction = useCallback((actionId: string) => {
    setAgentActions(prev => prev.map(a =>
      a.id === actionId ? { ...a, status: 'rejected' } : a
    ))
  }, [])

  const selectedShipment = shipments.find(s => s.id === selectedShipmentId) ?? null

  return {
    shipments,
    alerts,
    agentActions,
    complianceLogs,
    kpis,
    selectedShipment,
    selectedShipmentId,
    setSelectedShipmentId,
    activeTab,
    setActiveTab,
    agentThinking,
    simulationSpeed,
    setSimulationSpeed,
    acknowledgeAlert,
    approveAction,
    rejectAction,
  }
}
