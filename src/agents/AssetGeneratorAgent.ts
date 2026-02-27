import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class AssetGeneratorAgent extends BaseAgent {
    public readonly role = 'asset-generator';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '6B'
                ? `Plan asset generation for: "${input}". Include: logo (SVG), favicon, icons, illustrations, and OG image. Specify format, dimensions, and generation pipeline.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
