import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class BrandDesignerAgent extends BaseAgent {
    public readonly role = 'brand-designer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        if (phase === '3B') {
            return {
                agentRole: this.role,
                phase,
                content: `[Brand] Brand guide generated: color palette, typography, logo concepts.`,
                metadata: {
                    brandGuide: {
                        colors: {
                            primary: '#0ea5e9',
                            secondary: '#8b5cf6',
                            accent: '#f59e0b',
                            background: '#0f172a',
                            surface: '#1e293b',
                        },
                        typography: {
                            heading: 'Inter',
                            body: 'Inter',
                            mono: 'JetBrains Mono',
                        },
                        logoStatus: 'CONCEPT',
                    },
                },
            };
        }

        return {
            agentRole: this.role,
            phase,
            content: `[Brand] Visual identity system active for phase ${phase}.`,
        };
    }
}
