import {describe,expect,it} from 'vitest';
import {isArabicNews,isLikelyArabicText} from './newsLanguage';

describe('public news language guard',()=>{
  it('keeps Arabic and rejects Persian despite the shared Unicode block',()=>{
    expect(isLikelyArabicText('السعودية تعلن تحديثًا جديدًا')).toBe(true);
    expect(isLikelyArabicText('هدف قرار گرفتن نفت‌کش در خلیج فارس')).toBe(false);
  });
  it('honors known language markers while validating ar text',()=>{
    expect(isArabicNews('source','خبر عربي')).toBe(false);
    expect(isArabicNews('ar','خبر عربي')).toBe(true);
    expect(isArabicNews('ar','وقوع یک حادثه دریایی')).toBe(false);
  });
});
