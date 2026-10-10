# Local Figma asset inventory

Source: file `6wcFeFZWVwailFEAEsfVuv`, Home `7:2`, Search Route `12:74`.
Assets are downloaded originals, referenced statically by `src/assets.ts` and
rendered using React Native Image and the standard SVG transformer in
`src/Pathfinder.tsx`. No expiring asset URLs remain.

| Local name (under assets/figma) | Figma slot | Reference dimensions |
| --- | --- | --- |
| home-imgMenu.png | Home 12:32 | 33 × 34 |
| home-imgSearch.png | Home 12:21 | 31 × 36 |
| home-imgBus.png | Home 12:24, duplicate 19:42 | 39 × 39 |
| home-imgTrain.png | Home 12:25, duplicate 19:43 | 39 × 39 |
| home-imgTraveler.png | Home 12:26, duplicate 19:44 | 39 × 39 |
| home-imgNotification.png | Home 12:35 | 33 × 34 |
| home-imgEllipse1.svg | Home 12:31, 12:33 | intrinsic 65 × 65 |
| search-imgMyLocation.png | Search 15:8 | 39 × 39 |
| search-imgLocation.png | Search 15:10 | 39 × 39 |
| search-imgLocation1.png | Search 29:150–155 | 39 × 39 |
| search-imgSortingArrows.png | Search 15:18 | 40 × 34 |
| search-imgBack.png | Search 20:253 | 27 × 27 |
| search-imgCash.png | Search 42:260 | 20 × 20 |
| search-imgQuickModeOn.png | Search 42:261 | 20 × 20 |
| search-imgPeople.png | Search 42:262 | 20 × 20 |
| search-imgEllipse3.svg | Search connector dots | intrinsic 4 × 4 |
| search-imgEllipse7.svg | Search connector middle | intrinsic 8 × 8 |

The original SVG root dimensions are unedited. Images occupy scaled wrappers for
the current device viewport. Duplicate coincident Figma text/icon layers are
rendered once. Static map image 42:156 was intentionally replaced by MapView per
the user's requirement. Rendered-device geometry verification remains pending.
