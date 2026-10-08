import {describe,it,expect} from 'vitest';
import {publicPublisherLink} from './publicPublisherLink';

describe('Public publisher links',()=>{
  it('preserves canonical real publisher links, strips tracker fragments and checks allowed hosts',()=>{
    expect(publicPublisherLink('https://www.bbc.com/news/a?utm_source=x#fragment',['bbc.com']))
      .toBe('https://www.bbc.com/news/a');
    expect(publicPublisherLink('https://other-news.org/a',['bbc.com'])).toBeNull();
  });
  it('rejects private and alternative numeric addresses, IPv6 and local DNS suffixes',()=>{
    const addresses=[
      'http://127.0.0.1/news','http://172.31.9.10/news',
      'https://100.100.100.100/news','http://0x7f000001/news',
      'http://2130706433/news','http://[::1]/news',
      'http://[::ffff:127.0.0.1]/news',
      'https://dev.home.arpa/news','https://service.localdomain/news',
      'https://news.internal/news','https://server.local/news',
      'https://news.invalid/news','https://pub.example/news',
      'https://localhost/news','https://site.test/news',
      'javascript:alert(1)','https://user:pass@bbc.com/news',
    ];
    for(const address of addresses) expect(publicPublisherLink(address),address).toBeNull();
  });
});
