import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class ProjectManagerAgent extends BaseAgent {
    public readonly role = 'project-manager';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        if (phase === '1A') {
            // FAS Generation — call real LLM
            const fasPrompt = `Generează un Functional Architecture Sheet (FAS) pentru următoarea cerință:

"${input}"

Documentează fiecare funcție cu format:
**F-XXX** — Nume Funcție
• user_value: Ce primește utilizatorul
• system_effect: [OPEN|CLOSE|NEUTRAL] + efecte tehnice
• required_services: [servicii necesare]
• close_pair: F-YYY (dacă funcția deschide o stare)
• dependencies: [F-ZZZ] (funcții prerequisite)

IMPORTANT: 
- Fiecare funcție OPEN trebuie să aibă un CLOSE pair.
- Identifică minimum 5 funcții.
- La final, listează serviciile necesare agregate.`;

            const llmResponse = await this.callLLM(fasPrompt, phase);

            return {
                agentRole: this.role,
                phase,
                content: llmResponse,
                metadata: { type: 'FAS', generatedAt: new Date().toISOString() },
            };
        }

        if (phase === '1B' || phase === '2' || phase === '5' || phase === '12') {
            const llmResponse = await this.callLLM(
                `Ești în faza ${phase} SDLC. Procesează: "${input}"`,
                phase
            );
            return {
                agentRole: this.role,
                phase,
                content: llmResponse,
            };
        }

        // Default: call LLM for any phase
        const llmResponse = await this.callLLM(input, phase);
        return {
            agentRole: this.role,
            phase,
            content: llmResponse,
        };
    }
}
