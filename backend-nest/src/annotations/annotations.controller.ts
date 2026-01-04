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
import { AnnotationsService } from './annotations.service';
import {
  CreateAnnotationDto,
  UpdateAnnotationDto,
  ReplyAnnotationDto,
} from './dto/annotation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('annotations')
@UseGuards(JwtAuthGuard)
export class AnnotationsController {
  constructor(private readonly annotationsService: AnnotationsService) {}

  @Get(':portalId')
  async findAll(@Param('portalId') portalId: string) {
    return this.annotationsService.findAll(portalId);
  }

  @Post()
  async create(@Request() req, @Body() dto: CreateAnnotationDto) {
    return this.annotationsService.create(req.user.userId, dto);
  }

  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateAnnotationDto,
  ) {
    return this.annotationsService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return this.annotationsService.delete(id, req.user.userId);
  }

  @Post(':id/reply')
  async reply(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ReplyAnnotationDto,
  ) {
    return this.annotationsService.reply(id, req.user.userId, dto);
  }
}
