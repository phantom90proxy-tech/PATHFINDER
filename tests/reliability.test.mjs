import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocationAcquisition} from '../src/services/locationAcquisition.ts';
import {createSearchSession} from '../src/services/searchSession.ts';
import {tripEndpoints, tripTitle, routeLabel} from '../src/data/roadRoutes.ts';
import {routes} from '../src/data/routes.ts';

const fix = {latitude:14.6,longitude:121.1,accuracy:20,timestamp:100};
const provider = () => ({permission:async()=>({granted:true,canAskAgain:true}),servicesEnabled:async()=>true,position:async()=>fix});
const deferred = () => {let resolve; const promise=new Promise(r=>{resolve=r;}); return {promise,resolve};};

test('exit invalidates captured work even after a new focus', () => {
  const session=createSearchSession(); const current=session.capture();
  assert.equal(current(),true); session.exit(); assert.equal(current(),false);
  session.activate(); assert.equal(current(),false); assert.equal(session.capture()(),true);
});
test('location success and denial/disabled failures do not start unnecessary GPS work', async () => {
  assert.deepEqual(await createLocationAcquisition(provider())(),fix);
  for(const canAskAgain of [true,false]) {
    let positions=0;
    const acquire=createLocationAcquisition({...provider(),permission:async()=>({granted:false,canAskAgain}),position:async()=>{positions++;return fix;}});
    await assert.rejects(acquire(),canAskAgain?/denied/:/blocked/); assert.equal(positions,0);
  }
  await assert.rejects(createLocationAcquisition({...provider(),servicesEnabled:async()=>false})(),/services are off/);
});
for(const stage of ['permission','servicesEnabled','position']) {
  test(`deadline covers ${stage}, prevents overlapping calls and discards late completion`, async () => {
    const pending=deferred(); let calls=0,positions=0;
    const p={...provider(),position:async()=>{positions++;return fix;}};
    p[stage]=()=>{calls++;return pending.promise;};
    const acquire=createLocationAcquisition(p,10);
    const first=acquire();
    await assert.rejects(acquire(),/still finishing/);
    await assert.rejects(first,/timed out/);
    await assert.rejects(acquire(),/still finishing/); assert.equal(calls,1);
    pending.resolve(stage==='permission'?{granted:true,canAskAgain:true}:stage==='servicesEnabled'?true:fix);
    await new Promise(resolve=>setImmediate(resolve));
    if(stage!=='position')assert.equal(positions,0);
    assert.deepEqual(await acquire(),fix);
  });
}
test('location failures release lock and invalid coordinates are rejected', async () => {
  let fail=true;
  const acquire=createLocationAcquisition({...provider(),position:async()=>{if(fail)throw new Error('GPS failure');return fix;}});
  await assert.rejects(acquire(),/GPS failure/); fail=false; assert.deepEqual(await acquire(),fix);
  await assert.rejects(createLocationAcquisition({...provider(),position:async()=>({...fix,latitude:NaN})})(),/invalid position/);
});
test('demo direction is shared and road endpoints are never reversed a second time', () => {
  const route=routes[0]; const before=JSON.stringify(route);
  assert.deepEqual(tripEndpoints(route,true),{origin:route.destination,destination:route.origin});
  assert.equal(tripTitle(route,true),`${route.destination} → ${route.origin}`);
  assert.equal(routeLabel(route,true),`${route.destination} - ${route.origin}`);
  assert.equal(JSON.stringify(route),before);
  const road={...route,kind:'road'};
  assert.deepEqual(tripEndpoints(road,true),{origin:route.origin,destination:route.destination});
});
