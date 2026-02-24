// BaseAgent.ts — foundational class for all NEXUS AI agents
import { AgentOutputFilter, AgentContext } from '../behavioral/AgentOutputFilter';

export interface AgentOutput {
    agentRole: string;
    phase: string;
    content: string;
    metadata?: any;
}

export abstract class BaseAgent {
    public abstract readonly role: string;
    private outputFilter: AgentOutputFilter;

    constructor() {
        this.outputFilter = new AgentOutputFilter();
    }

    /**
     * Generates a response, but filters it through AgentOutputFilter (Rule #1)
     * before returning. If the filter rejects it, returns null (silence).
     */
    public async processAndRespond(input: string, context: AgentContext): Promise<AgentOutput | null> {
        const rawResponse = await this.generateResponse(input, context);

        const filterResult = this.outputFilter.shouldSend(rawResponse.content, context);
        if (!filterResult.send) {
            console.log(`[${this.role}] Output suppressed by filter: ${filterResult.reason}`);
            return null;
        }

        return rawResponse;
    }

    protected abstract generateResponse(input: string, context: AgentContext): Promise<AgentOutput>;
}
