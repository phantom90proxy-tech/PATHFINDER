import {Platform} from 'react-native';
import {createRoadRouter} from './roadRouting';

// Browsers supply their own User-Agent and Referer. Identify native HTTP requests.
export const requestRoadRoutes = createRoadRouter({headers: Platform.OS === 'web' ? {} : {'User-Agent': 'PATHFINDER/1.0'}});
