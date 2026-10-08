import { mkdir, writeFile } from 'node:fs/promises';
const assets = {
  "home-imgMenu": "https://www.figma.com/api/mcp/asset/542b97c3-7b10-4c5f-915f-5f491c4a711f.png",
  "home-imgSearch": "https://www.figma.com/api/mcp/asset/c98c0389-b944-400f-ae6f-e36994e69134.png",
  "home-imgBus": "https://www.figma.com/api/mcp/asset/a5509467-9d42-44f6-945a-6e4097ffd639.png",
  "home-imgTrain": "https://www.figma.com/api/mcp/asset/3e5653c7-6609-41a0-bbbc-7058b704324a.png",
  "home-imgTraveler": "https://www.figma.com/api/mcp/asset/b5f31f94-4fd6-4cee-bb9d-ca4adcda896a.png",
  "home-imgNotification": "https://www.figma.com/api/mcp/asset/badbfeec-677a-4824-b408-472fb0de39b9.png",
  "home-imgEllipse1": "https://www.figma.com/api/mcp/asset/3203a08b-ae5a-4f2d-8dfb-dc84637eff20.svg",
  "search-imgMyLocation": "https://www.figma.com/api/mcp/asset/781b855d-73c6-4d1d-a129-c11b478caa05.png",
  "search-imgLocation": "https://www.figma.com/api/mcp/asset/05bb6424-67cd-45db-9d4a-993c20609959.png",
  "search-imgLocation1": "https://www.figma.com/api/mcp/asset/d5123e15-7e07-40cd-9eff-661ae74ac0a2.png",
  "search-imgSortingArrows": "https://www.figma.com/api/mcp/asset/c9464c97-9407-468b-9f99-5a980f07fb68.png",
  "search-imgBack": "https://www.figma.com/api/mcp/asset/cf1bd542-ebb1-4ac4-bb24-a04585fb5b0e.png",
  "search-imgCash": "https://www.figma.com/api/mcp/asset/eb724fff-26a7-4855-b871-12b61f8809f9.png",
  "search-imgQuickModeOn": "https://www.figma.com/api/mcp/asset/4d89ed10-a776-4871-8261-ebfe5721077b.png",
  "search-imgPeople": "https://www.figma.com/api/mcp/asset/6a134e93-c870-4c93-b71b-10fe42459496.png",
  "search-imgEllipse3": "https://www.figma.com/api/mcp/asset/2c349898-8178-4b72-9e97-6a31eb2d279e.svg",
  "search-imgEllipse7": "https://www.figma.com/api/mcp/asset/929d7da9-3b94-41d3-a49c-fdecaf23bbee.svg"
};
await mkdir('assets/figma', { recursive: true });
for (const [name, url] of Object.entries(assets)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`Empty asset: ${name}`);
  await writeFile(`assets/figma/${name}.${url.split('.').pop()}`, bytes);
  console.log(`${name}: ${bytes.length} bytes`);
}
