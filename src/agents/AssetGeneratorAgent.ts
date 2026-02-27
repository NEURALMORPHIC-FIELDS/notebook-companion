import { BaseAgent, AgentOutput } from './BaseAgent';
import { AgentContext } from '../behavioral/AgentOutputFilter';

export class AssetGeneratorAgent extends BaseAgent {
    public readonly role = 'asset-generator';

    protected async generateResponse(input: string, context: AgentContext): Promise<AgentOutput> {
        const phase = context.phase || 'UNKNOWN';
        const llmResponse = await this.callLLM(
            phase === '6B'
                ? `Planifică generarea de assets pentru: "${input}". Include: logo (SVG), favicon, icons, illustrations, og-image. Specifică format, dimensiuni, pipeline de generare.`
                : input,
            phase
        );
        return { agentRole: this.role, phase, content: llmResponse };
    }
}
