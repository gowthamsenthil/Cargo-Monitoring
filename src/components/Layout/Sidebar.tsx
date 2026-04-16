import React from 'react'
import {
  LayoutDashboard, MapPin, BrainCircuit, Bell, ShieldCheck, BarChart3,
  Thermometer, Zap, Activity, GitBranch
} from 'lucide-react'
import clsx from 'clsx'

type Tab = 'dashboard' | 'tracking' | 'agent' | 'alerts' | 'compliance' | 'analytics' | 'workflow'

interface SidebarProps {
  activeTab: Tab
  setActiveTab: (t: Tab) => void
  criticalAlerts: number
  pendingActions: number
  agentThinking: boolean
}

const NAV = [
  { id: 'dashboard' as Tab, label: 'Overview', icon: LayoutDashboard },
  { id: 'tracking' as Tab, label: 'Live Tracking', icon: MapPin },
  { id: 'agent' as Tab, label: 'AI Agent', icon: BrainCircuit },
  { id: 'workflow' as Tab, label: 'Agent Workflow', icon: GitBranch },
  { id: 'alerts' as Tab, label: 'Alerts', icon: Bell },
  { id: 'compliance' as Tab, label: 'Compliance', icon: ShieldCheck },
  { id: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
]

export default function Sidebar({ activeTab, setActiveTab, criticalAlerts, pendingActions, agentThinking }: SidebarProps) {
  return (
    <aside className="w-60 shrink-0 flex flex-col glass-dark border-r border-white/5 min-h-screen">
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
            <Thermometer size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">ALTA</p>
            <p className="text-xs text-slate-200 leading-tight">Adaptive Logistics and Tracking Agent</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className={clsx(
            'w-2 h-2 rounded-full',
            agentThinking ? 'bg-yellow-400 blink' : 'bg-green-400'
          )} />
          <span className="text-xs text-slate-200">
            {agentThinking ? 'Agent analyzing...' : 'All systems nominal'}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ id, label, icon: Icon }) => {
          const badge = id === 'alerts' ? criticalAlerts : id === 'agent' ? pendingActions : 0
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                activeTab === id
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon size={16} />
              <span className="flex-1 text-left">{label}</span>
              {badge > 0 && (
                <span className={clsx(
                  'text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                  id === 'alerts' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                )}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/5 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Zap size={12} className="text-yellow-400" />
          <span>OnAsset Global Network</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Activity size={12} className="text-green-400" />
          <span>GDP / FDA / WHO-PQT</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <ShieldCheck size={12} className="text-brand-300" />
          <span>Audit-Ready Compliance</span>
        </div>
      </div>
    </aside>
  )
}
