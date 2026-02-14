from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Literal, Optional

app = FastAPI(title="OpenClaw Agent Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


AgentType = Literal["CrewAI", "LangGraph", "BeeAI", "OpenClaw", "Admin"]
AgentStatus = Literal["online", "offline", "busy", "error"]
TaskStatus = Literal["pending", "running", "completed", "failed"]
AlertSeverity = Literal["info", "warning", "critical"]


class Agent(BaseModel):
    id: str
    name: str
    type: AgentType
    status: AgentStatus
    last_heartbeat: datetime
    current_task_id: Optional[str] = None


class Task(BaseModel):
    id: str
    agent_id: str
    description: str
    status: TaskStatus
    started_at: datetime
    finished_at: Optional[datetime] = None
    output_summary: Optional[str] = None


class Heartbeat(BaseModel):
    id: str
    agent_id: str
    timestamp: datetime
    status: AgentStatus
    meta: dict = {}


class Alert(BaseModel):
    id: str
    severity: AlertSeverity
    message: str
    related_agent_id: Optional[str] = None
    related_task_id: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None


class PerformanceMetrics(BaseModel):
    agent_id: str
    cpu_usage: float
    memory_usage: float
    tasks_per_minute: float
    error_rate_per_hour: float


class Command(BaseModel):
    type: str
    payload: dict | None = None


# --- Mock data -------------------------------------------------------------

now = datetime.utcnow()

MOCK_AGENTS: List[Agent] = [
    Agent(
        id="agent-crewai-researcher",
        name="CrewAI Researcher",
        type="CrewAI",
        status="busy",
        last_heartbeat=now - timedelta(seconds=10),
        current_task_id="task-1",
    ),
    Agent(
        id="agent-langgraph-orchestrator",
        name="LangGraph Orchestrator",
        type="LangGraph",
        status="online",
        last_heartbeat=now - timedelta(seconds=5),
    ),
    Agent(
        id="agent-beeai-pm",
        name="BeeAI Project Manager",
        type="BeeAI",
        status="online",
        last_heartbeat=now - timedelta(seconds=20),
        current_task_id="task-2",
    ),
    Agent(
        id="agent-openclaw-1",
        name="OpenClaw Agent 1",
        type="OpenClaw",
        status="offline",
        last_heartbeat=now - timedelta(minutes=15),
    ),
    Agent(
        id="agent-admin-client",
        name="OpenClaw Admin Client",
        type="Admin",
        status="online",
        last_heartbeat=now - timedelta(seconds=30),
    ),
]

MOCK_PERF: List[PerformanceMetrics] = [
    PerformanceMetrics(
        agent_id="agent-crewai-researcher",
        cpu_usage=72.5,
        memory_usage=63.2,
        tasks_per_minute=0.4,
        error_rate_per_hour=0.1,
    ),
    PerformanceMetrics(
        agent_id="agent-langgraph-orchestrator",
        cpu_usage=34.1,
        memory_usage=41.8,
        tasks_per_minute=0.2,
        error_rate_per_hour=0.0,
    ),
    PerformanceMetrics(
        agent_id="agent-beeai-pm",
        cpu_usage=55.3,
        memory_usage=52.7,
        tasks_per_minute=0.6,
        error_rate_per_hour=0.05,
    ),
    PerformanceMetrics(
        agent_id="agent-openclaw-1",
        cpu_usage=0.0,
        memory_usage=0.0,
        tasks_per_minute=0.0,
        error_rate_per_hour=0.0,
    ),
    PerformanceMetrics(
        agent_id="agent-admin-client",
        cpu_usage=12.3,
        memory_usage=22.5,
        tasks_per_minute=0.1,
        error_rate_per_hour=0.0,
    ),
]

MOCK_TASKS: List[Task] = [
    Task(
        id="task-1",
        agent_id="agent-crewai-researcher",
        description="Research latest AI maturity models",
        status="running",
        started_at=now - timedelta(minutes=5),
    ),
    Task(
        id="task-2",
        agent_id="agent-beeai-pm",
        description="Update project plan for OpenClaw dashboard",
        status="pending",
        started_at=now - timedelta(minutes=2),
    ),
]

MOCK_HEARTBEATS: List[Heartbeat] = [
    Heartbeat(
        id="hb-1",
        agent_id="agent-crewai-researcher",
        timestamp=now - timedelta(seconds=10),
        status="busy",
        meta={"cpu": 0.7},
    ),
    Heartbeat(
        id="hb-2",
        agent_id="agent-langgraph-orchestrator",
        timestamp=now - timedelta(seconds=5),
        status="online",
        meta={"graphs": 3},
    ),
    Heartbeat(
        id="hb-3",
        agent_id="agent-beeai-pm",
        timestamp=now - timedelta(seconds=20),
        status="online",
        meta={"tasks_tracked": 12},
    ),
]

MOCK_ALERTS: List[Alert] = [
    Alert(
        id="alert-1",
        severity="warning",
        message="OpenClaw Agent 1 has been offline for 15 minutes",
        related_agent_id="agent-openclaw-1",
        created_at=now - timedelta(minutes=15),
    ),
]


# --- Routes ----------------------------------------------------------------

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/agents", response_model=List[Agent])
async def list_agents() -> List[Agent]:
    return MOCK_AGENTS


@app.get("/agents/{agent_id}", response_model=Agent)
async def get_agent(agent_id: str) -> Agent:
    for agent in MOCK_AGENTS:
        if agent.id == agent_id:
            return agent
    raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")


@app.get("/agents/{agent_id}/tasks", response_model=List[Task])
async def list_agent_tasks(agent_id: str) -> List[Task]:
    return [t for t in MOCK_TASKS if t.agent_id == agent_id]


@app.get("/tasks", response_model=List[Task])
async def list_tasks() -> List[Task]:
    return MOCK_TASKS


@app.get("/heartbeats/recent", response_model=List[Heartbeat])
async def recent_heartbeats() -> List[Heartbeat]:
    return MOCK_HEARTBEATS


@app.get("/alerts", response_model=List[Alert])
async def list_alerts() -> List[Alert]:
    return MOCK_ALERTS


@app.get("/metrics/performance", response_model=List[PerformanceMetrics])
async def performance_metrics() -> List[PerformanceMetrics]:
    return MOCK_PERF


@app.post("/agents/{agent_id}/commands")
async def send_command(agent_id: str, command: Command) -> dict:
    # For now, just echo back. Later, this will dispatch to real runtimes.
    return {
        "agent_id": agent_id,
        "command": command,
        "status": "accepted",
        "message": "Command queued (mock)",
    }
