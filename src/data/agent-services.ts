// Role-specific API services for each agent

export interface AgentService {
  id: string;
  name: string;
  description: string;
  placeholder: string; // API key placeholder hint
  docsUrl: string;
}

export interface AgentServiceConfig {
  agentId: string;
  services: AgentService[];
}

// Each agent gets services specific to their SDLC role
// NO OpenAI — using Anthropic, Google Gemini, Grok + role-specific tools
export const AGENT_SERVICES: Record<string, AgentService[]> = {
  pm: [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'PRD generation, user story writing, FAS orchestration', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Multimodal analysis, document processing, research', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'grok', name: 'xAI Grok', description: 'Real-time market context, trend analysis', placeholder: 'xai-...', docsUrl: 'https://docs.x.ai' },
    { id: 'notion', name: 'Notion API', description: 'Project docs, wikis, task management sync', placeholder: 'ntn_...', docsUrl: 'https://developers.notion.com' },
    { id: 'linear', name: 'Linear API', description: 'Issue tracking, sprint management', placeholder: 'lin_api_...', docsUrl: 'https://developers.linear.app' },
    { id: 'jira', name: 'Jira API', description: 'Enterprise project management', placeholder: 'jira_token_...', docsUrl: 'https://developer.atlassian.com/cloud/jira' },
  ],
  architect: [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'ADR reasoning, system design, architecture decisions', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Multimodal architecture diagrams, large context analysis', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'mermaid', name: 'Mermaid Chart API', description: 'Architecture diagram generation', placeholder: 'mc_...', docsUrl: 'https://www.mermaidchart.com/docs' },
  ],
  'devils-advocate': [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'Critical analysis, contestation, contradiction detection', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'grok', name: 'xAI Grok', description: 'Contrarian reasoning, edge case discovery', placeholder: 'xai-...', docsUrl: 'https://docs.x.ai' },
    { id: 'gemini', name: 'Google Gemini', description: 'Multi-perspective analysis, deep reasoning', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
  ],
  'tech-lead': [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'Tech spec writing, standards definition, threshold calibration', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Codebase analysis, technical documentation', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'grok', name: 'xAI Grok', description: 'Emerging tech stack evaluation', placeholder: 'xai-...', docsUrl: 'https://docs.x.ai' },
  ],
  backend: [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'Backend code generation, API design', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Code completion, server logic, large file analysis', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'github', name: 'GitHub API', description: 'Repository management, PR automation', placeholder: 'ghp_...', docsUrl: 'https://docs.github.com/en/rest' },
    { id: 'supabase', name: 'Supabase API', description: 'Database, auth, storage backend', placeholder: 'sbp_...', docsUrl: 'https://supabase.com/docs' },
  ],
  frontend: [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'UI component generation, React code', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Frontend code, multimodal design-to-code', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'figma', name: 'Figma API', description: 'Design-to-code, component inspection', placeholder: 'figd_...', docsUrl: 'https://www.figma.com/developers/api' },
    { id: 'vercel', name: 'Vercel API', description: 'Preview deployments, edge functions', placeholder: 'vercel_...', docsUrl: 'https://vercel.com/docs/rest-api' },
  ],
  qa: [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'Test case generation, coverage analysis', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Test scenario reasoning, bug pattern detection', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'browserstack', name: 'BrowserStack API', description: 'Cross-browser testing, device lab', placeholder: 'bs_...', docsUrl: 'https://www.browserstack.com/docs' },
    { id: 'playwright', name: 'Playwright Cloud', description: 'E2E test execution, visual regression', placeholder: 'pw_...', docsUrl: 'https://playwright.dev/docs/api' },
  ],
  security: [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'Vulnerability analysis, OWASP checks', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'grok', name: 'xAI Grok', description: 'Real-time threat intelligence, CVE analysis', placeholder: 'xai-...', docsUrl: 'https://docs.x.ai' },
    { id: 'snyk', name: 'Snyk API', description: 'Dependency vulnerability scanning', placeholder: 'snyk_...', docsUrl: 'https://docs.snyk.io/snyk-api' },
    { id: 'sonarcloud', name: 'SonarCloud API', description: 'Static code analysis, security hotspots', placeholder: 'sqp_...', docsUrl: 'https://sonarcloud.io/web_api' },
  ],
  'code-reviewer': [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'Deep code review, silent drop detection', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Large diff analysis, pattern recognition', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'github', name: 'GitHub API', description: 'PR reviews, code comments, diff analysis', placeholder: 'ghp_...', docsUrl: 'https://docs.github.com/en/rest' },
    { id: 'codeclimate', name: 'Code Climate API', description: 'Code quality metrics, maintainability', placeholder: 'cc_...', docsUrl: 'https://codeclimate.com/docs' },
  ],
  'tech-writer': [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'Documentation generation, API docs', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Multi-format doc generation, translations', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'readme', name: 'ReadMe API', description: 'API documentation hosting', placeholder: 'rdme_...', docsUrl: 'https://docs.readme.com' },
    { id: 'gitbook', name: 'GitBook API', description: 'Documentation platform, knowledge base', placeholder: 'gb_...', docsUrl: 'https://developer.gitbook.com' },
  ],
  devops: [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'CI/CD config generation, IaC templates', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Infrastructure analysis, log parsing', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'github-actions', name: 'GitHub Actions', description: 'CI/CD pipelines, workflow automation', placeholder: 'ghp_...', docsUrl: 'https://docs.github.com/en/actions' },
    { id: 'docker', name: 'Docker Hub API', description: 'Container registry, image management', placeholder: 'dckr_...', docsUrl: 'https://docs.docker.com/docker-hub/api' },
    { id: 'aws', name: 'AWS API', description: 'Cloud infrastructure, deployment', placeholder: 'AKIA...', docsUrl: 'https://docs.aws.amazon.com' },
  ],
  brand: [
    { id: 'gemini', name: 'Google Gemini (Imagen)', description: 'Brand asset generation, logo concepts', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'midjourney', name: 'Midjourney API', description: 'High-quality visual brand assets', placeholder: 'mj_...', docsUrl: 'https://docs.midjourney.com' },
    { id: 'figma', name: 'Figma API', description: 'Brand guide, design token management', placeholder: 'figd_...', docsUrl: 'https://www.figma.com/developers/api' },
    { id: 'coolors', name: 'Coolors API', description: 'Color palette generation', placeholder: 'coolors_...', docsUrl: 'https://coolors.co/api' },
  ],
  uiux: [
    { id: 'anthropic', name: 'Anthropic Claude', description: 'UX analysis, wireframe descriptions', placeholder: 'sk-ant-...', docsUrl: 'https://docs.anthropic.com' },
    { id: 'gemini', name: 'Google Gemini', description: 'Multimodal UI review, screenshot analysis', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'figma', name: 'Figma API', description: 'Design system, components, prototypes', placeholder: 'figd_...', docsUrl: 'https://www.figma.com/developers/api' },
    { id: 'storybook', name: 'Storybook / Chromatic', description: 'Component library, visual testing', placeholder: 'chpt_...', docsUrl: 'https://www.chromatic.com/docs' },
  ],
  'asset-gen': [
    { id: 'gemini', name: 'Google Gemini (Imagen)', description: 'Icon generation, illustrations', placeholder: 'AIza...', docsUrl: 'https://ai.google.dev/docs' },
    { id: 'stability', name: 'Stability AI', description: 'High-res image generation, upscaling', placeholder: 'sk-stab-...', docsUrl: 'https://platform.stability.ai/docs' },
    { id: 'replicate', name: 'Replicate API', description: 'Run open-source image models (Flux, SDXL)', placeholder: 'r8_...', docsUrl: 'https://replicate.com/docs' },
    { id: 'cloudinary', name: 'Cloudinary API', description: 'Image optimization, CDN delivery', placeholder: 'cloudinary_...', docsUrl: 'https://cloudinary.com/documentation' },
  ],
};

// Stored config per agent
export interface AgentApiConfig {
  serviceId: string;
  apiKey: string;
  baseUrl?: string;
  chatApi?: string;
  model?: string;
  enabled: boolean;
}

export function loadAgentConfigs(): Record<string, AgentApiConfig[]> {
  try {
    const raw = localStorage.getItem('nexus-agent-configs');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAgentConfigs(configs: Record<string, AgentApiConfig[]>) {
  localStorage.setItem('nexus-agent-configs', JSON.stringify(configs));
}
