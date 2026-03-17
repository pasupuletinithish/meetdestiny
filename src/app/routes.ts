import { createBrowserRouter } from "react-router-dom";
import { Login } from './components/Login';
import { CheckIn } from './components/CheckIn';
import { DiscoveryHub } from './components/DiscoveryHub';
import { Lounge } from './components/Lounge';
import { TravelersList } from './components/TravelersList';
import { VehicleGroupChat, DestinationChat } from './components/GroupChat';
import { PrivateChat } from './components/PrivateChat';
import { Friends } from './components/Friends';
import { NearbyStops } from './components/NearbyStops';
import { SafetySOS } from './components/SafetySOS';
import { UserProfile } from './components/UserProfile';
import { NotifyMe } from './components/NotifyMe';
import { AdminPanel } from './components/AdminPanel';

export const router = createBrowserRouter([
  { path: '/', Component: Login },
  { path: '/check-in', Component: CheckIn },
  { path: '/discovery', Component: DiscoveryHub },
  { path: '/lounge', Component: Lounge },
  { path: '/lounge/travelers', Component: TravelersList },
  { path: '/lounge/group', Component: VehicleGroupChat },
  { path: '/lounge/destination', Component: DestinationChat },
  { path: '/lounge/private', Component: PrivateChat },
  { path: '/friends', Component: Friends },
  { path: '/nearby-stops', Component: NearbyStops },
  { path: '/safety-sos', Component: SafetySOS },
  { path: '/profile', Component: UserProfile },
  { path: '/notify-me', Component: NotifyMe },
  { path: '/private-chat', Component: PrivateChat },
  { path: '/admin', Component: AdminPanel },
]);