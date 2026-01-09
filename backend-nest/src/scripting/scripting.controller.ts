import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScriptingService } from './scripting.service';
import type { ScriptVersion } from './scripting.service';

class CreateScriptDto {
  name: string;
  description?: string;
  code: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  isPublic?: boolean;
  tags?: string[];
}

class UpdateScriptDto {
  name?: string;
  description?: string;
  code?: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  isPublic?: boolean;
  tags?: string[];
}

class ExecuteScriptDto {
  input?: Record<string, any>;
  widgetData?: any;
  portalData?: any;
}

class ValidateScriptDto {
  code: string;
}

@ApiTags('Scripting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('scripting')
export class ScriptingController {
  constructor(private readonly scriptingService: ScriptingService) {}

  @Post('scripts')
  @ApiOperation({ summary: 'Create a new script' })
  @ApiBody({ type: CreateScriptDto })
  async createScript(@Request() req: any, @Body() dto: CreateScriptDto) {
    return this.scriptingService.createScript(
      req.user.workspaceId,
      req.user.id,
      dto,
    );
  }

  @Get('scripts')
  @ApiOperation({ summary: 'Get all scripts for workspace' })
  async getScripts(@Request() req: any) {
    return this.scriptingService.getWorkspaceScripts(req.user.workspaceId);
  }

  @Get('scripts/:scriptId')
  @ApiOperation({ summary: 'Get a script by ID' })
  @ApiParam({ name: 'scriptId', description: 'Script ID' })
  async getScript(@Request() req: any, @Param('scriptId') scriptId: string) {
    return this.scriptingService.getScript(req.user.workspaceId, scriptId);
  }

  @Put('scripts/:scriptId')
  @ApiOperation({ summary: 'Update a script' })
  @ApiParam({ name: 'scriptId', description: 'Script ID' })
  @ApiBody({ type: UpdateScriptDto })
  async updateScript(
    @Request() req: any,
    @Param('scriptId') scriptId: string,
    @Body() dto: UpdateScriptDto,
  ) {
    return this.scriptingService.updateScript(
      req.user.workspaceId,
      scriptId,
      req.user.id,
      dto,
    );
  }

  @Delete('scripts/:scriptId')
  @ApiOperation({ summary: 'Delete a script' })
  @ApiParam({ name: 'scriptId', description: 'Script ID' })
  async deleteScript(@Request() req: any, @Param('scriptId') scriptId: string) {
    return this.scriptingService.deleteScript(req.user.workspaceId, scriptId);
  }

  @Post('scripts/:scriptId/execute')
  @ApiOperation({ summary: 'Execute a script' })
  @ApiParam({ name: 'scriptId', description: 'Script ID' })
  @ApiBody({ type: ExecuteScriptDto })
  async executeScript(
    @Request() req: any,
    @Param('scriptId') scriptId: string,
    @Body() dto: ExecuteScriptDto,
  ) {
    return this.scriptingService.executeScript(
      req.user.workspaceId,
      scriptId,
      dto,
    );
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate script code' })
  @ApiBody({ type: ValidateScriptDto })
  async validateScript(@Body() dto: ValidateScriptDto) {
    return this.scriptingService.validateScript(dto.code);
  }

  @Get('scripts/:scriptId/versions')
  @ApiOperation({ summary: 'Get script versions' })
  @ApiParam({ name: 'scriptId', description: 'Script ID' })
  async getScriptVersions(
    @Request() req: any,
    @Param('scriptId') scriptId: string,
  ): Promise<ScriptVersion[]> {
    return this.scriptingService.getScriptVersions(
      req.user.workspaceId,
      scriptId,
    );
  }

  @Post('scripts/:scriptId/rollback/:version')
  @ApiOperation({ summary: 'Rollback script to a specific version' })
  @ApiParam({ name: 'scriptId', description: 'Script ID' })
  @ApiParam({ name: 'version', description: 'Version number' })
  async rollbackScript(
    @Request() req: any,
    @Param('scriptId') scriptId: string,
    @Param('version') version: string,
  ) {
    return this.scriptingService.rollbackScript(
      req.user.workspaceId,
      scriptId,
      parseInt(version, 10),
      req.user.id,
    );
  }

  @Get('libraries')
  @ApiOperation({ summary: 'Get available library functions' })
  getLibraries() {
    return this.scriptingService.getAvailableLibraries();
  }
}
