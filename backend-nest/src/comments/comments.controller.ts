import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a comment' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  async create(@Request() req: any, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(req.user.workspaceId, req.user.id, dto);
  }

  @Get('portal/:portalId')
  @ApiOperation({ summary: 'Get comments for a portal' })
  @ApiResponse({ status: 200, description: 'Returns portal comments' })
  async findByPortal(
    @Request() req: any,
    @Param('portalId') portalId: string,
    @Query('widgetId') widgetId?: string,
    @Query('includeReplies') includeReplies?: boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.commentsService.findByPortal(portalId, req.user.workspaceId, {
      widgetId,
      includeReplies: includeReplies !== false,
      limit: limit ? parseInt(String(limit), 10) : 50,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a comment by ID' })
  @ApiResponse({ status: 200, description: 'Returns the comment' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.commentsService.findOne(id, req.user.workspaceId);
  }

  @Get(':id/thread')
  @ApiOperation({ summary: 'Get comment thread with all replies' })
  @ApiResponse({ status: 200, description: 'Returns the comment thread' })
  async getThread(@Request() req: any, @Param('id') id: string) {
    return this.commentsService.getThread(id, req.user.workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.commentsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.commentsService.delete(id, req.user.id, req.user.workspaceId);
  }
}
