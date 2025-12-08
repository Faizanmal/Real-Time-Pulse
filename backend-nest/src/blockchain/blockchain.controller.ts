import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlockchainService } from './blockchain.service';
import { MerkleTreeService } from './merkle-tree.service';

@ApiTags('Blockchain')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('blockchain')
export class BlockchainController {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly merkleService: MerkleTreeService,
  ) {}

  @Post('audit')
  @ApiOperation({ summary: 'Create audit entry' })
  async createAuditEntry(
    @Request() req: any,
    @Body()
    dto: {
      entityType: string;
      entityId: string;
      action: string;
      data: Record<string, any>;
    },
  ) {
    return this.blockchainService.createAuditEntry(req.user.workspaceId, {
      ...dto,
      userId: req.user.id,
    });
  }

  @Post('block')
  @ApiOperation({ summary: 'Force create a new block from pending entries' })
  async createBlock(@Request() req: any) {
    return this.blockchainService.createBlock(req.user.workspaceId);
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify blockchain integrity' })
  async verifyIntegrity(@Request() req: any) {
    return this.blockchainService.verifyChainIntegrity(req.user.workspaceId);
  }

  @Get('verify/:entryId')
  @ApiOperation({ summary: 'Verify a specific audit entry' })
  @ApiParam({ name: 'entryId', description: 'Audit entry ID' })
  async verifyEntry(@Request() req: any, @Param('entryId') entryId: string) {
    return this.blockchainService.verifyEntry(req.user.workspaceId, entryId);
  }

  @Get('audit/:entityType/:entityId')
  @ApiOperation({ summary: 'Get audit trail for an entity' })
  @ApiParam({
    name: 'entityType',
    description: 'Entity type (widget, portal, etc.)',
  })
  @ApiParam({ name: 'entityId', description: 'Entity ID' })
  async getAuditTrail(
    @Request() req: any,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.blockchainService.getEntityAuditTrail(
      req.user.workspaceId,
      entityType,
      entityId,
    );
  }

  @Get('compliance')
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'entityTypes', required: false, type: [String] })
  @ApiQuery({ name: 'actions', required: false, type: [String] })
  async generateComplianceReport(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('entityTypes') entityTypes?: string | string[],
    @Query('actions') actions?: string | string[],
  ) {
    return this.blockchainService.generateComplianceReport(
      req.user.workspaceId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        entityTypes: entityTypes
          ? Array.isArray(entityTypes)
            ? entityTypes
            : [entityTypes]
          : undefined,
        actions: actions
          ? Array.isArray(actions)
            ? actions
            : [actions]
          : undefined,
      },
    );
  }

  @Get('export')
  @ApiOperation({ summary: 'Export blockchain for external verification' })
  async exportChain(@Request() req: any) {
    return this.blockchainService.exportChain(req.user.workspaceId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import blockchain (for verification/migration)' })
  async importChain(
    @Request() req: any,
    @Body()
    dto: {
      chain: any[];
      pendingEntries: any[];
      checksum: string;
    },
  ) {
    const success = await this.blockchainService.importChain(
      req.user.workspaceId,
      dto,
    );
    return { success };
  }

  @Post('merkle/verify')
  @ApiOperation({ summary: 'Verify a Merkle proof' })
  async verifyMerkleProof(
    @Body()
    dto: {
      leafHash: string;
      proof: string[];
      root: string;
    },
  ) {
    const valid = this.merkleService.verifyProof(
      dto.leafHash,
      dto.proof,
      dto.root,
    );
    return { valid };
  }

  @Post('merkle/tree')
  @ApiOperation({ summary: 'Build Merkle tree from hashes' })
  async buildMerkleTree(@Body() dto: { hashes: string[] }) {
    return this.merkleService.buildTreeStructure(dto.hashes);
  }
}
