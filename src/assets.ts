import Circle from '../assets/figma/home-imgEllipse1.svg';
import Dot from '../assets/figma/search-imgEllipse3.svg';
import BigDot from '../assets/figma/search-imgEllipse7.svg';
export const svgAssets={circle:Circle,dot:Dot,bigDot:BigDot};
export const assets = {
  menu:require('../assets/figma/home-imgMenu.png'), search:require('../assets/figma/home-imgSearch.png'),
  bus:require('../assets/figma/home-imgBus.png'), train:require('../assets/figma/home-imgTrain.png'),
  traveler:require('../assets/figma/home-imgTraveler.png'), notification:require('../assets/figma/home-imgNotification.png'),
  location:require('../assets/figma/search-imgLocation.png'),
  myLocation:require('../assets/figma/search-imgMyLocation.png'), pin:require('../assets/figma/search-imgLocation1.png'),
  swap:require('../assets/figma/search-imgSortingArrows.png'), back:require('../assets/figma/search-imgBack.png'),
  cash:require('../assets/figma/search-imgCash.png'), fast:require('../assets/figma/search-imgQuickModeOn.png'),
  people:require('../assets/figma/search-imgPeople.png'),
};
export type IconName = keyof typeof assets | keyof typeof svgAssets;
