import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';
import {
  UpdateWorkspaceDto,
  WorkspaceResponseDto,
  InviteMemberDto,
  WorkspaceMemberResponseDto,
  WorkspaceStatsDto,
} from './dto/workspace.dto';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * Get current user's workspace
   */
  @Get('me')
  async getMyWorkspace(@CurrentUser() user: RequestUser): Promise<WorkspaceResponseDto> {
    return this.workspaceService.getWorkspace(user.workspaceId, user.id);
  }

  /**
   * Get workspace by ID
   */
  @Get(':id')
  async getWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.getWorkspace(workspaceId, user.id);
  }

  /**
   * Update workspace details
   */
  @Patch(':id')
  async updateWorkspace(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.updateWorkspace(workspaceId, user.id, dto);
  }

  /**
   * Upload workspace logo
   */
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('logo'))
  async uploadLogo(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|gif|webp|svg\+xml)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.uploadLogo(workspaceId, user.id, file);
  }

  /**
   * Delete workspace logo
   */
  @Delete(':id/logo')
  @HttpCode(HttpStatus.OK)
  async deleteLogo(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.deleteLogo(workspaceId, user.id);
  }

  /**
   * Get workspace members
   */
  @Get(':id/members')
  async getMembers(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkspaceMemberResponseDto[]> {
    return this.workspaceService.getMembers(workspaceId, user.id);
  }

  /**
   * Invite a new member
   */
  @Post(':id/members')
  async inviteMember(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: InviteMemberDto,
  ): Promise<WorkspaceMemberResponseDto> {
    return this.workspaceService.inviteMember(workspaceId, user.id, dto);
  }

  /**
   * Remove a member
   */
  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.workspaceService.removeMember(workspaceId, user.id, memberId);
  }

  /**
   * Get workspace statistics
   */
  @Get(':id/stats')
  async getStats(
    @Param('id') workspaceId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<WorkspaceStatsDto> {
    return this.workspaceService.getStats(workspaceId, user.id);
  }
}
