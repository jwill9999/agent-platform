import { SchedulerDashboard } from '@/components/config/scheduler-dashboard';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default function SchedulerSettingsPage() {
  return (
    <>
      <SettingsNav />
      <SchedulerDashboard />
    </>
  );
}
