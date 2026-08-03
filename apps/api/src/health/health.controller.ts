import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({
    description: 'Indica que a aplicação está no ar.',
    schema: {
      example: { status: 'ok' },
    },
  })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
