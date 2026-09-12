import { Navigate, Route, Routes } from 'react-router-dom';
import Chat from './pages/Chat';
import Coder from './pages/Coder';
import DeveloperHub from './pages/DeveloperHub';
import APIPlayground from './pages/APIPlayground';
import RemoteAgent from './pages/RemoteAgent';
import IDEIntegration from './pages/IDEIntegration';
import Imagine from './pages/Imagine';

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/Chat" replace />} />
    <Route path="/Home" element={<Navigate to="/Chat" replace />} />
    <Route path="/Chat" element={<Chat />} />
    <Route path="/Imagine" element={<Imagine />} />
    <Route path="/Coder" element={<Coder />} />
    <Route path="/DeveloperHub" element={<DeveloperHub />} />
    <Route path="/APIPlayground" element={<APIPlayground />} />
    <Route path="/RemoteAgent" element={<RemoteAgent />} />
    <Route path="/IDEIntegration" element={<IDEIntegration />} />
    <Route path="*" element={<Navigate to="/Chat" replace />} />
  </Routes>;
}
