import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  CreateAnnotationDto,
  UpdateAnnotationDto,
  ReplyAnnotationDto,
} from './dto/annotation.dto';

@Injectable()
export class AnnotationsService {
  private readonly logger = new Logger(AnnotationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async create(userId: string, dto: CreateAnnotationDto) {
    const annotation = await this.prisma.comment.create({
      data: {
        portalId: dto.portalId,
        widgetId: dto.widgetId,
        authorId: userId,
        content: dto.content,
        type: dto.type as any, // Enum
        positionX: dto.positionX,
        positionY: dto.positionY,
        dataPoint: dto.dataPoint || undefined,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    this.realtimeGateway.broadcastToPortal(
      dto.portalId,
      'annotation:created',
      annotation,
    );
    return annotation;
  }

  async findAll(portalId: string) {
    return this.prisma.comment.findMany({
      where: {
        portalId,
        parentId: null,
        isDeleted: false,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        replies: {
          where: { isDeleted: false },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateAnnotationDto) {
    const annotation = await this.prisma.comment.findUnique({ where: { id } });
    if (!annotation) throw new NotFoundException('Annotation not found');
    if (annotation.authorId !== userId) throw new ForbiddenException();

    const updated = await this.prisma.comment.update({
      where: { id },
      data: {
        ...dto,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    this.realtimeGateway.broadcastToPortal(
      annotation.portalId,
      'annotation:updated',
      updated,
    );
    return updated;
  }

  async reply(parentId: string, userId: string, dto: ReplyAnnotationDto) {
    const parent = await this.prisma.comment.findUnique({
      where: { id: parentId },
    });
    if (!parent) throw new NotFoundException('Parent annotation not found');

    const reply = await this.prisma.comment.create({
      data: {
        portalId: parent.portalId,
        widgetId: parent.widgetId,
        parentId: parentId,
        authorId: userId,
        content: dto.content,
        type: 'COMMENT' as any,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    this.realtimeGateway.broadcastToPortal(
      parent.portalId,
      'annotation:reply_added',
      {
        parentId,
        reply,
      },
    );

    return reply;
  }

  async delete(id: string, userId: string) {
    const annotation = await this.prisma.comment.findUnique({ where: { id } });
    if (!annotation) throw new NotFoundException('Annotation not found');
    if (annotation.authorId !== userId) throw new ForbiddenException();

    await this.prisma.comment.update({
      where: { id },
      data: { isDeleted: true },
    });

    this.realtimeGateway.broadcastToPortal(
      annotation.portalId,
      'annotation:deleted',
      { id },
    );
    return { success: true };
  }
}
