import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class UIUXDesignerAgent extends BaseAgent {
    public readonly role = 'uiux-designer';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        if (phase === '3B') {
            return {
                agentRole: this.role,
                phase,
                content: `[UI/UX] Design system created: spacing tokens, component primitives, responsive breakpoints.`,
                metadata: {
                    designSystem: {
                        spacingScale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
                        breakpoints: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
                        components: ['Button', 'Input', 'Card', 'Modal', 'Toast', 'Popover', 'Switch', 'Badge'],
                        accessibility: { wcagLevel: 'AA', contrastRatio: 4.5 },
                    },
                    wireframes: [],
                    prototypes: [],
                },
            };
        }

        return {
            agentRole: this.role,
            phase,
            content: `[UI/UX] Design review for phase ${phase}.`,
        };
    }
}
