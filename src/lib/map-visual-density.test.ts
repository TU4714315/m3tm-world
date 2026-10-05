import {describe,it,expect} from 'vitest';
import {publicClusterOptions} from './map-visual-density';
describe('world public visual density',()=>{
  it('groups all cameras without removing camera records',()=>{
    expect(publicClusterOptions('cctv')).toEqual({
      cluster:true,clusterRadius:44,clusterMaxZoom:8,
    });
  });
  it('aggregates news-coded reports without confusing counts with evidence strength',()=>{
    for(const name of ['gdelt-events','civil-unrest']){
      expect(publicClusterOptions(name)).toEqual({
        cluster:true,clusterRadius:54,clusterMaxZoom:7,
      });
    }
  });
  it('does not group live flights, marine tracks, naval or satellite cells',()=>{
    for(const name of ['flights','military','maritime','naval-activity','satellites']){
      expect(publicClusterOptions(name)).toEqual({});
    }
  });
});
