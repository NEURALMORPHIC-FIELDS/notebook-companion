import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class SecurityAuditorAgent extends BaseAgent {
    public readonly role = 'security-auditor';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '9'
                ? `Efectuează audit de securitate pentru: "${input}". Verifică OWASP Top 10, RLS policies, autentificare, injection vectors. Dă severity rating.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
