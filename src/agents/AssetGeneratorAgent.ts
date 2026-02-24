import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class AssetGeneratorAgent extends BaseAgent {
    public readonly role = 'asset-generator';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context['phase'] || 'UNKNOWN';

        if (phase === '6B') {
            return {
                agentRole: this.role,
                phase,
                content: `[AssetGen] Asset generation pipeline ready. Logo, icons, and illustrations queued.`,
                metadata: {
                    assets: [
                        { type: 'logo', format: 'SVG', status: 'QUEUED' },
                        { type: 'favicon', format: 'ICO+PNG', status: 'QUEUED' },
                        { type: 'icons', format: 'SVG', count: 0, status: 'QUEUED' },
                        { type: 'illustrations', format: 'PNG', count: 0, status: 'QUEUED' },
                        { type: 'og-image', format: 'PNG', status: 'QUEUED' },
                    ],
                    pipeline: 'Gemini Imagen → Stability AI fallback → Cloudinary CDN',
                },
            };
        }

        return {
            agentRole: this.role,
            phase,
            content: `[AssetGen] Asset pipeline idle for phase ${phase}.`,
        };
    }
}
