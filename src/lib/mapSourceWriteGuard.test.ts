import {describe,it,expect,vi} from 'vitest';
import {createMapSourceWriteGuard} from './mapSourceWriteGuard';
const feature = (id:number, lng=44) => ({type:'Feature',properties:{id},geometry:{type:'Point',coordinates:[lng,15]}});
describe('public MapLibre GeoJSON update guard',()=>{
 it('avoids identical worker round trips while preserving all distinct features',()=>{
  const send=vi.fn(),src={setData:send},write=createMapSourceWriteGuard();
  expect(write(src,[feature(1)])).toBe(true);
  expect(write(src,[feature(1)])).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
  expect(write(src,[feature(1,46)])).toBe(true);
  expect(write(src,[feature(1,46),feature(2)])).toBe(true);
  expect(send.mock.lastCall?.[0].features).toHaveLength(2);
 });
 it('always sends the first update to a replaced style/source',()=>{
  const write=createMapSourceWriteGuard(),a={setData:vi.fn()},b={setData:vi.fn()};
  write(a,[]);write(a,[]);
  write(b,[]);expect(a.setData).toHaveBeenCalledTimes(1);
  expect(b.setData).toHaveBeenCalledTimes(1);
 });
 it('never suppresses a large source on the basis of a partial fingerprint',()=>{
  const write=createMapSourceWriteGuard(10),src={setData:vi.fn()};
  expect(write(src,[feature(1)])).toBe(true);
  expect(write(src,[feature(1)])).toBe(true);
  expect(src.setData).toHaveBeenCalledTimes(2);
 });
 it('resends a previously small cached value after a too-large intermediate update',()=>{
  const write=createMapSourceWriteGuard(120),src={setData:vi.fn()};
  write(src,[]);
  write(src,[feature(1),feature(2),feature(3)]);
  expect(write(src,[])).toBe(true);
 });
});
