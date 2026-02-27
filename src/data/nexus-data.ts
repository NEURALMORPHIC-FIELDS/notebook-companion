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
  color: string;
}

export const AGENTS: Agent[] = [
  { id: 'pm', name: 'Project Manager', role: 'Orchestration & FAS', status: 'active', icon: 'kanban', color: 'nexus-cyan' },
  { id: 'architect', name: 'Architect', role: 'ADR & System Design', status: 'working', icon: 'blocks', color: 'nexus-purple' },
  { id: 'devils-advocate', name: "Devil's Advocate", role: 'Contestation & Verification', status: 'active', icon: 'flame', color: 'nexus-red' },
  { id: 'tech-lead', name: 'Tech Lead', role: 'Tech Spec & Standards', status: 'idle', icon: 'cpu', color: 'nexus-blue' },
  { id: 'backend', name: 'Backend Engineer', role: 'Server & API Code', status: 'idle', icon: 'server', color: 'nexus-green' },
  { id: 'frontend', name: 'Frontend Engineer', role: 'UI & Components', status: 'idle', icon: 'monitor', color: 'nexus-cyan' },
  { id: 'qa', name: 'QA Engineer', role: 'Testing & Coverage', status: 'idle', icon: 'flask-conical', color: 'nexus-amber' },
  { id: 'security', name: 'Security Auditor', role: 'OWASP & Vulnerabilities', status: 'idle', icon: 'shield-check', color: 'nexus-red' },
  { id: 'code-reviewer', name: 'Code Reviewer', role: 'Review & Silent Drop Check', status: 'idle', icon: 'scan-eye', color: 'nexus-purple' },
  { id: 'tech-writer', name: 'Tech Writer', role: 'Documentation', status: 'idle', icon: 'book-open', color: 'nexus-blue' },
  { id: 'devops', name: 'DevOps Engineer', role: 'CI/CD & Deployment', status: 'idle', icon: 'rocket', color: 'nexus-amber' },
  { id: 'brand', name: 'Brand Designer', role: 'Visual Identity', status: 'idle', icon: 'gem', color: 'nexus-purple' },
  { id: 'uiux', name: 'UI/UX Designer', role: 'Design System & Wireframes', status: 'idle', icon: 'pen-tool', color: 'nexus-cyan' },
  { id: 'asset-gen', name: 'Asset Generator', role: 'Images & Icons', status: 'idle', icon: 'image', color: 'nexus-green' },
];
