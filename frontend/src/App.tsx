import { BrowserRouter, Route, Routes } from 'react-router-dom';
import HostRoomPage from './pages/HostRoomPage';
import JoinPage from './pages/JoinPage';
import ParticipantWaitingPage from './pages/ParticipantWaitingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HostRoomPage />} />
        <Route path="/join/:joinCode" element={<JoinPage />} />
        <Route path="/room/:roomId/participant" element={<ParticipantWaitingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
