import { useState, useEffect } from 'react';
import { orchestratorStore, OrchestratorState } from '@/stores/OrchestratorStore';

export function useOrchestratorStore(): OrchestratorState {
  const [state, setState] = useState<OrchestratorState>(orchestratorStore.getState());

  useEffect(() => {
    return orchestratorStore.subscribe(setState);
  }, []);

  return state;
}
