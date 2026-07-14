import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from './i18n.service.js';
import { I18nContext } from './i18n.context.js';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [I18nService],
    }).compile();

    service = module.get<I18nService>(I18nService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should translate keys without arguments and fallback to vi', () => {
    const result = service.translate('errors.VALIDATION_ERROR');
    expect(result).toBe('Dữ liệu không hợp lệ');
  });

  it('should translate keys with parameter interpolation', () => {
    const untilStr = '2026-07-14';
    const result = service.translate('errors.USER_BANNED', { until: untilStr });
    expect(result).toBe(`Tài khoản của bạn đã bị khóa cho đến ${untilStr}`);
  });

  it('should resolve key in a specific locale using I18nContext', () => {
    I18nContext.run('en', () => {
      const result = service.translate('errors.VALIDATION_ERROR');
      expect(result).toBe('Invalid validation data');
    });

    I18nContext.run('ja', () => {
      const result = service.translate('errors.VALIDATION_ERROR');
      expect(result).toBe('入力データが無効です');
    });
  });

  it('should translate deep nested keys from game category', () => {
    I18nContext.run('vi', () => {
      const result = service.translate('game.ruleset.RIICHI');
      expect(result).toBe('Luật Nhật (Riichi)');
    });

    I18nContext.run('en', () => {
      const result = service.translate('game.ruleset.SICHUAN');
      expect(result).toBe('Sichuan Rules');
    });
  });

  it('should translate email subject and body with interpolation', () => {
    I18nContext.run('vi', () => {
      const subject = service.translate('email.verifyEmail.subject');
      const body = service.translate('email.verifyEmail.body', {
        name: 'Vy',
        code: '123456',
      });
      expect(subject).toBe('Xác thực tài khoản');
      expect(body).toBe('Chào Vy, mã xác thực của bạn là 123456');
    });
  });

  it('should fallback to key itself if key is not found', () => {
    const result = service.translate('errors.SOME_NON_EXISTING_KEY');
    expect(result).toBe('errors.SOME_NON_EXISTING_KEY');
  });
});
