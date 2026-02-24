import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class DevOpsEngineerAgent extends BaseAgent {
    public readonly role = 'devops-engineer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        if (phase === '11') {
            return {
                agentRole: this.role,
                phase,
                content: `[DevOps] CI/CD pipeline configured. Dockerfile generated. verify_project.py integrated as gate.`,
                metadata: {
                    pipeline: {
                        ci: 'GitHub Actions',
                        stages: ['lint', 'test', 'build', 'veritas-gate', 'deploy'],
                        veritasIntegrated: true,
                    },
                    artifacts: [
                        { type: 'Dockerfile', path: 'Dockerfile', status: 'GENERATED' },
                        { type: 'CI_CONFIG', path: '.github/workflows/ci.yml', status: 'GENERATED' },
                        { type: 'DOCKER_COMPOSE', path: 'docker-compose.yml', status: 'GENERATED' },
                    ],
                },
            };
        }

        return {
            agentRole: this.role,
            phase,
            content: `[DevOps] Infrastructure monitoring for phase ${phase}.`,
        };
    }
}
