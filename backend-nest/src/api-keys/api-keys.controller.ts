import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('API Keys')
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created successfully' })
  async createApiKey(@CurrentUser() user: RequestUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.createApiKey(user.id, user.workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all API keys for the workspace' })
  @ApiResponse({ status: 200, description: 'API keys retrieved' })
  async getApiKeys(@CurrentUser() user: RequestUser) {
    return this.apiKeysService.getApiKeys(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an API key by ID' })
  @ApiResponse({ status: 200, description: 'API key retrieved' })
  async getApiKey(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.apiKeysService.getApiKey(id, user.workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an API key' })
  @ApiResponse({ status: 204, description: 'API key deleted' })
  async deleteApiKey(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.apiKeysService.deleteApiKey(id, user.workspaceId, user.id);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate an API key' })
  @ApiResponse({ status: 200, description: 'API key regenerated' })
  async regenerateApiKey(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.apiKeysService.regenerateApiKey(id, user.workspaceId, user.id);
  }
}
