import { useEffect, useMemo, useState } from 'react'
import './App.css'

type AgentType = 'CrewAI' | 'LangGraph' | 'BeeAI' | 'OpenClaw' | 'Admin'
type AgentStatus = 'online' | 'offline' | 'busy' | 'error'

interface Agent {
  id: string
  name: string
  type: AgentType
  status: AgentStatus
  last_heartbeat: string
  current_task_id?: string | null
}

interface Heartbeat {
  id: string
  agent_id: string
  timestamp: string
  status: AgentStatus
}

type AlertSeverity = 'info' | 'warning' | 'critical'

interface Alert {
  id: string
  severity: AlertSeverity
  message: string
  related_agent_id?: string | null
  created_at: string
}

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface PerformanceMetric {
  agent_id: string
  cpu_usage: number
  memory_usage: number
  tasks_per_minute: number
  error_rate_per_hour: number
}

type MainTab = 'crons' | 'decisions' | 'signals' | 'costs' | 'performance' | 'architecture'

function statusColor(status: AgentStatus): string {
  switch (status) {
    case 'online':
      return '#22c55e'
    case 'busy':
      return '#facc15'
    case 'error':
      return '#f97373'
    case 'offline':
    default:
      return '#6b7280'
  }
}

function App() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([])
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetric[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<MainTab>('crons')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showAlertsPanel, setShowAlertsPanel] = useState<boolean>(false)
  const [refreshSeconds, setRefreshSeconds] = useState<number>(15)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)
        const [agentsRes, hbRes, perfRes, alertsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/agents`),
          fetch(`${API_BASE_URL}/heartbeats/recent`),
          fetch(`${API_BASE_URL}/metrics/performance`),
          fetch(`${API_BASE_URL}/alerts`),
        ])

        if (!agentsRes.ok) throw new Error(`Failed to load agents: ${agentsRes.status}`)
        if (!hbRes.ok) throw new Error(`Failed to load heartbeats: ${hbRes.status}`)
        if (!perfRes.ok) throw new Error(`Failed to load performance metrics: ${perfRes.status}`)
        if (!alertsRes.ok) throw new Error(`Failed to load alerts: ${alertsRes.status}`)

        const agentsData = (await agentsRes.json()) as Agent[]
        const hbData = (await hbRes.json()) as Heartbeat[]
        const perfData = (await perfRes.json()) as PerformanceMetric[]
        const alertsData = (await alertsRes.json()) as Alert[]

        setAgents(agentsData)
        setHeartbeats(hbData)
        setPerfMetrics(perfData)
        setAlerts(alertsData)
        setError(null)
        setLastUpdated(new Date())
        if (!selectedAgentId && agentsData.length > 0) {
          setSelectedAgentId(agentsData[0].id)
        }
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Unknown error loading data')
      } finally {
        setLoading(false)
      }
    }

    fetchAll()

    const interval = setInterval(fetchAll, refreshSeconds * 1000)
    return () => clearInterval(interval)
  }, [selectedAgentId, refreshSeconds])

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  )

  const overdueCount = useMemo(
    () => agents.filter((a) => a.status === 'offline' || a.status === 'error').length,
    [agents],
  )

  const highPriorityAlertsCount = useMemo(
    () => alerts.filter((a) => a.severity === 'critical').length,
    [alerts],
  )

  const perfByAgent = useMemo(() => {
    const map = new Map<string, PerformanceMetric>()
    perfMetrics.forEach((m) => map.set(m.agent_id, m))
    return map
  }, [perfMetrics])

  const decisions = useMemo(
    () =>
      agents.map((agent, index) => ({
        id: `decision-${agent.id}`,
        agent,
        title: `Pending decision #${index + 1}`,
        age: `${5 + index * 3}h ago`,
        priority: index % 2 === 0 ? 'High' : 'Normal',
      })),
    [agents],
  )

  const typeCounts = useMemo(() => {
    const counts: Record<AgentType, number> = {
      CrewAI: 0,
      LangGraph: 0,
      BeeAI: 0,
      OpenClaw: 0,
      Admin: 0,
    }
    agents.forEach((a) => {
      counts[a.type] += 1
    })
    return counts
  }, [agents])

  const typeHealth = useMemo(() => {
    const base = {
      online: 0,
      offline: 0,
    }
    const health: Record<AgentType, { online: number; offline: number }> = {
      CrewAI: { ...base },
      LangGraph: { ...base },
      BeeAI: { ...base },
      OpenClaw: { ...base },
      Admin: { ...base },
    }
    agents.forEach((a) => {
      if (a.status === 'online' || a.status === 'busy') {
        health[a.type].online += 1
      } else {
        health[a.type].offline += 1
      }
    })
    return health
  }, [agents])

  const typeLastActivity = useMemo(() => {
    const last: Record<AgentType, Date | null> = {
      CrewAI: null,
      LangGraph: null,
      BeeAI: null,
      OpenClaw: null,
      Admin: null,
    }
    heartbeats.forEach((hb) => {
      const agent = agents.find((a) => a.id === hb.agent_id)
      if (!agent) return
      const ts = new Date(hb.timestamp)
      const current = last[agent.type]
      if (!current || ts > current) {
        last[agent.type] = ts
      }
    })
    return last
  }, [heartbeats, agents])

  const signals = useMemo(
    () =>
      agents.map((agent, index) => ({
        id: `signal-${agent.id}`,
        agent,
        label: `${agent.name} activity ping`,
        time: `${2 + index}h ago`,
        type: agent.type,
      })),
    [agents],
  )

  const costs = useMemo(
    () =>
      agents.map((agent, index) => ({
        id: `cost-${agent.id}`,
        agent,
        today: (index + 1) * 0.12,
        monthToDate: (index + 1) * 2.4,
      })),
    [agents],
  )

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-left">
          <span className="product-name">OpenClaw Mission Control</span>
          <span className="top-summary">{overdueCount} agents with issues · {agents.length} total</span>
        </div>
        <div className="top-bar-right">
          {lastUpdated && (
            <span className="top-meta">
              Last update: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <label className="refresh-control">
            <span className="refresh-label">Refresh</span>
            <select
              value={refreshSeconds}
              onChange={(e) => setRefreshSeconds(Number(e.target.value) || 15)}
            >
              <option value={5}>5s</option>
              <option value={15}>15s</option>
              <option value={60}>60s</option>
            </select>
          </label>
          <span className="top-pill">Paused</span>
          <span className="top-meta">Local · Dev</span>
        </div>
      </header>

      <main className="layout-main">
        {!loading && !error && (
          <button
            type="button"
            className={showAlertsPanel ? 'alert-strip alert-strip--active' : 'alert-strip'}
            onClick={() => setShowAlertsPanel((open) => !open)}
          >
            <span className="alert-icon">!</span>
            <span className="alert-summary">
              {overdueCount} agents overdue · {highPriorityAlertsCount} high-priority decisions
            </span>
            <span className="alert-secondary">mock data – will sync with real OpenClaw alerts</span>
          </button>
        )}
        {loading && <div className="loading">Loading agents…</div>}
        {error && !loading && <div className="error-banner">{error}</div>}

        {!loading && !error && (
          <div className="columns">
            {/* Left rail: agents list */}
            <aside className="column-left">
              <div className="column-header">Agents</div>
              <div className="agent-list">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    className={
                      'agent-card' + (agent.id === selectedAgentId ? ' agent-card--active' : '')
                    }
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="agent-card-title">{agent.name}</div>
                    <div className="agent-card-meta">
                      <span className="agent-pill">{agent.type}</span>
                      <span
                        className="status-dot"
                        style={{ backgroundColor: statusColor(agent.status) }}
                      />
                      <span className="agent-status-label">{agent.status}</span>
                    </div>
                    <div className="agent-card-sub">
                      Last heartbeat {new Date(agent.last_heartbeat).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* Center: crons / heartbeats table */}
            <section className="column-center">
              <div className="tabs">
                <button
                  className={activeTab === 'crons' ? 'tab tab--active' : 'tab'}
                  onClick={() => setActiveTab('crons')}
                >
                  Crons
                </button>
                <button
                  className={activeTab === 'decisions' ? 'tab tab--active' : 'tab'}
                  onClick={() => setActiveTab('decisions')}
                >
                  Decisions
                </button>
                <button
                  className={activeTab === 'signals' ? 'tab tab--active' : 'tab'}
                  onClick={() => setActiveTab('signals')}
                >
                  Signals
                </button>
                <button
                  className={activeTab === 'costs' ? 'tab tab--active' : 'tab'}
                  onClick={() => setActiveTab('costs')}
                >
                  Costs
                </button>
                <button
                  className={activeTab === 'performance' ? 'tab tab--active' : 'tab'}
                  onClick={() => setActiveTab('performance')}
                >
                  Performance
                </button>
                <button
                  className={activeTab === 'architecture' ? 'tab tab--active' : 'tab'}
                  onClick={() => setActiveTab('architecture')}
                >
                  Architecture
                </button>
              </div>
              <div className="table-wrapper">
                {activeTab === 'crons' && (
                  <table className="jobs-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Job</th>
                        <th>Agent</th>
                        <th>Last run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heartbeats.map((hb) => {
                        const agent = agents.find((a) => a.id === hb.agent_id)
                        if (!agent) return null
                        const isSelected = agent.id === selectedAgentId
                        return (
                          <tr
                            key={hb.id}
                            className={isSelected ? 'row--active' : ''}
                            onClick={() => setSelectedAgentId(agent.id)}
                          >
                            <td>
                              <span
                                className="status-pill"
                                style={{ backgroundColor: statusColor(hb.status) }}
                              >
                                {hb.status === 'online' ? 'OK' : hb.status.toUpperCase()}
                              </span>
                            </td>
                            <td>{`${agent.name} Heartbeat`}</td>
                            <td>{agent.type}</td>
                            <td>{new Date(hb.timestamp).toLocaleString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                {activeTab === 'decisions' && (
                  <table className="jobs-table">
                    <thead>
                      <tr>
                        <th>Priority</th>
                        <th>Decision</th>
                        <th>Agent</th>
                        <th>Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decisions.map((d) => (
                        <tr
                          key={d.id}
                          className={d.agent.id === selectedAgentId ? 'row--active' : ''}
                          onClick={() => setSelectedAgentId(d.agent.id)}
                        >
                          <td>{d.priority}</td>
                          <td>{d.title}</td>
                          <td>{d.agent.name}</td>
                          <td>{d.age}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {activeTab === 'signals' && (
                  <table className="jobs-table">
                    <thead>
                      <tr>
                        <th>Signal</th>
                        <th>Agent</th>
                        <th>Type</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signals.map((s) => (
                        <tr
                          key={s.id}
                          className={s.agent.id === selectedAgentId ? 'row--active' : ''}
                          onClick={() => setSelectedAgentId(s.agent.id)}
                        >
                          <td>{s.label}</td>
                          <td>{s.agent.name}</td>
                          <td>{s.type}</td>
                          <td>{s.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {activeTab === 'costs' && (
                  <table className="jobs-table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Cost today (USD)</th>
                        <th>Month to date (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costs.map((c) => (
                        <tr
                          key={c.id}
                          className={c.agent.id === selectedAgentId ? 'row--active' : ''}
                          onClick={() => setSelectedAgentId(c.agent.id)}
                        >
                          <td>{c.agent.name}</td>
                          <td>{c.today.toFixed(2)}</td>
                          <td>{c.monthToDate.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {activeTab === 'performance' && (
                  <table className="jobs-table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>CPU</th>
                        <th>Memory</th>
                        <th>Tasks / min</th>
                        <th>Errors / hour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((agent) => {
                        const perf = perfByAgent.get(agent.id)
                        if (!perf) return null
                        return (
                          <tr
                            key={agent.id}
                            className={agent.id === selectedAgentId ? 'row--active' : ''}
                            onClick={() => setSelectedAgentId(agent.id)}
                          >
                            <td>{agent.name}</td>
                            <td>{perf.cpu_usage.toFixed(1)}%</td>
                            <td>{perf.memory_usage.toFixed(1)}%</td>
                            <td>{perf.tasks_per_minute.toFixed(2)}</td>
                            <td>{perf.error_rate_per_hour.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                {activeTab === 'architecture' && (
                  <div className="arch-panel">
                    <div className="arch-header">OpenClaw architecture snapshot</div>
                    <p className="arch-text">
                      This summarizes the current agents in your OpenClaw mission control, mapped to the
                      concepts in the OpenClaw architecture docs (gateway, clients, nodes, admin).
                    </p>
                    <div className="arch-flow">
                      <span className="arch-flow-step">Client</span>
                      <span className="arch-flow-arrow">⟶</span>
                      <span className="arch-flow-step">Gateway</span>
                      <span className="arch-flow-arrow">⟶</span>
                      <span className="arch-flow-step">OpenClaw agents / nodes</span>
                      <span className="arch-flow-arrow">⟶</span>
                      <span className="arch-flow-step">Admin / Dashboard</span>
                    </div>
                    <div className="arch-grid">
                      <div className="arch-card">
                        <div className="arch-card-title">Total agents</div>
                        <div className="arch-card-value">{agents.length}</div>
                      </div>
                      <div className="arch-card">
                        <div className="arch-card-title">CrewAI</div>
                        <div className="arch-card-value">{typeCounts.CrewAI}</div>
                        <div className="arch-card-meta">
                          <span className="health-dot health-dot--online" />
                          {typeHealth.CrewAI.online} online ·
                          <span className="health-dot health-dot--offline" />
                          {typeHealth.CrewAI.offline} offline
                          <span className="arch-meta-secondary">
                            Last activity:{' '}
                            {typeLastActivity.CrewAI
                              ? typeLastActivity.CrewAI.toLocaleTimeString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="arch-card">
                        <div className="arch-card-title">LangGraph</div>
                        <div className="arch-card-value">{typeCounts.LangGraph}</div>
                        <div className="arch-card-meta">
                          <span className="health-dot health-dot--online" />
                          {typeHealth.LangGraph.online} online ·
                          <span className="health-dot health-dot--offline" />
                          {typeHealth.LangGraph.offline} offline
                          <span className="arch-meta-secondary">
                            Last activity:{' '}
                            {typeLastActivity.LangGraph
                              ? typeLastActivity.LangGraph.toLocaleTimeString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="arch-card">
                        <div className="arch-card-title">BeeAI</div>
                        <div className="arch-card-value">{typeCounts.BeeAI}</div>
                        <div className="arch-card-meta">
                          <span className="health-dot health-dot--online" />
                          {typeHealth.BeeAI.online} online ·
                          <span className="health-dot health-dot--offline" />
                          {typeHealth.BeeAI.offline} offline
                          <span className="arch-meta-secondary">
                            Last activity:{' '}
                            {typeLastActivity.BeeAI
                              ? typeLastActivity.BeeAI.toLocaleTimeString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="arch-card">
                        <div className="arch-card-title">OpenClaw nodes</div>
                        <div className="arch-card-value">{typeCounts.OpenClaw}</div>
                        <div className="arch-card-meta">
                          <span className="health-dot health-dot--online" />
                          {typeHealth.OpenClaw.online} online ·
                          <span className="health-dot health-dot--offline" />
                          {typeHealth.OpenClaw.offline} offline
                          <span className="arch-meta-secondary">
                            Last activity:{' '}
                            {typeLastActivity.OpenClaw
                              ? typeLastActivity.OpenClaw.toLocaleTimeString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="arch-card">
                        <div className="arch-card-title">Admin clients</div>
                        <div className="arch-card-value">{typeCounts.Admin}</div>
                        <div className="arch-card-meta">
                          <span className="health-dot health-dot--online" />
                          {typeHealth.Admin.online} online ·
                          <span className="health-dot health-dot--offline" />
                          {typeHealth.Admin.offline} offline
                          <span className="arch-meta-secondary">
                            Last activity:{' '}
                            {typeLastActivity.Admin
                              ? typeLastActivity.Admin.toLocaleTimeString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="arch-text small">
                      For full connection lifecycle (client ↔ gateway ↔ nodes) see the OpenClaw docs:
                      <a
                        href="https://docs.openclaw.ai/concepts/architecture"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {' '}
                        Gateway Architecture & Connection lifecycle
                      </a>
                      . This dashboard reflects the live presence and health of those agents in real time.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Right: detail pane */}
            <aside className="column-right">
              {showAlertsPanel && alerts.length > 0 && (
                <div className="alerts-panel">
                  <div className="alerts-panel-header">Alerts</div>
                  <div className="alerts-panel-body">
                    {alerts.map((a) => {
                      const agent = a.related_agent_id
                        ? agents.find((ag) => ag.id === a.related_agent_id)
                        : undefined
                      return (
                        <div
                          key={a.id}
                          className="alert-row"
                          onClick={() => {
                            if (agent) setSelectedAgentId(agent.id)
                          }}
                        >
                          <span
                            className={
                              a.severity === 'critical'
                                ? 'alert-chip alert-chip--critical'
                                : a.severity === 'warning'
                                  ? 'alert-chip alert-chip--warning'
                                  : 'alert-chip'
                            }
                          >
                            {a.severity}
                          </span>
                          <div className="alert-row-main">
                            <div className="alert-row-msg">{a.message}</div>
                            <div className="alert-row-meta">
                              <span>{new Date(a.created_at).toLocaleString()}</span>
                              {agent && <span> · {agent.name}</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {selectedAgent ? (
                <div className="detail-pane">
                  <div className="detail-header">
                    <div>
                      <div className="detail-title">{selectedAgent.name}</div>
                      <div className="detail-subtitle">{selectedAgent.type} · Overview</div>
                    </div>
                    <span
                      className="status-pill"
                      style={{ backgroundColor: statusColor(selectedAgent.status) }}
                    >
                      {selectedAgent.status}
                    </span>
                  </div>
                  <div className="detail-section">
                    <div className="detail-label">Last heartbeat</div>
                    <div className="detail-value">
                      {new Date(selectedAgent.last_heartbeat).toLocaleString()}
                    </div>
                  </div>
                  <div className="detail-section">
                    <div className="detail-label">Current task</div>
                    <div className="detail-value">
                      {selectedAgent.current_task_id ?? 'None active'}
                    </div>
                  </div>
                  {(() => {
                    const perf = perfByAgent.get(selectedAgent.id)
                    if (!perf) {
                      return (
                        <div className="detail-section muted">
                          No performance metrics reported for this agent yet.
                        </div>
                      )
                    }
                    return (
                      <div className="detail-section">
                        <div className="detail-label">Performance</div>
                        <div className="detail-value perf-grid">
                          <span>CPU: {perf.cpu_usage.toFixed(1)}%</span>
                          <span>Memory: {perf.memory_usage.toFixed(1)}%</span>
                          <span>Tasks/min: {perf.tasks_per_minute.toFixed(2)}</span>
                          <span>Errors/hour: {perf.error_rate_per_hour.toFixed(2)}</span>
                        </div>
                      </div>
                    )
                  })()}
                  <div className="detail-section muted">Schedule and files views will appear here next.</div>
                </div>
              ) : (
                <div className="detail-empty">Select an agent to view details</div>
              )}
            </aside>
          </div>
        )}
        <footer className="disclaimer">
          Experimental dashboard for Lalit Nayyar · Contact: lalitnayyar@gmail.com · Data is
          mock, for development and monitoring UX only.
        </footer>
      </main>
    </div>
  )
}

export default App
