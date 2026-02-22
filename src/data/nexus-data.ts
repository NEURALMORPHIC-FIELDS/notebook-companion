// NEXUS AI SDLC Phases data
export interface SDLCPhase {
  id: string;
  number: string;
  name: string;
  agent: string;
  status: 'completed' | 'in-progress' | 'pending' | 'blocked';
  veritasCheck?: string;
  output: string;
}

export const SDLC_PHASES: SDLCPhase[] = [
  { id: '0', number: '0', name: 'Onboarding', agent: 'System', status: 'completed', output: 'Template + HITL + .nexus.json + NEXUS.md + verify_project.py', veritasCheck: '—' },
  { id: '1a', number: '1A', name: 'Functional Architecture Sheet', agent: 'PM', status: 'completed', output: 'FAS.md — functions, effects, services', veritasCheck: 'Architectural contradictions detected' },
  { id: '1b', number: '1B', name: 'Discovery & PRD', agent: 'PM', status: 'completed', output: 'Full PRD with User Stories', veritasCheck: '—' },
  { id: '2', number: '2', name: 'Team Assembly', agent: 'PM (web search)', status: 'completed', output: 'Team Configuration Document', veritasCheck: '—' },
  { id: '3a', number: '3A', name: 'Architecture', agent: "Architect + Devil's Advocate", status: 'in-progress', output: 'ADR + Contestation Report', veritasCheck: 'Arch Contradiction Detector' },
  { id: '3b', number: '3B', name: 'Brand & Design System', agent: 'Brand + UI/UX + Asset Gen', status: 'pending', output: 'Brand Guide + Design System + Figma File', veritasCheck: '—' },
  { id: '4', number: '4', name: 'Technical Design', agent: "Tech Lead + Devil's Advocate", status: 'pending', output: 'Tech Spec + threshold calibration', veritasCheck: 'Threshold Calibration Gate' },
  { id: '5', number: '5', name: 'Task Breakdown', agent: 'PM', status: 'pending', output: 'WBS — 1 task per FAS function', veritasCheck: '—' },
  { id: '6a', number: '6A', name: 'Implementation — Dev', agent: "Engineers + Devil's Advocate", status: 'pending', output: 'Source code + monitors', veritasCheck: 'verify_project.py → WIRED?' },
  { id: '6b', number: '6B', name: 'Implementation — Assets', agent: 'Asset Generator', status: 'pending', output: 'Logo, icons, illustrations', veritasCheck: '—' },
  { id: '7', number: '7', name: 'Code Review', agent: "Code Reviewer + Devil's Advocate", status: 'pending', output: 'Review Report + Known Incomplete', veritasCheck: 'Veritas re-run' },
  { id: '8', number: '8', name: 'QA & Testing', agent: 'QA Engineer', status: 'pending', output: 'Test Report — 1 suite per FAS fn', veritasCheck: 'Coverage → ACTIVE' },
  { id: '9', number: '9', name: 'Security Audit', agent: 'Security Auditor', status: 'pending', output: 'Security Report (OWASP)', veritasCheck: '—' },
  { id: '10', number: '10', name: 'Documentation', agent: 'Tech Writer', status: 'pending', output: 'README, API Docs, Storybook', veritasCheck: '—' },
  { id: '11', number: '11', name: 'DevOps / Deploy', agent: 'DevOps Engineer', status: 'pending', output: 'Dockerfile, CI/CD, verify_project.py', veritasCheck: 'exit code 0' },
];

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'working' | 'blocked';
  icon: string;
}

export const AGENTS: Agent[] = [
  { id: 'pm', name: 'Project Manager', role: 'Orchestration & FAS', status: 'active', icon: '📋' },
  { id: 'architect', name: 'Architect', role: 'ADR & System Design', status: 'working', icon: '🏗️' },
  { id: 'devils-advocate', name: "Devil's Advocate", role: 'Contestation & Verification', status: 'active', icon: '😈' },
  { id: 'tech-lead', name: 'Tech Lead', role: 'Tech Spec & Standards', status: 'idle', icon: '⚙️' },
  { id: 'backend', name: 'Backend Engineer', role: 'Server & API Code', status: 'idle', icon: '🔧' },
  { id: 'frontend', name: 'Frontend Engineer', role: 'UI & Components', status: 'idle', icon: '🎨' },
  { id: 'qa', name: 'QA Engineer', role: 'Testing & Coverage', status: 'idle', icon: '🧪' },
  { id: 'security', name: 'Security Auditor', role: 'OWASP & Vulnerabilities', status: 'idle', icon: '🔒' },
  { id: 'code-reviewer', name: 'Code Reviewer', role: 'Review & Silent Drop Check', status: 'idle', icon: '👁️' },
  { id: 'tech-writer', name: 'Tech Writer', role: 'Documentation', status: 'idle', icon: '📝' },
  { id: 'devops', name: 'DevOps Engineer', role: 'CI/CD & Deployment', status: 'idle', icon: '🚀' },
  { id: 'brand', name: 'Brand Designer', role: 'Visual Identity', status: 'idle', icon: '💎' },
  { id: 'uiux', name: 'UI/UX Designer', role: 'Design System & Wireframes', status: 'idle', icon: '✏️' },
  { id: 'asset-gen', name: 'Asset Generator', role: 'Images & Icons', status: 'idle', icon: '🖼️' },
];

export interface ModuleState {
  name: string;
  path: string;
  category: 'WIRED' | 'NOT_WIRED' | 'TEST' | 'CONFIG';
  isCritical: boolean;
}

export const MOCK_MODULES: ModuleState[] = [
  { name: 'core.events', path: 'core/events.py', category: 'WIRED', isCritical: true },
  { name: 'core.data.ingestion', path: 'core/data/ingestion.py', category: 'WIRED', isCritical: true },
  { name: 'core.data.normalizer', path: 'core/data/normalizer.py', category: 'WIRED', isCritical: true },
  { name: 'core.data.storage', path: 'core/data/storage.py', category: 'WIRED', isCritical: true },
  { name: 'core.execution.oms', path: 'core/execution/oms.py', category: 'WIRED', isCritical: true },
  { name: 'core.execution.venue_router', path: 'core/execution/venue_router.py', category: 'WIRED', isCritical: true },
  { name: 'core.execution.portfolio_tracker', path: 'core/execution/portfolio_tracker.py', category: 'WIRED', isCritical: true },
  { name: 'core.risk.pre_trade', path: 'core/risk/pre_trade.py', category: 'WIRED', isCritical: true },
  { name: 'core.features.registry', path: 'core/features/registry.py', category: 'NOT_WIRED', isCritical: true },
  { name: 'core.cognition.outcome_tracker', path: 'core/cognition/outcome_tracker.py', category: 'NOT_WIRED', isCritical: true },
  { name: 'core.utils.debug_helpers', path: 'core/utils/debug_helpers.py', category: 'NOT_WIRED', isCritical: false },
  { name: 'core.utils.formatters', path: 'core/utils/formatters.py', category: 'NOT_WIRED', isCritical: false },
  { name: 'tests.test_oms', path: 'tests/test_oms.py', category: 'TEST', isCritical: false },
  { name: 'tests.test_ingestion', path: 'tests/test_ingestion.py', category: 'TEST', isCritical: false },
  { name: 'tests.test_events', path: 'tests/test_events.py', category: 'TEST', isCritical: false },
  { name: 'config.settings', path: 'config/settings.py', category: 'CONFIG', isCritical: false },
  { name: 'config.__init__', path: 'config/__init__.py', category: 'CONFIG', isCritical: false },
];
