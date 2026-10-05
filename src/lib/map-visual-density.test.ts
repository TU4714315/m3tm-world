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
  it('groups only mapped APP news report symbols, not alerts or unlocated feeds',()=>{
    expect(publicClusterOptions('app-news')).toEqual({
      cluster:true,clusterRadius:48,clusterMaxZoom:8,
    });
    expect(publicClusterOptions('field-alerts')).toEqual({});
    expect(publicClusterOptions('live-news')).toEqual({});
  });
  it('does not group live flights, marine tracks, naval or satellite cells',()=>{
    for(const name of ['flights','military','maritime','naval-activity','satellites']){
      expect(publicClusterOptions(name)).toEqual({});
    }
  });
});
