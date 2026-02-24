import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class TechWriterAgent extends BaseAgent {
    public readonly role = 'tech-writer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        if (phase === '10') {
            return {
                agentRole: this.role,
                phase,
                content: `[TechWriter] Documentation suite generated: README, API Docs, Storybook.`,
                metadata: {
                    documents: [
                        { type: 'README', path: 'README.md', status: 'DRAFT' },
                        { type: 'API_DOCS', path: '.nexus/docs/API.md', status: 'DRAFT' },
                        { type: 'STORYBOOK', path: '.nexus/docs/STORYBOOK.md', status: 'DRAFT' },
                        { type: 'CHANGELOG', path: 'CHANGELOG.md', status: 'DRAFT' },
                    ],
                },
            };
        }

        return {
            agentRole: this.role,
            phase,
            content: `[TechWriter] Documenting phase ${phase} outputs.`,
        };
    }
}
