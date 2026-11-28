import { StreamableFile } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ url: '/api/v1/reports/fixture.csv' }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as any;

  it('leaves binary StreamableFile downloads intact', async () => {
    const file = new StreamableFile(Buffer.from('fixture,csv'));
    const handler = { handle: () => of(file) } as any;

    await expect(firstValueFrom(new ResponseInterceptor().intercept(context, handler))).resolves.toBe(file);
  });

  it('continues to wrap ordinary API data', async () => {
    const handler = { handle: () => of({ value: 1 }) } as any;

    await expect(firstValueFrom(new ResponseInterceptor().intercept(context, handler))).resolves.toMatchObject({
      success: true,
      statusCode: 200,
      data: { value: 1 },
    });
  });
});
