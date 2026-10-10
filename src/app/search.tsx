import Pathfinder from '../Pathfinder';
import {SearchSessionContext, useSearchSession} from '../hooks/useSearchSession';
export default function Search(){
  const session = useSearchSession();
  return <SearchSessionContext.Provider value={session}><Pathfinder screen="search" /></SearchSessionContext.Provider>;
}
