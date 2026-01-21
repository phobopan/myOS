import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { ThreadView } from './components/ThreadView';

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-transparent text-white">
      <Titlebar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <ThreadView />
      </div>
    </div>
  );
}
