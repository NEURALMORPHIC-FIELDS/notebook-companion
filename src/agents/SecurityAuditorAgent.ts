import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class SecurityAuditorAgent extends BaseAgent {
    public readonly role = 'security-auditor';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '9'
                ? `Perform a security audit for: "${input}". Check OWASP Top 10, RLS policies, authentication, and injection vectors. Provide severity ratings.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
