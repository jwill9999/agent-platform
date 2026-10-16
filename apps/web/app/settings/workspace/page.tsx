import { LocalMonitoring } from '@/components/settings/local-monitoring';
import { WorkspaceDashboard } from '@/components/config/workspace-dashboard';

export default function WorkspaceSettingsPage() {
  return (
    <>
      <WorkspaceDashboard />
      <LocalMonitoring />
    </>
  );
}
