import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import VeritasDashboard from "@/components/VeritasDashboard";
import AgentsPanel from "@/components/AgentsPanel";
import ChatPanel from "@/components/ChatPanel";
import ProjectsPanel from "@/components/ProjectsPanel";
import NotebookPanel from "@/components/NotebookPanel";
import HITLPanel from "@/components/HITLPanel";
import RepoPanel from "@/components/RepoPanel";
import DeployPanel from "@/components/DeployPanel";

type View = 'dashboard' | 'veritas' | 'agents' | 'chat' | 'projects' | 'notebook' | 'hitl' | 'repo' | 'deploy';

const Index = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const handleOpenProject = (_project: unknown) => {
    setCurrentView('chat');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'veritas': return <VeritasDashboard />;
      case 'agents': return <AgentsPanel />;
      case 'chat': return <ChatPanel />;
      case 'hitl': return <HITLPanel />;
      case 'projects': return <ProjectsPanel onOpenProject={handleOpenProject} />;
      case 'notebook': return <NotebookPanel />;
      case 'repo': return <RepoPanel />;
      case 'deploy': return <DeployPanel />;
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
