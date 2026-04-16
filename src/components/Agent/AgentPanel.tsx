import React, { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import {
  BrainCircuit, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Zap, Shield, Clock, AlertTriangle, RotateCcw, FileText,
  MapPin, Users, Package, Phone, Navigation, Timer, History, Send
} from 'lucide-react'
import { AgentAction, CascadeAction, DecisionRecord } from '../../types'
import { format, formatDistanceToNow } from 'date-fns'

interface Props {
  actions: AgentAction[]
  agentThinking: boolean
  onApprove: (id: string) => void
  onReject: (id: string, humanInstruction?: string) => void
  decisionHistory?: DecisionRecord[]
}

const actionTypeIcon: Record<string, React.ElementType> = {
  reroute: Navigation,
  notify_provider: Phone,
  reschedule_appointments: Users,
  cold_storage: Package,
  customs_escalation: Shield,
  insurance_claim: FileText,
  carrier_switch: RotateCcw,
  inventory_update: Package,
  compliance_log: FileText,
  alert_team: AlertTriangle,
}

const riskBadge = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const statusBadge = {
  pending_approval: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  approved: 'bg-green-500/20 text-green-300 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  executed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  auto_executed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
}

const actionStatusColor: Record<string, string> = {
  pending: 'text-slate-400',
  executing: 'text-yellow-400 blink',
  done: 'text-green-400',
  skipped: 'text-slate-600',
}

function CascadeActionItem({ action }: { action: CascadeAction }) {
  const Icon = actionTypeIcon[action.type] || Zap
  return (
    <div className={clsx(
      'flex items-start gap-2.5 p-2.5 rounded-lg border',
      action.status === 'done' ? 'border-green-500/15 bg-green-500/5' :
      action.status === 'executing' ? 'border-yellow-500/20 bg-yellow-500/5' :
      action.status === 'skipped' ? 'border-white/5 opacity-40' :
      'border-white/8 bg-white/2'
    )}>
      <Icon size={14} className={clsx('mt-0.5 shrink-0', actionStatusColor[action.status])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-slate-300 capitalize">
            {action.type.replace(/_/g, ' ')}
          </span>
          {action.automated && (
            <span className="text-xs px-1.5 py-0 rounded bg-purple-500/20 text-purple-400 border border-purple-500/20">auto</span>
          )}
          <span className={clsx('text-xs ml-auto', actionStatusColor[action.status])}>
            {action.status}
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{action.description}</p>
      </div>
    </div>
  )
}

function ActionCard({ action, onApprove, onReject }: {
  action: AgentAction
  onApprove: () => void
  onReject: (instruction?: string) => void
}) {
  const [expanded, setExpanded] = useState(action.riskLevel === 'critical' || action.riskLevel === 'high')
  const [showOverride, setShowOverride] = useState(false)
  const [overrideText, setOverrideText] = useState('')
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (action.status !== 'pending_approval' || action.riskLevel !== 'critical' || !action.pendingApprovalAt) {
      setSecondsLeft(null)
      return
    }
    const update = () => {
      const elapsed = (Date.now() - new Date(action.pendingApprovalAt!).getTime()) / 1000
      setSecondsLeft(Math.max(0, Math.ceil(20 - elapsed)))
    }
    update()
    const iv = setInterval(update, 500)
    return () => clearInterval(iv)
  }, [action.status, action.riskLevel, action.pendingApprovalAt])

  return (
    <div className={clsx(
      'rounded-xl border glass fade-in overflow-hidden',
      action.riskLevel === 'critical' ? 'border-red-500/25' :
      action.riskLevel === 'high' ? 'border-orange-500/25' :
      'border-white/8'
    )}>
      <div
        className="p-4 cursor-pointer hover:bg-white/2 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          <div className={clsx(
            'p-2 rounded-lg shrink-0',
            action.riskLevel === 'critical' ? 'bg-red-500/15' :
            action.riskLevel === 'high' ? 'bg-orange-500/15' : 'bg-blue-500/15'
          )}>
            <BrainCircuit size={16} className={clsx(
              action.riskLevel === 'critical' ? 'text-red-400' :
              action.riskLevel === 'high' ? 'text-orange-400' : 'text-brand-400'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-white">{action.shipmentCode}</span>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', riskBadge[action.riskLevel])}>
                {action.riskLevel.toUpperCase()}
              </span>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full border', statusBadge[action.status])}>
                {action.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{action.reasoning}</p>
          </div>
          <button className="text-slate-500 hover:text-white shrink-0 mt-0.5">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Zap size={11} />
            <span>{action.actions.length} actions</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield size={11} />
            <span>{action.complianceFrameworks.join(' · ')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={11} />
            <span>{format(new Date(action.timestamp), 'HH:mm:ss')}</span>
          </div>
          <div className="ml-auto text-right">
            <span className="text-slate-400">Confidence: </span>
            <span className="text-white font-medium">{action.confidence}%</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4">
          <div className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 mb-3">
            <p className="text-xs font-medium text-brand-300 mb-1">Impact Assessment</p>
            <p className="text-xs text-slate-400">{action.estimatedImpact}</p>
          </div>

          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Cascade Actions</p>
          <div className="space-y-1.5">
            {action.actions.map(ca => (
              <CascadeActionItem key={ca.id} action={ca} />
            ))}
          </div>

          {action.status === 'pending_approval' && (
            <div className="mt-4 space-y-2">
              {secondsLeft !== null && (
                <div className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium',
                  secondsLeft > 10 ? 'bg-orange-500/10 border-orange-500/30 text-orange-300' :
                  secondsLeft > 5  ? 'bg-red-500/15 border-red-500/40 text-red-300' :
                                     'bg-red-500/25 border-red-500/60 text-red-200 animate-pulse'
                )}>
                  <Timer size={13} className="shrink-0" />
                  <span>Auto-executes in <strong>{secondsLeft}s</strong> if not reviewed</span>
                  <div className="ml-auto h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full transition-all duration-500"
                      style={{ width: `${(secondsLeft / 20) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onApprove() }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 text-sm font-medium transition-colors"
                >
                  <CheckCircle size={14} />
                  Approve & Execute
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowOverride(!showOverride); setExpanded(true) }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 text-sm font-medium transition-colors"
                >
                  <XCircle size={14} />
                  Reject
                </button>
              </div>
              {showOverride && (
                <div className="p-3 rounded-lg bg-slate-800/60 border border-white/10 space-y-2">
                  <p className="text-xs text-slate-400 font-medium">What should the agent do instead? <span className="text-slate-500">(optional — leave blank to reject without override)</span></p>
                  <textarea
                    value={overrideText}
                    onChange={e => setOverrideText(e.target.value)}
                    placeholder="e.g. Prioritise finding a cold-chain certified carrier even if more expensive..."
                    rows={3}
                    className="w-full text-xs text-white bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-brand-500/50 placeholder-slate-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onReject(overrideText.trim() || undefined); setShowOverride(false) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/20 border border-orange-500/30 text-orange-400 hover:bg-orange-600/30 text-xs font-medium transition-colors"
                    >
                      <Send size={11} />
                      {overrideText.trim() ? 'Reject & Send Override to Agent' : 'Reject Without Override'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowOverride(false) }}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {action.status === 'approved' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-400">
              <CheckCircle size={13} />
              <span>Approved by {action.approvedBy} — Execution in progress</span>
            </div>
          )}
          {action.status === 'rejected' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
              <XCircle size={13} />
              <span>Rejected — No automated action taken. Logged for audit.</span>
            </div>
          )}
          {action.status === 'auto_executed' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-purple-400">
              <Zap size={13} />
              <span>{action.approvedBy?.includes('timeout') ? '⚡ Auto-executed after 20s critical timeout — safest option selected' : 'Auto-executed (low-impact actions) — Fully logged'}</span>
            </div>
          )}
          {action.status === 'rejected' && action.humanInstruction && (
            <div className="mt-3 p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/15">
              <p className="text-xs text-orange-400 font-medium mb-1">Human Override Instruction (sent to agent):</p>
              <p className="text-xs text-slate-400">{action.humanInstruction}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AgentPanel({ actions, agentThinking, onApprove, onReject, decisionHistory = [] }: Props) {
  const pendingCount = actions.filter(a => a.status === 'pending_approval').length
  const autoCount = actions.filter(a => a.status === 'auto_executed').length
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BrainCircuit size={18} className="text-brand-400" />
            AI Agent Console
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Continuous risk analysis · Human-in-the-loop approvals</p>
        </div>
        <div className="flex items-center gap-2">
          {agentThinking && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg agent-thinking border border-blue-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 blink" />
              <span className="text-xs text-blue-300">Analyzing telemetry...</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass border border-white/8 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{actions.length}</p>
          <p className="text-xs text-slate-400">Total Actions</p>
        </div>
        <div className="glass border border-orange-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-400">{pendingCount}</p>
          <p className="text-xs text-slate-400">Pending Approval</p>
        </div>
        <div className="glass border border-purple-500/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-purple-400">{autoCount}</p>
          <p className="text-xs text-slate-400">Auto-Executed</p>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle size={14} className="text-orange-400 shrink-0" />
          <p className="text-xs text-orange-300">
            <span className="font-bold">{pendingCount} action{pendingCount > 1 ? 's' : ''}</span> require human approval before execution.
            Review and approve or reject to maintain compliance.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {actions.map(a => (
          <ActionCard
            key={a.id}
            action={a}
            onApprove={() => onApprove(a.id)}
            onReject={(instruction) => onReject(a.id, instruction)}
          />
        ))}
        {actions.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <BrainCircuit size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No active agent recommendations</p>
            <p className="text-xs mt-1">All shipments within normal parameters</p>
          </div>
        )}
      </div>

      {decisionHistory.length > 0 && (
        <div className="border-t border-white/5 pt-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors mb-3"
          >
            <History size={13} />
            <span className="font-medium">Decision History</span>
            <span className="ml-1 px-1.5 py-0 rounded-full bg-white/10 text-slate-300">{decisionHistory.length}</span>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showHistory && (
            <div className="space-y-2">
              {decisionHistory.slice(0, 10).map(rec => (
                <div key={rec.id} className="flex gap-3 p-2.5 rounded-lg bg-white/2 border border-white/5">
                  <div className={clsx('mt-0.5 shrink-0',
                    rec.decision === 'approved' ? 'text-green-400' :
                    rec.decision === 'auto_executed' ? 'text-purple-400' : 'text-red-400'
                  )}>
                    {rec.decision === 'approved' ? <CheckCircle size={13} /> :
                     rec.decision === 'auto_executed' ? <Zap size={13} /> : <XCircle size={13} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-slate-300 capitalize">{rec.decision.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-600">{rec.trackingCode}</span>
                      <span className="text-xs text-slate-600 ml-auto">{formatDistanceToNow(new Date(rec.timestamp), { addSuffix: true })}</span>
                    </div>
                    {rec.humanInstruction && (
                      <p className="text-xs text-orange-400/80 italic">“{rec.humanInstruction}”</p>
                    )}
                    <p className="text-xs text-slate-500 truncate">{rec.agentResponse}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
