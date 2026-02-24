import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import VeritasDashboard from "@/components/VeritasDashboard";
import AgentsPanel from "@/components/AgentsPanel";
import ChatPanel from "@/components/ChatPanel";
import NotebookPanel from "@/components/NotebookPanel";

type View = 'dashboard' | 'veritas' | 'agents' | 'chat' | 'notebook';

const Index = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'veritas': return <VeritasDashboard />;
      case 'agents': return <AgentsPanel />;
      case 'chat': return <ChatPanel />;
      case 'notebook': return <NotebookPanel />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderView()}
      </main>
    </div>
  );
};

export default Index;
