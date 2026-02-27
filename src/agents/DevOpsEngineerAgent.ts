import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class DevOpsEngineerAgent extends BaseAgent {
    public readonly role = 'devops-engineer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '11'
                ? `Configurează CI/CD pipeline pentru: "${input}". Include: Dockerfile, GitHub Actions, stages (lint, test, build, veritas-gate, deploy), monitoring.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
